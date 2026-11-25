import asyncio
import signal

from django.core.management.base import BaseCommand

from suivo.consumer import run_consumer


class Command(BaseCommand):
    help = "Run the single Suivo UNIT_STATUS WebSocket consumer."

    def handle(self, *args, **options):
        self.stdout.write("Starting Suivo UNIT_STATUS consumer.")
        try:
            asyncio.run(self._serve())
        except KeyboardInterrupt:
            self.stdout.write("Suivo consumer stopped.")

    async def _serve(self):
        task = asyncio.create_task(run_consumer())
        loop = asyncio.get_running_loop()
        for signum in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(signum, task.cancel)
        try:
            await task
        except asyncio.CancelledError:
            self.stdout.write("Suivo consumer stopped.")
