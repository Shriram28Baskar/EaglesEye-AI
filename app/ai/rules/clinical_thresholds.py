# Age-banded threshold rules
ABNORMALITY_WEIGHTS = {
    'tachycardia':      {'weight': 15, 'description': 'Elevated heart rate'},
    'bradycardia':      {'weight': 18, 'description': 'Low heart rate'},
    'hypoxia_severe':   {'weight': 35, 'description': 'Severe oxygen desaturation'},
    'hypoxia_mild':     {'weight': 15, 'description': 'Mild oxygen desaturation'},
    'hypotension':      {'weight': 25, 'description': 'Low blood pressure'},
    'hypertension':     {'weight': 12, 'description': 'High blood pressure'},
    'fever':            {'weight': 10, 'description': 'Elevated temperature'},
    'hypothermia':      {'weight': 20, 'description': 'Low temperature'},
    'tachypnea':        {'weight': 12, 'description': 'Rapid breathing'},
    'bradypnea':        {'weight': 15, 'description': 'Slow breathing'},
}

# Combined pattern rules (alert correlation)
CORRELATION_RULES = [
    {
        'name': 'Possible Septic Shock',
        'requires': ['tachycardia', 'hypotension', 'fever'],
        'confidence_base': 0.82,
        'severity': 'critical'
    },
    {
        'name': 'Possible Respiratory Failure',  
        'requires': ['hypoxia_severe', 'tachypnea'],
        'confidence_base': 0.78,
        'severity': 'critical'
    },
    {
        'name': 'Possible Hypovolemic Shock',
        'requires': ['tachycardia', 'hypotension'],
        'confidence_base': 0.72,
        'severity': 'high'
    },
    {
        'name': 'Possible Cardiac Event',
        'requires': ['bradycardia', 'hypotension'],
        'confidence_base': 0.75,
        'severity': 'critical'
    },
    {
        'name': 'Hypoxia with Tachycardia',
        'requires': ['hypoxia_mild', 'tachycardia'],
        'confidence_base': 0.65,
        'severity': 'high'
    },
    {
        'name': 'Hypertensive Crisis with Tachycardia',
        'requires': ['hypertension', 'tachycardia'],
        'confidence_base': 0.68,
        'severity': 'high'
    },
]

def get_thresholds(age: int) -> dict:
    # Returns age-appropriate thresholds
    if age < 1: # Infant
        return {'hr_high': 160, 'hr_low': 90, 'spo2_critical': 90, 'spo2_low': 94, 'sbp_high': 105, 'sbp_low': 70, 'temp_high': 38.0, 'temp_low': 36.0, 'rr_high': 50, 'rr_low': 25}
    elif age < 12: # Child
        return {'hr_high': 130, 'hr_low': 70, 'spo2_critical': 92, 'spo2_low': 95, 'sbp_high': 120, 'sbp_low': 80, 'temp_high': 38.0, 'temp_low': 36.0, 'rr_high': 30, 'rr_low': 18}
    elif age < 65: # Adult
        return {'hr_high': 100, 'hr_low': 60, 'spo2_critical': 90, 'spo2_low': 94, 'sbp_high': 130, 'sbp_low': 90, 'temp_high': 38.0, 'temp_low': 36.0, 'rr_high': 20, 'rr_low': 12}
    else: # Senior
        return {'hr_high': 100, 'hr_low': 55, 'spo2_critical': 90, 'spo2_low': 94, 'sbp_high': 140, 'sbp_low': 90, 'temp_high': 38.0, 'temp_low': 35.5, 'rr_high': 24, 'rr_low': 12}
