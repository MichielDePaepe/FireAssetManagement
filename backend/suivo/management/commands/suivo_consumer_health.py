from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from suivo.models import SuivoSyncState


class Command(BaseCommand):
    help = "Check whether the Suivo push consumer is connected and responding."

    def handle(self, *args, **options):
        state = SuivoSyncState.objects.filter(pk=1).first()
        cutoff = timezone.now() - timedelta(seconds=90)
        if (
            not state
            or not state.push_connected_at
            or not state.push_last_message_at
            or state.push_last_message_at < cutoff
        ):
            raise CommandError("Suivo push consumer is not healthy.")
        self.stdout.write("Suivo push consumer is healthy.")
