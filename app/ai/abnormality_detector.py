from typing import List, Dict, Any
from app.ai.rules.clinical_thresholds import get_thresholds, CORRELATION_RULES, ABNORMALITY_WEIGHTS

def detect_abnormalities(vitals: Dict[str, Any], age: int) -> List[Dict[str, Any]]:
    """
    Returns list of detected abnormalities:
    [{type: str, severity: str, value: float, threshold: float, message: str}]
    """
    thresholds = get_thresholds(age)
    abnormalities = []

    hr = vitals.get('hr')
    if hr is not None:
        if hr > thresholds['hr_high']:
            abnormalities.append({'type': 'tachycardia', 'severity': 'high', 'value': hr, 'threshold': thresholds['hr_high'], 'message': f'Elevated heart rate: {hr}'})
        elif hr < thresholds['hr_low']:
            abnormalities.append({'type': 'bradycardia', 'severity': 'high', 'value': hr, 'threshold': thresholds['hr_low'], 'message': f'Low heart rate: {hr}'})

    spo2 = vitals.get('spo2')
    if spo2 is not None:
        if spo2 <= thresholds['spo2_critical']:
            abnormalities.append({'type': 'hypoxia_severe', 'severity': 'critical', 'value': spo2, 'threshold': thresholds['spo2_critical'], 'message': f'Severe hypoxia: {spo2}%'})
        elif spo2 <= thresholds['spo2_low']:
            abnormalities.append({'type': 'hypoxia_mild', 'severity': 'high', 'value': spo2, 'threshold': thresholds['spo2_low'], 'message': f'Mild hypoxia: {spo2}%'})

    sbp = vitals.get('bp_sys')
    if sbp is not None:
        if sbp > thresholds['sbp_high']:
            abnormalities.append({'type': 'hypertension', 'severity': 'high', 'value': sbp, 'threshold': thresholds['sbp_high'], 'message': f'High blood pressure: {sbp}'})
        elif sbp < thresholds['sbp_low']:
            abnormalities.append({'type': 'hypotension', 'severity': 'critical', 'value': sbp, 'threshold': thresholds['sbp_low'], 'message': f'Low blood pressure: {sbp}'})

    temp = vitals.get('temp')
    if temp is not None:
        if temp > thresholds['temp_high']:
            abnormalities.append({'type': 'fever', 'severity': 'moderate', 'value': temp, 'threshold': thresholds['temp_high'], 'message': f'Fever: {temp}'})
        elif temp < thresholds['temp_low']:
            abnormalities.append({'type': 'hypothermia', 'severity': 'high', 'value': temp, 'threshold': thresholds['temp_low'], 'message': f'Hypothermia: {temp}'})
            
    rr = vitals.get('rr')
    if rr is not None:
        if rr > thresholds['rr_high']:
            abnormalities.append({'type': 'tachypnea', 'severity': 'high', 'value': rr, 'threshold': thresholds['rr_high'], 'message': f'Rapid breathing: {rr}'})
        elif rr < thresholds['rr_low']:
            abnormalities.append({'type': 'bradypnea', 'severity': 'high', 'value': rr, 'threshold': thresholds['rr_low'], 'message': f'Slow breathing: {rr}'})

    return abnormalities

def classify_severity(abnormalities: List[Dict[str, Any]]) -> str:
    """Returns overall severity: low/moderate/high/critical"""
    if not abnormalities:
        return 'low'
    
    severities = [a['severity'] for a in abnormalities]
    
    if 'critical' in severities:
        return 'critical'
    elif 'high' in severities:
        return 'high'
    elif 'moderate' in severities:
        return 'moderate'
    else:
        return 'low'
