import redis.asyncio as redis
from app.config import settings
import logging

logger = logging.getLogger(__name__)

class RedisClient:
    _redis: redis.Redis = None

    @classmethod
    def get_client(cls) -> redis.Redis:
        if cls._redis is None:
            cls._redis = redis.from_url(settings.REDIS_URL, decode_responses=True)
        return cls._redis

    @classmethod
    async def close(cls):
        if cls._redis is not None:
            await cls._redis.close()

def get_redis() -> redis.Redis:
    return RedisClient.get_client()

async def await_redis_ready():
    client = get_redis()
    try:
        await client.ping()
        logger.info("Redis is ready.")
    except Exception as e:
        logger.error(f"Redis not available: {e}")
