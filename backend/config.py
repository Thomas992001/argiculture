from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000

    mqtt_broker_host: str = "localhost"
    mqtt_broker_port: int = 1883
    mqtt_username: Optional[str] = None
    mqtt_password: Optional[str] = None

    influxdb_url: str = "http://localhost:8086"
    influxdb_token: str = "my-super-secret-token"
    influxdb_org: str = "greenhouse"
    influxdb_bucket: str = "telemetry"

    simulator_interval_seconds: float = 5.0
    simulator_enabled: bool = True

    ml_forecast_horizon_minutes: int = 60
    ml_anomaly_sensitivity: float = 0.05

    # Google Gemini AI
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
