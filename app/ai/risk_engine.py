from typing import Any, Dict, List
from app.ai.abnormality_detector import detect_abnormalities, classify_severity
from app.ai.models.deterioration_classifier import predict_deterioration
from app.ai.rules.clinical_thresholds import ABNORMALITY_WEIGHTS, CORRELATION_RULES

async def compute_risk(
    patient_id: str,
    current_vitals: dict,
    vitals_history: list[dict],
    age: int,
    db: Any,
    redis: Any
) -> dict:
    """
    Returns full risk assessment dict.
    """
    abnormalities = detect_abnormalities(current_vitals, age)
    rules_risk = 0.0
    for ab in abnormalities:
        weight = ABNORMALITY_WEIGHTS.get(ab['type'], {}).get('weight', 0)
        mult = 1.0
        if ab['severity'] == 'critical': mult = 1.5
        elif ab['severity'] == 'high': mult = 1.2
        rules_risk += weight * mult
        
    correlation_bonus = 0.0
    ab_types = [a['type'] for a in abnormalities]
    for rule in CORRELATION_RULES:
        if all(req in ab_types for req in rule['requires']):
            correlation_bonus += 20.0
            break
            
    # Trend adjustment based on vital slope
    trend_adj = 0.0
    if len(vitals_history) >= 2:
        latest_h = vitals_history[0] if vitals_history else current_vitals
        prev_h = vitals_history[-1] if vitals_history else current_vitals
        hr_diff = latest_h.get('hr', 75) - prev_h.get('hr', 75)
        spo2_diff = latest_h.get('spo2', 98) - prev_h.get('spo2', 98)
        if hr_diff > 15 or spo2_diff < -4:
            trend_adj = 10.0
        elif hr_diff > 8 or spo2_diff < -2:
            trend_adj = 5.0
        elif hr_diff < -8 and spo2_diff > 2:
            trend_adj = -5.0

    rules_risk = max(0.0, min(100.0, rules_risk + trend_adj + correlation_bonus))
    
    ml_prob, _ = predict_deterioration(vitals_history, age)
    
    if len(vitals_history) > 0 and ml_prob is not None:
        final_risk = 0.6 * rules_risk + 0.4 * (ml_prob * 100.0)
        ai_degraded = False
        model_version = "hybrid-v1"
        model_agreement = 1.0 - (abs(rules_risk - (ml_prob * 100.0)) / 100.0)
    else:
        # Graceful degradation: 100% pure rule-based scoring
        final_risk = rules_risk
        ai_degraded = True
        model_version = "rules-fallback"
        model_agreement = 1.0

    final_risk = max(0.0, min(100.0, final_risk))

    # Calculate model agreement and confidence: f(reading_count, agreement)
    reading_factor = min(1.0, 0.4 + len(vitals_history) * 0.05)
    confidence = max(20.0, min(100.0, (0.5 * reading_factor + 0.5 * model_agreement) * 100.0))
    
    # Severity classification: max(abnormality_severity, risk_score_tier)
    ab_severity = classify_severity(abnormalities)
    if final_risk >= 80 or ab_severity == 'critical':
        severity = 'critical'
    elif final_risk >= 60 or ab_severity == 'high':
        severity = 'high'
    elif final_risk >= 40 or ab_severity == 'moderate':
        severity = 'moderate'
    else:
        severity = 'low'
        
    # Synthesize plain-language clinical reasoning grounded in active factors
    if abnormalities:
        ab_descriptions = [ab.get('message', ab['type'].replace('_', ' ')) for ab in abnormalities[:3]]
        if ai_degraded:
            reasoning = f"Elevated clinical risk driven by {'; '.join(ab_descriptions)} (clinical rules fallback)."
        else:
            reasoning = f"Elevated clinical risk driven by {'; '.join(ab_descriptions)} with ML deterioration risk of {ml_prob * 100:.0f}%."
    else:
        reasoning = "All monitored vital signs within baseline clinical thresholds."

    return {
        'risk_score': round(final_risk, 1),
        'confidence': round(confidence, 1),
        'severity': severity,
        'abnormalities': abnormalities,
        'top_factors': ab_types[:3],
        'reasoning': reasoning,
        'trend': 'stable',
        'model_version': model_version,
        'ai_degraded': ai_degraded
    }

def compute_trend(risk_history: list[float]) -> str:
    """Computes trend from last 5 risk scores"""
    if len(risk_history) < 2:
        return 'stable'
    recent = risk_history[-min(5, len(risk_history)):]
    diff = recent[-1] - recent[0]
    if diff > 15:
        return 'rapidly_deteriorating'
    elif diff > 5:
        return 'deteriorating'
    elif diff < -5:
        return 'improving'
    return 'stable'
