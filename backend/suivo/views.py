from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import SuivoDevice, SuivoSyncState, SuivoUnit
from .tasks import synchronize_suivo


def _explicit_value(value, names):
    if isinstance(value, dict):
        for key, item in value.items():
            if key.casefold() in names:
                return item
            found = _explicit_value(item, names)
            if found is not None:
                return found
    elif isinstance(value, list):
        for item in value:
            found = _explicit_value(item, names)
            if found is not None:
                return found
    return None


def _sync_metadata():
    state = SuivoSyncState.objects.filter(pk=1).first()
    has_snapshot = SuivoUnit.objects.exists() or SuivoDevice.objects.exists()
    return {
        "last_succeeded_at": state.last_succeeded_at if state else None,
        "last_error": state.last_error if state else "",
        "stale": bool(state and state.last_error and has_snapshot),
    }


def _unit_status(unit):
    status_data = unit.status_data or {}
    return {
        "last_seen_at": unit.last_seen_at,
        "position_at": unit.position_at,
        "position": unit.position,
        "battery_level": _explicit_value(
            status_data, {"battery-level", "battery_level", "batterylevel"}
        ),
        "battery_voltage": _explicit_value(
            status_data, {"battery-voltage", "battery_voltage", "batteryvoltage"}
        ),
    }


class SuivoAssetListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        from citygis.models import Vehicle

        vehicles = list(Vehicle.objects.filter(is_current=True).order_by("alphacode", "id"))
        normalized = {}
        for vehicle in vehicles:
            normalized.setdefault(vehicle.alphacode.strip().casefold(), []).append(vehicle)
        rows = []
        for unit in SuivoUnit.objects.prefetch_related("devices"):
            matches = normalized.get(unit.name.strip().casefold(), [])
            match_status = "matched" if len(matches) == 1 else "multiple" if matches else "none"
            rows.append(
                {
                    "external_id": unit.external_id,
                    "name": unit.name,
                    "match_status": match_status,
                    "vehicle": (
                        {"id": matches[0].pk, "name": matches[0].alphacode.strip()}
                        if len(matches) == 1
                        else None
                    ),
                    "matches": [
                        {"id": vehicle.pk, "name": vehicle.alphacode.strip()} for vehicle in matches
                    ],
                    "devices": [
                        {
                            "external_id": device.external_id,
                            "imei": device.imei,
                            "type": device.device_type,
                        }
                        for device in unit.devices.all()
                    ],
                    **_unit_status(unit),
                }
            )
        return Response({"results": rows, **_sync_metadata()})


class SuivoDeviceListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        rows = []
        devices = SuivoDevice.objects.select_related("unit").all()
        for device in devices:
            unit_data = None
            telemetry = {
                "last_seen_at": None,
                "position_at": None,
                "position": None,
                "battery_level": None,
                "battery_voltage": None,
            }
            if device.unit_id:
                unit_data = {
                    "external_id": device.unit.external_id,
                    "name": device.unit.name,
                }
                telemetry = _unit_status(device.unit)
            rows.append(
                {
                    "external_id": device.external_id,
                    "imei": device.imei,
                    "device_type": device.device_type,
                    "unit": unit_data,
                    **telemetry,
                }
            )
        return Response({"results": rows, **_sync_metadata()})


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
