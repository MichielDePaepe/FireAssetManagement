from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import SuivoDevice, SuivoSyncState, SuivoUnit
from .tasks import synchronize_suivo


class SuivoSyncView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        state = SuivoSyncState.objects.filter(pk=1).first()
        return Response(
            {
                "last_attempted_at": state.last_attempted_at if state else None,
                "last_succeeded_at": state.last_succeeded_at if state else None,
                "last_error": state.last_error if state else "",
                "unit_count": SuivoUnit.objects.count(),
                "device_count": SuivoDevice.objects.count(),
            }
        )

    def post(self, request):
        if not settings.SUIVO_CLIENT_ID or not settings.SUIVO_CLIENT_SECRET:
            return Response({"detail": "Suivo API-credentials zijn niet ingesteld."}, status=400)
        task = synchronize_suivo.apply_async()
        return Response(
            {"task_id": task.id, "status": "PENDING", "queued_at": timezone.now()},
            status=status.HTTP_202_ACCEPTED,
        )
