from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import get_db
from app.services.ward_analytics import get_ward_analytics as service_get_ward_analytics

router = APIRouter(tags=["Ward"])

@router.get("/ward/{id}/analytics")
async def get_ward_analytics(id: str, db: AsyncSession = Depends(get_db)):
    return await service_get_ward_analytics(id, db)
