import socketio


sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
)

socket_app = socketio.ASGIApp(sio)


@sio.event
async def connect(sid, environ, auth=None):
    """Register a frontend telemetry client."""
    await sio.emit(
        "connection_status",
        {
            "connected": True,
        },
        to=sid,
    )


@sio.event
async def disconnect(sid):
    """Handle a frontend telemetry client disconnecting."""
    return None


async def broadcast(event: str, data):
    """Broadcast an event to all connected CarbonTwin clients."""
    await sio.emit(event, data)