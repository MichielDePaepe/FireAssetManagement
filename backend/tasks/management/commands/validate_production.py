import os

from cryptography.fernet import Fernet
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Fail closed when required production environment values are still sample defaults."

    def handle(self, *args, **options):
        if os.getenv("DJANGO_DEBUG", "false").lower() == "true":
            raise CommandError("DJANGO_DEBUG must be false for production.")
        placeholders = ("change-me", "development", "replace-with", "example", "your-")
        secret = os.getenv("DJANGO_SECRET_KEY", "")
        if len(secret) < 50 or any(value in secret.lower() for value in placeholders):
            raise CommandError(
                "Set DJANGO_SECRET_KEY to a unique random value of at least 50 characters."
            )
        password = os.getenv("POSTGRES_PASSWORD", "")
        if len(password) < 16 or any(value in password.lower() for value in placeholders):
            raise CommandError("Set POSTGRES_PASSWORD to a unique value of at least 16 characters.")
        if not os.getenv("DJANGO_ALLOWED_HOSTS", "").strip():
            raise CommandError("Set DJANGO_ALLOWED_HOSTS to the production hostnames.")
        credential_key = os.getenv("FIREPLAN_CREDENTIAL_KEY", "")
        if not credential_key:
            raise CommandError("Set FIREPLAN_CREDENTIAL_KEY to a unique Fernet key.")
        try:
            Fernet(credential_key.encode("ascii"))
        except (ValueError, UnicodeEncodeError) as error:
            raise CommandError("FIREPLAN_CREDENTIAL_KEY must be a valid Fernet key.") from error
        self.stdout.write(self.style.SUCCESS("Production environment values passed validation."))
