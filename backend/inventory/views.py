from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from assets.models import Pager, Radio, RicCode, RicCodeVectorRelationship
from assets.serializers import PagerSerializer, RicCodeSerializer
from citygis.models import Location, Vector, VectorStatus
from citygis.serializers import LocationSerializer, VectorSerializer

from .models import ManagedObject, ManagedRelationship
from .serializers import (
    RadioRelationshipHistorySerializer,
    RadioRelationshipSerializer,
    VectorAssignmentSerializer,
)


class InventorySnapshotView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        locations = Location.objects.select_related("parent", "service").all()
        statuses = {row.code: row for row in VectorStatus.objects.all()}
        vectors = list(Vector.objects.select_related("service__location", "vehicle").all())
        vector_by_managed_object = {row.managed_object_id: row.pk for row in vectors}

        vector_assignments = ManagedRelationship.objects.filter(
            kind=ManagedRelationship.Kind.ASSIGNED_TO,
            source__kind=ManagedObject.Kind.PAGER,
            ended_at__isnull=True,
        ).select_related("source", "target")
        assigned_vector_by_pager_object = {
            row.source_id: vector_by_managed_object.get(row.target_id) for row in vector_assignments
        }
        active_code_links = {
            row.code_id: row.vector_id
            for row in RicCodeVectorRelationship.objects.filter(ended_at__isnull=True)
        }

        pagers = []
        for pager in Pager.objects.select_related("managed_object", "type").all():
            row = PagerSerializer(pager).data
            row["assigned_vector_id"] = assigned_vector_by_pager_object.get(pager.managed_object_id)
            pagers.append(row)

        ric_codes = []
        for code in RicCode.objects.all():
            row = RicCodeSerializer(code).data
            row["vector_id"] = active_code_links.get(code.pk)
            ric_codes.append(row)

        return Response(
            {
                "locations": LocationSerializer(locations, many=True).data,
                "vectors": VectorSerializer(
                    vectors, many=True, context={"status_catalog": statuses}
                ).data,
                "pagers": pagers,
                "ric_codes": ric_codes,
            }
        )


def validate_vector_assignment(request):
    serializer = VectorAssignmentSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    vector_id = serializer.validated_data["vector_id"]
    if vector_id is None:
        return None
    return Vector.objects.select_related("managed_object").get(pk=vector_id)


class PagerVectorAssignmentView(APIView):
    permission_classes = [IsAdminUser]

    def put(self, request, pager_id):
        pager = get_object_or_404(Pager.objects.select_related("managed_object"), pk=pager_id)
        vector = validate_vector_assignment(request)
        if vector is not None:
            ManagedRelationship.assign_operationally(pager.managed_object, vector.managed_object)
        else:
            self._unassign(pager.managed_object)
        return Response({"vector_id": vector.pk if vector else None})

    @staticmethod
    def _unassign(managed_object):
        with transaction.atomic():
            locked_object = ManagedObject.objects.select_for_update().get(pk=managed_object.pk)
            relation = ManagedRelationship.objects.filter(
                source=locked_object,
                kind=ManagedRelationship.Kind.ASSIGNED_TO,
                ended_at__isnull=True,
            ).first()
            if relation:
                relation.ended_at = timezone.now()
                relation.save(update_fields=["ended_at"])


class RicCodeVectorAssignmentView(APIView):
    permission_classes = [IsAdminUser]

    def put(self, request, code_id):
        code = get_object_or_404(RicCode, pk=code_id)
        vector = validate_vector_assignment(request)
        if vector is not None:
            RicCodeVectorRelationship.assign(code, vector)
        else:
            with transaction.atomic():
                locked_code = RicCode.objects.select_for_update().get(pk=code.pk)
                current = RicCodeVectorRelationship.objects.filter(
                    code=locked_code, ended_at__isnull=True
                ).first()
                if current:
                    current.ended_at = timezone.now()
                    current.save(update_fields=["ended_at"])
        return Response({"vector_id": vector.pk if vector else None}, status=status.HTTP_200_OK)


class RadioRelationshipView(APIView):
    def get_permissions(self):
        return [IsAdminUser() if self.request.method == "PUT" else IsAuthenticated()]

    def get_radio(self, radio_id):
        return get_object_or_404(Radio.objects.select_related("managed_object"), pk=radio_id)

    def get(self, request, radio_id):
        radio = self.get_radio(radio_id)
        history = ManagedRelationship.objects.filter(source=radio.managed_object).select_related(
            "target", "target_location"
        )
        rows = list(history)
        current = next((row for row in rows if row.ended_at is None), None)
        return Response(
            {
                "current": RadioRelationshipHistorySerializer(current).data if current else None,
                "history": RadioRelationshipHistorySerializer(rows, many=True).data,
            }
        )

    def put(self, request, radio_id):
        radio = self.get_radio(radio_id)
        serializer = RadioRelationshipSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        try:
            if values["target"] is None and values["target_location"] is None:
                ManagedRelationship.clear(radio.managed_object, values["kind"])
            else:
                ManagedRelationship.relate(
                    radio.managed_object,
                    values["kind"],
                    target=values["target"],
                    target_location=values["target_location"],
                )
        except (ValueError, DjangoValidationError, serializers.ValidationError) as error:
            raise serializers.ValidationError({"detail": str(error)}) from error
        return self.get(request, radio_id)
