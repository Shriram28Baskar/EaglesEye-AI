from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.db.base import get_db
from app.db.models import PatientProfile, RiskAssessment, AlertEvent

router = APIRouter(tags=["Dashboard"])

@router.get("/dashboard/summary")
async def get_dashboard_summary(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PatientProfile))
    patients = result.scalars().all()
    total_patients = len(patients)

    critical_count = 0
    high_risk_count = 0
    monitor_count = 0
    stable_count = 0
    total_risk = 0.0

    for p in patients:
        risk_result = await db.execute(
            select(RiskAssessment)
            .where(RiskAssessment.patient_id == p.id)
            .order_by(desc(RiskAssessment.ts))
            .limit(1)
        )
        risk = risk_result.scalars().first()
        score = risk.risk_score if risk else 15.0
        sev = risk.severity if risk else "low"
        total_risk += score

        if sev == "critical" or score >= 80:
            critical_count += 1
        elif sev == "high" or score >= 60:
            high_risk_count += 1
        elif sev == "moderate" or score >= 40:
            monitor_count += 1
        else:
            stable_count += 1

    active_alerts_res = await db.execute(
        select(func.count(AlertEvent.id)).where(
            AlertEvent.status.in_(["generated", "acknowledged", "viewed"])
        )
    )
    active_alerts = active_alerts_res.scalar() or 0
    avg_risk = round(total_risk / max(1, total_patients), 1)

    return {
        "total_patients": total_patients,
        "critical_count": critical_count,
        "high_risk_count": high_risk_count,
        "monitor_count": monitor_count,
        "stable_count": stable_count,
        "active_alerts": active_alerts,
        "avg_risk": avg_risk,
        "nurses_available": 6
    }

@router.get("/dashboard/patients")
async def get_dashboard_patients(db: AsyncSession = Depends(get_db)):
    from app.api.patients import get_patients
    return await get_patients(db)
