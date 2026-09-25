import json
import logging
from typing import Dict, Set
from fastapi import WebSocket
from app.db.redis_client import get_redis

logger = logging.getLogger(__name__)

class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.redis_pubsub = None

    async def connect(self, websocket: WebSocket, channel: str):
        await websocket.accept()
        if channel not in self.active_connections:
            self.active_connections[channel] = set()
        self.active_connections[channel].add(websocket)

    def disconnect(self, websocket: WebSocket, channel: str):
        if channel in self.active_connections:
            self.active_connections[channel].discard(websocket)
            if not self.active_connections[channel]:
                del self.active_connections[channel]

    async def broadcast_local(self, channel: str, message: dict):
        if channel in self.active_connections:
            websockets_to_remove = set()
            for connection in self.active_connections[channel]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.warning(f"Error sending to websocket: {e}")
                    websockets_to_remove.add(connection)
            
            for conn in websockets_to_remove:
                self.disconnect(conn, channel)

    async def broadcast(self, channel: str, data: dict):
        redis = get_redis()
        try:
            await redis.publish(channel, json.dumps(data))
        except Exception as e:
            logger.error(f"Redis publish failed: {e}")

    async def listen_redis(self):
        redis = get_redis()
        self.redis_pubsub = redis.pubsub()
        await self.redis_pubsub.psubscribe("*")
        logger.info("Started Redis pubsub listener for WebSockets")
        try:
            async for message in self.redis_pubsub.listen():
                if message["type"] in ["message", "pmessage"]:
                    channel = message["channel"]
                    if isinstance(channel, bytes):
                        channel = channel.decode()
                    
                    data_str = message["data"]
                    try:
                        data = json.loads(data_str)
                        await self.broadcast_local(channel, data)
                    except Exception as e:
                        logger.error(f"Failed to broadcast from redis message: {e}")
        except Exception as e:
            logger.error(f"Redis listen error: {e}")

manager = WebSocketManager()
