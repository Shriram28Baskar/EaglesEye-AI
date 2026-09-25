from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import logging
from contextlib import asynccontextmanager

from app.db.base import create_tables
from app.db.redis_client import await_redis_ready, RedisClient
from app.services.seed import seed_patients_if_empty
from app.db.base import AsyncSessionLocal
from app.ws.manager import manager
from app.ws import dashboard_hub, vitals_hub, alerts_hub, health_hub
from app.api import patients, dashboard, alerts, priority, notifications, search, simulator, system, ward

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up EaglesEye-AI Backend...")
    await create_tables()
    await await_redis_ready()
    
    async with AsyncSessionLocal() as session:
        await seed_patients_if_empty(session)
        
    # Start Redis listener task
    redis_task = asyncio.create_task(manager.listen_redis())
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    redis_task.cancel()
    await RedisClient.close()

app = FastAPI(title="EaglesEye-AI", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Websockets
app.include_router(dashboard_hub.router, prefix="/ws")
app.include_router(vitals_hub.router, prefix="/ws")
app.include_router(alerts_hub.router, prefix="/ws")
app.include_router(health_hub.router, prefix="/ws")

# API Routers
app.include_router(patients.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")
app.include_router(priority.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(simulator.router, prefix="/api")
app.include_router(system.router, prefix="/api")
app.include_router(ward.router, prefix="/api")

@app.get("/")
def read_root():
    return {"status": "EaglesEye-AI Backend Running"}
