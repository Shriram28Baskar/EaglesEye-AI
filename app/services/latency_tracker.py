"""
Pipeline Latency Tracker — Stores per-stage processing times in Redis.
Provides rolling window metrics (avg, P95, P99) for the full AI pipeline.
"""
import time
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

LATENCY_KEY = "eagleseye:pipeline_latency"
MAX_SAMPLES = 100  # Rolling window of last 100 ingestion cycles


async def record_pipeline_latency(redis, metrics: dict):
    """
    Push a latency sample dict to Redis list (capped at MAX_SAMPLES).
    metrics = {
        "patient_id": str,
        "ts": float (epoch),
        "db_write_ms": float,
        "risk_engine_ms": float,
        "ml_inference_ms": float,
        "explainability_ms": float,
        "prediction_ms": float,
        "alert_correlation_ms": float,
        "ws_broadcast_ms": float,
        "total_pipeline_ms": float,
    }
    """
    if not redis:
        return
    try:
        await redis.lpush(LATENCY_KEY, json.dumps(metrics))
        await redis.ltrim(LATENCY_KEY, 0, MAX_SAMPLES - 1)
    except Exception as e:
        logger.warning(f"Failed to record pipeline latency: {e}")


async def get_latency_stats(redis) -> dict:
    """
    Returns aggregated latency statistics from the rolling Redis window.
    """
    if not redis:
        return _empty_stats()

    try:
        raw = await redis.lrange(LATENCY_KEY, 0, MAX_SAMPLES - 1)
        if not raw:
            return _empty_stats()

        samples = [json.loads(r) for r in raw]

        stages = [
            "db_write_ms",
            "risk_engine_ms",
            "ml_inference_ms",
            "explainability_ms",
            "prediction_ms",
            "alert_correlation_ms",
            "ws_broadcast_ms",
            "total_pipeline_ms",
        ]

        stats = {"sample_count": len(samples), "stages": {}}

        for stage in stages:
            values = sorted([s[stage] for s in samples if stage in s and s[stage] is not None])
            if not values:
                stats["stages"][stage] = {"avg_ms": 0, "p95_ms": 0, "p99_ms": 0, "min_ms": 0, "max_ms": 0}
                continue
            n = len(values)
            stats["stages"][stage] = {
                "avg_ms": round(sum(values) / n, 2),
                "p95_ms": round(values[int(n * 0.95)], 2),
                "p99_ms": round(values[int(n * 0.99)], 2),
                "min_ms": round(values[0], 2),
                "max_ms": round(values[-1], 2),
            }

        # Recent 10 samples for time-series chart
        stats["recent"] = samples[:10]

        return stats

    except Exception as e:
        logger.warning(f"Failed to get latency stats: {e}")
        return _empty_stats()


def _empty_stats():
    return {
        "sample_count": 0,
        "stages": {},
        "recent": [],
    }
