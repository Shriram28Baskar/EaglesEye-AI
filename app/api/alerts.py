from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import json
import logging

from app.db.base import get_db
from app.db.models import AlertEvent, TimelineEvent, PatientProfile
from app.db.redis_client import RedisClient

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Alerts"])

@router.get("/alerts")
async def get_alerts(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    patient_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(AlertEvent).order_by(desc(AlertEvent.created_at))
    if status:
        query = query.where(AlertEvent.status == status)
    if severity:
        query = query.where(AlertEvent.severity == severity)
    if patient_id:
        query = query.where(AlertEvent.patient_id == patient_id)
        
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/alerts/{id}")
async def get_alert(id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AlertEvent).where(AlertEvent.id == id))
    alert = result.scalars().first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert

@router.post("/alerts/{id}/acknowledge")
async def acknowledge_alert(
    id: str,
    payload: Optional[Dict[str, Any]] = Body(None),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(AlertEvent).where(AlertEvent.id == id))
    alert = result.scalars().first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    by_user = (payload or {}).get("by_user") or (payload or {}).get("user_id") or "Dr. On-Duty"
    alert.status = "acknowledged"
    history = list(alert.status_history or [])
    history.append({
        "status": "acknowledged",
        "ts": datetime.now(timezone.utc).isoformat(),
        "by_user": by_user
    })
    alert.status_history = history

    timeline = TimelineEvent(
        patient_id=alert.patient_id,
        event_type="alert_acknowledged",
        payload={"alert_id": alert.id, "by_user": by_user, "type": alert.abnormality_type}
    )
    db.add(timeline)
    await db.commit()
    await db.refresh(alert)

    redis = RedisClient.get_client()
    if redis:
        try:
            await redis.publish("alerts:updates", json.dumps({
                "type": "alert_acknowledged",
                "alert_id": alert.id,
                "status": "acknowledged",
                "by_user": by_user
            }))
        except Exception:
            pass

    return alert

@router.post("/alerts/{id}/resolve")
async def resolve_alert(
    id: str,
    payload: Optional[Dict[str, Any]] = Body(None),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(AlertEvent).where(AlertEvent.id == id))
    alert = result.scalars().first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    by_user = (payload or {}).get("by_user") or (payload or {}).get("user_id") or "Dr. On-Duty"
    alert.status = "resolved"
    alert.resolved_at = datetime.now(timezone.utc)
    history = list(alert.status_history or [])
    history.append({
        "status": "resolved",
        "ts": datetime.now(timezone.utc).isoformat(),
        "by_user": by_user
    })
    alert.status_history = history

    timeline = TimelineEvent(
        patient_id=alert.patient_id,
        event_type="alert_resolved",
        payload={"alert_id": alert.id, "by_user": by_user, "type": alert.abnormality_type}
    )
    db.add(timeline)
    await db.commit()
    await db.refresh(alert)

    redis = RedisClient.get_client()
    if redis:
        try:
            await redis.publish("alerts:updates", json.dumps({
                "type": "alert_resolved",
                "alert_id": alert.id,
                "status": "resolved",
                "by_user": by_user
            }))
        except Exception:
            pass

    return alert

@router.post("/alerts/{id}/escalate")
async def escalate_alert(
    id: str,
    payload: Optional[Dict[str, Any]] = Body(None),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(AlertEvent).where(AlertEvent.id == id))
    alert = result.scalars().first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    by_user = (payload or {}).get("by_user") or (payload or {}).get("user_id") or "Dr. On-Duty"
    alert.status = "escalated"
    history = list(alert.status_history or [])
    history.append({
        "status": "escalated",
        "ts": datetime.now(timezone.utc).isoformat(),
        "by_user": by_user
    })
    alert.status_history = history

    p_res = await db.execute(select(PatientProfile).where(PatientProfile.id == alert.patient_id))
    patient = p_res.scalars().first()

    redis = RedisClient.get_client()
    from app.services.notification_service import check_and_escalate
    if patient:
        try:
            await check_and_escalate(
                patient_id=patient.id,
                patient_name=patient.name,
                ward=patient.ward,
                risk_score=85.0 if alert.severity == "critical" else 75.0,
                reasons=[alert.message or alert.abnormality_type],
                db=db,
                redis=redis
            )
        except Exception as e:
            logger.error(f"Error during escalation trigger for alert {alert.id}: {e}")

    timeline = TimelineEvent(
        patient_id=alert.patient_id,
        event_type="alert_escalated",
        payload={"alert_id": alert.id, "by_user": by_user, "type": alert.abnormality_type}
    )
    db.add(timeline)
    await db.commit()
    await db.refresh(alert)

    if redis:
        try:
            await redis.publish("alerts:updates", json.dumps({
                "type": "alert_escalated",
                "alert_id": alert.id,
                "status": "escalated",
                "by_user": by_user
            }))
        except Exception:
            pass

    return alert
