"""
Clinical Scenario Simulator Engine — Generates parametrized vital streams
and feeds them through the full real-time perception → AI intelligence pipeline.
"""
import asyncio
import random
import logging
from datetime import datetime, timezone
from dataclasses import dataclass
from typing import Literal

from app.db.base import AsyncSessionLocal
from app.db.models import VitalReading, SimulationRun
from sqlalchemy import select

logger = logging.getLogger(__name__)

SimulationMode = Literal["stable", "gradual_decline", "severe_deterioration"]


@dataclass
class SimulationConfig:
    patient_id: str
    mode: SimulationMode
    duration_seconds: int = 120
    tick_interval_seconds: float = 4.0


class ClinicalSimulator:
    _active_tasks: dict[str, asyncio.Task] = {}

    def is_running(self, patient_id: str) -> bool:
        task = self._active_tasks.get(patient_id)
        return task is not None and not task.done()

    def start(self, run_id: str, config: SimulationConfig):
        # Stop existing task if any
        self.stop(config.patient_id)
        task = asyncio.create_task(self._run(run_id, config))
        self._active_tasks[config.patient_id] = task

    def stop(self, patient_id: str):
        task = self._active_tasks.get(patient_id)
        if task and not task.done():
            task.cancel()
        self._active_tasks.pop(patient_id, None)

    async def _run(self, run_id: str, config: SimulationConfig):
        from app.api.patients import _run_ai_pipeline

        ticks = max(1, int(config.duration_seconds / config.tick_interval_seconds))
        logger.info(f"Starting simulation {run_id} for {config.patient_id}: {config.mode}, {ticks} ticks")

        try:
            for i in range(ticks):
                progress = i / max(1, (ticks - 1))

                if config.mode == "stable":
                    vitals = {
                        "hr": round(75 + random.uniform(-3, 3), 1),
                        "spo2": round(98 + random.uniform(-1, 1), 1),
                        "bp_sys": round(120 + random.uniform(-5, 5), 1),
                        "bp_dia": round(80 + random.uniform(-3, 3), 1),
                        "temp": round(37.0 + random.uniform(-0.2, 0.2), 1),
                        "rr": round(16 + random.uniform(-1, 1), 1),
                    }
                elif config.mode == "gradual_decline":
                    # Drifting from stable to high risk
                    vitals = {
                        "hr": round(75 + progress * 45 + random.uniform(-2, 2), 1),
                        "spo2": round(98 - progress * 10 + random.uniform(-1, 1), 1),
                        "bp_sys": round(120 - progress * 35 + random.uniform(-4, 4), 1),
                        "bp_dia": round(80 - progress * 25 + random.uniform(-3, 3), 1),
                        "temp": round(37.0 + progress * 1.8 + random.uniform(-0.1, 0.1), 1),
                        "rr": round(16 + progress * 12 + random.uniform(-1, 1), 1),
                    }
                else:  # severe_deterioration
                    # Rapid septic / respiratory failure crisis
                    vitals = {
                        "hr": round(135 + random.uniform(-5, 5), 1),
                        "spo2": round(86 + random.uniform(-2, 2), 1),
                        "bp_sys": round(82 + random.uniform(-4, 4), 1),
                        "bp_dia": round(50 + random.uniform(-3, 3), 1),
                        "temp": round(39.2 + random.uniform(-0.2, 0.2), 1),
                        "rr": round(28 + random.uniform(-2, 2), 1),
                    }

                # 1. Ingest vital record & update run ticks in DB
                async with AsyncSessionLocal() as db:
                    reading = VitalReading(
                        patient_id=config.patient_id,
                        time=datetime.now(timezone.utc),
                        hr=vitals["hr"],
                        bp_sys=vitals["bp_sys"],
                        bp_dia=vitals["bp_dia"],
                        spo2=vitals["spo2"],
                        temp=vitals["temp"],
                        rr=vitals["rr"],
                    )
                    db.add(reading)

                    run_res = await db.execute(select(SimulationRun).where(SimulationRun.id == run_id))
                    run_obj = run_res.scalars().first()
                    if run_obj:
                        run_obj.ticks_generated = i + 1

                    await db.commit()

                # 2. Trigger the real AI pipeline (Risk, Explainability, Alerts, Priority, WS)
                try:
                    await _run_ai_pipeline(config.patient_id, vitals)
                except Exception as e:
                    logger.error(f"AI pipeline error during sim {run_id}: {e}")

                await asyncio.sleep(config.tick_interval_seconds)

            # Mark completed
            async with AsyncSessionLocal() as db:
                run_res = await db.execute(select(SimulationRun).where(SimulationRun.id == run_id))
                run_obj = run_res.scalars().first()
                if run_obj and run_obj.status == "running":
                    run_obj.status = "completed"
                    run_obj.stopped_at = datetime.now(timezone.utc)
                    await db.commit()

            logger.info(f"Simulation {run_id} completed successfully.")

        except asyncio.CancelledError:
            logger.info(f"Simulation {run_id} was cancelled.")
        finally:
            self._active_tasks.pop(config.patient_id, None)


simulator = ClinicalSimulator()
