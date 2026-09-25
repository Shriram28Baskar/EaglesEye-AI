import asyncio
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import PatientProfile, VitalReading, RiskAssessment
import random

MOCK_PATIENTS = [
    {"id": "P01", "name": "John Doe", "age": 45, "gender": "M", "ward": "ICU", "room": "101", "diagnosis": "Sepsis", "assigned_nurse": "Nurse Sarah"},
    {"id": "P02", "name": "Jane Smith", "age": 62, "gender": "F", "ward": "ICU", "room": "102", "diagnosis": "Pneumonia", "assigned_nurse": "Nurse Sarah"},
    {"id": "P03", "name": "Alice Johnson", "age": 28, "gender": "F", "ward": "Post-Op", "room": "201", "diagnosis": "Appendectomy", "assigned_nurse": "Nurse John"},
    {"id": "P04", "name": "Bob Brown", "age": 75, "gender": "M", "ward": "Cardiac", "room": "301", "diagnosis": "Heart Failure", "assigned_nurse": "Nurse Emily"},
    {"id": "P05", "name": "Charlie Davis", "age": 50, "gender": "M", "ward": "General", "room": "401", "diagnosis": "Diabetes", "assigned_nurse": "Nurse Emily"},
    {"id": "P06", "name": "Diana Evans", "age": 35, "gender": "F", "ward": "General", "room": "402", "diagnosis": "Asthma", "assigned_nurse": "Nurse Michael"},
    {"id": "P07", "name": "Evan Foster", "age": 82, "gender": "M", "ward": "ICU", "room": "103", "diagnosis": "Stroke", "assigned_nurse": "Nurse Sarah"},
    {"id": "P08", "name": "Fiona Green", "age": 41, "gender": "F", "ward": "Post-Op", "room": "202", "diagnosis": "Cholecystectomy", "assigned_nurse": "Nurse John"},
    {"id": "P09", "name": "George Harris", "age": 55, "gender": "M", "ward": "Cardiac", "room": "302", "diagnosis": "Myocardial Infarction", "assigned_nurse": "Nurse Emily"},
    {"id": "P10", "name": "Hannah Ivy", "age": 22, "gender": "F", "ward": "General", "room": "403", "diagnosis": "Dehydration", "assigned_nurse": "Nurse Michael"},
    {"id": "P11", "name": "Ian Jones", "age": 68, "gender": "M", "ward": "ICU", "room": "104", "diagnosis": "Respiratory Failure", "assigned_nurse": "Nurse Sarah"},
    {"id": "P12", "name": "Julia King", "age": 47, "gender": "F", "ward": "General", "room": "404", "diagnosis": "Hypertension", "assigned_nurse": "Nurse Michael"},
    {"id": "P13", "name": "Kevin Lee", "age": 33, "gender": "M", "ward": "Post-Op", "room": "203", "diagnosis": "Hernia Repair", "assigned_nurse": "Nurse John"},
    {"id": "P14", "name": "Laura Miller", "age": 71, "gender": "F", "ward": "Cardiac", "room": "303", "diagnosis": "Arrhythmia", "assigned_nurse": "Nurse Emily"},
    {"id": "P15", "name": "Mike Nelson", "age": 59, "gender": "M", "ward": "General", "room": "405", "diagnosis": "Cellulitis", "assigned_nurse": "Nurse Michael"},
    {"id": "P16", "name": "Nina Owens", "age": 29, "gender": "F", "ward": "ICU", "room": "105", "diagnosis": "Trauma", "assigned_nurse": "Nurse Sarah"},
    {"id": "P17", "name": "Oscar Perez", "age": 64, "gender": "M", "ward": "Post-Op", "room": "204", "diagnosis": "Knee Replacement", "assigned_nurse": "Nurse John"},
    {"id": "P18", "name": "Paula Quinn", "age": 52, "gender": "F", "ward": "Cardiac", "room": "304", "diagnosis": "Angina", "assigned_nurse": "Nurse Emily"},
    {"id": "P19", "name": "Quincy Roberts", "age": 38, "gender": "M", "ward": "General", "room": "406", "diagnosis": "Gastroenteritis", "assigned_nurse": "Nurse Michael"},
    {"id": "P20", "name": "Rachel Scott", "age": 77, "gender": "F", "ward": "ICU", "room": "106", "diagnosis": "Septic Shock", "assigned_nurse": "Nurse Sarah"}
]

async def seed_patients_if_empty(session: AsyncSession):
    result = await session.execute(select(PatientProfile))
    existing = result.scalars().first()
    
    if existing:
        print("Database already seeded.")
        return

    print("Seeding database with initial patients...")
    now = datetime.utcnow()
    
    for p_data in MOCK_PATIENTS:
        patient = PatientProfile(**p_data)
        session.add(patient)
        
        for i in range(12, 0, -1):
            reading_time = now - timedelta(minutes=5*i)
            vital = VitalReading(
                patient_id=patient.id,
                time=reading_time,
                hr=random.uniform(60, 100),
                bp_sys=random.uniform(110, 130),
                bp_dia=random.uniform(70, 85),
                spo2=random.uniform(95, 100),
                temp=random.uniform(36.5, 37.5),
                rr=random.uniform(12, 20)
            )
            session.add(vital)
        
        # simple baseline risk
        risk = RiskAssessment(
            patient_id=patient.id,
            risk_score=random.uniform(10, 30),
            confidence=0.9,
            severity="low",
            abnormalities=[],
            top_factors=[],
            reasoning="Stable baseline",
            trend="stable",
            ts=now
        )
        session.add(risk)

    await session.commit()
    print("Database seeding completed.")
