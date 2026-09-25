"""
Alert Correlation Engine — Redis sliding-window rules engine.
Merges co-occurring vital abnormalities into named clinical concerns.
Prevents duplicate single-vital alerts for the same active event.
"""
import time
import uuid
import json
import logging
from typing import Any
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

WINDOW_SECONDS = 300  # 5-minute sliding window


async def process_abnormalities(
    patient_id: str,
    abnormalities: list[dict],
    vitals: dict,
    db: Any,
    redis: Any,
) -> list[dict]:
    """
    1. Add each abnormality to Redis sorted-set with current timestamp as score.
    2. Prune entries older than WINDOW_SECONDS.
    3. Check CORRELATION_RULES — if a rule's required set is present in window:
       - Create a correlated AlertEvent (if not already active).
       - Suppress individual single_vital alerts for merged abnormalities.
    4. For unmatched abnormalities — create single_vital AlertEvent (if not active).
    5. Publish to Redis channel 'alerts:updates'.
    Returns list of new alert dicts created.
    """
    from app.ai.rules.clinical_thresholds import CORRELATION_RULES
    from app.db.models import AlertEvent, TimelineEvent
    from sqlalchemy import select, and_

    now = time.time()
    new_alerts: list[dict] = []
    correlated_ab_types: set[str] = set()

    if not redis:
        # No Redis — still create single-vital alerts directly
        for ab in abnormalities:
            alert = await _create_alert(
                patient_id=patient_id,
                alert_type="single_vital",
                abnormality_type=ab["type"],
                severity=ab.get("severity", "moderate"),
                message=ab.get("message", ""),
                vitals=vitals,
                db=db,
            )
            if alert:
                new_alerts.append(alert)
        return new_alerts

    # --- Step 1 & 2: Update Redis window ---
    for ab in abnormalities:
        key = f"patient:{patient_id}:abnorm:{ab['type']}"
        await redis.zadd(key, {f"{ab['type']}:{now}": now})
        # Remove stale entries
        cutoff = now - WINDOW_SECONDS
        await redis.zremrangebyscore(key, 0, cutoff)
        # Set TTL so keys auto-expire
        await redis.expire(key, WINDOW_SECONDS * 2)

    # Get all currently active abnormality types in window (across current and past readings in 5-min window)
    active_types: set[str] = set()
    cutoff = now - WINDOW_SECONDS
    try:
        keys = await redis.keys(f"patient:{patient_id}:abnorm:*")
        for k in keys:
            if isinstance(k, bytes):
                k = k.decode()
            await redis.zremrangebyscore(k, 0, cutoff)
            count = await redis.zcard(k)
            if count > 0:
                active_types.add(k.split(":")[-1])
    except Exception:
        for ab in abnormalities:
            active_types.add(ab["type"])

    # --- Step 3: Check correlation rules ---
    for rule in CORRELATION_RULES:
        required = set(rule["requires"])
        if required.issubset(active_types):
            # Check if already active in DB
            existing = await db.execute(
                select(AlertEvent).where(
                    and_(
                        AlertEvent.patient_id == patient_id,
                        AlertEvent.abnormality_type == rule["name"],
                        AlertEvent.status.in_(["generated", "acknowledged", "viewed", "escalated"]),
                    )
                )
            )
            if existing.scalars().first():
                # Already active — skip
                correlated_ab_types.update(required)
                continue

            # Create correlated alert
            alert_id = str(uuid.uuid4())
            vitals_snap = {
                "hr": vitals.get("hr"),
                "bp_sys": vitals.get("bp_sys"),
                "spo2": vitals.get("spo2"),
                "temp": vitals.get("temp"),
            }
            alert = AlertEvent(
                id=alert_id,
                patient_id=patient_id,
                alert_type="correlated",
                abnormality_type=rule["name"],
                severity=rule["severity"],
                status="generated",
                status_history=[
                    {"status": "generated", "ts": datetime.now(timezone.utc).isoformat()}
                ],
                correlated_from=list(required),
                vitals_snapshot=vitals_snap,
                message=(
                    f"Correlated alert: {rule['name']}. "
                    f"Confidence: {int(rule['confidence_base'] * 100)}%. "
                    f"Triggered by: {', '.join(required)}."
                ),
            )
            db.add(alert)
            correlated_ab_types.update(required)

            # Timeline event
            timeline = TimelineEvent(
                patient_id=patient_id,
                event_type="alert",
                payload={
                    "alert_id": alert_id,
                    "type": "correlated",
                    "name": rule["name"],
                    "severity": rule["severity"],
                },
            )
            db.add(timeline)

            alert_dict = {
                "id": alert_id,
                "patient_id": patient_id,
                "alert_type": "correlated",
                "abnormality_type": rule["name"],
                "severity": rule["severity"],
                "message": alert.message,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            new_alerts.append(alert_dict)
            logger.info(f"[Correlation] Created correlated alert '{rule['name']}' for patient {patient_id}")

    # --- Step 4: Single-vital alerts for unmatched abnormalities ---
    for ab in abnormalities:
        if ab["type"] in correlated_ab_types:
            continue  # Suppressed — part of a correlated alert

        existing = await db.execute(
            select(AlertEvent).where(
                and_(
                    AlertEvent.patient_id == patient_id,
                    AlertEvent.abnormality_type == ab["type"],
                    AlertEvent.alert_type == "single_vital",
                    AlertEvent.status.in_(["generated", "acknowledged", "viewed", "escalated"]),
                )
            )
        )
        if existing.scalars().first():
            continue  # Already active

        alert_id = str(uuid.uuid4())
        vitals_snap = {
            "hr": vitals.get("hr"),
            "bp_sys": vitals.get("bp_sys"),
            "spo2": vitals.get("spo2"),
            "temp": vitals.get("temp"),
        }
        alert = AlertEvent(
            id=alert_id,
            patient_id=patient_id,
            alert_type="single_vital",
            abnormality_type=ab["type"],
            severity=ab.get("severity", "moderate"),
            status="generated",
            status_history=[
                {"status": "generated", "ts": datetime.now(timezone.utc).isoformat()}
            ],
            correlated_from=[],
            vitals_snapshot=vitals_snap,
            message=ab.get("message", f"Abnormality detected: {ab['type']}"),
        )
        db.add(alert)

        timeline = TimelineEvent(
            patient_id=patient_id,
            event_type="alert",
            payload={
                "alert_id": alert_id,
                "type": "single_vital",
                "abnormality": ab["type"],
                "severity": ab.get("severity"),
            },
        )
        db.add(timeline)

        alert_dict = {
            "id": alert_id,
            "patient_id": patient_id,
            "alert_type": "single_vital",
            "abnormality_type": ab["type"],
            "severity": ab.get("severity", "moderate"),
            "message": alert.message,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        new_alerts.append(alert_dict)

    await db.commit()

    # --- Step 5: Publish to Redis ---
    if new_alerts:
        await redis.publish("alerts:updates", json.dumps({
            "patient_id": patient_id,
            "alerts": new_alerts,
        }))

    return new_alerts


async def _create_alert(
    patient_id: str,
    alert_type: str,
    abnormality_type: str,
    severity: str,
    message: str,
    vitals: dict,
    db: Any,
) -> dict | None:
    """Helper to create a single alert without Redis."""
    from app.db.models import AlertEvent
    from sqlalchemy import select, and_

    existing = await db.execute(
        select(AlertEvent).where(
            and_(
                AlertEvent.patient_id == patient_id,
                AlertEvent.abnormality_type == abnormality_type,
                AlertEvent.status.in_(["generated", "acknowledged", "viewed", "escalated"]),
            )
        )
    )
    if existing.scalars().first():
        return None

    alert_id = str(uuid.uuid4())
    alert = AlertEvent(
        id=alert_id,
        patient_id=patient_id,
        alert_type=alert_type,
        abnormality_type=abnormality_type,
        severity=severity,
        status="generated",
        status_history=[{"status": "generated", "ts": datetime.now(timezone.utc).isoformat()}],
        correlated_from=[],
        vitals_snapshot={"hr": vitals.get("hr"), "bp_sys": vitals.get("bp_sys"),
                         "spo2": vitals.get("spo2"), "temp": vitals.get("temp")},
        message=message,
    )
    db.add(alert)
    await db.commit()
    return {
        "id": alert_id, "patient_id": patient_id,
        "alert_type": alert_type, "abnormality_type": abnormality_type,
        "severity": severity, "message": message,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
