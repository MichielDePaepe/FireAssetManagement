from django.db.models import Q
from rest_framework import serializers, status, viewsets
from rest_framework.permissions import SAFE_METHODS, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Issi,
    Organization,
    Pager,
    PagerType,
    Radio,
    RadioModel,
    RadioSubscription,
    RicCode,
    TeiRange,
)
from .scanning import fireplan_scan_candidates
from .serializers import (
    IssiManagementSerializer,
    OrganizationSerializer,
    PagerSerializer,
    PagerTypeSerializer,
    RadioManagementSerializer,
    RadioModelManagementSerializer,
    RadioSerializer,
    RadioSubscriptionSerializer,
    RicCodeSerializer,
    TeiRangeSerializer,
)


class PagerViewSet(viewsets.ModelViewSet):
    queryset = Pager.objects.select_related("type").all()
    serializer_class = PagerSerializer
    permission_classes = [IsAuthenticated]


class IsStaffOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated) and (
            request.method in SAFE_METHODS or request.user.is_staff
        )


class RadioViewSet(viewsets.ModelViewSet):
    serializer_class = RadioManagementSerializer
    permission_classes = [IsStaffOrReadOnly]

    def get_queryset(self):
        queryset = Radio.objects.select_related("managed_object", "model").prefetch_related(
            "subscription_history__issi"
        )
        query = self.request.query_params.get("search", "").strip()
        if not query:
            return queryset
        matches = (
            Q(tei__icontains=query)
            | Q(manufacturer__icontains=query)
            | Q(model_name__icontains=query)
            | Q(model__manufacturer__icontains=query)
            | Q(model__name__icontains=query)
            | Q(fireplan_qr_url__icontains=query)
            | Q(subscription_history__issi__issi__icontains=query)
            | Q(subscription_history__issi__alias__icontains=query)
            | Q(
                managed_object__outgoing_relationships__target__vector__vector_code__icontains=query
            )
            | Q(managed_object__outgoing_relationships__target__vehicle__alphacode__icontains=query)
            | Q(managed_object__outgoing_relationships__target_location__name__icontains=query)
        )
        if query.isdecimal():
            matches |= Q(fireplan_id=int(query))
        return queryset.filter(matches).distinct()


class IssiViewSet(viewsets.ModelViewSet):
    serializer_class = IssiManagementSerializer
    permission_classes = [IsStaffOrReadOnly]

    def get_queryset(self):
        queryset = Issi.objects.select_related("organization").prefetch_related(
            "subscription_history__radio"
        )
        query = self.request.query_params.get("search", "").strip()
        if not query:
            return queryset
        return queryset.filter(
            Q(issi__icontains=query)
            | Q(alias__icontains=query)
            | Q(organization__name__icontains=query)
            | Q(subscription_history__radio__tei__icontains=query)
        ).distinct()


class OrganizationViewSet(viewsets.ModelViewSet):
    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer
    permission_classes = [IsStaffOrReadOnly]


class RadioModelViewSet(viewsets.ModelViewSet):
    queryset = RadioModel.objects.all()
    serializer_class = RadioModelManagementSerializer
    permission_classes = [IsStaffOrReadOnly]


class TeiRangeViewSet(viewsets.ModelViewSet):
    queryset = TeiRange.objects.select_related("model").all()
    serializer_class = TeiRangeSerializer
    permission_classes = [IsStaffOrReadOnly]


class RadioSubscriptionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = RadioSubscription.objects.select_related("radio", "issi").all()
    serializer_class = RadioSubscriptionSerializer
    permission_classes = [IsStaffOrReadOnly]

    def create(self, request, *args, **kwargs):
        serializer = RadioSubscriptionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if "radio" not in data or "issi" not in data:
            raise serializers.ValidationError(
                {"detail": "Geef radio_id en issi_id op voor een bevestigde koppeling."}
            )
        subscription = RadioSubscription.assign(data["radio"], data["issi"])
        return Response(
            RadioSubscriptionSerializer(subscription).data,
            status=status.HTTP_201_CREATED,
        )


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
