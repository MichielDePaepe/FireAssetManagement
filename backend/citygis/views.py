import asyncio
import json
from datetime import timedelta

from asgiref.sync import sync_to_async
from django.db.models.functions import Coalesce
from django.http import HttpResponse, StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_GET
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from assets.models import Pager, Radio
from assets.serializers import PagerSerializer, RadioSerializer
from inventory.models import ManagedRelationship

from .models import (
    CityGISSyncState,
    Location,
    Service,
    Vector,
    VectorStatus,
    VectorStatusHistory,
    Vehicle,
)
from .serializers import (
    LocationManagementSerializer,
    LocationSerializer,
    ServiceOptionSerializer,
    ServiceSerializer,
    VectorSerializer,
    VectorStatusHistorySerializer,
    VectorStatusSerializer,
    VehicleSerializer,
)
from .tasks import refresh_citygis


class LocationViewSet(viewsets.ModelViewSet):
    """Staff management for local location records and their parent hierarchy."""

    queryset = Location.objects.select_related("parent", "service").prefetch_related("children")
    serializer_class = LocationManagementSerializer
    permission_classes = [IsAdminUser]

    @action(detail=False, methods=["get"], url_path="services")
    def service_options(self, request):
        services = Service.objects.select_related("location").all()
        return Response(ServiceOptionSerializer(services, many=True).data)

    @action(detail=True, methods=["get"], url_path="overview")
    def overview(self, request, pk=None):
        location = self.get_object()
        service = location.service if location.kind == Location.Kind.POST else None
        vectors = (
            Vector.objects.select_related("service", "vehicle")
            .filter(service=service, is_current=True)
            .order_by("service_abbreviation", "vector_code")
            if service
            else Vector.objects.none()
        )
        statuses = {row.code: row for row in VectorStatus.objects.all()}
        window_end = timezone.now()
        window_start = window_end - timedelta(hours=24)
        vector_ids = [vector.pk for vector in vectors]
        managed_ids = [vector.managed_object_id for vector in vectors]
        vector_id_by_managed_id = {vector.managed_object_id: vector.pk for vector in vectors}
        assignments = ManagedRelationship.objects.filter(
            target_id__in=managed_ids,
            kind=ManagedRelationship.Kind.ASSIGNED_TO,
            ended_at__isnull=True,
            source__kind__in=["pager", "radio"],
        ).select_related("source")
        assets_by_vector = {vector_id: {"pagers": [], "radios": []} for vector_id in vector_ids}
        sources_by_kind = {"pager": [], "radio": []}
        for assignment in assignments:
            vector_id = vector_id_by_managed_id[assignment.target_id]
            sources_by_kind[assignment.source.kind].append(assignment.source_id)
            assets_by_vector[vector_id][f"{assignment.source.kind}s"].append(assignment.source_id)
        pagers = {
            pager.managed_object_id: pager
            for pager in Pager.objects.filter(managed_object_id__in=sources_by_kind["pager"])
            .select_related("type", "managed_object")
        }
        radios = {
            radio.managed_object_id: radio
            for radio in Radio.objects.filter(managed_object_id__in=sources_by_kind["radio"])
            .select_related("model", "model__manufacturer", "managed_object")
        }
        history_by_vector = {vector_id: [] for vector_id in vector_ids}
        history = (
            VectorStatusHistory.objects.filter(vector_id__in=vector_ids)
            .order_by("vector_id", "id")
        )
        for episode in history:
            history_by_vector[episode.vector_id].append(episode)

        vector_data = VectorSerializer(
            vectors, many=True, context={"status_catalog": statuses}
        ).data
        for data, vector in zip(vector_data, vectors, strict=True):
            related = assets_by_vector[vector.pk]
            data["pagers"] = PagerSerializer(
                [pagers[asset_id] for asset_id in related["pagers"] if asset_id in pagers],
                many=True,
            ).data
            data["radios"] = RadioSerializer(
                [radios[asset_id] for asset_id in related["radios"] if asset_id in radios],
                many=True,
            ).data
            data["status_periods"] = _status_periods(
                history_by_vector[vector.pk], window_start, window_end, statuses
            )
        return Response(
            {
                "location": LocationSerializer(location).data,
                "service": ServiceSerializer(service).data if service else None,
                "status_window": {"starts_at": window_start, "ends_at": window_end},
                "vectors": vector_data,
            }
        )

    def destroy(self, request, *args, **kwargs):
        location = self.get_object()
        if location.children.exists():
            return Response(
                {"detail": "Verwijder eerst de onderliggende locaties."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if location.service_id:
            return Response(
                {"detail": "Koppel eerst de CityGIS-dienst los."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


def _status_periods(episodes, window_start, window_end, status_catalog):
    """Clip observed status episodes to a fixed window and expose all gaps as unknown."""
    clipped = []
    for episode in episodes:
        starts_at = max(episode.source_effective_at or episode.observed_at, window_start)
        ends_at = min(episode.ended_at or window_end, window_end)
        if starts_at < ends_at:
            clipped.append((starts_at, ends_at, episode.status_code or None))

    clipped.sort(key=lambda period: (period[0], period[1]))
    periods = []
    cursor = window_start

    def append_period(starts_at, ends_at, code, catalog_status):
        period = _period_payload(starts_at, ends_at, code, catalog_status)
        if periods and periods[-1]["is_unknown"] and period["is_unknown"]:
            periods[-1]["ends_at"] = ends_at
            periods[-1]["duration_seconds"] += period["duration_seconds"]
        else:
            periods.append(period)

    for starts_at, ends_at, code in clipped:
        starts_at = max(starts_at, cursor)
        if starts_at > cursor:
            append_period(cursor, starts_at, None, None)
        if ends_at <= starts_at:
            continue
        catalog_status = status_catalog.get(code)
        append_period(starts_at, ends_at, code, catalog_status)
        cursor = ends_at
    if cursor < window_end:
        append_period(cursor, window_end, None, None)
    return periods


def _period_payload(starts_at, ends_at, code, catalog_status):
    return {
        "status_code": code,
        "status_description": catalog_status.description if catalog_status else None,
        "status_abbreviation": catalog_status.abbreviation if catalog_status else None,
        "status_color": catalog_status.color if catalog_status else None,
        "starts_at": starts_at,
        "ends_at": ends_at,
        "duration_seconds": max(0, int((ends_at - starts_at).total_seconds())),
        "is_unknown": code is None,
    }


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
