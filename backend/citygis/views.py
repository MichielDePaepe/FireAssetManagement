import asyncio
import json

from asgiref.sync import sync_to_async
from django.db.models.functions import Coalesce
from django.http import HttpResponse, StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_GET
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CityGISSyncState, Vector, VectorStatus, VectorStatusHistory, Vehicle
from .serializers import (
    VectorSerializer,
    VectorStatusHistorySerializer,
    VectorStatusSerializer,
    VehicleSerializer,
)
from .tasks import refresh_citygis


def build_citygis_snapshot() -> dict:
    statuses = list(VectorStatus.objects.all())
    status_catalog = {status.code: status for status in statuses}
    vehicles = Vehicle.objects.all()
    vectors = Vector.objects.select_related("vehicle").all()
    sync_state = CityGISSyncState.objects.filter(pk=1).first()
    last_refreshed_at = sync_state.last_succeeded_at if sync_state else None
    if last_refreshed_at is None:
        last_seen_values = [
            Vehicle.objects.order_by("-last_seen_at")
            .values_list("last_seen_at", flat=True)
            .first(),
            Vector.objects.order_by("-last_seen_at")
            .values_list("last_seen_at", flat=True)
            .first(),
        ]
        last_refreshed_at = max((value for value in last_seen_values if value), default=None)

    return {
        "vehicles": VehicleSerializer(vehicles, many=True).data,
        "vectors": VectorSerializer(
            vectors, many=True, context={"status_catalog": status_catalog}
        ).data,
        "statuses": VectorStatusSerializer(statuses, many=True).data,
        "last_refreshed_at": last_refreshed_at,
        "sync_state": {
            "last_attempted_at": sync_state.last_attempted_at if sync_state else None,
            "last_succeeded_at": sync_state.last_succeeded_at if sync_state else None,
            "last_error": (sync_state.last_error or None) if sync_state else None,
        },
    }


@sync_to_async
def async_citygis_snapshot() -> dict:
    return build_citygis_snapshot()


class CityGISDataView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response(build_citygis_snapshot())


class CityGISVectorStatusHistoryView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, vector_id):
        vector = get_object_or_404(Vector, pk=vector_id)
        history = (
            VectorStatusHistory.objects.filter(vector=vector)
            .annotate(status_order_at=Coalesce("source_effective_at", "observed_at"))
            .order_by("-status_order_at", "-id")[:50]
        )
        serializer = VectorStatusHistorySerializer(
            history,
            many=True,
            context={
                "status_catalog": {status.code: status for status in VectorStatus.objects.all()},
                "now": timezone.now(),
            },
        )
        return Response(serializer.data)


class CityGISRefreshView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        task = refresh_citygis.apply_async()
        return Response(
            {"task_id": task.id, "status": "PENDING", "queued_at": timezone.now()},
            status=202,
        )


@require_GET
def citygis_events(request):
    if not request.user.is_authenticated or not request.user.is_staff:
        return HttpResponse(status=401 if not request.user.is_authenticated else 403)

    async def stream():
        previous = None
        last_heartbeat = timezone.now()
        yield "retry: 2000\n\n"
        while True:
            snapshot = await async_citygis_snapshot()
            payload = json.dumps(snapshot, default=str, sort_keys=True, separators=(",", ":"))
            if payload != previous:
                yield f"event: citygis\ndata: {payload}\n\n"
                previous = payload
            now = timezone.now()
            if (now - last_heartbeat).total_seconds() >= 15:
                yield ": keep-alive\n\n"
                last_heartbeat = now
            await asyncio.sleep(1)

    response = StreamingHttpResponse(stream(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache, no-transform"
    response["X-Accel-Buffering"] = "no"
    return response
