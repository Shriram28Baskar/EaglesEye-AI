"""
AI Clinical Triage Assistant — Orchestrates Groq LLM + fallback.
Loads real patient data from DB, calls LLM, saves TriageSummary.
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def generate_triage(patient_id: str, db: AsyncSession) -> dict:
    """
    Generates a clinical triage summary using Groq LLaMA 3.1.
    Falls back to rule-based template if LLM is unavailable.
    Saves result to TriageSummary table and creates a TimelineEvent.
    """
    from app.db.models import (
        PatientProfile, VitalReading, RiskAssessment,
        ExplainabilityReport, TriageSummary, TimelineEvent
    )
    from app.integrations.llm_client import generate_triage_summary

    # ── Load patient ─────────────────────────────────────────────────────────
    patient_res = await db.execute(
        select(PatientProfile).where(PatientProfile.id == patient_id)
    )
    patient = patient_res.scalars().first()
    if not patient:
        raise ValueError(f"Patient {patient_id} not found")

    # ── Load latest vitals ───────────────────────────────────────────────────
    vitals_res = await db.execute(
        select(VitalReading)
        .where(VitalReading.patient_id == patient_id)
        .order_by(desc(VitalReading.time))
        .limit(1)
    )
    vital = vitals_res.scalars().first()
    vitals_dict = {}
    if vital:
        vitals_dict = {
            "hr": vital.hr, "bp_sys": vital.bp_sys, "bp_dia": vital.bp_dia,
            "spo2": vital.spo2, "temp": vital.temp, "rr": vital.rr,
            "time": vital.time.isoformat() if vital.time else None,
        }

    # ── Load latest risk assessment ──────────────────────────────────────────
    risk_res = await db.execute(
        select(RiskAssessment)
        .where(RiskAssessment.patient_id == patient_id)
        .order_by(desc(RiskAssessment.ts))
        .limit(1)
    )
    risk = risk_res.scalars().first()
    risk_dict = {}
    if risk:
        risk_dict = {
            "risk_score": risk.risk_score,
            "severity": risk.severity,
            "trend": risk.trend,
            "abnormalities": risk.abnormalities or [],
            "top_factors": risk.top_factors or [],
            "reasoning": risk.reasoning,
            "model_version": risk.model_version,
        }

    # ── Load latest explainability ───────────────────────────────────────────
    expl_res = await db.execute(
        select(ExplainabilityReport)
        .where(ExplainabilityReport.patient_id == patient_id)
        .order_by(desc(ExplainabilityReport.ts))
        .limit(1)
    )
    expl = expl_res.scalars().first()
    expl_dict = {"factors": expl.factors if expl else [], "reasoning_trace": expl.reasoning_trace if expl else ""}

    # ── Build patient data dict ──────────────────────────────────────────────
    patient_dict = {
        "id": patient.id,
        "name": patient.name,
        "age": patient.age,
        "gender": patient.gender,
        "ward": patient.ward,
        "diagnosis": patient.diagnosis,
        "admitted_days": patient.admitted_days,
    }

    # ── Call LLM ─────────────────────────────────────────────────────────────
    logger.info(f"Generating triage for {patient_id} (risk={risk_dict.get('risk_score', '?')})")
    try:
        result = await generate_triage_summary(
            patient_data=patient_dict,
            risk_assessment=risk_dict,
            explainability=expl_dict,
            vitals=vitals_dict,
        )
    except Exception as e:
        logger.error(f"Triage LLM error for {patient_id}: {e}")
        from app.ai.triage_fallback import generate_triage_fallback
        result = generate_triage_fallback(patient_dict, risk_dict, vitals_dict)

    # ── Save TriageSummary ───────────────────────────────────────────────────
    triage_obj = TriageSummary(
        id=str(uuid.uuid4()),
        patient_id=patient_id,
        condition=result.get("condition", "Unknown"),
        clinical_concern=result.get("clinical_concern", "None identified"),
        predicted_outcome=result.get("predicted_outcome", "Unknown"),
        key_contributors=result.get("key_contributors", []),
        recommended_actions=result.get("recommended_actions", []),
        ai_degraded=result.get("ai_degraded", False),
    )
    db.add(triage_obj)

    # ── Timeline event ───────────────────────────────────────────────────────
    db.add(TimelineEvent(
        patient_id=patient_id,
        event_type="triage",
        payload={
            "condition": result.get("condition"),
            "clinical_concern": result.get("clinical_concern"),
            "ai_degraded": result.get("ai_degraded", False),
        },
    ))

    await db.commit()
    logger.info(f"Triage complete for {patient_id}: ai_degraded={result.get('ai_degraded')}")
    return result
