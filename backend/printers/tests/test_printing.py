from datetime import datetime
from unittest.mock import patch

import pytest

from printers.models import Printer
from printers.services import _test_label_lines, print_test_label

pytestmark = pytest.mark.django_db


def test_test_label_uses_saved_model_address_port_width_and_text():
    printer = Printer(
        name="Magazijn",
        manufacturer="Brother",
        model="PT-P900W",
        ip_address="192.0.2.25",
        port=9101,
        tape_width_mm=12,
    )
    now = datetime(2026, 11, 14, 12, 34)
    assert _test_label_lines(printer.name, now) == [
        "Magazijn",
        "2026-11-14 12:34",
    ]

    with patch("printers.services.timezone.localtime", return_value=now), patch(
        "printers.services.BrotherLabel"
    ) as driver_class:
        print_test_label(printer)

    driver_class.assert_called_once_with(
        device="PT-P900W",
        target="tcp://192.0.2.25:9101",
        backend="network",
    )
    driver = driver_class.return_value
    driver.print.assert_called_once()
    call = driver.print.call_args
    assert call.kwargs["type"] == "12"
    assert len(call.kwargs["images"]) == 1
    image = call.kwargs["images"][0]
    assert image.mode == "1"
    assert image.width == round(12 * 360 / 25.4)
    assert image.height > image.width
    assert image.getbbox() is not None


def test_driver_exception_is_not_swallowed():
    printer = Printer(
        name="Magazijn",
        manufacturer="Brother",
        model="PT-P900W",
        ip_address="192.0.2.25",
        port=9100,
        tape_width_mm=24,
    )
    with patch("printers.services.BrotherLabel") as driver_class:
        driver_class.return_value.print.side_effect = OSError("offline")

        with pytest.raises(OSError, match="offline"):
            print_test_label(printer)
