from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.db.base import get_db
from app.db.models import PatientProfile, AlertEvent
import asyncio

router = APIRouter(tags=["Search"])

@router.get("/search")
async def search(q: str = Query(...), db: AsyncSession = Depends(get_db)):
    search_term = f"%{q}%"
    
    # Run searches concurrently to hit <300ms target
    patients_query = select(PatientProfile).where(
        or_(
            PatientProfile.id.ilike(search_term),
            PatientProfile.name.ilike(search_term),
            PatientProfile.room.ilike(search_term),
            PatientProfile.ward.ilike(search_term),
            PatientProfile.diagnosis.ilike(search_term)
        )
    ).limit(10)
    
    alerts_query = select(AlertEvent).where(
        or_(
            AlertEvent.message.ilike(search_term),
            AlertEvent.abnormality_type.ilike(search_term)
        )
    ).limit(10)
    
    # execute concurrently
    patients_task = db.execute(patients_query)
    alerts_task = db.execute(alerts_query)
    
    patients_result, alerts_result = await asyncio.gather(patients_task, alerts_task)
    
    return {
        "patients": patients_result.scalars().all(),
        "alerts": alerts_result.scalars().all()
    }
