def generate_explainability(
    vitals: dict,
    abnormalities: list,
    risk_score: float,
    trend: str,
    age: int
) -> dict:
    """
    Returns:
    {
        factors: [{factor, weight, direction, value, threshold, contribution_pct}],
        reasoning_trace: str  # plain English, grounded in structured factors only
    }
    """
    from app.ai.rules.clinical_thresholds import ABNORMALITY_WEIGHTS
    
    factors = []
    total_weight = 0
    
    for ab in abnormalities:
        weight = ABNORMALITY_WEIGHTS.get(ab['type'], {}).get('weight', 10)
        total_weight += weight
        factors.append({
            'factor': ab['type'],
            'weight': weight,
            'direction': 'above' if ab['value'] > ab['threshold'] else 'below',
            'value': ab['value'],
            'threshold': ab['threshold'],
            'contribution_pct': 0
        })
        
    for f in factors:
        if total_weight > 0:
            f['contribution_pct'] = (f['weight'] / total_weight) * 100
            
    factors.sort(key=lambda x: x['contribution_pct'], reverse=True)
    
    if factors:
        top_factors = [f['factor'] for f in factors[:2]]
        reasoning = f"Elevated risk is primarily driven by {' and '.join(top_factors).replace('_', ' ')}."
    else:
        reasoning = "Patient vitals are currently within stable ranges."
        
    return {
        'factors': factors,
        'reasoning_trace': reasoning
    }
