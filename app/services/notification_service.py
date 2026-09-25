"""
Notification Service — Creates notifications and triggers Vapi escalation calls.
"""
import uuid
import json
import logging
from datetime import datetime, timezone
from typing import Any
from app.config import settings

logger = logging.getLogger(__name__)

# Track recently escalated patients to prevent double-firing (in-memory, per worker)
_escalated_recently: dict[str, float] = {}
ESCALATION_COOLDOWN_SECONDS = 300  # 5 min cooldown per patient


async def create_alert_notification(
    alert: dict,
    patient_name: str,
    db: Any,
    redis: Any,
):
    """Create a Notification record and push to Redis."""
    from app.db.models import Notification

    severity = alert.get("severity", "moderate")
    priority = "critical" if severity == "critical" else "high" if severity == "high" else "normal"

    notif = Notification(
        id=str(uuid.uuid4()),
        patient_id=alert.get("patient_id"),
        notification_type="alert",
        title=f"⚠️ Alert: {alert.get('abnormality_type', 'Unknown')} — {patient_name}",
        body=alert.get("message", ""),
        read=False,
        priority=priority,
    )
    db.add(notif)
    await db.commit()

    if redis:
        await redis.publish("notifications:updates", json.dumps({
            "type": "new_notification",
            "notification": {
                "id": notif.id,
                "patient_id": notif.patient_id,
                "notification_type": "alert",
                "title": notif.title,
                "body": notif.body,
                "priority": priority,
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        }))


async def check_and_escalate(
    patient_id: str,
    patient_name: str,
    ward: str,
    risk_score: float,
    reasons: list[str],
    db: Any,
    redis: Any,
):
    """
    Trigger Vapi outbound calls to both primary clinician and escalation supervisor
    if risk >= 80 and not in cooldown.
    Record EscalationCall table entries for each contact.
    """
    import time
    from app.integrations.vapi_client import trigger_vapi_call
    from app.db.models import EscalationCall, Notification

    now = time.time()
    last_escalation = _escalated_recently.get(patient_id, 0)

    if now - last_escalation < ESCALATION_COOLDOWN_SECONDS:
        logger.info(f"Escalation for {patient_id} skipped (cooldown active: {int(now - last_escalation)}s / {ESCALATION_COOLDOWN_SECONDS}s)")
        return

    _escalated_recently[patient_id] = now
    logger.warning(f"🚨 Triggering dual-tier escalation for patient {patient_id} (risk={risk_score:.1f})")

    # Dual-tier rota: Primary Clinician + Escalation Supervisor
    escalation_contacts = [
        {
            "name": getattr(settings, "PRIMARY_DOCTOR_NAME", "Doctor 1 (Primary)"),
            "phone": getattr(settings, "PRIMARY_DOCTOR_PHONE", "+919035890001"),
            "role": "Primary Clinician",
        },
        {
            "name": getattr(settings, "ESCALATION_SUPERVISOR_NAME", "Doctor 2 (Supervisor)"),
            "phone": getattr(settings, "ESCALATION_SUPERVISOR_PHONE", "+919363179481"),
            "role": "Escalation Supervisor",
        },
    ]

    successful_calls = []

    for contact in escalation_contacts:
        contact_name = contact["name"]
        contact_phone = contact["phone"]
        role = contact["role"]

        try:
            logger.info(f"Initiating escalation voice call to {role}: {contact_name} ({contact_phone})")
            result = await trigger_vapi_call(
                patient_name=patient_name,
                patient_id=patient_id,
                ward=ward,
                risk_score=risk_score,
                reasons=reasons[:3],
                phone_number=contact_phone,
            )

            call_id = result.get("call_id") or "call_unassigned"
            status = "queued" if result.get("success") else "failed"
            ended_reason = None if result.get("success") else result.get("error")

            call_record = EscalationCall(
                id=str(uuid.uuid4()),
                patient_id=patient_id,
                call_provider="vapi",
                call_id=call_id,
                phone=contact_phone,
                person_contacted=f"{contact_name} ({role})",
                status=status,
                ended_reason=ended_reason,
                alert_message=f"Critical alert: Patient {patient_name}, risk {risk_score:.0f}%. {', '.join(reasons[:2])}",
            )
            db.add(call_record)
            if result.get("success"):
                successful_calls.append(contact_phone)
                logger.info(f"Successfully queued escalation call to {contact_phone} (id={call_id})")
            else:
                logger.warning(f"Voice call to {contact_phone} could not be placed: {result.get('error')}")

        except Exception as ex:
            logger.error(f"Error dispatching escalation call to {contact_phone}: {ex}")

    try:
        # Create escalation notification in system
        contact_summary = ", ".join(f"{c['name']} ({c['phone']})" for c in escalation_contacts)
        notif = Notification(
            id=str(uuid.uuid4()),
            patient_id=patient_id,
            notification_type="escalation",
            title=f"🚨 Dual Escalation Triggered — {patient_name}",
            body=f"Automated voice alerts dispatched to {contact_summary}. Risk: {risk_score:.0f}%. {', '.join(reasons[:2])}.",
            read=False,
            priority="critical",
        )
        db.add(notif)
        await db.commit()

        if redis:
            await redis.publish("notifications:updates", json.dumps({
                "type": "escalation",
                "patient_id": patient_id,
                "risk_score": risk_score,
                "contacts_called": [c["phone"] for c in escalation_contacts],
            }))

    except Exception as e:
        logger.error(f"Failed to record escalation event in database/redis for {patient_id}: {e}")
