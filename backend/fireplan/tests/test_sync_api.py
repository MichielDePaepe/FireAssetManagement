from types import SimpleNamespace
from unittest.mock import patch

import pytest
from cryptography.fernet import Fernet
from django.contrib.auth import get_user_model
from django.test import Client, override_settings
from django.urls import reverse

from fireplan.crypto import encrypt_secret
from fireplan.models import FireplanCredential

pytestmark = pytest.mark.django_db
TEST_KEY = Fernet.generate_key().decode("ascii")


@pytest.fixture
def admin_client(db):
    user = get_user_model().objects.create_superuser(
        username="sync-admin", email="sync-admin@example.test", password="test-password-123"
    )
    client = Client()
    client.force_login(user)
    return client


@pytest.fixture
def regular_client(db):
    user = get_user_model().objects.create_user(
        username="sync-user", password="test-password-123"
    )
    client = Client()
    client.force_login(user)
    return client


@override_settings(FIREPLAN_CREDENTIAL_KEY=TEST_KEY)
def test_staff_can_queue_sync_and_receive_celery_task_id(admin_client):
    FireplanCredential.objects.create(
        pk=1, login="fireplan-user", encrypted_password=encrypt_secret("secret")
    )
    with patch(
        "fireplan.views.synchronize_pagers.apply_async",
        return_value=SimpleNamespace(id="celery-task-123"),
    ) as queue_task:
        response = admin_client.post(reverse("fireplan-sync-pagers"))

    assert response.status_code == 202
    assert response.json() == {"task_id": "celery-task-123", "status": "PENDING"}
    queue_task.assert_called_once_with()


def test_sync_endpoint_is_staff_only(regular_client):
    assert regular_client.post(reverse("fireplan-sync-pagers")).status_code == 403
    assert Client().post(reverse("fireplan-sync-pagers")).status_code == 403


def test_sync_endpoint_requires_saved_fireplan_credentials(admin_client):
    with patch("fireplan.views.synchronize_pagers.apply_async") as queue_task:
        response = admin_client.post(reverse("fireplan-sync-pagers"))

    assert response.status_code == 400
    assert "Fireplan-inloggegevens" in response.json()["detail"]
    queue_task.assert_not_called()


@override_settings(FIREPLAN_CREDENTIAL_KEY=TEST_KEY)
def test_sync_endpoint_rejects_unusable_saved_password(admin_client):
    FireplanCredential.objects.create(
        pk=1, login="fireplan-user", encrypted_password="not-valid-encrypted-data"
    )
    with patch("fireplan.views.synchronize_pagers.apply_async") as queue_task:
        response = admin_client.post(reverse("fireplan-sync-pagers"))

    assert response.status_code == 400
    assert "onbruikbaar" in response.json()["detail"]
    queue_task.assert_not_called()


@override_settings(FIREPLAN_CREDENTIAL_KEY=TEST_KEY)
def test_sync_endpoint_rejects_unusable_saved_session(admin_client):
    FireplanCredential.objects.create(
        pk=1,
        login="fireplan-user",
        encrypted_password=encrypt_secret("secret"),
        encrypted_cookies=encrypt_secret("not-a-cookie-jar"),
    )
    with patch("fireplan.views.synchronize_pagers.apply_async") as queue_task:
        response = admin_client.post(reverse("fireplan-sync-pagers"))

    assert response.status_code == 400
    assert "sessie" in response.json()["detail"].lower()
    queue_task.assert_not_called()


def test_sync_endpoint_is_in_openapi_schema(admin_client):
    response = admin_client.get(reverse("schema"))

    assert response.status_code == 200
    assert b"/api/fireplan/sync-pagers/" in response.content
