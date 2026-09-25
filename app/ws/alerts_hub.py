from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.ws.manager import manager
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.websocket("/alerts")
async def alerts_websocket(websocket: WebSocket):
    channel = "alerts:updates"
    await manager.connect(websocket, channel)
    try:
        await websocket.send_json({"type": "info", "message": "Connected to alerts updates"})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel)
    except Exception as e:
        logger.error(f"Alerts WS error: {e}")
        manager.disconnect(websocket, channel)
