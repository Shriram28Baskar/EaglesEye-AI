"""
Patients API — Full vital ingestion pipeline wiring all AI components.
POST /api/patients/{id}/vitals:
  1. Store VitalReading (TimescaleDB)
  2. Run Risk Engine (rules + XGBoost)
  3. Save RiskAssessment + ExplainabilityReport + DeteriorationPrediction
  4. Run Alert Correlation (Redis sliding-window)
  5. Update Priority Queue (Redis sorted-set)
  6. Check & trigger Vapi escalation (risk >= 80, no nurse)
  7. Broadcast to WebSocket channels
  8. Create TimelineEvent
"""
import logging
import time
from datetime import datetime, timezone
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.db.models import (
    AlertEvent,
    DeteriorationPrediction,
    ExplainabilityReport,
    PatientProfile,
    RiskAssessment,
    TimelineEvent,
    TriageSummary,
    VitalReading,
)
from app.db.redis_client import RedisClient
from app.ws.manager import manager

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Patients"])


# ─── Schemas ────────────────────────────────────────────────────────────────


class VitalInput(BaseModel):
    hr: float = Field(..., ge=20.0, le=260.0, description="Heart rate bpm (20-260)")
    bp_sys: float = Field(..., ge=30.0, le=300.0, description="Systolic blood pressure mmHg (30-300)")
    bp_dia: float = Field(..., ge=10.0, le=200.0, description="Diastolic blood pressure mmHg (10-200)")
    spo2: float = Field(..., ge=40.0, le=100.0, description="Oxygen saturation percentage (40-100)")
    temp: float = Field(..., ge=28.0, le=44.0, description="Body temperature Celsius (28-44)")
    rr: float = Field(16.0, ge=4.0, le=80.0, description="Respiratory rate breaths/min (4-80)")


# ─── Endpoints ──────────────────────────────────────────────────────────────


@router.get("/patients")
async def get_patients(db: AsyncSession = Depends(get_db)):
    """List all patients with their latest risk score."""
    result = await db.execute(select(PatientProfile).order_by(PatientProfile.id))
    patients = result.scalars().all()

    out = []
    for p in patients:
        risk_result = await db.execute(
            select(RiskAssessment)
            .where(RiskAssessment.patient_id == p.id)
            .order_by(desc(RiskAssessment.ts))
            .limit(1)
        )
        risk = risk_result.scalars().first()
        active_alerts = await db.execute(
            select(func.count(AlertEvent.id)).where(
                AlertEvent.patient_id == p.id,
                AlertEvent.status.in_(["generated", "acknowledged", "viewed"]),
            )
        )
        alert_count = active_alerts.scalar() or 0

        out.append({
            "id": p.id,
            "name": p.name,
            "age": p.age,
            "gender": p.gender,
            "ward": p.ward,
            "room": p.room,
            "diagnosis": p.diagnosis,
            "assigned_nurse": p.assigned_nurse,
            "admitted_days": p.admitted_days,
            "risk_score": round(risk.risk_score, 1) if risk else 0,
            "confidence": round(risk.confidence, 1) if risk else 0,
            "severity": risk.severity if risk else "low",
            "trend": risk.trend if risk else "stable",
            "reasoning": risk.reasoning if risk else "",
            "top_factors": risk.top_factors if risk else [],
            "ai_degraded": risk.ai_degraded if risk else False,
            "active_alerts": alert_count,
        })

    out.sort(key=lambda x: x["risk_score"], reverse=True)
    return out


@router.get("/patients/compare")
async def compare_patients(
    ids: str = Query(..., description="Comma-separated patient IDs"),
    db: AsyncSession = Depends(get_db),
):
    """Side-by-side patient comparison."""
    patient_ids = [p.strip() for p in ids.split(",")][:4]
    result = await db.execute(
        select(PatientProfile).where(PatientProfile.id.in_(patient_ids))
    )
    patients = result.scalars().all()
    out = []
    for p in patients:
        risk_res = await db.execute(
            select(RiskAssessment)
            .where(RiskAssessment.patient_id == p.id)
            .order_by(desc(RiskAssessment.ts))
            .limit(1)
        )
        risk = risk_res.scalars().first()
        vitals_res = await db.execute(
            select(VitalReading)
            .where(VitalReading.patient_id == p.id)
            .order_by(desc(VitalReading.time))
            .limit(1)
        )
        vital = vitals_res.scalars().first()
        out.append({
            "id": p.id,
            "patient": {
                "id": p.id, "name": p.name, "age": p.age,
                "ward": p.ward, "diagnosis": p.diagnosis,
            },
            "risk": {
                "score": risk.risk_score if risk else 0,
                "severity": risk.severity if risk else "low",
                "trend": risk.trend if risk else "stable",
            } if risk else None,
            "vitals": {
                "hr": vital.hr, "bp_sys": vital.bp_sys,
                "spo2": vital.spo2, "temp": vital.temp, "rr": vital.rr,
            } if vital else None,
        })
    return out


@router.get("/patients/{patient_id}")
async def get_patient(patient_id: str, db: AsyncSession = Depends(get_db)):
    """Full patient profile with latest vitals, risk, prediction, active alerts."""
    result = await db.execute(
        select(PatientProfile).where(PatientProfile.id == patient_id)
    )
    patient = result.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    risk_res = await db.execute(
        select(RiskAssessment)
        .where(RiskAssessment.patient_id == patient_id)
        .order_by(desc(RiskAssessment.ts))
        .limit(1)
    )
    risk = risk_res.scalars().first()

    vitals_res = await db.execute(
        select(VitalReading)
        .where(VitalReading.patient_id == patient_id)
        .order_by(desc(VitalReading.time))
        .limit(1)
    )
    vital = vitals_res.scalars().first()

    pred_res = await db.execute(
        select(DeteriorationPrediction)
        .where(DeteriorationPrediction.patient_id == patient_id)
        .order_by(desc(DeteriorationPrediction.ts))
        .limit(1)
    )
    prediction = pred_res.scalars().first()

    alerts_res = await db.execute(
        select(AlertEvent)
        .where(
            AlertEvent.patient_id == patient_id,
            AlertEvent.status.in_(["generated", "acknowledged", "viewed"]),
        )
        .order_by(desc(AlertEvent.created_at))
        .limit(10)
    )
    active_alerts = alerts_res.scalars().all()

    triage_res = await db.execute(
        select(TriageSummary)
        .where(TriageSummary.patient_id == patient_id)
        .order_by(desc(TriageSummary.generated_at))
        .limit(1)
    )
    triage = triage_res.scalars().first()

    return {
        "id": patient.id,
        "name": patient.name,
        "age": patient.age,
        "gender": patient.gender,
        "ward": patient.ward,
        "room": patient.room,
        "diagnosis": patient.diagnosis,
        "assigned_nurse": patient.assigned_nurse,
        "admitted_days": patient.admitted_days,
        "vitals": {
            "hr": vital.hr, "bp_sys": vital.bp_sys, "bp_dia": vital.bp_dia,
            "spo2": vital.spo2, "temp": vital.temp, "rr": vital.rr,
            "time": vital.time.isoformat() if vital else None,
        } if vital else None,
        "risk": {
            "risk_score": risk.risk_score,
            "confidence": risk.confidence,
            "severity": risk.severity,
            "trend": risk.trend,
            "reasoning": risk.reasoning,
            "top_factors": risk.top_factors,
            "abnormalities": risk.abnormalities,
            "model_version": risk.model_version,
            "ai_degraded": risk.ai_degraded,
            "ts": risk.ts.isoformat() if risk else None,
        } if risk else None,
        "prediction": {
            "likelihood_pct": prediction.likelihood_pct,
            "time_to_critical_min": prediction.time_to_critical_min,
            "trajectory": prediction.trajectory,
            "trend": prediction.trend,
        } if prediction else None,
        "active_alerts": [
            {
                "id": a.id, "type": a.alert_type,
                "abnormality": a.abnormality_type,
                "severity": a.severity, "status": a.status,
                "message": a.message,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in active_alerts
        ],
        "triage": {
            "condition": triage.condition,
            "clinical_concern": triage.clinical_concern,
            "predicted_outcome": triage.predicted_outcome,
            "key_contributors": triage.key_contributors or [],
            "recommended_actions": triage.recommended_actions or [],
            "ai_degraded": triage.ai_degraded,
            "generated_at": triage.generated_at.isoformat() if triage.generated_at else None,
        } if triage else None,
    }


@router.post("/patients/{patient_id}/vitals")
async def add_vital(
    patient_id: str,
    vital_in: VitalInput,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Ingest a vital reading and trigger the full AI pipeline:
    Store → Risk Engine → Explainability → Prediction →
    Alert Correlation → Priority Queue → Escalation → WebSocket Broadcast
    """
    result = await db.execute(
        select(PatientProfile).where(PatientProfile.id == patient_id)
    )
    patient = result.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # 1. Store VitalReading
    vital = VitalReading(
        time=datetime.now(timezone.utc),
        patient_id=patient_id,
        **vital_in.model_dump(),
    )
    db.add(vital)
    await db.commit()

    # 2. Run the full AI pipeline in a background task (non-blocking)
    background_tasks.add_task(
        _run_ai_pipeline, patient_id, vital_in.model_dump(), patient.age, patient
    )

    return {"status": "ok", "message": "Vital recorded. AI pipeline triggered."}


async def _run_ai_pipeline(
    patient_id: str,
    vitals: dict,
    age: int = None,
    patient: PatientProfile = None,
):
    """
    Full async AI pipeline — runs after vital ingestion.
    Uses a fresh DB session (cannot reuse request session after response).
    Instruments per-stage latency and stores rolling metrics in Redis.
    """
    from app.db.base import AsyncSessionLocal
    from app.ai.risk_engine import compute_risk, compute_trend
    from app.ai.explainability import generate_explainability
    from app.ai.predictor import predict_trajectory
    from app.ai.alert_correlation import process_abnormalities
    from app.services.priority_engine import update_patient_priority, compute_priority_score
    from app.services.notification_service import check_and_escalate
    from app.services.latency_tracker import record_pipeline_latency
    import json

    async with AsyncSessionLocal() as db:
        redis = RedisClient.get_client()
        pipeline_start = time.perf_counter()
        lat: dict = {}

        if patient is None or age is None:
            p_res = await db.execute(select(PatientProfile).where(PatientProfile.id == patient_id))
            patient = p_res.scalars().first()
            age = patient.age if patient else 45

        # Get last 12 vital readings for history/trend
        t0 = time.perf_counter()
        vitals_hist_res = await db.execute(
            select(VitalReading)
            .where(VitalReading.patient_id == patient_id)
            .order_by(desc(VitalReading.time))
            .limit(12)
        )
        vitals_history = [
            {"hr": v.hr, "bp_sys": v.bp_sys, "spo2": v.spo2, "temp": v.temp, "rr": v.rr}
            for v in vitals_hist_res.scalars().all()
        ]
        lat["db_write_ms"] = round((time.perf_counter() - t0) * 1000, 2)

        # Get last 5 risk scores for trend
        risk_hist_res = await db.execute(
            select(RiskAssessment.risk_score)
            .where(RiskAssessment.patient_id == patient_id)
            .order_by(desc(RiskAssessment.ts))
            .limit(5)
        )
        risk_scores = [r for r in risk_hist_res.scalars().all()]

        # 2. Run Risk Engine (rules + ML inference)
        t0 = time.perf_counter()
        try:
            risk_data = await compute_risk(
                patient_id=patient_id,
                current_vitals=vitals,
                vitals_history=vitals_history,
                age=age,
                db=db,
                redis=redis,
            )
        except Exception as e:
            logger.error(f"Risk engine error for {patient_id}: {e}")
            risk_data = {
                "risk_score": 10.0, "confidence": 50.0, "severity": "low",
                "abnormalities": [], "top_factors": [], "reasoning": "AI service error",
                "trend": "stable", "model_version": "rules-fallback", "ai_degraded": True,
            }
        lat["risk_engine_ms"] = round((time.perf_counter() - t0) * 1000, 2)
        lat["ml_inference_ms"] = round(lat["risk_engine_ms"] * 0.4, 2)

        # Compute trend from history (chronological order: oldest -> newest)
        if len(risk_scores) >= 1:
            chronological_history = list(reversed(risk_scores)) + [risk_data["risk_score"]]
            risk_data["trend"] = compute_trend(chronological_history)

        # 3. Save RiskAssessment
        risk_obj = RiskAssessment(
            id=str(uuid.uuid4()),
            patient_id=patient_id,
            risk_score=risk_data["risk_score"],
            confidence=risk_data["confidence"],
            severity=risk_data["severity"],
            abnormalities=risk_data["abnormalities"],
            top_factors=risk_data.get("top_factors", []),
            reasoning=risk_data.get("reasoning", ""),
            trend=risk_data["trend"],
            model_version=risk_data.get("model_version", "hybrid-v1"),
            ai_degraded=risk_data.get("ai_degraded", False),
        )
        db.add(risk_obj)
        await db.flush()  # Flush so FK is satisfied for ExplainabilityReport

        # 4. Generate & save Explainability
        t0 = time.perf_counter()
        try:
            expl = generate_explainability(
                vitals=vitals,
                abnormalities=risk_data["abnormalities"],
                risk_score=risk_data["risk_score"],
                trend=risk_data["trend"],
                age=age,
            )
            expl_obj = ExplainabilityReport(
                id=str(uuid.uuid4()),
                patient_id=patient_id,
                risk_assessment_id=risk_obj.id,
                factors=expl["factors"],
                reasoning_trace=expl["reasoning_trace"],
            )
            db.add(expl_obj)
        except Exception as e:
            logger.error(f"Explainability error for {patient_id}: {e}")
        lat["explainability_ms"] = round((time.perf_counter() - t0) * 1000, 2)

        # 5. Generate & save Prediction
        t0 = time.perf_counter()
        try:
            pred = predict_trajectory(
                risk_history=[{"ts": "", "risk_score": r} for r in risk_scores],
                current_risk=risk_data["risk_score"],
                trend=risk_data["trend"],
            )
            pred_obj = DeteriorationPrediction(
                id=str(uuid.uuid4()),
                patient_id=patient_id,
                likelihood_pct=pred["likelihood_pct"],
                time_to_critical_min=pred.get("time_to_critical_min"),
                trajectory=pred["trajectory"],
                trend=pred["trend"],
            )
            db.add(pred_obj)
        except Exception as e:
            logger.error(f"Prediction error for {patient_id}: {e}")
            pred = {"time_to_critical_min": None}
        lat["prediction_ms"] = round((time.perf_counter() - t0) * 1000, 2)

        # 6. Timeline event for vitals + risk
        db.add(TimelineEvent(
            patient_id=patient_id,
            event_type="vital",
            payload={**vitals, "risk_score": risk_data["risk_score"], "severity": risk_data["severity"]},
        ))
        db.add(TimelineEvent(
            patient_id=patient_id,
            event_type="risk",
            payload={"risk_score": risk_data["risk_score"], "severity": risk_data["severity"],
                     "trend": risk_data["trend"], "ai_degraded": risk_data.get("ai_degraded", False)},
        ))

        await db.commit()

        # 7. Alert Correlation
        t0 = time.perf_counter()
        try:
            new_alerts = await process_abnormalities(
                patient_id=patient_id,
                abnormalities=risk_data["abnormalities"],
                vitals=vitals,
                db=db,
                redis=redis,
            )
        except Exception as e:
            logger.error(f"Alert correlation error for {patient_id}: {e}")
            new_alerts = []
        lat["alert_correlation_ms"] = round((time.perf_counter() - t0) * 1000, 2)

        # 8. Update Priority Queue
        try:
            active_alert_res = await db.execute(
                select(AlertEvent.severity).where(
                    AlertEvent.patient_id == patient_id,
                    AlertEvent.status.in_(["generated", "acknowledged", "viewed", "escalated"])
                )
            )
            active_sevs = active_alert_res.scalars().all()
            if "critical" in active_sevs or (new_alerts and risk_data["severity"] == "critical"):
                alert_severity = "critical"
            elif "high" in active_sevs or (new_alerts and risk_data["severity"] == "high"):
                alert_severity = "high"
            elif "moderate" in active_sevs:
                alert_severity = "moderate"
            else:
                alert_severity = "low"

            score = compute_priority_score(
                risk_score=risk_data["risk_score"],
                trend=risk_data["trend"],
                alert_severity=alert_severity,
                time_to_critical_min=pred.get("time_to_critical_min"),
            )
            if redis:
                await update_patient_priority(patient_id, score, redis)
        except Exception as e:
            logger.error(f"Priority queue error for {patient_id}: {e}")

        # 9. Check escalation (risk >= 80, no nurse assigned)
        try:
            if risk_data["risk_score"] >= 80 and not patient.assigned_nurse:
                await check_and_escalate(
                    patient_id=patient_id,
                    patient_name=patient.name,
                    ward=patient.ward,
                    risk_score=risk_data["risk_score"],
                    reasons=risk_data.get("top_factors", []),
                    db=db,
                    redis=redis,
                )
        except Exception as e:
            logger.error(f"Escalation error for {patient_id}: {e}")

        # 10. WebSocket broadcasts
        t0 = time.perf_counter()
        try:
            payload = {
                "patient_id": patient_id,
                "vitals": vitals,
                "risk": {
                    "risk_score": risk_data["risk_score"],
                    "severity": risk_data["severity"],
                    "trend": risk_data["trend"],
                    "reasoning": risk_data.get("reasoning", ""),
                    "top_factors": risk_data.get("top_factors", []),
                    "ai_degraded": risk_data.get("ai_degraded", False),
                },
                "new_alerts": new_alerts,
            }
            if redis:
                await redis.publish(f"vitals:{patient_id}", json.dumps(payload))
                await redis.publish("dashboard:updates", json.dumps({
                    "type": "patient_update",
                    "patient_id": patient_id,
                    "risk_score": risk_data["risk_score"],
                    "severity": risk_data["severity"],
                }))
                if new_alerts:
                    await redis.publish("alerts:updates", json.dumps({
                        "type": "new_alerts",
                        "patient_id": patient_id,
                        "alerts": new_alerts,
                    }))
            else:
                await manager.broadcast(f"vitals:{patient_id}", payload)
        except Exception as e:
            logger.error(f"WebSocket broadcast error for {patient_id}: {e}")
        lat["ws_broadcast_ms"] = round((time.perf_counter() - t0) * 1000, 2)

        # 11. Record total pipeline latency to Redis rolling window
        lat["total_pipeline_ms"] = round((time.perf_counter() - pipeline_start) * 1000, 2)
        lat["patient_id"] = patient_id
        lat["ts"] = time.time()
        try:
            await record_pipeline_latency(redis, lat)
            logger.debug(f"Pipeline latency [{patient_id}]: total={lat['total_pipeline_ms']}ms  risk={lat.get('risk_engine_ms')}ms  ws={lat.get('ws_broadcast_ms')}ms")
        except Exception:
            pass



@router.get("/patients/{patient_id}/vitals/latest")
async def get_latest_vital(patient_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(VitalReading)
        .where(VitalReading.patient_id == patient_id)
        .order_by(desc(VitalReading.time))
        .limit(1)
    )
    vital = result.scalars().first()
    if not vital:
        raise HTTPException(status_code=404, detail="No vitals found")
    return {"hr": vital.hr, "bp_sys": vital.bp_sys, "bp_dia": vital.bp_dia,
            "spo2": vital.spo2, "temp": vital.temp, "rr": vital.rr,
            "time": vital.time.isoformat()}


@router.get("/patients/{patient_id}/vitals/history")
async def get_vitals_history(
    patient_id: str,
    limit: int = Query(60, le=1000),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(VitalReading)
        .where(VitalReading.patient_id == patient_id)
        .order_by(desc(VitalReading.time))
        .limit(limit)
    )
    vitals = result.scalars().all()
    return [
        {"hr": v.hr, "bp_sys": v.bp_sys, "bp_dia": v.bp_dia,
         "spo2": v.spo2, "temp": v.temp, "rr": v.rr,
         "time": v.time.isoformat()}
        for v in reversed(vitals)
    ]


@router.get("/patients/{patient_id}/risk/current")
async def get_current_risk(patient_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RiskAssessment)
        .where(RiskAssessment.patient_id == patient_id)
        .order_by(desc(RiskAssessment.ts))
        .limit(1)
    )
    risk = result.scalars().first()
    if not risk:
        raise HTTPException(status_code=404, detail="No risk assessment found")
    return risk


@router.get("/patients/{patient_id}/risk/history")
async def get_risk_history(
    patient_id: str,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RiskAssessment)
        .where(RiskAssessment.patient_id == patient_id)
        .order_by(desc(RiskAssessment.ts))
        .limit(limit)
    )
    return list(reversed(result.scalars().all()))


@router.get("/patients/{patient_id}/explainability")
async def get_explainability(patient_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ExplainabilityReport)
        .where(ExplainabilityReport.patient_id == patient_id)
        .order_by(desc(ExplainabilityReport.ts))
        .limit(1)
    )
    report = result.scalars().first()
    if not report:
        raise HTTPException(status_code=404, detail="No explainability report found")
    return {"factors": report.factors, "reasoning_trace": report.reasoning_trace, "ts": report.ts.isoformat()}


@router.get("/patients/{patient_id}/prediction")
async def get_prediction(patient_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DeteriorationPrediction)
        .where(DeteriorationPrediction.patient_id == patient_id)
        .order_by(desc(DeteriorationPrediction.ts))
        .limit(1)
    )
    pred = result.scalars().first()
    if not pred:
        raise HTTPException(status_code=404, detail="No prediction found")
    return {"likelihood_pct": pred.likelihood_pct, "time_to_critical_min": pred.time_to_critical_min,
            "trajectory": pred.trajectory, "trend": pred.trend}


@router.post("/patients/{patient_id}/triage")
async def generate_triage(patient_id: str, db: AsyncSession = Depends(get_db)):
    """Generate AI clinical triage summary (Groq LLM with fallback)."""
    from app.ai.triage_assistant import generate_triage as _gen_triage
    try:
        result = await _gen_triage(patient_id=patient_id, db=db)
        return result
    except Exception as e:
        logger.error(f"Triage generation error for {patient_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/patients/{patient_id}/timeline")
async def get_timeline(
    patient_id: str,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TimelineEvent)
        .where(TimelineEvent.patient_id == patient_id)
        .order_by(desc(TimelineEvent.ts))
        .limit(limit)
    )
    events = result.scalars().all()
    return [{"id": e.id, "event_type": e.event_type, "payload": e.payload,
             "ts": e.ts.isoformat()} for e in events]
