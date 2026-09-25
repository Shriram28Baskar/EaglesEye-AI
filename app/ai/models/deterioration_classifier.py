import os
import numpy as np
try:
    import xgboost as xgb
    from sklearn.preprocessing import StandardScaler
    from joblib import dump, load
except ImportError:
    pass # Will be handled by graceful degradation if missing

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'deterioration_model.joblib')
SCALER_PATH = os.path.join(os.path.dirname(__file__), 'scaler.joblib')

def generate_synthetic_training_data(n_samples=5000):
    """
    Generate synthetic labeled training data:
    Features: [hr, bp_sys, bp_dia, spo2, temp, rr, age, hr_trend, spo2_trend, bp_trend]
    Label: 1 if deteriorating (risk>60), 0 otherwise
    """
    np.random.seed(42)
    X = []
    y = []
    
    for _ in range(n_samples):
        # 30% chance of critical patient, 70% stable
        if np.random.rand() < 0.3:
            # Critical
            hr = np.random.normal(120, 15) if np.random.rand() < 0.5 else np.random.normal(50, 10)
            bp_sys = np.random.normal(85, 10)
            bp_dia = np.random.normal(55, 10)
            spo2 = np.random.normal(90, 4)
            temp = np.random.normal(38.5, 1)
            rr = np.random.normal(28, 5)
            age = np.random.randint(18, 90)
            hr_trend = np.random.normal(5, 2)
            spo2_trend = np.random.normal(-2, 1)
            bp_trend = np.random.normal(-5, 2)
            label = 1
        else:
            # Stable
            hr = np.random.normal(75, 10)
            bp_sys = np.random.normal(120, 15)
            bp_dia = np.random.normal(80, 10)
            spo2 = np.random.normal(98, 1)
            temp = np.random.normal(37, 0.4)
            rr = np.random.normal(16, 2)
            age = np.random.randint(18, 90)
            hr_trend = np.random.normal(0, 1)
            spo2_trend = np.random.normal(0, 0.5)
            bp_trend = np.random.normal(0, 1)
            label = 0
            
        X.append([hr, bp_sys, bp_dia, spo2, temp, rr, age, hr_trend, spo2_trend, bp_trend])
        y.append(label)
        
    return np.array(X), np.array(y)

def train_model():
    """Train XGBoost classifier on synthetic data and save to disk"""
    X, y = generate_synthetic_training_data()
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    model = xgb.XGBClassifier(
        n_estimators=200,
        max_depth=5,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric='logloss',
        random_state=42
    )
    model.fit(X_scaled, y)
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    dump(model, MODEL_PATH)
    dump(scaler, SCALER_PATH)
    return model, scaler

def load_or_train_model():
    """Load existing model or train new one"""
    if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
        try:
            model = load(MODEL_PATH)
            scaler = load(SCALER_PATH)
            return model, scaler
        except Exception:
            pass
    return train_model()

def predict_deterioration(vitals_history: list[dict], age: int) -> tuple[float, float]:
    """
    Returns (deterioration_probability, confidence)
    vitals_history: list of recent vital dicts with trends
    """
    if not vitals_history:
        return 0.0, 0.0
        
    try:
        model, scaler = load_or_train_model()
    except Exception:
        # Fallback if xgboost not installed
        return 0.0, 0.0
        
    latest = vitals_history[-1]
    
    # Calculate simple trends if history is present
    hr_trend = 0
    spo2_trend = 0
    bp_trend = 0
    if len(vitals_history) > 1:
        prev = vitals_history[0]
        hr_trend = latest.get('hr', 75) - prev.get('hr', 75)
        spo2_trend = latest.get('spo2', 98) - prev.get('spo2', 98)
        bp_trend = latest.get('bp_sys', 120) - prev.get('bp_sys', 120)
        
    features = [[
        latest.get('hr', 75),
        latest.get('bp_sys', 120),
        latest.get('bp_dia', 80),
        latest.get('spo2', 98),
        latest.get('temp', 37.0),
        latest.get('rr', 16),
        age,
        hr_trend,
        spo2_trend,
        bp_trend
    ]]
    
    try:
        features_scaled = scaler.transform(features)
        prob = model.predict_proba(features_scaled)[0][1]
        confidence = min(1.0, 0.5 + len(vitals_history) * 0.1) # Confidence based on history length
        return float(prob), float(confidence)
    except Exception:
        return 0.0, 0.0
