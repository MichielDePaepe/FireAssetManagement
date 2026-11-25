"""Single long-running Suivo UNIT_STATUS websocket consumer."""

import asyncio
import json
import logging

from asgiref.sync import sync_to_async
from django.conf import settings
from websockets.asyncio.client import connect

from .client import SuivoClient
from .push import (
    PING_RESPONSE,
    SuivoPushError,
    apply_status_update,
    build_subscription_message,
    build_websocket_uri,
    handle_server_message,
    mark_push_connected,
    mark_push_disconnected,
    mark_push_message,
    reconnect_delay,
)

logger = logging.getLogger(__name__)
transport_logger = logging.getLogger("suivo.websocket.transport")
transport_logger.disabled = True


async def run_connection() -> None:
    client = SuivoClient()
    token = client._token()
    uri = build_websocket_uri(settings.SUIVO_WSS_URL, token)
    async with connect(
        uri,
        open_timeout=20,
        close_timeout=10,
        ping_interval=None,
        max_size=1_048_576,
        logger=transport_logger,
    ) as websocket:
        await sync_to_async(mark_push_connected, thread_sensitive=True)()
        await websocket.send(json.dumps(build_subscription_message(), separators=(",", ":")))
        logger.info("Suivo WebSocket connected; UNIT_STATUS subscription sent")
        ping_outstanding = False
        while True:
            try:
                message = await asyncio.wait_for(websocket.recv(), timeout=30)
            except TimeoutError:
                if ping_outstanding:
                    raise TimeoutError("Suivo WebSocket application ping timed out") from None
                await websocket.send(json.dumps({"ping-message": {}}, separators=(",", ":")))
                ping_outstanding = True
                continue

            update = await handle_server_message(websocket, message)
            await sync_to_async(mark_push_message, thread_sensitive=True)()
            if update == PING_RESPONSE:
                ping_outstanding = False
            elif isinstance(update, dict):
                await sync_to_async(apply_status_update, thread_sensitive=True)(update)


async def run_consumer() -> None:
    attempt = 0
    while True:
        try:
            await run_connection()
            raise SuivoPushError("Suivo WebSocket closed.")
        except asyncio.CancelledError:
            raise
        except Exception as error:
            delay = reconnect_delay(attempt)
            attempt += 1
            error_type = type(error).__name__
            await sync_to_async(mark_push_disconnected, thread_sensitive=True)(error_type, delay)
            logger.warning(
                "Suivo WebSocket disconnected; retry scheduled",
                extra={"error_type": error_type, "retry_seconds": delay},
            )
            await asyncio.sleep(delay)
