import asyncio
import json
import os
from unittest.mock import AsyncMock, patch

import pytest
from celery.contrib.testing.worker import start_worker
from django.contrib.auth import get_user_model
from django.test import Client
from django.urls import reverse
from django_celery_results.models import TaskResult

from config.celery import app as celery_app
from tasks.tasks import example_task
from tasks.views import task_snapshot

pytestmark = pytest.mark.django_db


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user(username="test-user", password="test-password-123")


@pytest.fixture
def client(user):
    client = Client()
    client.force_login(user)
    return client


def test_task_start_returns_celery_id(client):
    with patch("tasks.views.example_task.apply_async") as apply_async:
        apply_async.return_value.id = "task-123"
        response = client.post(
            reverse("task-collection"),
            data={"duration_seconds": 12},
            content_type="application/json",
        )
    assert response.status_code == 202
    assert response.json() == {"task_id": "task-123", "status": "PENDING"}
    apply_async.assert_called_once_with(kwargs={"duration_seconds": 12})


def test_task_start_validates_duration(client):
    response = client.post(
        reverse("task-collection"), data={"duration_seconds": 2}, content_type="application/json"
    )
    assert response.status_code == 400


def test_task_api_requires_login():
    response = Client().get(reverse("task-collection"))
    assert response.status_code == 403


def test_task_status_endpoint_uses_celery_id(client):
    snapshot = {
        "task_id": "task-123",
        "task_name": "tasks.example_task",
        "status": "PROGRESS",
        "progress": {"current": 2, "total": 10, "percent": 20},
        "result": None,
        "error": None,
        "updated_at": None,
    }
    with patch("tasks.views.task_snapshot", return_value=snapshot):
        response = client.get(reverse("task-detail", args=["task-123"]))
    assert response.status_code == 200
    assert response.json()["progress"]["percent"] == 20


def test_progress_recorder_payload_is_exposed_without_an_extra_model():
    class ActiveResult:
        state = "PROGRESS"
        info = {
            "pending": False,
            "current": 4,
            "total": 10,
            "percent": 40,
            "description": "Working",
        }

        def failed(self):
            return False

        def successful(self):
            return False

    with patch("tasks.views.AsyncResult", return_value=ActiveResult()):
        snapshot = task_snapshot("task-123")
    assert snapshot["progress"] == {
        "pending": False,
        "current": 4,
        "total": 10,
        "percent": 40,
        "description": "Working",
    }


def test_example_task_records_progress_and_returns_result(monkeypatch):
    recorded = []
    monkeypatch.setattr("tasks.tasks.time.sleep", lambda _seconds: None)
    monkeypatch.setattr(
        "tasks.tasks.ProgressRecorder.set_progress",
        lambda _self, current, total, description=None: recorded.append(
            (current, total, description)
        ),
    )
    result = example_task.apply(kwargs={"duration_seconds": 5}, task_id="example-test-id")
    assert result.successful()
    assert result.result == {
        "message": "Example task completed successfully.",
        "duration_seconds": 5,
    }
    assert len(recorded) == 5
    assert recorded[-1][:2] == (5, 5)


def test_retry_and_timeout_policy_is_explicit():
    assert RuntimeError in example_task.autoretry_for
    assert example_task.max_retries >= 1
    assert example_task.soft_time_limit < example_task.time_limit


def test_task_failure_is_recorded_in_celery_result_backend(monkeypatch):
    monkeypatch.setattr("tasks.tasks.time.sleep", lambda _seconds: None)
    with patch(
        "tasks.tasks.ProgressRecorder.set_progress",
        side_effect=ValueError("deliberate test failure"),
    ):
        result = example_task.apply(
            kwargs={"duration_seconds": 5}, task_id="example-failure-id", throw=False
        )
    assert result.failed()
    assert "deliberate test failure" in str(result.result)


@pytest.mark.integration
@pytest.mark.skipif(
    os.getenv("RUN_CELERY_INTEGRATION") != "true", reason="Requires a live Redis broker"
)
def test_celery_worker_persists_progress_and_result():
    with start_worker(celery_app, concurrency=1, loglevel="WARNING", perform_ping_check=False):
        start_response = client.post(
            reverse("task-collection"),
            data=json.dumps({"duration_seconds": 5}),
            content_type="application/json",
        )
        assert start_response.status_code == 202
        task_id = start_response.json()["task_id"]

        sse_response = client.get(reverse("task-events", args=[task_id]))
        assert sse_response.status_code == 200

        async def collect_events():
            return [
                chunk.decode() if isinstance(chunk, bytes) else chunk
                async for chunk in sse_response.streaming_content
            ]

        chunks = asyncio.run(collect_events())

    events = [
        json.loads(line.removeprefix("data: "))
        for chunk in chunks
        for line in chunk.splitlines()
        if line.startswith("data: ")
    ]

    assert any(
        event["status"] == "PROGRESS" and event["progress"]["current"] > 0 for event in events
    )
    assert events[-1]["status"] == "SUCCESS"
    assert events[-1]["result"] == {
        "message": "Example task completed successfully.",
        "duration_seconds": 5,
    }
    assert TaskResult.objects.get(task_id=task_id).status == "SUCCESS"


def test_sse_endpoint_authenticates_and_streams_latest_state(client):
    snapshot = {
        "task_id": "task-123",
        "task_name": "tasks.example_task",
        "status": "SUCCESS",
        "progress": None,
        "result": {"message": "done"},
        "error": None,
        "updated_at": None,
    }
    with patch("tasks.views.async_task_snapshot", new=AsyncMock(return_value=snapshot)):
        response = client.get(reverse("task-events", args=["task-123"]))
        assert response.status_code == 200
        assert response["Content-Type"].startswith("text/event-stream")

        async def collect():
            return [chunk async for chunk in response.streaming_content]

        chunks = [
            chunk.decode() if isinstance(chunk, bytes) else chunk
            for chunk in asyncio.run(collect())
        ]
    assert any("retry: 2000" in chunk for chunk in chunks)
    assert any("event: task" in chunk and "done" in chunk for chunk in chunks)


def test_sse_rejects_anonymous_client():
    response = Client().get(reverse("task-events", args=["task-123"]))
    assert response.status_code == 401
