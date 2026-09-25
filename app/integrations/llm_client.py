import json
import httpx
import logging
from typing import Any
from app.config import settings

logger = logging.getLogger(__name__)

async def generate_triage_summary(
    patient_data: dict,
    risk_assessment: dict,
    explainability: dict,
    vitals: dict
) -> dict:
    """
    Calls Groq API with LLaMA 3.1 70B for clinical decision support.
    Falls back to deterministic rule-based triage if API is unavailable or unconfigured.
    """
    SYSTEM_PROMPT = """
You are a clinical decision support AI for EaglesEye hospital monitoring.
You MUST output ONLY valid JSON matching this exact schema:
{
  "condition": "<1-sentence current patient condition>",
  "clinical_concern": "<specific named clinical concern if any, else 'None identified'>",
  "predicted_outcome": "<1-sentence predicted outcome if untreated>",
  "key_contributors": ["<factor 1>", "<factor 2>", "<factor 3>"],
  "recommended_actions": ["<action 1>", "<action 2>", "<action 3>"]
}
Base EVERY statement ONLY on the structured data provided. No free narrative. No fabrication."""

    prompt = f"""
Patient Data: {json.dumps(patient_data)}
Vitals: {json.dumps(vitals)}
Risk: {json.dumps(risk_assessment)}
Explainability: {json.dumps(explainability)}
"""
    
    api_key = settings.GROQ_API_KEY
    if not api_key:
        logger.warning("GROQ_API_KEY not configured. Using deterministic triage fallback.")
        from app.ai.triage_fallback import generate_triage_fallback
        return generate_triage_fallback(patient_data, risk_assessment, vitals)
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": getattr(settings, "GROQ_MODEL", "llama-3.1-70b-versatile"),
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt}
                    ],
                    "response_format": {"type": "json_object"}
                },
                timeout=10.0
            )
            data = response.json()
            content = data['choices'][0]['message']['content']
            res = json.loads(content)
            res['ai_degraded'] = False
            return res
    except Exception as e:
        logger.warning(f"Groq API call error ({e}). Using deterministic triage fallback.")
        from app.ai.triage_fallback import generate_triage_fallback
        return generate_triage_fallback(patient_data, risk_assessment, vitals)
