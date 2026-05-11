"""
AI Advisor for the Digital Twin Greenhouse.

Provides context-aware recommendations, plain-language explanations,
VPD calculations, crop health insights, and an interactive Q&A engine.
Works entirely offline using rule-based reasoning over live sensor data.
"""

import math
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

from backend.database import tsdb
from backend.services.twin_state import twin_state
from backend.services.weather_service import weather_service
from backend.models import SensorType, AlertSeverity


# ── Crop Profiles ──

@dataclass
class CropProfile:
    name: str
    temp_min: float
    temp_max: float
    temp_ideal: float
    rh_min: float
    rh_max: float
    rh_ideal: float
    ph_min: float
    ph_max: float
    ec_min: float
    ec_max: float
    light_hours: float
    light_dli: float  # Daily Light Integral (mol/m²/day)
    vpd_min: float
    vpd_max: float
    notes: str


CROP_PROFILES = {
    "lettuce": CropProfile(
        "Lettuce", 15, 25, 20, 50, 80, 65, 5.5, 6.5, 0.8, 1.5,
        14, 14, 0.4, 1.0, "Prefers cool conditions; bolts above 25°C"
    ),
    "tomato": CropProfile(
        "Tomato", 18, 30, 24, 50, 70, 60, 5.8, 6.5, 2.0, 3.5,
        16, 22, 0.8, 1.2, "Needs warm days, cooler nights; high light demand"
    ),
    "basil": CropProfile(
        "Basil", 18, 30, 25, 40, 60, 50, 5.5, 6.5, 1.0, 1.6,
        14, 16, 0.8, 1.2, "Very sensitive to cold; pinch flowers for leaf production"
    ),
    "strawberry": CropProfile(
        "Strawberry", 15, 26, 22, 60, 75, 65, 5.5, 6.5, 1.0, 1.5,
        12, 18, 0.6, 1.0, "Needs good airflow to prevent gray mold (Botrytis)"
    ),
    "cucumber": CropProfile(
        "Cucumber", 20, 30, 26, 60, 80, 70, 5.5, 6.5, 1.7, 2.5,
        16, 25, 0.8, 1.2, "High humidity tolerance; watch for powdery mildew"
    ),
    "pepper": CropProfile(
        "Pepper", 18, 30, 25, 50, 70, 60, 5.5, 6.5, 1.5, 2.5,
        14, 20, 0.8, 1.2, "Sensitive to temperature swings; likes warm roots"
    ),
    "general": CropProfile(
        "General Greenhouse", 18, 28, 23, 50, 75, 60, 5.5, 6.5, 1.0, 2.5,
        14, 18, 0.5, 1.2, "Balanced conditions for mixed growing"
    ),
}


class InsightPriority(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


@dataclass
class Insight:
    title: str
    message: str
    priority: InsightPriority
    category: str
    action: Optional[str] = None
    icon: str = "info"
    metric_name: Optional[str] = None
    metric_value: Optional[float] = None


@dataclass
class ChatResponse:
    answer: str
    insights: List[Insight] = field(default_factory=list)
    data_points: Dict[str, float] = field(default_factory=dict)


def calculate_vpd(temp_c: float, rh_percent: float) -> float:
    """Calculate Vapor Pressure Deficit in kPa."""
    svp = 0.6108 * math.exp((17.27 * temp_c) / (temp_c + 237.3))
    avp = svp * (rh_percent / 100.0)
    return round(svp - avp, 3)


def calculate_dew_point(temp_c: float, rh_percent: float) -> float:
    """Calculate dew point temperature in °C."""
    a, b = 17.27, 237.3
    alpha = (a * temp_c) / (b + temp_c) + math.log(rh_percent / 100.0)
    return round((b * alpha) / (a - alpha), 1)


def compute_trend(values: List[float], window: int = 10) -> str:
    """Determine trend from recent values."""
    if len(values) < window:
        return "stable"
    recent = values[-window:]
    slope = (recent[-1] - recent[0]) / len(recent)
    if abs(slope) < 0.05:
        return "stable"
    return "rising" if slope > 0 else "falling"


class AIAdvisor:
    """Context-aware AI advisor for the greenhouse digital twin."""

    def __init__(self):
        self.active_crop = "general"

    def set_crop(self, crop_name: str):
        if crop_name.lower() in CROP_PROFILES:
            self.active_crop = crop_name.lower()

    def get_crop_profile(self) -> CropProfile:
        return CROP_PROFILES.get(self.active_crop, CROP_PROFILES["general"])

    # ── Core Analysis ──

    def _get_current_readings(self) -> Dict[str, float]:
        """Gather all latest sensor values into a flat dict."""
        latest = tsdb.get_all_latest()
        result = {}
        for key, reading in latest.items():
            result[key] = reading.value
            legacy = f"{reading.zone_id}:{reading.sensor_type.value}"
            result[legacy] = reading.value
        return result

    def _get_trend_for(self, zone_id: str, sensor_type: str) -> str:
        history = tsdb.get_recent_values(zone_id, sensor_type, count=60)
        if len(history) < 5:
            return "insufficient data"
        return compute_trend([v for _, v in history])

    def _get_stats_for(self, zone_id: str, sensor_type: str) -> Optional[Dict]:
        history = tsdb.get_recent_values(zone_id, sensor_type, count=200)
        if len(history) < 5:
            return None
        values = [v for _, v in history]
        arr = np.array(values)
        return {
            "mean": round(float(arr.mean()), 2),
            "std": round(float(arr.std()), 2),
            "min": round(float(arr.min()), 2),
            "max": round(float(arr.max()), 2),
            "latest": round(values[-1], 2),
            "trend": compute_trend(values),
        }

    # ── Insight Generation ──

    def generate_insights(self) -> List[Insight]:
        """Analyze current state and generate prioritized recommendations."""
        readings = self._get_current_readings()
        crop = self.get_crop_profile()
        insights = []

        insights.extend(self._analyze_climate(readings, crop))
        insights.extend(self._analyze_vpd(readings, crop))
        insights.extend(self._analyze_irrigation(readings, crop))
        insights.extend(self._analyze_efficiency(readings))
        insights.extend(self._analyze_weather(readings, crop))

        insights.sort(key=lambda i: {
            "critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4
        }.get(i.priority, 5))

        return insights

    def _analyze_climate(self, readings: Dict, crop: CropProfile) -> List[Insight]:
        results = []
        rh = readings.get("zone_air:humidity")
        air_temp = readings.get("zone_air:temperature")
        light = readings.get("zone_air:light")

        if rh is not None:
            if rh > crop.rh_max:
                results.append(Insight(
                    title="Humidity Too High",
                    message=f"Humidity is {rh:.0f}%, above {crop.rh_max}% max for {crop.name}. "
                            f"High humidity promotes fungal diseases like Botrytis and powdery mildew.",
                    priority=InsightPriority.MEDIUM, category="climate",
                    action="Increase ventilation with exhaust fan. Reduce misting. Improve air circulation.",
                    icon="droplets", metric_name="humidity", metric_value=rh,
                ))
            elif rh < crop.rh_min:
                results.append(Insight(
                    title="Humidity Too Low",
                    message=f"Humidity is {rh:.0f}%, below {crop.rh_min}% min for {crop.name}. "
                            f"Low humidity increases transpiration stress and leaf edge burn.",
                    priority=InsightPriority.MEDIUM, category="climate",
                    action="Use misting or wet pads. Reduce ventilation rate temporarily.",
                    icon="droplets", metric_name="humidity", metric_value=rh,
                ))

        if air_temp is not None:
            if air_temp > crop.temp_max:
                severity = InsightPriority.HIGH if air_temp > crop.temp_max + 5 else InsightPriority.MEDIUM
                results.append(Insight(
                    title="Air Temperature Too High",
                    message=f"Air temperature is {air_temp:.1f}°C, above {crop.temp_max}°C max for {crop.name}. "
                            f"Heat stress reduces photosynthesis and can cause flower drop.",
                    priority=severity, category="climate",
                    action="Increase ventilation and shading. Consider evaporative cooling.",
                    icon="thermometer", metric_name="temperature", metric_value=air_temp,
                ))
            elif air_temp < crop.temp_min:
                severity = InsightPriority.HIGH if air_temp < crop.temp_min - 5 else InsightPriority.MEDIUM
                results.append(Insight(
                    title="Air Temperature Too Low",
                    message=f"Air temperature is {air_temp:.1f}°C, below {crop.temp_min}°C min for {crop.name}. "
                            f"Cold stress slows growth and may damage sensitive tissues.",
                    priority=severity, category="climate",
                    action="Close ventilation openings. Turn on heating if available.",
                    icon="thermometer", metric_name="temperature", metric_value=air_temp,
                ))
            else:
                results.append(Insight(
                    title="Air Temperature Normal",
                    message=f"Air temperature is {air_temp:.1f}°C, within the ideal range of "
                            f"{crop.temp_min}-{crop.temp_max}°C for {crop.name}.",
                    priority=InsightPriority.INFO, category="climate", icon="thermometer",
                    metric_name="temperature", metric_value=air_temp,
                ))

        if light is not None:
            if light < 2000:
                results.append(Insight(
                    title="Light Level Too Low",
                    message=f"Light level is {light:.0f} lux, well below the minimum for healthy growth. "
                            f"Insufficient light reduces photosynthesis and causes etiolation.",
                    priority=InsightPriority.MEDIUM, category="climate",
                    action="Check if it's nighttime. Consider supplemental grow lights.",
                    icon="sun", metric_name="light", metric_value=light,
                ))
            elif light > 60000:
                results.append(Insight(
                    title="Light Level Very High",
                    message=f"Light level is {light:.0f} lux. Excess light can cause leaf bleaching "
                            f"and heat stress, especially on young or sensitive plants.",
                    priority=InsightPriority.LOW, category="climate",
                    action="Deploy shade cloth if available. Monitor leaf temperature.",
                    icon="sun", metric_name="light", metric_value=light,
                ))

        return results

    def _analyze_vpd(self, readings: Dict, crop: CropProfile) -> List[Insight]:
        results = []
        air_temp = readings.get("zone_air:temperature")
        if air_temp is None:
            soil_temps = [
                readings.get(f"zone_bed_{bed}:soil_temperature")
                for bed in ("a", "b", "c")
            ]
            valid_temps = [t for t in soil_temps if t is not None]
            air_temp = sum(valid_temps) / len(valid_temps) if valid_temps else None
        temp = air_temp
        rh = readings.get("zone_air:humidity")

        if temp is None or rh is None:
            return results

        vpd = calculate_vpd(temp, rh)
        dew_point = calculate_dew_point(temp, rh)

        if vpd < crop.vpd_min:
            results.append(Insight(
                title="VPD Too Low — Risk of Condensation",
                message=f"VPD is {vpd:.2f} kPa (ideal: {crop.vpd_min}-{crop.vpd_max} kPa). "
                        f"Dew point: {dew_point}°C. Low VPD means stomata close and transpiration drops. "
                        f"Moisture on leaves promotes disease.",
                priority=InsightPriority.MEDIUM, category="vpd",
                action="Increase temperature or decrease humidity. Improve airflow.",
                icon="gauge", metric_name="vpd", metric_value=vpd,
            ))
        elif vpd > crop.vpd_max:
            results.append(Insight(
                title="VPD Too High — Drought Stress Risk",
                message=f"VPD is {vpd:.2f} kPa (ideal: {crop.vpd_min}-{crop.vpd_max} kPa). "
                        f"High VPD forces rapid transpiration, causing wilting and nutrient uptake issues.",
                priority=InsightPriority.MEDIUM, category="vpd",
                action="Increase humidity (misting) or reduce temperature. Ensure adequate irrigation.",
                icon="gauge", metric_name="vpd", metric_value=vpd,
            ))
        else:
            results.append(Insight(
                title="VPD in Optimal Range",
                message=f"VPD is {vpd:.2f} kPa — excellent for {crop.name}. Dew point: {dew_point}°C. "
                        f"Plants are transpiring well, nutrient uptake should be efficient.",
                priority=InsightPriority.INFO, category="vpd", icon="check",
                metric_name="vpd", metric_value=vpd,
            ))

        return results

    def _analyze_irrigation(self, readings: Dict, crop: CropProfile) -> List[Insight]:
        results = []
        bed_zones = [
            ("zone_bed_a", "Substrate A"),
            ("zone_bed_b", "Substrate B"),
            ("zone_bed_c", "Substrate C"),
        ]

        for zone_id, label in bed_zones:
            moisture = readings.get(f"{zone_id}:soil_moisture")
            if moisture is None:
                continue

            trend = self._get_trend_for(zone_id, "soil_moisture")

            if moisture < 25:
                results.append(Insight(
                    title=f"{label} — Moisture Critically Low",
                    message=f"{label} moisture is {moisture:.0f}% — plants are at risk of wilting. Trend: {trend}.",
                    priority=InsightPriority.CRITICAL, category="irrigation",
                    action="Start irrigation immediately. Check valve and pump operation.",
                    icon="droplets", metric_name="soil_moisture", metric_value=moisture,
                ))
            elif moisture < 35:
                results.append(Insight(
                    title=f"{label} — Moisture Getting Low",
                    message=f"{label} moisture is {moisture:.0f}% and {trend}. Schedule irrigation soon.",
                    priority=InsightPriority.MEDIUM, category="irrigation",
                    action="Open irrigation valve within the next 15-30 minutes.",
                    icon="droplets", metric_name="soil_moisture", metric_value=moisture,
                ))
            elif moisture > 75:
                results.append(Insight(
                    title=f"{label} — Overwatered",
                    message=f"{label} moisture is {moisture:.0f}%. Oversaturation reduces oxygen at roots.",
                    priority=InsightPriority.MEDIUM, category="irrigation",
                    action="Stop irrigation. Ensure drainage is adequate.",
                    icon="droplets", metric_name="soil_moisture", metric_value=moisture,
                ))
            elif trend == "falling" and moisture < 50:
                results.append(Insight(
                    title=f"{label} — Moisture Declining",
                    message=f"{label} moisture is {moisture:.0f}% and falling. Irrigation will be needed soon.",
                    priority=InsightPriority.LOW, category="irrigation",
                    action="Prepare to irrigate within the next hour.",
                    icon="droplets", metric_name="soil_moisture", metric_value=moisture,
                ))

        return results

    def _analyze_efficiency(self, readings: Dict) -> List[Insight]:
        """Cross-sensor analysis for pump/resource efficiency."""
        results = []
        actuators = {a.actuator_id: a.state for a in twin_state.get_all_actuators()}

        for bed, label in [("a", "Substrate A"), ("b", "Substrate B"), ("c", "Substrate C")]:
            moisture = readings.get(f"zone_bed_{bed}:soil_moisture")
            pump_id = f"pump_{bed}"
            if moisture is not None and moisture > 70 and actuators.get(pump_id) == "on":
                results.append(Insight(
                    title=f"{label} Pump Running While Wet",
                    message=f"{label} moisture is already {moisture:.0f}% but the pump is still on. Over-watering wastes water and risks root rot.",
                    priority=InsightPriority.MEDIUM, category="efficiency",
                    action=f"Turn off {pump_id}. Soil is sufficiently moist.",
                    icon="zap",
                ))

        return results

    def _analyze_weather(self, readings: Dict, crop: CropProfile) -> List[Insight]:
        """Weather-informed insights using outdoor conditions and forecast."""
        results = []
        try:
            weather = weather_service.get_weather()
            if weather.get("error"):
                return results

            current = weather.get("current", {}) or {}
            forecast = weather.get("next_12h", {}) or {}

            outdoor_temp = current.get("temp_c")
            outdoor_humidity = current.get("humidity_pct")
            condition = current.get("condition", "")
            max_rain_prob = forecast.get("max_rain_prob_pct", 0)
            total_rain = forecast.get("total_rain_mm", 0)

            if outdoor_temp is not None and outdoor_temp > 35:
                results.append(Insight(
                    title="Extreme Outdoor Heat",
                    message=f"Outdoor temperature is {outdoor_temp}°C. This will raise greenhouse "
                            f"temperatures. Expect increased cooling demand and water consumption.",
                    priority=InsightPriority.MEDIUM, category="climate",
                    action="Maximize ventilation and shade. Monitor indoor temperature closely.",
                    icon="thermometer", metric_name="outdoor_temp", metric_value=outdoor_temp,
                ))

            if max_rain_prob > 70:
                results.append(Insight(
                    title="Rain Expected — Adjust Irrigation",
                    message=f"Rain probability is {max_rain_prob}% in the next 12 hours "
                            f"(expected {total_rain} mm). Outdoor humidity will rise, affecting indoor conditions.",
                    priority=InsightPriority.LOW, category="irrigation",
                    action="Reduce irrigation schedule. Close vents if rain is heavy.",
                    icon="droplets", metric_name="rain_probability", metric_value=max_rain_prob,
                ))

            cloud_cover = current.get("cloud_cover_pct")
            light = readings.get("zone_air:light")
            if cloud_cover is not None and cloud_cover > 80 and light is not None and light < 5000:
                results.append(Insight(
                    title="Overcast — Low Natural Light",
                    message=f"Cloud cover is {cloud_cover}% and indoor light is only {light:.0f} lux. "
                            f"Plants may not receive enough photosynthetically active radiation.",
                    priority=InsightPriority.LOW, category="climate",
                    action="Consider turning on supplemental grow lights.",
                    icon="sun", metric_name="light", metric_value=light,
                ))
        except Exception:
            pass

        return results

    # ── Summary Generation ──

    def generate_summary(self) -> str:
        """Generate a natural language summary of the greenhouse state."""
        readings = self._get_current_readings()
        crop = self.get_crop_profile()

        rh = readings.get("zone_air:humidity")
        air_temp = readings.get("zone_air:temperature")
        light = readings.get("zone_air:light")

        parts = []
        parts.append(f"Current crop profile: {crop.name}.")

        air_parts = []
        if air_temp is not None:
            air_parts.append(f"temperature {air_temp:.1f}°C")
        if rh is not None:
            air_parts.append(f"humidity {rh:.0f}%")
        if light is not None:
            air_parts.append(f"light {light:.0f} lux")
        if air_parts:
            parts.append(f"Greenhouse air: {', '.join(air_parts)}.")

        for zone_id, label in [("zone_bed_a", "Substrate A"), ("zone_bed_b", "Substrate B"), ("zone_bed_c", "Substrate C")]:
            moisture = readings.get(f"{zone_id}:soil_moisture")
            soil_temp = readings.get(f"{zone_id}:soil_temperature")
            soil_ph = readings.get(f"{zone_id}:soil_ph")
            bed_parts = []
            if moisture is not None:
                m_trend = self._get_trend_for(zone_id, "soil_moisture")
                bed_parts.append(f"moisture {moisture:.0f}% ({m_trend})")
            if soil_temp is not None:
                bed_parts.append(f"temp {soil_temp:.1f}°C")
            if soil_ph is not None:
                bed_parts.append(f"pH {soil_ph:.1f}")
            if bed_parts:
                parts.append(f"{label}: {', '.join(bed_parts)}.")

        try:
            weather = weather_service.get_weather()
            cur = weather.get("current", {}) or {}
            if cur and cur.get("temp_c") is not None:
                parts.append(
                    f"Outdoor: {cur.get('condition', 'N/A')}, "
                    f"{cur['temp_c']}°C, {cur.get('humidity_pct', 'N/A')}% RH."
                )
        except Exception:
            pass

        alerts = twin_state.get_alerts()
        if alerts:
            parts.append(f"There are {len(alerts)} active alert(s) requiring attention.")
        else:
            parts.append("No active alerts — the system is running smoothly.")

        return " ".join(parts)

    # ── Chat / Q&A Engine ──

    def answer_question(self, question: str) -> ChatResponse:
        """Answer a user question using current greenhouse data and crop knowledge."""
        q = question.lower().strip()
        readings = self._get_current_readings()
        crop = self.get_crop_profile()

        if any(w in q for w in ["hello", "hi", "hey", "help"]):
            return ChatResponse(
                answer=(
                    f"Hello! I'm TwinMind, your greenhouse AI assistant. I can help you with:\n\n"
                    f"- **Current conditions**: Ask 'How is my greenhouse doing?'\n"
                    f"- **Specific sensors**: Ask about temperature, humidity, pH, EC, etc.\n"
                    f"- **VPD**: Ask 'What is VPD?' or 'Calculate VPD'\n"
                    f"- **Crop advice**: Ask 'What crops can I grow?' or 'Advice for tomato'\n"
                    f"- **Irrigation**: Ask 'Should I water?' or 'When to irrigate?'\n"
                    f"- **Problems**: Ask 'What's wrong?' or 'Any issues?'\n"
                    f"- **Suggestions**: Ask 'What should I do?' or 'Give me tips'\n\n"
                    f"Currently monitoring for: **{crop.name}**."
                ),
            )

        if any(w in q for w in ["how", "status", "doing", "overview", "summary"]):
            summary = self.generate_summary()
            insights = self.generate_insights()
            top_actions = [i for i in insights if i.action and i.priority != InsightPriority.INFO][:3]
            if top_actions:
                summary += "\n\n**Top recommendations:**\n"
                for i, ins in enumerate(top_actions, 1):
                    summary += f"{i}. {ins.action}\n"
            return ChatResponse(answer=summary, insights=insights[:5])

        if any(w in q for w in ["vpd", "vapor pressure", "transpiration"]):
            soil_temps = [readings.get(f"zone_bed_{b}:soil_temperature") for b in ("a", "b", "c")]
            valid_temps = [t for t in soil_temps if t is not None]
            temp = sum(valid_temps) / len(valid_temps) if valid_temps else None
            rh = readings.get("zone_air:humidity")
            if temp is not None and rh is not None:
                vpd = calculate_vpd(temp, rh)
                dp = calculate_dew_point(temp, rh)
                status = "optimal" if crop.vpd_min <= vpd <= crop.vpd_max else ("too low" if vpd < crop.vpd_min else "too high")
                return ChatResponse(
                    answer=(
                        f"**Vapor Pressure Deficit (VPD)**: {vpd:.2f} kPa — {status}\n\n"
                        f"VPD measures how 'thirsty' the air is. It controls how fast plants transpire.\n\n"
                        f"- Current temp: {temp:.1f}°C, RH: {rh:.0f}%\n"
                        f"- Dew point: {dp}°C\n"
                        f"- Ideal VPD for {crop.name}: {crop.vpd_min}-{crop.vpd_max} kPa\n\n"
                        f"**What it means:**\n"
                        f"- VPD too low → stomata close, poor transpiration, mold risk\n"
                        f"- VPD too high → too much water loss, wilting, stress\n"
                        f"- VPD just right → healthy nutrient uptake and growth"
                    ),
                    data_points={"vpd": vpd, "dew_point": dp, "temperature": temp, "humidity": rh},
                )
            return ChatResponse(answer="Not enough sensor data to calculate VPD yet. Waiting for temperature and humidity readings.")

        if any(w in q for w in ["temperature", "temp", "hot", "cold", "heat", "cool"]):
            parts = []
            for zone_id, label in [("zone_bed_a", "Substrate A"), ("zone_bed_b", "Substrate B"), ("zone_bed_c", "Substrate C")]:
                soil_temp = readings.get(f"{zone_id}:soil_temperature")
                if soil_temp is not None:
                    trend = self._get_trend_for(zone_id, "soil_temperature")
                    status = "optimal" if crop.temp_min <= soil_temp <= crop.temp_max else ("too high" if soil_temp > crop.temp_max else "too low")
                    parts.append(f"**{label} Soil Temp**: {soil_temp:.1f}°C — {status} (trend: {trend})")
            if parts:
                parts.insert(0, f"**Soil Temperature Status** (ideal: {crop.temp_min}-{crop.temp_max}°C):\n")
                return ChatResponse(answer="\n".join(parts))
            return ChatResponse(answer="Soil temperature data is not available yet.")

        if any(w in q for w in ["humidity", "humid", "rh", "moisture air", "dry air"]):
            rh = readings.get("zone_air:humidity")
            if rh is not None:
                status = "optimal" if crop.rh_min <= rh <= crop.rh_max else ("too high" if rh > crop.rh_max else "too low")
                return ChatResponse(
                    answer=(
                        f"**Relative Humidity**: {rh:.0f}% — {status}\n\n"
                        f"- Ideal for {crop.name}: {crop.rh_min}-{crop.rh_max}% (ideal: {crop.rh_ideal}%)\n"
                        f"- Trend: {self._get_trend_for('zone_air', 'humidity')}\n\n"
                        f"{'**Action**: Increase ventilation to reduce humidity.' if rh > crop.rh_max else ''}"
                        f"{'**Action**: Use misting or reduce ventilation to raise humidity.' if rh < crop.rh_min else ''}"
                    ),
                    data_points={"humidity": rh},
                )
            return ChatResponse(answer="Humidity data is not available yet.")

        if any(w in q for w in ["ph", "acid", "alkaline", "nutrient lock"]):
            parts = []
            for zone_id, label in [("zone_bed_a", "Substrate A"), ("zone_bed_b", "Substrate B"), ("zone_bed_c", "Substrate C")]:
                soil_ph = readings.get(f"{zone_id}:soil_ph")
                if soil_ph is not None:
                    status = "in range" if crop.ph_min <= soil_ph <= crop.ph_max else "out of range"
                    parts.append(f"**{label} Soil pH**: {soil_ph:.1f} — {status}")
            if parts:
                parts.append(
                    f"\n- Ideal for {crop.name}: {crop.ph_min}-{crop.ph_max}\n"
                    f"**Why pH matters**: pH controls which nutrients are available to roots. "
                    f"Outside the ideal range, certain elements 'lock out' even if present in the substrate."
                )
            return ChatResponse(answer="\n".join(parts) if parts else "Soil pH data not available yet.")

        if any(w in q for w in ["water", "irrigat", "when to water", "should i water", "soil moisture"]):
            parts = []
            for zone_id, label in [("zone_bed_a", "Substrate A"), ("zone_bed_b", "Substrate B"), ("zone_bed_c", "Substrate C")]:
                moisture = readings.get(f"{zone_id}:soil_moisture")
                if moisture is not None:
                    trend = self._get_trend_for(zone_id, "soil_moisture")
                    if moisture < 30:
                        parts.append(f"**{label}**: {moisture:.0f}% ({trend}) — **irrigate now!**")
                    elif moisture < 45 and trend == "falling":
                        parts.append(f"**{label}**: {moisture:.0f}% ({trend}) — plan irrigation soon")
                    elif moisture > 70:
                        parts.append(f"**{label}**: {moisture:.0f}% ({trend}) — well-watered, avoid overwatering")
                    else:
                        parts.append(f"**{label}**: {moisture:.0f}% ({trend}) — adequate")
            if parts:
                return ChatResponse(answer="**Soil Moisture Status:**\n\n" + "\n".join(parts))
            return ChatResponse(answer="Soil moisture data not available yet.")

        if any(w in q for w in ["crop", "grow", "plant", "what can i"]):
            lines = ["**Available crop profiles:**\n"]
            for key, cp in CROP_PROFILES.items():
                if key == "general":
                    continue
                lines.append(
                    f"- **{cp.name}**: {cp.temp_min}-{cp.temp_max}°C, pH {cp.ph_min}-{cp.ph_max}, "
                    f"EC {cp.ec_min}-{cp.ec_max} mS/cm — {cp.notes}"
                )
            lines.append(f"\nCurrent profile: **{crop.name}**. Ask me to 'switch to tomato' to change.")
            return ChatResponse(answer="\n".join(lines))

        if any(w in q for w in ["switch to", "change to", "set crop"]):
            for crop_key in CROP_PROFILES:
                if crop_key in q:
                    self.set_crop(crop_key)
                    cp = self.get_crop_profile()
                    return ChatResponse(
                        answer=(
                            f"Switched to **{cp.name}** profile!\n\n"
                            f"- Temperature: {cp.temp_min}-{cp.temp_max}°C (ideal: {cp.temp_ideal}°C)\n"
                            f"- Humidity: {cp.rh_min}-{cp.rh_max}%\n"
                            f"- pH: {cp.ph_min}-{cp.ph_max}\n"
                            f"- EC: {cp.ec_min}-{cp.ec_max} mS/cm\n"
                            f"- VPD: {cp.vpd_min}-{cp.vpd_max} kPa\n"
                            f"- Light: {cp.light_hours}h, DLI target: {cp.light_dli} mol/m²/day\n"
                            f"- Note: {cp.notes}"
                        )
                    )
            return ChatResponse(answer="I didn't recognize that crop. Try: lettuce, tomato, basil, strawberry, cucumber, or pepper.")

        if any(w in q for w in ["wrong", "issue", "problem", "alert", "warning"]):
            insights = self.generate_insights()
            problems = [i for i in insights if i.priority in (InsightPriority.CRITICAL, InsightPriority.HIGH, InsightPriority.MEDIUM)]
            if not problems:
                return ChatResponse(answer="No significant issues detected. Your greenhouse is running well!", insights=insights[:3])
            lines = [f"**Found {len(problems)} issue(s):**\n"]
            for i, p in enumerate(problems, 1):
                lines.append(f"{i}. **{p.title}** ({p.priority.value})\n   {p.message}")
                if p.action:
                    lines.append(f"   → {p.action}")
                lines.append("")
            return ChatResponse(answer="\n".join(lines), insights=problems)

        if any(w in q for w in ["suggest", "recommend", "tip", "advice", "what should", "what do"]):
            insights = self.generate_insights()
            actionable = [i for i in insights if i.action]
            if not actionable:
                return ChatResponse(
                    answer="Everything looks good! No specific actions needed right now. Keep monitoring and maintaining your regular schedule.",
                    insights=insights[:3],
                )
            lines = ["**Here are my top suggestions:**\n"]
            for i, ins in enumerate(actionable[:5], 1):
                lines.append(f"{i}. **{ins.title}** — {ins.action}")
            return ChatResponse(answer="\n".join(lines), insights=actionable[:5])

        # Default fallback
        summary = self.generate_summary()
        insights = self.generate_insights()
        top = [i for i in insights if i.action][:3]
        answer = f"I'm not sure about that specific question, but here's what I know:\n\n{summary}"
        if top:
            answer += "\n\n**Current suggestions:**\n"
            for i, ins in enumerate(top, 1):
                answer += f"{i}. {ins.action}\n"
        answer += "\nTry asking about temperature, humidity, VPD, pH, EC, irrigation, crops, or 'what's wrong?'"
        return ChatResponse(answer=answer, insights=insights[:3])


advisor = AIAdvisor()
