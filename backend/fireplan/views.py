from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .client import FireplanLoginError, deserialize_cookie_jar, ensure_fireplan_session
from .crypto import FireplanEncryptionError, decrypt_secret, encrypt_secret
from .models import FireplanCredential
from .tasks import synchronize_pagers


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
            cookie_data, reused = ensure_fireplan_session(
                credential.login, password, cookie_data
            )
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
