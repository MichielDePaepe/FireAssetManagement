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
        username="radio-sync-admin", email="radio-sync@example.test", password="test-password-123"
    )
    client = Client()
    client.force_login(user)
    return client


@pytest.fixture
def regular_client(db):
    user = get_user_model().objects.create_user(
        username="radio-sync-user", password="test-password-123"
    )
    client = Client()
    client.force_login(user)
    return client


@override_settings(FIREPLAN_CREDENTIAL_KEY=TEST_KEY)
def test_staff_can_queue_radio_sync_and_get_existing_celery_task_id(admin_client):
    FireplanCredential.objects.create(
        pk=1, login="fireplan-user", encrypted_password=encrypt_secret("secret")
    )
    with patch(
        "fireplan.views.synchronize_radios.apply_async",
        return_value=SimpleNamespace(id="radio-task-123"),
    ) as queue_task:
        response = admin_client.post(reverse("fireplan-sync-radios"))

    assert response.status_code == 202
    assert response.json() == {"task_id": "radio-task-123", "status": "PENDING"}
    queue_task.assert_called_once_with()


def test_radio_sync_endpoint_is_staff_only(regular_client):
    assert regular_client.post(reverse("fireplan-sync-radios")).status_code == 403
    assert Client().post(reverse("fireplan-sync-radios")).status_code == 403


def test_radio_sync_endpoint_requires_usable_saved_credentials(admin_client):
    response = admin_client.post(reverse("fireplan-sync-radios"))
    assert response.status_code == 400
    assert "FirePlan-inloggegevens" in response.json()["detail"]

    FireplanCredential.objects.create(
        pk=1, login="fireplan-user", encrypted_password="not-a-valid-secret"
    )
    response = admin_client.post(reverse("fireplan-sync-radios"))
    assert response.status_code == 400
    assert "onbruikbaar" in response.json()["detail"]
