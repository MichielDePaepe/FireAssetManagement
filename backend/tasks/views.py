import asyncio
import json
import logging
from typing import Any

from asgiref.sync import sync_to_async
from celery.result import AsyncResult
from django.db import connection
from django.http import HttpRequest, HttpResponse, StreamingHttpResponse
from django.utils import timezone
from django.views.decorators.http import require_GET
from django_celery_results.models import TaskResult
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .serializers import StartTaskSerializer
from .tasks import example_task

logger = logging.getLogger(__name__)
TRACKED_TASK_NAMES = (
    "tasks.example_task",
    "fireplan.sync_pagers",
    "fireplan.sync_inventories",
    "citygis.refresh",
)


@require_GET
def health(_request: HttpRequest) -> HttpResponse:
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception:
        logger.exception("Health check failed")
        return HttpResponse("database unavailable", status=503, content_type="text/plain")
    return HttpResponse("ok", content_type="text/plain")


def task_snapshot(task_id: str) -> dict[str, Any]:
    result = AsyncResult(task_id)
    info = result.info
    progress = None
    if isinstance(info, dict):
        progress = info.get("progress")
        if progress is None and {"current", "total", "percent"}.issubset(info):
            progress = info
    error = None
    task_result = None
    if result.failed():
        error = str(info)[:500]
    elif result.successful():
        task_result = info
    row = (
        TaskResult.objects.filter(task_id=task_id)
        .only("task_name", "date_done", "date_started")
        .first()
    )
    updated_at = row.date_done.isoformat() if row and row.date_done else None
    if result.state == "STARTED" and row and row.date_started:
        updated_at = row.date_started.isoformat()
    return {
        "task_id": task_id,
        "task_name": row.task_name if row else "tasks.example_task",
        "status": result.state,
        "progress": progress,
        "result": task_result,
        "error": error,
        "updated_at": updated_at,
    }


@api_view(["POST", "GET"])
@permission_classes([IsAuthenticated])
def task_collection(request):
    if request.method == "POST":
        serializer = StartTaskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        task = example_task.apply_async(kwargs=serializer.validated_data)
        logger.info(
            "Started example task", extra={"task_id": task.id, "user": request.user.get_username()}
        )
        return Response({"task_id": task.id, "status": "PENDING"}, status=status.HTTP_202_ACCEPTED)

    rows = TaskResult.objects.filter(task_name__in=TRACKED_TASK_NAMES).order_by(
        "-date_created"
    )[:50]
    data = [task_snapshot(row.task_id) for row in rows]
    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def task_detail(request, task_id: str):
    snapshot = task_snapshot(task_id)
    if snapshot["task_name"] not in TRACKED_TASK_NAMES:
        return Response({"detail": "Task not found."}, status=status.HTTP_404_NOT_FOUND)
    return Response(snapshot)


@sync_to_async
def async_task_snapshot(task_id: str) -> dict[str, Any]:
    return task_snapshot(task_id)


def encode_event(snapshot: dict[str, Any]) -> str:
    return f"event: task\ndata: {json.dumps(snapshot, default=str, separators=(',', ':'))}\n\n"


@require_GET
def task_events(request: HttpRequest, task_id: str):
    if not request.user.is_authenticated:
        return HttpResponse(status=401)

    async def stream():
        last_payload = None
        last_heartbeat = timezone.now()
        yield "retry: 2000\n\n"
        while True:
            snapshot = await async_task_snapshot(task_id)
            payload = json.dumps(snapshot, default=str, sort_keys=True)
            if payload != last_payload:
                yield encode_event(snapshot)
                last_payload = payload
            now = timezone.now()
            if (now - last_heartbeat).total_seconds() >= 15:
                yield ": keep-alive\n\n"
                last_heartbeat = now
            if snapshot["status"] in {"SUCCESS", "FAILURE", "REVOKED"}:
                return
            await asyncio.sleep(1)

    response = StreamingHttpResponse(stream(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache, no-transform"
    response["X-Accel-Buffering"] = "no"
    return response
