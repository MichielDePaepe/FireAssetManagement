import logging
import socket

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from .models import Printer
from .serializers import PrinterSerializer
from .services import print_test_label as send_test_label

logger = logging.getLogger(__name__)


class PrinterViewSet(viewsets.ModelViewSet):
    queryset = Printer.objects.all()
    serializer_class = PrinterSerializer
    permission_classes = [IsAdminUser]

    @action(detail=True, methods=["post"], url_path="check-connection")
    def check_connection(self, request, pk=None):
        printer = self.get_object()
        try:
            connection = socket.create_connection(
                (printer.ip_address, printer.port), timeout=2
            )
            connection.close()
        except TimeoutError:
            return Response(
                {"status": "timeout", "detail": "Geen antwoord binnen 2 seconden."}
            )
        except OSError:
            return Response(
                {"status": "unreachable", "detail": "Verbinding mislukt."}
            )
        return Response(
            {"status": "reachable", "detail": "TCP-poort bereikbaar."}
        )

    @action(detail=True, methods=["post"], url_path="print-test-label")
    def print_test_label(self, request, pk=None):
        printer = self.get_object()
        try:
            send_test_label(printer)
        except Exception:
            logger.exception(
                "Printer test label failed",
                extra={"printer_id": printer.pk, "printer_model": printer.model},
            )
            return Response(
                {"status": "failed", "detail": "Afdrukken mislukt."}, status=502
            )
        return Response(
            {
                "status": "sent",
                "detail": "Testlabel verzonden; fysieke afdruk niet bevestigd.",
            }
        )
