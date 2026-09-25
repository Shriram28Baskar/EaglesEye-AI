from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.ws.manager import manager
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.websocket("/system/health")
async def health_websocket(websocket: WebSocket):
    channel = "system:health"
    await manager.connect(websocket, channel)
    try:
        await websocket.send_json({"type": "info", "message": "Connected to system health updates"})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel)
    except Exception as e:
        logger.error(f"Health WS error: {e}")
        manager.disconnect(websocket, channel)
