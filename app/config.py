import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    BACKEND_PORT: int = 8000
    FRONTEND_PORT: int = 8080

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/eagleseye"
    REDIS_URL: str = "redis://localhost:6379/0"

    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama3-70b-8192"
    OPENAI_API_KEY: Optional[str] = None

    VAPI_PRIVATE_KEY: Optional[str] = None
    VAPI_ASSISTANT_ID: Optional[str] = None
    VAPI_PHONE_NUMBER_ID: Optional[str] = None

    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_PHONE_NUMBER: Optional[str] = None

    PRIMARY_DOCTOR_PHONE: str = "+919035890001"
    PRIMARY_DOCTOR_NAME: str = "Dr. Primary"
    ESCALATION_SUPERVISOR_PHONE: str = "+919363179481"
    ESCALATION_SUPERVISOR_NAME: str = "Dr. Supervisor"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
