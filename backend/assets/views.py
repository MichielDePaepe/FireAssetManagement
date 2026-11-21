from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Pager, PagerType, Radio, RicCode
from .scanning import fireplan_scan_candidates
from .serializers import PagerSerializer, PagerTypeSerializer, RadioSerializer, RicCodeSerializer


class PagerViewSet(viewsets.ModelViewSet):
    queryset = Pager.objects.select_related("type").all()
    serializer_class = PagerSerializer
    permission_classes = [IsAuthenticated]


class PagerScanLookupView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        raw_scan = request.data.get("scanned_line")
        if not isinstance(raw_scan, str) or not raw_scan.strip():
            return Response({"message": "A scanned Fireplan QR URL is required."}, status=400)

        candidates = fireplan_scan_candidates(raw_scan)
        if not candidates:
            return Response(
                {"message": "The scanned value is not a recognized Fireplan QR URL."}, status=400
            )

        pager = Pager.objects.filter(fireplan_qr_url__in=candidates).first()
        if pager is None:
            return Response({"message": "No pager matches this Fireplan QR URL."}, status=404)

        return Response({"raw_scan": raw_scan, "pager": PagerSerializer(pager).data})


class RadioScanLookupView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        raw_scan = request.data.get("scanned_line")
        if not isinstance(raw_scan, str) or not raw_scan.strip():
            return Response({"message": "A scanned FirePlan QR URL is required."}, status=400)

        candidates = fireplan_scan_candidates(raw_scan)
        if not candidates:
            return Response(
                {"message": "The scanned value is not a recognized FirePlan QR URL."}, status=400
            )

        radio = Radio.objects.select_related("managed_object", "model").filter(
            fireplan_qr_url__in=candidates
        ).first()
        if radio is None:
            return Response({"message": "No radio matches this FirePlan QR URL."}, status=404)
        return Response({"raw_scan": raw_scan, "radio": RadioSerializer(radio).data})


class PagerTypeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PagerType.objects.all()
    serializer_class = PagerTypeSerializer
    permission_classes = [IsAuthenticated]


class RicCodeViewSet(viewsets.ModelViewSet):
    queryset = RicCode.objects.all()
    serializer_class = RicCodeSerializer
    permission_classes = [IsAuthenticated]
