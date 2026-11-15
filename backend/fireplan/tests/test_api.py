from unittest.mock import patch

import pytest
from cryptography.fernet import Fernet
from django.contrib.auth import get_user_model
from django.test import Client, override_settings
from django.urls import reverse

from fireplan.crypto import decrypt_secret
from fireplan.models import FireplanCredential

pytestmark = pytest.mark.django_db
TEST_KEY = Fernet.generate_key().decode("ascii")


@pytest.fixture
def admin_client(db):
    user = get_user_model().objects.create_superuser(
        username="fireplan-admin", email="admin@example.test", password="test-password-123"
    )
    client = Client()
    client.force_login(user)
    return client


@pytest.fixture
def regular_client(db):
    user = get_user_model().objects.create_user(
        username="fireplan-user", password="test-password-123"
    )
    client = Client()
    client.force_login(user)
    return client


@override_settings(FIREPLAN_CREDENTIAL_KEY=TEST_KEY)
def test_admin_can_save_credentials_but_secrets_are_never_returned(admin_client):
    response = admin_client.put(
        reverse("fireplan-credentials"),
        data={"login": "fireplan-user", "password": "a-secret-password"},
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.json()["password_configured"] is True
    assert "password" not in response.json()
    credential = FireplanCredential.objects.get(pk=1)
    assert credential.encrypted_password != "a-secret-password"
    assert decrypt_secret(credential.encrypted_password) == "a-secret-password"

    get_response = admin_client.get(reverse("fireplan-credentials"))
    assert get_response.status_code == 200
    assert "encrypted_password" not in get_response.json()
    assert "a-secret-password" not in get_response.content.decode()


@override_settings(FIREPLAN_CREDENTIAL_KEY=TEST_KEY)
def test_blank_password_keeps_existing_secret(admin_client):
    admin_client.put(
        reverse("fireplan-credentials"),
        data={"login": "fireplan-user", "password": "a-secret-password"},
        content_type="application/json",
    )
    original = FireplanCredential.objects.get(pk=1).encrypted_password

    response = admin_client.put(
        reverse("fireplan-credentials"),
        data={"login": "fireplan-user", "password": ""},
        content_type="application/json",
    )

    assert response.status_code == 200
    assert FireplanCredential.objects.get(pk=1).encrypted_password == original

    changed_login = admin_client.put(
        reverse("fireplan-credentials"),
        data={"login": "a-different-user", "password": ""},
        content_type="application/json",
    )
    assert changed_login.status_code == 400


def test_fireplan_settings_are_staff_only(regular_client):
    assert regular_client.get(reverse("fireplan-credentials")).status_code == 403
    assert regular_client.put(
        reverse("fireplan-credentials"),
        data={"login": "user", "password": "secret"},
        content_type="application/json",
    ).status_code == 403
    assert regular_client.post(reverse("fireplan-test-login")).status_code == 403


@override_settings(FIREPLAN_CREDENTIAL_KEY=TEST_KEY)
def test_fireplan_login_reuses_and_persists_encrypted_session(admin_client):
    admin_client.put(
        reverse("fireplan-credentials"),
        data={"login": "fireplan-user", "password": "a-secret-password"},
        content_type="application/json",
    )
    with patch(
        "fireplan.views.ensure_fireplan_session",
        return_value=("[{\"name\":\"session\",\"value\":\"cookie-secret\"}]", False),
    ) as login:
        response = admin_client.post(reverse("fireplan-test-login"))

    assert response.status_code == 200
    assert response.json()["session_reused"] is False
    login.assert_called_once_with("fireplan-user", "a-secret-password", None)
    credential = FireplanCredential.objects.get(pk=1)
    assert credential.encrypted_cookies != "cookie-secret"
    assert decrypt_secret(credential.encrypted_cookies) == (
        "[{\"name\":\"session\",\"value\":\"cookie-secret\"}]"
    )
    assert "cookie-secret" not in response.content.decode()

    with patch(
        "fireplan.views.ensure_fireplan_session",
        return_value=("existing-session", True),
    ) as reuse:
        reused_response = admin_client.post(reverse("fireplan-test-login"))

    assert reused_response.status_code == 200
    assert reused_response.json()["session_reused"] is True
    reuse.assert_called_once_with(
        "fireplan-user",
        "a-secret-password",
        "[{\"name\":\"session\",\"value\":\"cookie-secret\"}]",
    )


def test_login_endpoint_requires_saved_credentials(admin_client):
    response = admin_client.post(reverse("fireplan-test-login"))

    assert response.status_code == 400


def test_anonymous_user_cannot_read_fireplan_settings():
    response = Client().get(reverse("fireplan-credentials"))

    assert response.status_code == 403
