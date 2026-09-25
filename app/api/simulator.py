import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime, timezone

from app.db.base import get_db
from app.db.models import SimulationRun
from app.simulator.engine import simulator, SimulationConfig

router = APIRouter(tags=["Simulator"])


class SimStartRequest(BaseModel):
    patient_id: str
    mode: str
    duration_seconds: int = 120


class SimStopRequest(BaseModel):
    patient_id: str


@router.post("/simulator/start")
async def start_simulation(req: SimStartRequest, db: AsyncSession = Depends(get_db)):
    run_id = str(uuid.uuid4())
    run = SimulationRun(
        id=run_id,
        patient_id=req.patient_id,
        mode=req.mode,
        status="running",
        started_at=datetime.now(timezone.utc),
        ticks_generated=0,
    )
    db.add(run)
    await db.commit()

    config = SimulationConfig(
        patient_id=req.patient_id,
        mode=req.mode,  # type: ignore
        duration_seconds=req.duration_seconds,
        tick_interval_seconds=4.0,
    )
    simulator.start(run_id, config)

    return {
        "status": "started",
        "run_id": run_id,
        "patient_id": req.patient_id,
        "mode": req.mode,
        "duration_seconds": req.duration_seconds,
    }


@router.post("/simulator/stop")
async def stop_simulation(req: SimStopRequest, db: AsyncSession = Depends(get_db)):
    simulator.stop(req.patient_id)

    result = await db.execute(
        select(SimulationRun)
        .where(SimulationRun.patient_id == req.patient_id, SimulationRun.status == "running")
    )
    run = result.scalars().first()
    if run:
        run.status = "stopped"
        run.stopped_at = datetime.now(timezone.utc)
        await db.commit()

    return {"status": "stopped", "patient_id": req.patient_id}


@router.get("/simulator/status")
async def get_simulator_status(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SimulationRun).where(SimulationRun.status == "running")
    )
    runs = result.scalars().all()
    active_dict = {}
    for r in runs:
        active_dict[r.patient_id] = {
            "run_id": r.id,
            "mode": r.mode,
            "ticks_generated": r.ticks_generated,
            "total_ticks": 30,  # default based on duration
            "started_at": r.started_at.isoformat() if r.started_at else None,
        }
    return {"active_simulations": active_dict}
