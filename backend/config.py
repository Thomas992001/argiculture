from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional


class Settings(BaseSettings):
    backend_host: str = "0.0.0.0"
    backend_port: int = Field(8000, alias="PORT")

    mqtt_broker_host: str = "localhost"
    mqtt_broker_port: int = 1883
    mqtt_username: Optional[str] = None
    mqtt_password: Optional[str] = None

    influxdb_url: str = "http://localhost:8086"
    influxdb_token: str = "my-super-secret-token"
    influxdb_org: str = "greenhouse"
    influxdb_bucket: str = "telemetry"

    simulator_interval_seconds: float = 5.0
    simulator_enabled: bool = False

    ml_forecast_horizon_minutes: int = 60
    ml_anomaly_sensitivity: float = 0.05

    # Google Gemini AI
    gemini_api_key: Optional[str] = None
    gemini_model: str = "gemini-2.5-pro"
    
    # Google Cloud Vertex AI
    gcp_project_id: Optional[str] = "agritwin-mrv"
    gcp_location: str = "us-central1"

    # CORS Settings
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        # 生产环境域名可在此处补充或通过 .env JSON array 注入: '["https://yourdomain.com"]'
    ]

    # Firebase
    firebase_target_uid: str = "ZLwjf4x1vBPkcEHc015OhelwwHo1"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore"
    }


settings = Settings()
