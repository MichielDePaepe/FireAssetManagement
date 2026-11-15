import socket
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.urls import reverse

from printers.models import Printer

pytestmark = pytest.mark.django_db


@pytest.fixture
def staff_client(db):
    user = get_user_model().objects.create_user(
        username="printer-admin", password="test-password-123", is_staff=True
    )
    authenticated_client = Client()
    authenticated_client.force_login(user)
    return authenticated_client


@pytest.fixture
def client(db):
    user = get_user_model().objects.create_user(
        username="printer-user", password="test-password-123"
    )
    authenticated_client = Client()
    authenticated_client.force_login(user)
    return authenticated_client


def test_staff_can_create_printer(staff_client):
    response = staff_client.post(
        reverse("printer-list"),
        data={
            "name": "Magazijn",
            "manufacturer": "Brother",
            "model": "PT-P900W",
            "ip_address": "192.0.2.25",
            "port": 9100,
            "tape_width_mm": 12,
        },
        content_type="application/json",
    )

    assert response.status_code == 201
    assert response.json()["name"] == "Magazijn"
    assert response.json()["model"] == "PT-P900W"


def test_staff_can_list_update_and_delete_printer(staff_client):
    created = staff_client.post(
        reverse("printer-list"),
        data={
            "name": "Werkplaats",
            "manufacturer": "Brother",
            "model": "PT-P900W",
            "ip_address": "192.0.2.26",
        },
        content_type="application/json",
    )
    printer_id = created.json()["id"]

    listed = staff_client.get(reverse("printer-list"))
    retrieved = staff_client.get(reverse("printer-detail", args=[printer_id]))
    updated = staff_client.patch(
        reverse("printer-detail", args=[printer_id]),
        data={"name": "Werkplaats Noord", "tape_width_mm": 36},
        content_type="application/json",
    )
    deleted = staff_client.delete(reverse("printer-detail", args=[printer_id]))

    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert retrieved.status_code == 200
    assert updated.status_code == 200
    assert updated.json()["name"] == "Werkplaats Noord"
    assert deleted.status_code == 204


@pytest.mark.parametrize(
    "overrides",
    [
        {"name": "   "},
        {"manufacturer": "Acme"},
        {"model": "PT-P750W"},
        {"ip_address": "not-an-ip"},
        {"port": 0},
        {"port": 65536},
        {"tape_width_mm": 9},
    ],
)
def test_invalid_printer_values_are_rejected(staff_client, overrides):
    values = {
        "name": "Werkplaats",
        "manufacturer": "Brother",
        "model": "PT-P900W",
        "ip_address": "192.0.2.27",
        "port": 9100,
        "tape_width_mm": 12,
    }
    values.update(overrides)

    response = staff_client.post(
        reverse("printer-list"), data=values, content_type="application/json"
    )

    assert response.status_code == 400


def test_printer_api_requires_staff_access(client):
    assert client.get(reverse("printer-list")).status_code == 403


def test_printer_api_requires_authentication():
    assert Client().get(reverse("printer-list")).status_code == 403


@pytest.fixture
def configured_printer(db):
    return Printer.objects.create(
        name="Magazijn",
        manufacturer="Brother",
        model="PT-P900W",
        ip_address="192.0.2.25",
        port=9111,
        tape_width_mm=12,
    )


def test_staff_connection_check_reports_reachable_and_uses_bounded_timeout(
    staff_client, configured_printer
):
    with patch("printers.views.socket.create_connection") as connect:
        response = staff_client.post(
            reverse("printer-check-connection", args=[configured_printer.pk])
        )

    assert response.status_code == 200
    assert response.json() == {"status": "reachable", "detail": "TCP-poort bereikbaar."}
    connect.assert_called_once_with(("192.0.2.25", 9111), timeout=2)


def test_connection_check_reports_timeout(staff_client, configured_printer):
    with patch("printers.views.socket.create_connection", side_effect=socket.timeout):
        response = staff_client.post(
            reverse("printer-check-connection", args=[configured_printer.pk])
        )

    assert response.status_code == 200
    assert response.json() == {"status": "timeout", "detail": "Geen antwoord binnen 2 seconden."}


def test_connection_check_reports_connection_failure(staff_client, configured_printer):
    with patch(
        "printers.views.socket.create_connection",
        side_effect=OSError("sensitive low-level detail"),
    ):
        response = staff_client.post(
            reverse("printer-check-connection", args=[configured_printer.pk])
        )

    assert response.status_code == 200
    assert response.json() == {"status": "unreachable", "detail": "Verbinding mislukt."}
    assert "sensitive" not in response.content.decode()


def test_connection_check_requires_staff_access(client, configured_printer):
    response = client.post(
        reverse("printer-check-connection", args=[configured_printer.pk])
    )

    assert response.status_code == 403


def test_staff_can_send_test_label_using_saved_printer(
    staff_client, configured_printer
):
    with patch("printers.views.send_test_label") as print_label:
        response = staff_client.post(
            reverse("printer-print-test-label", args=[configured_printer.pk])
        )

    assert response.status_code == 200
    assert response.json() == {
        "status": "sent",
        "detail": "Testlabel verzonden; fysieke afdruk niet bevestigd.",
    }
    print_label.assert_called_once()
    assert print_label.call_args.args[0].pk == configured_printer.pk


def test_test_label_driver_failure_is_reported_as_failure(
    staff_client, configured_printer
):
    with patch(
        "printers.views.send_test_label",
        side_effect=OSError("sensitive low-level detail"),
    ):
        response = staff_client.post(
            reverse("printer-print-test-label", args=[configured_printer.pk])
        )

    assert response.status_code == 502
    assert response.json() == {"status": "failed", "detail": "Afdrukken mislukt."}
    assert "sensitive" not in response.content.decode()


def test_test_label_action_requires_staff_access(client, configured_printer):
    response = client.post(
        reverse("printer-print-test-label", args=[configured_printer.pk])
    )

    assert response.status_code == 403
