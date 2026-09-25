import httpx
import logging
from typing import Any, Optional
from app.config import settings

logger = logging.getLogger(__name__)

async def trigger_vapi_call(
    patient_name: str,
    patient_id: str,
    ward: str,
    risk_score: float,
    reasons: list[str],
    phone_number: str = "+919035890001",
) -> dict:
    """
    Triggers an outbound clinical escalation voice call via Vapi API.
    Calls the specified phone_number with clinical situation briefing.
    """
    first_message = (
        f"Eagles Eye A.I. Emergency Alert. Patient {patient_name} in {ward} has an escalated risk score of "
        f"{risk_score:.0f} percent. Primary indicators: {'. '.join(reasons[:2])}. Please confirm immediate clinical response."
    )
    
    payload = {
        'assistantId': settings.VAPI_ASSISTANT_ID,
        'phoneNumberId': settings.VAPI_PHONE_NUMBER_ID,
        'customer': {'number': phone_number},
        'assistantOverrides': {'firstMessage': first_message}
    }
    
    if not settings.VAPI_PRIVATE_KEY or not settings.VAPI_ASSISTANT_ID or not settings.VAPI_PHONE_NUMBER_ID:
        logger.warning(f"Vapi credentials incomplete. Skipping voice call dispatch to {phone_number}.")
        return {'success': False, 'call_id': None, 'error': 'Missing Vapi configuration'}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(
                "https://api.vapi.ai/call/phone",
                headers={"Authorization": f"Bearer {settings.VAPI_PRIVATE_KEY}"},
                json=payload
            )
            if res.status_code in (200, 201):
                data = res.json()
                call_id = data.get('id')
                logger.info(f"Vapi outbound call successfully initiated to {phone_number}: id={call_id}")
                return {'success': True, 'call_id': call_id, 'status': data.get('status', 'queued')}
            else:
                err_text = res.text
                logger.error(f"Vapi dispatch failed for {phone_number} (status {res.status_code}): {err_text}")
                return {'success': False, 'call_id': None, 'error': err_text}
    except Exception as e:
        logger.error(f"Vapi connection error for {phone_number}: {e}")
        return {'success': False, 'call_id': None, 'error': str(e)}
