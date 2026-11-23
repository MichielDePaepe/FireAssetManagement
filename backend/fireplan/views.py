from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from assets.models import RadioSubscription

from .client import (
    FireplanInventoryError,
    FireplanLoginError,
    deserialize_cookie_jar,
    ensure_fireplan_session,
)
from .crypto import FireplanEncryptionError, decrypt_secret, encrypt_secret
from .inventory_client import FireplanInventoryClient
from .inventory_mapping import parse_fireplan_datetime
from .inventory_relationships import resolve_inventory_relationship
from .models import FireplanCredential, FireplanInventory
from .tasks import synchronize_inventories, synchronize_pagers, synchronize_radios


class FireplanCredentialSerializer(serializers.Serializer):
    login = serializers.CharField(max_length=255)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    def validate(self, attrs):
        instance = self.context.get("instance")
        password = attrs.get("password", "")
        if not instance and not password:
            raise serializers.ValidationError({"password": "Vul het Fireplan-wachtwoord in."})
        if instance and attrs["login"] != instance.login and not password:
            raise serializers.ValidationError(
                {"password": "Vul het wachtwoord opnieuw in wanneer de login wijzigt."}
            )
        if password:
            try:
                encrypt_secret(password)
            except FireplanEncryptionError as error:
                raise serializers.ValidationError({"password": str(error)}) from error
        return attrs


class FireplanCredentialsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        credential = FireplanCredential.objects.filter(pk=1).first()
        return Response(
            {
                "login": credential.login if credential else "",
                "password_configured": bool(credential and credential.encrypted_password),
                "session_configured": bool(credential and credential.encrypted_cookies),
                "session_checked_at": credential.session_checked_at if credential else None,
                "updated_at": credential.updated_at if credential else None,
            }
        )

    def put(self, request):
        credential = FireplanCredential.objects.filter(pk=1).first()
        serializer = FireplanCredentialSerializer(
            data=request.data, context={"instance": credential}
        )
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        credential = credential or FireplanCredential(pk=1)
        login = values["login"].strip()
        if login != credential.login:
            credential.encrypted_cookies = ""
            credential.session_checked_at = None
        credential.login = login
        if values.get("password"):
            credential.encrypted_password = encrypt_secret(values["password"])
            credential.encrypted_cookies = ""
            credential.session_checked_at = None
        credential.updated_at = timezone.now()
        credential.save()
        return Response(
            {
                "login": credential.login,
                "password_configured": bool(credential.encrypted_password),
                "session_configured": bool(credential.encrypted_cookies),
                "session_checked_at": credential.session_checked_at,
                "updated_at": credential.updated_at,
            }
        )


class FireplanTestLoginView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        credential = FireplanCredential.objects.filter(pk=1).first()
        if not credential or not credential.encrypted_password:
            return Response(
                {"detail": "Stel eerst Fireplan-inloggegevens in."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            password = decrypt_secret(credential.encrypted_password)
            cookie_data = (
                decrypt_secret(credential.encrypted_cookies)
                if credential.encrypted_cookies
                else None
            )
            cookie_data, reused = ensure_fireplan_session(credential.login, password, cookie_data)
        except (FireplanEncryptionError, FireplanLoginError) as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        credential.encrypted_cookies = encrypt_secret(cookie_data)
        credential.session_checked_at = timezone.now()
        credential.save(update_fields=["encrypted_cookies", "session_checked_at", "updated_at"])
        detail = (
            "Bestaande Fireplan-sessie is nog geldig en werd hergebruikt."
            if reused
            else "Opnieuw aangemeld bij Fireplan; de sessie is versleuteld opgeslagen."
        )
        return Response(
            {
                "ok": True,
                "detail": detail,
                "session_reused": reused,
                "session_configured": True,
                "session_checked_at": credential.session_checked_at,
            }
        )


class FireplanPagerSyncView(APIView):
    permission_classes = [IsAdminUser]

    @extend_schema(
        request=None,
        responses={
            202: inline_serializer(
                name="FireplanPagerSyncAccepted",
                fields={
                    "task_id": serializers.CharField(),
                    "status": serializers.ChoiceField(choices=["PENDING"]),
                },
            )
        },
    )
    def post(self, request):
        credential = FireplanCredential.objects.filter(pk=1).first()
        if not credential or not credential.encrypted_password:
            return Response(
                {"detail": "Stel eerst Fireplan-inloggegevens in."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            decrypt_secret(credential.encrypted_password)
            if credential.encrypted_cookies:
                cookie_data = decrypt_secret(credential.encrypted_cookies)
                deserialize_cookie_jar(cookie_data)
        except (FireplanEncryptionError, FireplanLoginError) as error:
            return Response(
                {"detail": f"Fireplan-inloggegevens zijn onbruikbaar: {error}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        task = synchronize_pagers.apply_async()
        return Response(
            {"task_id": task.id, "status": "PENDING"},
            status=status.HTTP_202_ACCEPTED,
        )


class FireplanRadioSyncView(APIView):
    permission_classes = [IsAdminUser]

    @extend_schema(
        request=None,
        responses={
            202: inline_serializer(
                name="FireplanRadioSyncAccepted",
                fields={
                    "task_id": serializers.CharField(),
                    "status": serializers.ChoiceField(choices=["PENDING"]),
                },
            )
        },
    )
    def post(self, request):
        credential = FireplanCredential.objects.filter(pk=1).first()
        if not credential or not credential.encrypted_password:
            return Response(
                {"detail": "Stel eerst FirePlan-inloggegevens in."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            decrypt_secret(credential.encrypted_password)
            if credential.encrypted_cookies:
                cookie_data = decrypt_secret(credential.encrypted_cookies)
                deserialize_cookie_jar(cookie_data)
        except (FireplanEncryptionError, FireplanLoginError) as error:
            return Response(
                {"detail": f"FirePlan-inloggegevens zijn onbruikbaar: {error}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        task = synchronize_radios.apply_async()
        return Response(
            {"task_id": task.id, "status": "PENDING"},
            status=status.HTTP_202_ACCEPTED,
        )


class FireplanInventoryPageQuerySerializer(serializers.Serializer):
    page = serializers.IntegerField(min_value=1, default=1, required=False)
    page_size = serializers.IntegerField(min_value=1, max_value=100, default=25, required=False)


class FireplanInventoryPeriodSerializer(serializers.Serializer):
    start_date = serializers.DateField(input_formats=["%Y-%m-%d"])
    end_date = serializers.DateField(input_formats=["%Y-%m-%d"])

    def validate(self, attrs):
        if attrs["start_date"] > attrs["end_date"]:
            raise serializers.ValidationError(
                {"end_date": "Einddatum moet gelijk aan of na de begindatum liggen."}
            )
        return attrs


class FireplanInventoryListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        query = FireplanInventoryPageQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        page = query.validated_data["page"]
        page_size = query.validated_data["page_size"]
        credential = FireplanCredential.objects.filter(pk=1).first()
        if not credential or not credential.encrypted_password:
            return Response(
                {"detail": "Stel eerst Fireplan-inloggegevens in."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            password = decrypt_secret(credential.encrypted_password)
            cookie_data = (
                decrypt_secret(credential.encrypted_cookies)
                if credential.encrypted_cookies
                else None
            )
            client = FireplanInventoryClient(credential.login, password, cookie_data)
            source_rows, total = client.fetch_inventory_summary_page(
                first=(page - 1) * page_size,
                rows=page_size,
            )
        except FireplanEncryptionError:
            return Response(
                {"detail": "Fireplan-inloggegevens zijn onbruikbaar."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except (FireplanLoginError, FireplanInventoryError, OSError, TimeoutError):
            return Response(
                {"detail": "FirePlan-inventarissamenvattingen konden niet worden opgehaald."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        refreshed_cookie_data = client.refreshed_cookie_data()
        update_fields = ["session_checked_at", "updated_at"]
        if refreshed_cookie_data != cookie_data:
            credential.encrypted_cookies = encrypt_secret(refreshed_cookie_data)
            update_fields.append("encrypted_cookies")
        credential.session_checked_at = timezone.now()
        credential.save(update_fields=update_fields)

        inventory_uuids = [row["uuid"] for row in source_rows]
        local_rows = {
            row.uuid: row
            for row in FireplanInventory.objects.filter(uuid__in=inventory_uuids).select_related(
                "vector"
            )
        }
        results = []
        for row in source_rows:
            local = local_rows.get(row["uuid"])
            closed_at = parse_fireplan_datetime(row["closedAt"])
            if local and local.last_successful_sync_at:
                vector = local.vector
            else:
                vector = resolve_inventory_relationship(
                    row.get("vehicleAlphaCode") or "", closed_at
                ).vector
            results.append(
                {
                    "uuid": row["uuid"],
                    "vehicle_alpha_code": row.get("vehicleAlphaCode") or "",
                    "inventory_type_name": row.get("inventoryTypeName") or "",
                    "done_in_name": row.get("doneInName") or "",
                    "done_by_full_name": row.get("doneByFullName") or "",
                    "overseen_by_full_name": row.get("overseenByFullName") or "",
                    "created_at": parse_fireplan_datetime(row["createdAt"])
                    if row.get("createdAt")
                    else None,
                    "closed_at": closed_at,
                    "vector_code": vector.vector_code if vector else None,
                    "vector_name": vector.name if vector else "",
                    "updated_at": parse_fireplan_datetime(row["updatedAt"])
                    if row.get("updatedAt")
                    else None,
                    "has_incident_reports": row.get("hasIncidentReports"),
                    "is_complete_after_completion": row.get("isCompleteAfterCompletion"),
                    "is_complete_before_completion": row.get("isCompleteBeforeCompletion"),
                    "is_quantity_count_excluded": row.get("isQuantityCountExcluded"),
                    "is_test_standard": row.get("isTestStandard"),
                    "remaining_missing_followed_count": row.get("remainingMissingFollowedCount"),
                    "sync_status": local.sync_status if local else "not_synced",
                    "last_successful_sync_at": local.last_successful_sync_at if local else None,
                    "last_error": local.last_error if local else "",
                }
            )
        return Response({"count": total, "page": page, "page_size": page_size, "results": results})


class FireplanInventoryDetailView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, inventory_uuid):
        inventory = get_object_or_404(
            FireplanInventory.objects.select_related("vehicle", "vector").prefetch_related(
                "radio_observations__radio",
                Prefetch(
                    "radio_observations__radio__subscription_history",
                    queryset=RadioSubscription.objects.filter(ended_at__isnull=True).select_related(
                        "issi"
                    ),
                    to_attr="active_fireplan_subscriptions",
                ),
            ),
            uuid=inventory_uuid,
            last_successful_sync_at__isnull=False,
        )
        return Response(
            {
                "uuid": inventory.uuid,
                "vehicle_alpha_code": inventory.vehicle_alpha_code,
                "inventory_type_name": inventory.inventory_type_name,
                "done_in_name": inventory.done_in_name,
                "done_by_full_name": inventory.done_by_full_name,
                "overseen_by_full_name": inventory.overseen_by_full_name,
                "source_created_at": inventory.source_created_at,
                "source_closed_at": inventory.source_closed_at,
                "source_updated_at": inventory.source_updated_at,
                "has_incident_reports": inventory.has_incident_reports,
                "is_complete_after_completion": inventory.is_complete_after_completion,
                "is_complete_before_completion": inventory.is_complete_before_completion,
                "is_quantity_count_excluded": inventory.is_quantity_count_excluded,
                "is_test_standard": inventory.is_test_standard,
                "remaining_missing_followed_count": inventory.remaining_missing_followed_count,
                "vehicle": (
                    {
                        "alphacode": inventory.vehicle.alphacode,
                        "fireplan_id": inventory.vehicle.fireplan_id,
                    }
                    if inventory.vehicle_id
                    else None
                ),
                "vector": (
                    {
                        "vector_code": inventory.vector.vector_code,
                        "name": inventory.vector.name,
                        "abbreviation": inventory.vector.abbreviation,
                    }
                    if inventory.vector_id
                    else None
                ),
                "sync_status": inventory.sync_status,
                "last_attempted_at": inventory.last_attempted_at,
                "last_successful_sync_at": inventory.last_successful_sync_at,
                "last_error": inventory.last_error,
                "radio_items": inventory.radio_items,
                "radio_observations": [
                    {
                        "fireplan_item_id": observation.fireplan_item_id,
                        "item_type_id": observation.item_type_id,
                        "serial_number": observation.serial_number,
                        "radio": (
                            {
                                "id": observation.radio_id,
                                "tei": observation.radio.tei,
                                "issi_alias": (
                                    observation.radio.active_fireplan_subscriptions[0].issi.alias
                                    if observation.radio.active_fireplan_subscriptions
                                    else None
                                ),
                                "is_active": bool(observation.radio.active_fireplan_subscriptions),
                            }
                            if observation.radio_id
                            else None
                        ),
                    }
                    for observation in inventory.radio_observations.all()
                ],
            }
        )


class FireplanInventoryTargetedSyncView(APIView):
    permission_classes = [IsAdminUser]

    @extend_schema(
        request=None,
        responses={
            202: inline_serializer(
                name="FireplanInventoryTargetedSyncAccepted",
                fields={
                    "task_id": serializers.CharField(),
                    "status": serializers.ChoiceField(choices=["PENDING"]),
                },
            )
        },
    )
    def post(self, request, inventory_uuid):
        get_object_or_404(
            FireplanInventory,
            uuid=inventory_uuid,
            last_successful_sync_at__isnull=False,
        )
        credential = FireplanCredential.objects.filter(pk=1).first()
        if not credential or not credential.encrypted_password:
            return Response(
                {"detail": "Stel eerst Fireplan-inloggegevens in."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            decrypt_secret(credential.encrypted_password)
            if credential.encrypted_cookies:
                deserialize_cookie_jar(decrypt_secret(credential.encrypted_cookies))
        except (FireplanEncryptionError, FireplanLoginError):
            return Response(
                {"detail": "Fireplan-inloggegevens zijn onbruikbaar."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        task = synchronize_inventories.apply_async(kwargs={"inventory_uuid": inventory_uuid})
        return Response(
            {"task_id": task.id, "status": "PENDING"},
            status=status.HTTP_202_ACCEPTED,
        )


class FireplanInventorySyncView(APIView):
    permission_classes = [IsAdminUser]

    @extend_schema(
        request=FireplanInventoryPeriodSerializer,
        responses={
            202: inline_serializer(
                name="FireplanInventorySyncAccepted",
                fields={
                    "task_id": serializers.CharField(),
                    "status": serializers.ChoiceField(choices=["PENDING"]),
                },
            )
        },
    )
    def post(self, request):
        period = FireplanInventoryPeriodSerializer(data=request.data)
        period.is_valid(raise_exception=True)
        credential = FireplanCredential.objects.filter(pk=1).first()
        if not credential or not credential.encrypted_password:
            return Response(
                {"detail": "Stel eerst Fireplan-inloggegevens in."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            decrypt_secret(credential.encrypted_password)
            if credential.encrypted_cookies:
                deserialize_cookie_jar(decrypt_secret(credential.encrypted_cookies))
        except (FireplanEncryptionError, FireplanLoginError):
            return Response(
                {"detail": "Fireplan-inloggegevens zijn onbruikbaar."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        task = synchronize_inventories.apply_async(
            kwargs={
                "start_date": period.validated_data["start_date"].isoformat(),
                "end_date": period.validated_data["end_date"].isoformat(),
            }
        )
        return Response(
            {"task_id": task.id, "status": "PENDING"},
            status=status.HTTP_202_ACCEPTED,
        )
