from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "CarbonTwin OS API"
    APP_VERSION: str = "1.0.0"

    HOST: str = "127.0.0.1"
    PORT: int = 8000

    SIMULATION_INTERVAL: float = 1.0

    class Config:
        env_file = ".env"


settings = Settings()