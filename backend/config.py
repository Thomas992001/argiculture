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
    influxdb_token: str = Field("my-super-secret-token", alias="INFLUXDB_TOKEN")
    influxdb_org: str = "greenhouse"
    influxdb_bucket: str = "telemetry"

    simulator_interval_seconds: float = 5.0
    simulator_enabled: bool = False

    ml_forecast_horizon_minutes: int = 60
    ml_anomaly_sensitivity: float = 0.05

    # Google Gemini AI
    gemini_api_key: Optional[str] = Field(None, alias="GEMINI_API_KEY")
    gemini_model: str = "gemini-3-flash-preview"
    
    # Google Cloud Vertex AI
    gcp_project_id: Optional[str] = "agritwin-mrv"
    gcp_location: str = "global"

    # YouTube Data API
    youtube_api_key: Optional[str] = Field(None, alias="YOUTUBE_API_KEY")

    # CORS Settings
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # Firebase Admin SDK
    firebase_credentials: Optional[str] = Field(None, alias="FIREBASE_CREDENTIALS")
    firebase_database_url: str = "https://agritwin-mrv-default-rtdb.firebaseio.com/"
    firebase_target_uid: Optional[str] = Field(None, alias="FIREBASE_TARGET_UID")

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
        "populate_by_name": True
    }


settings = Settings()
