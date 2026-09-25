def generate_triage_fallback(
    patient_data: dict,
    risk_assessment: dict,
    vitals: dict
) -> dict:
    """
    Generates evidence-grounded rule-based triage summary without LLM.
    Strictly follows schema with ai_degraded=True.
    """
    abnormalities = risk_assessment.get('abnormalities', [])
    factors = [ab['type'] for ab in abnormalities]
    severity = risk_assessment.get('severity', 'low')
    risk_score = risk_assessment.get('risk_score', 0)

    # Clinical concern synthesis
    factor_set = set(factors)
    if {'tachycardia', 'hypotension', 'fever'}.issubset(factor_set):
        clinical_concern = "High clinical suspicion for Septic Shock"
    elif {'hypoxia_severe', 'tachypnea'}.issubset(factor_set) or 'hypoxia_severe' in factor_set:
        clinical_concern = "Acute Hypoxemic Respiratory Distress"
    elif {'tachycardia', 'hypotension'}.issubset(factor_set):
        clinical_concern = "Hemodynamic Instability / Hypovolemic Shock"
    elif 'hypertension' in factor_set and 'tachycardia' in factor_set:
        clinical_concern = "Hypertensive Crisis with Sympathetic Surge"
    elif factors:
        clinical_concern = f"Acute Deterioration: {', '.join(factors[:2]).replace('_', ' ').title()}"
    else:
        clinical_concern = "None identified — Baseline Physiological Limits"

    # Predicted outcome
    if severity == 'critical' or risk_score >= 80:
        predicted_outcome = "High risk of cardiopulmonary arrest or ICU transfer within 30–60 minutes if untreated."
    elif severity == 'high' or risk_score >= 60:
        predicted_outcome = "Likely progression to organ hypoperfusion and critical decompensation without intervention."
    elif severity == 'moderate':
        predicted_outcome = "Potential for progressive vital sign destabilization; requires escalated surveillance."
    else:
        predicted_outcome = "Stable clinical trajectory with maintenance of physiological equilibrium."

    # Recommended actions mapped to specific findings
    actions = []
    if 'hypoxia_severe' in factor_set or 'hypoxia_mild' in factor_set:
        actions.append("Titrate high-flow supplemental O₂ and check arterial blood gas (ABG)")
    if 'hypotension' in factor_set:
        actions.append("Initiate 500mL crystalloid IV fluid challenge and check mean arterial pressure (MAP)")
    if 'tachycardia' in factor_set or 'bradycardia' in factor_set:
        actions.append("Obtain stat 12-lead ECG and initiate continuous cardiac telemetry rhythm strip")
    if 'fever' in factor_set:
        actions.append("Draw two sets of blood cultures, obtain serum lactate, and prepare broad-spectrum IV antibiotics")
    if not actions:
        actions = ["Continue continuous telemetry monitoring", "Record full vitals check in 60 minutes"]

    condition = (
        f"Patient is {severity.upper()} acuity (Risk: {risk_score:.0f}%) with {len(factors)} active physiological alarms."
        if factors else
        f"Patient is physiologically stable (Risk: {risk_score:.0f}%) within reference ranges."
    )

    return {
        "condition": condition,
        "clinical_concern": clinical_concern,
        "predicted_outcome": predicted_outcome,
        "key_contributors": [f.replace('_', ' ').title() for f in factors[:3]] if factors else ["All Vitals Normal"],
        "recommended_actions": actions[:3],
        "ai_degraded": True
    }
