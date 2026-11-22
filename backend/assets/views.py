import csv
import io

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.permissions import SAFE_METHODS, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Issi,
    Manufacturer,
    Organization,
    Pager,
    PagerType,
    Radio,
    RadioModel,
    RadioSubscription,
    RicCode,
    TeiRange,
    normalize_tei,
)
from .scanning import fireplan_scan_candidates
from .serializers import (
    IssiManagementSerializer,
    ManufacturerSerializer,
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
        queryset = Radio.objects.select_related(
            "managed_object", "model", "model__manufacturer"
        ).prefetch_related(
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
        if query.isascii() and query.isdigit() and len(query) == 14:
            matches |= Q(tei=normalize_tei(query))
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
        matches = (
            Q(issi__icontains=query)
            | Q(alias__icontains=query)
            | Q(organization__name__icontains=query)
            | Q(subscription_history__radio__tei__icontains=query)
        )
        if query.isascii() and query.isdigit() and len(query) == 14:
            matches |= Q(subscription_history__radio__tei=normalize_tei(query))
        return queryset.filter(matches).distinct()


class OrganizationViewSet(viewsets.ModelViewSet):
    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer
    permission_classes = [IsStaffOrReadOnly]


class ManufacturerViewSet(viewsets.ModelViewSet):
    queryset = Manufacturer.objects.all()
    serializer_class = ManufacturerSerializer
    permission_classes = [IsStaffOrReadOnly]


class RadioModelViewSet(viewsets.ModelViewSet):
    queryset = RadioModel.objects.select_related("manufacturer").all()
    serializer_class = RadioModelManagementSerializer
    permission_classes = [IsStaffOrReadOnly]


class TeiRangeViewSet(viewsets.ModelViewSet):
    queryset = TeiRange.objects.select_related("model", "model__manufacturer").all()
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


class RadioSubscriptionImportView(APIView):
    permission_classes = [IsStaffOrReadOnly]

    def post(self, request):
        uploaded_file = request.FILES.get("file")
        if uploaded_file is None:
            return Response({"detail": "Selecteer een CSV-bestand."}, status=400)

        try:
            text = uploaded_file.read().decode("utf-8-sig")
        except UnicodeDecodeError:
            return Response({"detail": "Het CSV-bestand moet UTF-8-gecodeerd zijn."}, status=400)
        sample = text[:4096]
        try:
            delimiter = csv.Sniffer().sniff(sample, delimiters=";,\t").delimiter
        except csv.Error:
            delimiter = ";"

        rows = list(csv.reader(io.StringIO(text), delimiter=delimiter))
        if not rows:
            return Response({"detail": "Het CSV-bestand is leeg."}, status=400)
        headers = [value.strip().lstrip("\ufeff").upper() for value in rows[0]]
        required = ["TEI", "BRAND", "IDENTIFIER"]
        missing = [name for name in required if name not in headers]
        if missing:
            return Response(
                {"detail": f"Verplichte kolommen ontbreken: {', '.join(missing)}."}, status=400
            )
        # ASTRID exports can contain BRAND twice. The first is the radio brand.
        indexes = {name: headers.index(name) for name in required}
        rows_with_pairs = []
        skipped = 0
        issues = []
        invalid_rows = False
        for row_number, row in enumerate(rows[1:], start=2):
            if not any(value.strip() for value in row):
                skipped += 1
                continue
            if max(indexes.values()) >= len(row):
                skipped += 1
                invalid_rows = True
                issues.append(f"Rij {row_number}: de regel bevat te weinig kolommen.")
                continue
            if row[indexes["BRAND"]].strip().casefold() == "spare subscription":
                skipped += 1
                continue
            tei = normalize_tei(row[indexes["TEI"]].strip())
            issi_number = row[indexes["IDENTIFIER"]].strip()
            if len(tei) != 15 or not all(character in "0123456789" for character in tei):
                skipped += 1
                invalid_rows = True
                issues.append(f"Rij {row_number}: TEI moet na normalisatie precies 15 cijfers bevatten.")
                continue
            if not issi_number:
                skipped += 1
                invalid_rows = True
                issues.append(f"Rij {row_number}: IDENTIFIER (ISSI) is leeg.")
                continue
            rows_with_pairs.append((row_number, tei, issi_number))

        has_data_rows = any(any(value.strip() for value in row) for row in rows[1:])
        if not has_data_rows:
            return Response(
                {"detail": "Het CSV-bestand bevat geen gegevensregels."},
                status=400,
            )
        if invalid_rows:
            return Response(
                {
                    "detail": "Het CSV-bestand bevat ongeldige abonnementregels; er zijn geen wijzigingen toegepast.",
                    "skipped": skipped,
                    "issues": issues[:20],
                },
                status=400,
            )
        created_radios = 0
        created_issis = 0
        ended_subscriptions = 0
        imported_at = timezone.now()
        source_pairs = list(dict.fromkeys((tei, issi_number) for _, tei, issi_number in rows_with_pairs))
        pair_row_numbers = {}
        for row_number, tei, issi_number in rows_with_pairs:
            pair_row_numbers.setdefault((tei, issi_number), row_number)
        with transaction.atomic():
            radios_by_tei = {}
            issis_by_number = {}
            for tei, issi_number in source_pairs:
                radio, radio_created = Radio.objects.get_or_create(tei=tei)
                issi, issi_created = Issi.objects.get_or_create(
                    issi=issi_number,
                    defaults={"alias": issi_number},
                )
                created_radios += int(radio_created)
                created_issis += int(issi_created)
                radios_by_tei[tei] = radio
                issis_by_number[issi_number] = issi

            current = list(RadioSubscription.objects.filter(ended_at__isnull=True).select_related("radio", "issi"))
            current_pairs = {(item.radio.tei, item.issi.issi) for item in current}
            selected_pairs = []
            used_teis = set()
            used_issis = set()

            # Preserve current assignments that still appear in the source snapshot.
            for pair in source_pairs:
                if pair not in current_pairs:
                    continue
                selected_pairs.append(pair)
                used_teis.add(pair[0])
                used_issis.add(pair[1])

            # A radio and an ISSI can each have only one active assignment. If the CSV
            # contains competing pairs, keep an existing match where possible and
            # skip the remaining ambiguous rows rather than silently replacing it.
            for pair in source_pairs:
                if pair in current_pairs:
                    continue
                tei, issi_number = pair
                if tei in used_teis or issi_number in used_issis:
                    skipped += 1
                    row_number = pair_row_numbers[pair]
                    issues.append(f"Rij {row_number}: conflicteert met een andere radio/ISSI-koppeling in het bestand.")
                    continue
                selected_pairs.append(pair)
                used_teis.add(tei)
                used_issis.add(issi_number)

            selected_set = set(selected_pairs)
            ending_ids = [
                item.pk for item in current
                if (item.radio.tei, item.issi.issi) not in selected_set
            ]
            if ending_ids:
                ended_subscriptions = RadioSubscription.objects.filter(pk__in=ending_ids).update(ended_at=imported_at)

            for tei, issi_number in selected_pairs:
                if (tei, issi_number) in current_pairs:
                    continue
                RadioSubscription.assign(
                    radios_by_tei[tei],
                    issis_by_number[issi_number],
                    started_at=imported_at,
                )

        return Response({
            "rows": len(rows) - 1,
            "subscriptions": len(selected_pairs),
            "created_radios": created_radios,
            "created_issis": created_issis,
            "ended_subscriptions": ended_subscriptions,
            "skipped": skipped,
            "issues": issues[:20],
        })


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

        radio = Radio.objects.select_related(
            "managed_object", "model", "model__manufacturer"
        ).filter(
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
