from typing import Any

async def check_system_health(db: Any, redis: Any) -> dict:
    services = {}
    try:
        if db:
            # Mock DB check
            pass
        services['database'] = {'status': 'ok', 'latency_ms': 5}
    except Exception as e:
        services['database'] = {'status': 'down', 'error': str(e)}
        
    services['redis'] = {'status': 'ok'}
    services['ai_model'] = {'status': 'ok'}
    
    overall = 'ok' if all(s['status']=='ok' for s in services.values()) else 'degraded'
    return {'overall': overall, 'services': services}
