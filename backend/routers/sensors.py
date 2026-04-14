"""Sensor data API endpoints."""

from fastapi import APIRouter, Query
from typing import List, Optional
from datetime import datetime, timedelta

from backend.models import SensorReading, SensorType, get_now
from backend.database import tsdb

router = APIRouter(prefix="/api/sensors", tags=["Sensors"])


@router.get("/latest", response_model=dict)
async def get_latest_readings():
    """Get the most recent reading for every sensor."""
    latest = tsdb.get_all_latest()
    result = {}
    for key, reading in latest.items():
        result[key] = reading.model_dump()
        result[key]["timestamp"] = reading.timestamp.isoformat()
    return result


@router.get("/history", response_model=List[dict])
async def get_sensor_history(
    zone_id: str = Query(..., description="Zone identifier"),
    sensor_type: SensorType = Query(..., description="Type of sensor"),
    minutes: int = Query(60, ge=1, le=1440, description="History window in minutes"),
    limit: int = Query(500, ge=1, le=5000),
):
    """Get historical sensor readings for a specific zone and sensor type."""
    start = get_now() - timedelta(minutes=minutes)
    readings = tsdb.query(zone_id, sensor_type.value, start_time=start, limit=limit)
    return [
        {
            "timestamp": r.timestamp.isoformat(),
            "value": r.value,
            "quality": r.quality,
        }
        for r in readings
    ]


@router.get("/zones/{zone_id}/current", response_model=dict)
async def get_zone_current(zone_id: str):
    """Get all current sensor values for a zone."""
    all_latest = tsdb.get_all_latest()
    zone_readings = {
        key: {
            "value": reading.value,
            "unit": reading.unit,
            "quality": reading.quality,
            "timestamp": reading.timestamp.isoformat(),
        }
        for key, reading in all_latest.items()
        if reading.zone_id == zone_id
    }
    return zone_readings


@router.get("/types", response_model=List[str])
async def get_sensor_types():
    """List all available sensor types."""
    return [t.value for t in SensorType]
