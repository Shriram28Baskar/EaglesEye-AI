from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy import text
from app.config import settings
import logging

logger = logging.getLogger(__name__)

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    pool_size=20,
    max_overflow=10
)

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

async def create_tables():
    logger.info("Creating database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        # Create hypertable for vital_readings
        try:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;"))
        except Exception as e:
            logger.warning(f"Could not create timescaledb extension (maybe already exists or not supported): {e}")

        try:
            await conn.execute(text("SELECT create_hypertable('vital_readings', 'time', if_not_exists => TRUE);"))
            logger.info("Successfully ensured hypertable on vital_readings")
        except Exception as e:
            logger.warning(f"Could not create hypertable (maybe already exists or standard pg): {e}")
