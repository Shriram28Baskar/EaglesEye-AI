from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, func
from datetime import datetime, timezone, timedelta
import os
import time

from app.db.base import get_db
from app.db.redis_client import get_redis
from app.db.models import VitalReading
from app.ws.manager import manager
from app.simulator.engine import simulator
from app.config import settings

router = APIRouter(tags=["System"])


@router.get("/system/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    start_time = time.time()
    services = {}
    overall = "ok"

    # API
    latency = round((time.time() - start_time) * 1000, 2)
    services["api"] = {"status": "ok", "latency_ms": latency}

    # Database
    db_start = time.time()
    try:
        await db.execute(text("SELECT 1"))
        db_lat = round((time.time() - db_start) * 1000, 1)
        services["database"] = {"status": "ok", "type": "TimescaleDB/PostgreSQL", "latency_ms": db_lat}
    except Exception as e:
        services["database"] = {"status": "down", "error": str(e)}
        overall = "degraded"

    # Redis & Queue Depth
    redis = get_redis()
    try:
        r_start = time.time()
        await redis.ping()
        r_lat = round((time.time() - r_start) * 1000, 1)
        queue_depth = await redis.zcard("eagleseye:priority_queue")
        services["redis"] = {
            "status": "ok",
            "type": "Redis 7",
            "latency_ms": r_lat,
            "queue_depth": queue_depth
        }
    except Exception as e:
        services["redis"] = {"status": "down", "error": str(e), "queue_depth": 0}
        overall = "degraded"

    # AI Model
    model_dir = os.path.dirname(os.path.dirname(__file__))
    model_path = os.path.join(model_dir, "ai", "models", "deterioration_model.joblib")
    if os.path.exists(model_path):
        services["ai_service"] = {
            "status": "ok",
            "model_version": "hybrid-v1",
            "model_type": "XGBoost Classifier + Rule Engine"
        }
    else:
        services["ai_service"] = {
            "status": "degraded",
            "model_version": "rules-fallback",
            "note": "Running clinical rules-only fallback"
        }

    # WebSocket connections
    total_ws = sum(len(conns) for conns in manager.active_connections.values())
    services["websocket_hub"] = {
        "status": "ok",
        "active_connections": total_ws,
        "channels": list(manager.active_connections.keys())
    }

    # Sensor Feed
    active_sim_count = len(simulator._active_tasks)
    try:
        recent_cutoff = datetime.now(timezone.utc) - timedelta(seconds=60)
        recent_v = await db.execute(
            select(func.count(VitalReading.time)).where(VitalReading.time >= recent_cutoff)
        )
        recent_count = recent_v.scalar() or 0
        services["sensor_feed"] = {
            "status": "ok" if (active_sim_count > 0 or recent_count > 0) else "idle",
            "active_simulators": active_sim_count,
            "readings_last_min": recent_count
        }
    except Exception:
        services["sensor_feed"] = {"status": "idle", "active_simulators": active_sim_count}

    # Voice / Escalation Gateway (Vapi / Twilio)
    has_vapi = bool(getattr(settings, "VAPI_PRIVATE_KEY", None) and getattr(settings, "VAPI_ASSISTANT_ID", None))
    services["voice_gateway"] = {
        "status": "ok" if has_vapi else "not_configured",
        "provider": "Vapi AI Voice Gateway",
        "phone_configured": bool(getattr(settings, "VAPI_PHONE_NUMBER_ID", None))
    }

    if services["database"]["status"] == "down" and services["redis"]["status"] == "down":
        overall = "down"

    return {"overall": overall, "services": services}


@router.get("/system/latency")
async def get_pipeline_latency():
    """
    Returns rolling pipeline latency statistics from Redis.
    Covers per-stage avg/P95/P99 across the last 100 vital ingestion cycles.
    """
    from app.services.latency_tracker import get_latency_stats
    redis = get_redis()
    stats = await get_latency_stats(redis)
    return stats
