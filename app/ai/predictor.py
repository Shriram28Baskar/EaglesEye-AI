def predict_trajectory(
    risk_history: list[dict],  # [{ts, risk_score}]
    current_risk: float,
    trend: str
) -> dict:
    """
    Returns trajectory prediction.
    """
    trajectory = []
    time_to_critical_min = None
    
    if trend == 'rapidly_deteriorating':
        slope = 1.5
        likelihood = 85.0
    elif trend == 'deteriorating':
        slope = 0.5
        likelihood = 60.0
    elif trend == 'improving':
        slope = -0.5
        likelihood = 10.0
    else:
        slope = 0
        likelihood = 20.0
        
    current = current_risk
    if current >= 80.0:
        time_to_critical_min = 0.0
    elif slope > 0:
        min_to_80 = (80.0 - current) / slope
        time_to_critical_min = round(max(1.0, min_to_80), 1)

    for t in [15, 30, 45, 60]:
        pred = current + slope * t
        pred = max(0.0, min(100.0, pred))
        trajectory.append({'t_minutes': t, 'predicted_risk': round(pred, 1)})
            
    return {
        'likelihood_pct': likelihood,
        'time_to_critical_min': time_to_critical_min,
        'trajectory': trajectory,
        'trend': trend
    }
