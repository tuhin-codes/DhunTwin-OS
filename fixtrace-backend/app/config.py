import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

# Load .env file from backend directory or project root
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

class Settings(BaseSettings):
    # App Settings
    APP_NAME: str = "FixTrace API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Hindsight Settings (Vectorize.io)
    HINDSIGHT_API_URL: str = "https://api.hindsight.vectorize.io"
    HINDSIGHT_API_KEY: str = ""
    HINDSIGHT_BANK_ID: str = "fixtrace-demo-01"
    
    # LLM Settings
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    
    # Database Settings
    DATABASE_URL: str = "sqlite:///./fixtrace.db"
    
    # Server Ports
    BACKEND_PORT: int = 8000
    
    model_config = SettingsConfigDict(env_file=".env", extra="allow")

settings = Settings()
