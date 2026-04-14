from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, List
from datetime import datetime, timezone, timedelta
from enum import Enum

# Kuala Lumpur Time (UTC+8)
KL_TZ = timezone(timedelta(hours=8))

def get_now():
    return datetime.now(KL_TZ)


# ── Sensor Types ──

class SensorType(str, Enum):
    TEMPERATURE = "temperature"
    HUMIDITY = "humidity"
    CO2 = "co2"
    SOIL_MOISTURE = "soil_moisture"
    EC = "ec"
    PH = "ph"
    WATER_TEMPERATURE = "water_temperature"
    WATER_LEVEL = "water_level"
    LIGHT_INTENSITY = "light_intensity"


class ZoneType(str, Enum):
    GREENHOUSE_AIR = "greenhouse_air"
    SUBSTRATE_BED = "substrate_bed"
    HYDROPONIC_NFT = "hydroponic_nft"
    HYDROPONIC_DWC = "hydroponic_dwc"
    RESERVOIR = "reservoir"


# ── Sensor Reading ──

class SensorReading(BaseModel):
    model_config = ConfigDict(extra='allow')

    sensor_id: str
    sensor_type: SensorType
    zone_id: str
    value: float
    unit: str
    timestamp: datetime = Field(default_factory=get_now)
    quality: float = Field(default=1.0, ge=0.0, le=1.0)
    uid: Optional[str] = None


class SensorBatch(BaseModel):
    readings: List[SensorReading]
    node_id: str
    firmware_version: str = "1.0.0"


# ── Digital Twin State ──

class ActuatorState(str, Enum):
    ON = "on"
    OFF = "off"
    AUTO = "auto"


class ActuatorCommand(BaseModel):
    actuator_id: str
    command: ActuatorState
    value: Optional[float] = None
    duration_seconds: Optional[int] = None


class Actuator(BaseModel):
    actuator_id: str
    name: str
    type: str
    zone_id: str
    state: ActuatorState = ActuatorState.OFF
    current_value: float = 0.0
    last_changed: datetime = Field(default_factory=get_now)


class Zone(BaseModel):
    zone_id: str
    name: str
    type: ZoneType
    sensors: List[str] = []
    actuators: List[str] = []
    current_readings: Dict[str, float] = {}


class GreenhouseState(BaseModel):
    timestamp: datetime = Field(default_factory=get_now)
    zones: Dict[str, Zone] = {}
    actuators: Dict[str, Actuator] = {}
    alerts: List["Alert"] = []
    system_health: str = "healthy"


# ── Alerts ──

class AlertSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class Alert(BaseModel):
    alert_id: str
    severity: AlertSeverity
    message: str
    sensor_id: Optional[str] = None
    zone_id: Optional[str] = None
    value: Optional[float] = None
    threshold: Optional[float] = None
    timestamp: datetime = Field(default_factory=get_now)
    acknowledged: bool = False


# ── Analytics ──

class ForecastPoint(BaseModel):
    timestamp: datetime
    predicted_value: float
    lower_bound: float
    upper_bound: float


class ForecastResponse(BaseModel):
    sensor_type: str
    zone_id: str
    horizon_minutes: int
    points: List[ForecastPoint]
    model_name: str
    confidence: float


class AnomalyEvent(BaseModel):
    timestamp: datetime
    sensor_id: str
    sensor_type: str
    zone_id: str
    actual_value: float
    expected_range: tuple
    anomaly_score: float
    description: str


# ── API Responses ──

class HistoricalDataRequest(BaseModel):
    sensor_type: SensorType
    zone_id: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    limit: int = 500


class SystemStatus(BaseModel):
    uptime_seconds: float
    mqtt_connected: bool
    influxdb_connected: bool
    simulator_running: bool
    active_sensors: int
    active_actuators: int
    pending_alerts: int
