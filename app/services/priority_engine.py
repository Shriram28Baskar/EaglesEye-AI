"""
Priority Engine — Redis sorted-set for real-time patient urgency ranking.
"""
from typing import Any

PRIORITY_KEY = "eagleseye:priority_queue"


def compute_priority_score(
    risk_score: float,
    trend: str,
    alert_severity: str,
    time_to_critical_min: float | None,
) -> float:
    base = risk_score
    trend_mult = {
        "rapidly_deteriorating": 1.4,
        "deteriorating": 1.2,
        "stable": 1.0,
        "improving": 0.85,
    }.get(trend, 1.0)
    severity_bonus = {"critical": 20, "high": 10, "moderate": 5, "low": 0}.get(alert_severity, 0)
    urgency_bonus = max(0.0, (60.0 - time_to_critical_min) / 2.0) if time_to_critical_min is not None else 0.0
    return min(100.0, base * trend_mult + severity_bonus + urgency_bonus)


async def update_patient_priority(patient_id: str, score: float, redis: Any):
    if redis:
        await redis.zadd(PRIORITY_KEY, {patient_id: score})


async def get_priority_queue(redis: Any, limit: int = 20) -> list[dict]:
    if not redis:
        return []
    try:
        # Returns list of (member, score) tuples
        items = await redis.zrevrange(PRIORITY_KEY, 0, limit - 1, withscores=True)
        return [{"patient_id": member, "score": round(score, 1)} for member, score in items]
    except Exception:
        return []
