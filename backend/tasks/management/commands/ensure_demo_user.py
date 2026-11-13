import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Create/update the local development demo user. Never use this command in production."

    def handle(self, *args, **options):
        if os.getenv("DJANGO_DEBUG", "false").lower() != "true":
            raise CommandError("ensure_demo_user is allowed only when DJANGO_DEBUG=true")
        username = os.getenv("DEMO_USERNAME", "starter")
        password = os.getenv("DEMO_PASSWORD", "")
        if not password:
            raise CommandError("Set DEMO_PASSWORD in the development environment")
        user, _ = get_user_model().objects.get_or_create(username=username)
        user.set_password(password)
        user.is_staff = True
        user.save()
        self.stdout.write(self.style.SUCCESS(f"Development account ready: {username}"))
