from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.ws.manager import manager
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.websocket("/patients/{patient_id}/vitals")
async def vitals_websocket(websocket: WebSocket, patient_id: str):
    channel = f"vitals:{patient_id}"
    await manager.connect(websocket, channel)
    try:
        # TODO: send latest vitals
        await websocket.send_json({"type": "info", "message": f"Connected to vitals for {patient_id}"})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel)
    except Exception as e:
        logger.error(f"Vitals WS error for {patient_id}: {e}")
        manager.disconnect(websocket, channel)
