from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Optional
from app.db.base import get_db
from app.db.models import Notification, EscalationCall

router = APIRouter(tags=["Notifications"])

@router.get("/notifications/escalation-calls")
async def get_escalation_calls(
    patient_id: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    query = select(EscalationCall).order_by(desc(EscalationCall.created_at)).limit(limit)
    if patient_id:
        query = query.where(EscalationCall.patient_id == patient_id)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/notifications")
async def get_notifications(
    type: Optional[str] = None,
    read: Optional[bool] = None,
    priority: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(Notification).order_by(desc(Notification.created_at))
    if type:
        query = query.where(Notification.notification_type == type)
    if read is not None:
        query = query.where(Notification.read == read)
    if priority:
        query = query.where(Notification.priority == priority)
        
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/notifications/{id}/read")
async def mark_read(id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Notification).where(Notification.id == id))
    notification = result.scalars().first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.read = True
    await db.commit()
    await db.refresh(notification)
    return notification

@router.post("/notifications/read-all")
async def mark_all_read(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Notification).where(Notification.read == False))
    notifications = result.scalars().all()
    for n in notifications:
        n.read = True
    await db.commit()
    return {"status": "success", "count": len(notifications)}
