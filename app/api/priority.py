from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Dict, Any

from app.db.base import get_db
from app.db.redis_client import get_redis
from app.db.models import PatientProfile, RiskAssessment
from app.services.priority_engine import PRIORITY_KEY, get_priority_queue as get_pq

router = APIRouter(tags=["Priority"])


@router.get("/priority/queue")
async def get_priority_queue(db: AsyncSession = Depends(get_db)):
    redis = get_redis()
    raw_queue = await get_pq(redis, limit=20)
    
    if not raw_queue:
        # Fallback to DB sorted by risk_score if Redis queue is empty
        res = await db.execute(
            select(PatientProfile)
        )
        patients = res.scalars().all()
        enriched = []
        for p in patients:
            risk_res = await db.execute(
                select(RiskAssessment)
                .where(RiskAssessment.patient_id == p.id)
                .order_by(desc(RiskAssessment.ts))
                .limit(1)
            )
            risk = risk_res.scalars().first()
            score = round(risk.risk_score, 1) if risk else 15.0
            enriched.append({
                "patient_id": p.id,
                "score": score,
                "priority_score": score,
                "name": p.name,
                "ward": p.ward,
                "room": p.room,
                "diagnosis": p.diagnosis,
                "severity": risk.severity if risk else "low",
                "trend": risk.trend if risk else "stable",
            })
        enriched.sort(key=lambda x: x["score"], reverse=True)
        return enriched

    # Enrich Redis queue items with patient details
    patient_ids = [item["patient_id"] for item in raw_queue]
    p_res = await db.execute(select(PatientProfile).where(PatientProfile.id.in_(patient_ids)))
    p_map = {p.id: p for p in p_res.scalars().all()}

    enriched = []
    for item in raw_queue:
        pid = item["patient_id"]
        p = p_map.get(pid)
        risk_res = await db.execute(
            select(RiskAssessment)
            .where(RiskAssessment.patient_id == pid)
            .order_by(desc(RiskAssessment.ts))
            .limit(1)
        )
        risk = risk_res.scalars().first()
        enriched.append({
            "patient_id": pid,
            "score": item["score"],
            "priority_score": item["score"],
            "name": p.name if p else f"Patient {pid}",
            "ward": p.ward if p else "General",
            "room": p.room if p else "101",
            "diagnosis": p.diagnosis if p else "Observation",
            "severity": risk.severity if risk else "low",
            "trend": risk.trend if risk else "stable",
        })

    return enriched
