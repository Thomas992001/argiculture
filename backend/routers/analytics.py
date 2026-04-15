"""
Analytics and ML API endpoints — all powered by Google Gemini.

Local ML (XGBoost, Isolation Forest) provides the raw numbers;
Gemini interprets them into human-friendly, actionable analysis.
"""

from fastapi import APIRouter, Query
from typing import List

import numpy as np

from backend.models import SensorType, ForecastResponse
from backend.database import tsdb
from backend.services.gemini_advisor import gemini_advisor
from ml.forecasting import forecaster
from ml.anomaly import anomaly_service

router = APIRouter(prefix="/api/analytics", tags=["Analytics (Gemini-powered)"])


@router.get("/forecast")
async def get_forecast(
    zone_id: str = Query(..., description="Zone to forecast"),
    sensor_type: SensorType = Query(..., description="Sensor type to forecast"),
    horizon_minutes: int = Query(60, ge=5, le=360),
):
    """Generate a forecast with Gemini AI interpretation."""
    historical = tsdb.get_recent_values(zone_id, sensor_type.value, count=200)

    if not historical:
        return {
            "sensor_type": sensor_type.value,
            "zone_id": zone_id,
            "horizon_minutes": horizon_minutes,
            "points": [],
            "model_name": "none",
            "confidence": 0.0,
            "ai_analysis": None,
            "powered_by": "no_data",
        }

    points = forecaster.forecast(historical, horizon_minutes)
    model_name = "xgboost" if forecaster._xgboost_available and len(historical) >= 30 else "ema"

    points_dicts = [
        {
            "timestamp": p.timestamp.isoformat(),
            "predicted_value": p.predicted_value,
            "lower_bound": p.lower_bound,
            "upper_bound": p.upper_bound,
        }
        for p in points
    ]

    values = [v for _, v in historical]
    arr = np.array(values)
    stats = {
        "mean": round(float(arr.mean()), 2),
        "std": round(float(arr.std()), 2),
        "min": round(float(arr.min()), 2),
        "max": round(float(arr.max()), 2),
        "latest": round(values[-1], 2),
        "count": len(values),
    }

    # Gemini interprets the forecast
    gemini_result = await gemini_advisor.analyze_forecast(
        zone_id, sensor_type.value, points_dicts, stats
    )

    return {
        "sensor_type": sensor_type.value,
        "zone_id": zone_id,
        "horizon_minutes": horizon_minutes,
        "points": points_dicts,
        "model_name": model_name,
        "confidence": min(0.95, len(historical) / 200),
        "ai_analysis": gemini_result.get("analysis") if gemini_result else None,
        "powered_by": gemini_result.get("powered_by", "local") if gemini_result else "local_ml",
    }


@router.get("/anomalies")
async def check_anomalies():
    """Run anomaly detection on all sensors with Gemini AI analysis."""
    all_latest = tsdb.get_all_latest()
    anomalies = []

    for key, reading in all_latest.items():
        history = tsdb.get_recent_values_for_sensor(
            reading.zone_id, reading.sensor_id, count=100
        )
        if len(history) < 10:
            continue

        values = [v for _, v in history]
        result = anomaly_service.check_reading(values, reading.value, reading.sensor_type.value)

        anomalies.append({
            "sensor_id": reading.sensor_id,
            "sensor_type": reading.sensor_type.value,
            "zone_id": reading.zone_id,
            "current_value": reading.value,
            "is_anomaly": result.is_anomaly,
            "anomaly_score": round(result.score, 3),
            "description": result.description,
            "expected_min": result.expected_min,
            "expected_max": result.expected_max,
        })

    # Gemini analyzes all anomalies together
    gemini_result = await gemini_advisor.analyze_all_anomalies(anomalies)

    return {
        "sensors": anomalies,
        "total_sensors": len(anomalies),
        "anomalies_detected": sum(1 for a in anomalies if a["is_anomaly"]),
        "ai_analysis": gemini_result.get("analysis") if gemini_result else None,
        "powered_by": gemini_result.get("powered_by", "local") if gemini_result else "local_ml",
    }


@router.get("/statistics")
async def get_statistics(
    zone_id: str = Query(...),
    sensor_type: SensorType = Query(...),
):
    """Get sensor statistics with Gemini AI interpretation."""
    history = tsdb.get_recent_values(zone_id, sensor_type.value, count=500)
    if not history:
        return {"error": "No data available"}

    values = [v for _, v in history]
    arr = np.array(values)

    stats = {
        "zone_id": zone_id,
        "sensor_type": sensor_type.value,
        "count": len(values),
        "mean": round(float(arr.mean()), 2),
        "std": round(float(arr.std()), 2),
        "min": round(float(arr.min()), 2),
        "max": round(float(arr.max()), 2),
        "median": round(float(np.median(arr)), 2),
        "latest": round(values[-1], 2),
        "trend": round(float(arr[-10:].mean() - arr[:10].mean()), 2) if len(values) >= 20 else 0.0,
    }

    # Gemini interprets statistics
    gemini_result = await gemini_advisor.interpret_statistics(
        zone_id, sensor_type.value, stats
    )

    stats["ai_interpretation"] = gemini_result.get("interpretation") if gemini_result else None
    stats["powered_by"] = gemini_result.get("powered_by", "local") if gemini_result else "local"

    return stats
