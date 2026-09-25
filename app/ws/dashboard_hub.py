from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.ws.manager import manager
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.websocket("/dashboard")
async def dashboard_websocket(websocket: WebSocket):
    channel = "dashboard:updates"
    await manager.connect(websocket, channel)
    try:
        # TODO: send initial dashboard state here
        await websocket.send_json({"type": "info", "message": "Connected to dashboard updates"})
        while True:
            await websocket.receive_text() # Keep alive
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel)
    except Exception as e:
        logger.error(f"Dashboard WS error: {e}")
        manager.disconnect(websocket, channel)
