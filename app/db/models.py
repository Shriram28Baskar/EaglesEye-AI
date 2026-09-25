from datetime import datetime
import uuid
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, Boolean, JSON, Text
from app.db.base import Base

class VitalReading(Base):
    __tablename__ = 'vital_readings'
    time = Column(DateTime(timezone=True), primary_key=True, default=datetime.utcnow)
    patient_id = Column(String, primary_key=True, index=True)
    hr = Column(Float)  # heart rate bpm
    bp_sys = Column(Float)  # systolic mmHg
    bp_dia = Column(Float)  # diastolic mmHg
    spo2 = Column(Float)  # %
    temp = Column(Float)  # celsius
    rr = Column(Float)  # respiratory rate breaths/min

class PatientProfile(Base):
    __tablename__ = 'patients'
    id = Column(String, primary_key=True)  # e.g. P01
    name = Column(String)
    age = Column(Integer)
    gender = Column(String)  # M/F
    ward = Column(String)
    room = Column(String)
    diagnosis = Column(String)
    assigned_nurse = Column(String, nullable=True)
    admitted_days = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class RiskAssessment(Base):
    __tablename__ = 'risk_assessments'
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String, ForeignKey('patients.id'), index=True)
    risk_score = Column(Float)  # 0-100
    confidence = Column(Float)  # 0-100
    severity = Column(String)  # low/moderate/high/critical
    abnormalities = Column(JSON)  # list of detected abnormalities
    top_factors = Column(JSON)  # ranked contributing factors
    reasoning = Column(Text)  # plain-language explanation
    trend = Column(String)  # improving/stable/deteriorating/rapidly_deteriorating
    model_version = Column(String, default='hybrid-v1')
    ai_degraded = Column(Boolean, default=False)
    ts = Column(DateTime(timezone=True), default=datetime.utcnow, index=True)

class ExplainabilityReport(Base):
    __tablename__ = 'explainability_reports'
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String, ForeignKey('patients.id'), index=True)
    risk_assessment_id = Column(String, ForeignKey('risk_assessments.id'))
    factors = Column(JSON)  # [{factor, weight, direction, value}]
    reasoning_trace = Column(Text)
    ts = Column(DateTime(timezone=True), default=datetime.utcnow)

class DeteriorationPrediction(Base):
    __tablename__ = 'deterioration_predictions'
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String, ForeignKey('patients.id'), index=True)
    likelihood_pct = Column(Float)
    time_to_critical_min = Column(Float, nullable=True)  # null if stable/improving
    trajectory = Column(JSON)  # [{t_minutes, predicted_risk}]
    trend = Column(String)
    ts = Column(DateTime(timezone=True), default=datetime.utcnow)

class TriageSummary(Base):
    __tablename__ = 'triage_summaries'
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String, ForeignKey('patients.id'), index=True)
    condition = Column(Text)
    clinical_concern = Column(Text)
    predicted_outcome = Column(Text)
    key_contributors = Column(JSON)  # list of strings
    recommended_actions = Column(JSON)  # list of strings
    ai_degraded = Column(Boolean, default=False)
    generated_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class AlertEvent(Base):
    __tablename__ = 'alert_events'
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String, ForeignKey('patients.id'), index=True)
    alert_type = Column(String)  # single_vital / correlated
    abnormality_type = Column(String)  # tachycardia / hypoxia / possible_septic_shock etc.
    severity = Column(String)  # low/moderate/high/critical
    status = Column(String, default='generated')  # generated/acknowledged/viewed/resolved/escalated
    status_history = Column(JSON, default=list)  # [{status, ts, by_user}]
    correlated_from = Column(JSON, default=list)  # list of single-vital alert ids merged into this
    vitals_snapshot = Column(JSON)  # {hr, bp_sys, spo2, temp} at time of alert
    message = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

class TimelineEvent(Base):
    __tablename__ = 'timeline_events'
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String, ForeignKey('patients.id'), index=True)
    event_type = Column(String)  # vital/alert/risk/prediction/triage/action
    payload = Column(JSON)
    ts = Column(DateTime(timezone=True), default=datetime.utcnow, index=True)

class Notification(Base):
    __tablename__ = 'notifications'
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String, nullable=True)
    notification_type = Column(String)  # alert/escalation/triage/system
    title = Column(String)
    body = Column(Text)
    read = Column(Boolean, default=False)
    priority = Column(String, default='normal')  # normal/high/critical
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class EscalationCall(Base):
    __tablename__ = 'escalation_calls'
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String, nullable=True)
    call_provider = Column(String, default='vapi')  # vapi/twilio
    call_id = Column(String)  # Vapi call ID
    phone = Column(String)
    person_contacted = Column(String)
    status = Column(String)  # queued/ringing/completed/failed
    ended_reason = Column(String, nullable=True)
    alert_message = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class SimulationRun(Base):
    __tablename__ = 'simulation_runs'
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String)
    mode = Column(String)  # stable/gradual_decline/severe_deterioration
    status = Column(String, default='running')  # running/stopped/completed
    started_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    stopped_at = Column(DateTime(timezone=True), nullable=True)
    ticks_generated = Column(Integer, default=0)
