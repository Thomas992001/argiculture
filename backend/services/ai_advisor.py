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
        insights.extend(self._analyze_hydroponics(readings, crop))
        insights.extend(self._analyze_reservoir(readings))
        insights.extend(self._analyze_efficiency(readings))

        insights.sort(key=lambda i: {
            "critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4
        }.get(i.priority, 5))

        return insights

    def _analyze_climate(self, readings: Dict, crop: CropProfile) -> List[Insight]:
        results = []
        temp = readings.get("zone_air:temperature")
        rh = readings.get("zone_air:humidity")
        co2 = readings.get("zone_air:co2")
        light = readings.get("zone_air:light_intensity")

        if temp is not None:
            temp_trend = self._get_trend_for("zone_air", "temperature")
            if temp > crop.temp_max:
                action = "Turn on the exhaust fan and open vents to cool down."
                if temp > crop.temp_max + 5:
                    action += " Consider misting or shade cloth if available."
                results.append(Insight(
                    title="Temperature Too High",
                    message=f"Air temperature is {temp:.1f}°C, above the ideal range for {crop.name} ({crop.temp_min}-{crop.temp_max}°C). "
                            f"This can cause heat stress, wilting, and reduced growth. Trend: {temp_trend}.",
                    priority=InsightPriority.HIGH if temp > crop.temp_max + 3 else InsightPriority.MEDIUM,
                    category="climate", action=action, icon="thermometer",
                    metric_name="temperature", metric_value=temp,
                ))
            elif temp < crop.temp_min:
                results.append(Insight(
                    title="Temperature Too Low",
                    message=f"Air temperature is {temp:.1f}°C, below the minimum for {crop.name} ({crop.temp_min}°C). "
                            f"Cold stress slows growth and can damage roots. Trend: {temp_trend}.",
                    priority=InsightPriority.HIGH if temp < crop.temp_min - 3 else InsightPriority.MEDIUM,
                    category="climate",
                    action="Turn on the heater. Check for drafts or poor insulation.",
                    icon="thermometer", metric_name="temperature", metric_value=temp,
                ))
            else:
                distance = abs(temp - crop.temp_ideal)
                if distance < 2:
                    results.append(Insight(
                        title="Temperature Optimal",
                        message=f"Air temperature is {temp:.1f}°C — near ideal ({crop.temp_ideal}°C) for {crop.name}.",
                        priority=InsightPriority.INFO, category="climate", icon="check",
                        metric_name="temperature", metric_value=temp,
                    ))

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

        if co2 is not None:
            if co2 < 400:
                results.append(Insight(
                    title="CO₂ Very Low",
                    message=f"CO₂ is {co2:.0f} ppm — below ambient levels. Photosynthesis is limited. "
                            f"Plants cannot grow efficiently below 350 ppm.",
                    priority=InsightPriority.HIGH, category="climate",
                    action="Increase ventilation to bring in fresh air, or activate CO₂ injection.",
                    icon="wind", metric_name="co2", metric_value=co2,
                ))
            elif co2 > 1200:
                results.append(Insight(
                    title="CO₂ Elevated",
                    message=f"CO₂ is {co2:.0f} ppm — above enrichment target. Most greenhouse crops plateau at 800-1200 ppm.",
                    priority=InsightPriority.LOW, category="climate",
                    action="Consider reducing CO₂ injection to save cost. Check for CO₂ leaks.",
                    icon="wind", metric_name="co2", metric_value=co2,
                ))

        if light is not None:
            if light < 500:
                results.append(Insight(
                    title="Low Light Conditions",
                    message=f"Light intensity is {light:.0f} lux — this is very low. If it's daytime, check for obstructions.",
                    priority=InsightPriority.LOW, category="climate",
                    action="Turn on supplemental lighting if available. Clean greenhouse glazing.",
                    icon="sun", metric_name="light_intensity", metric_value=light,
                ))

        return results

    def _analyze_vpd(self, readings: Dict, crop: CropProfile) -> List[Insight]:
        results = []
        temp = readings.get("zone_air:temperature")
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
        moisture = readings.get("zone_bed:soil_moisture")

        if moisture is None:
            return results

        trend = self._get_trend_for("zone_bed", "soil_moisture")

        if moisture < 25:
            results.append(Insight(
                title="Soil Moisture Critically Low",
                message=f"Moisture is {moisture:.0f}% — plants are at risk of wilting. Trend: {trend}.",
                priority=InsightPriority.CRITICAL, category="irrigation",
                action="Start irrigation immediately. Check valve and pump operation.",
                icon="droplets", metric_name="soil_moisture", metric_value=moisture,
            ))
        elif moisture < 35:
            results.append(Insight(
                title="Soil Moisture Getting Low",
                message=f"Moisture is {moisture:.0f}% and {trend}. Schedule irrigation soon to avoid stress.",
                priority=InsightPriority.MEDIUM, category="irrigation",
                action="Open irrigation valve within the next 15-30 minutes.",
                icon="droplets", metric_name="soil_moisture", metric_value=moisture,
            ))
        elif moisture > 75:
            results.append(Insight(
                title="Soil Overwatered",
                message=f"Moisture is {moisture:.0f}%. Oversaturation reduces oxygen at roots, risking root rot.",
                priority=InsightPriority.MEDIUM, category="irrigation",
                action="Stop irrigation. Ensure drainage is adequate. Increase ventilation.",
                icon="droplets", metric_name="soil_moisture", metric_value=moisture,
            ))
        else:
            if trend == "falling" and moisture < 50:
                results.append(Insight(
                    title="Moisture Declining — Plan Irrigation",
                    message=f"Moisture is {moisture:.0f}% and falling. At current rate, irrigation will be needed soon.",
                    priority=InsightPriority.LOW, category="irrigation",
                    action="Prepare to irrigate within the next hour.",
                    icon="droplets", metric_name="soil_moisture", metric_value=moisture,
                ))

        return results

    def _analyze_hydroponics(self, readings: Dict, crop: CropProfile) -> List[Insight]:
        results = []
        ph = readings.get("zone_nft:ph")
        ec = readings.get("zone_nft:ec")
        water_temp = readings.get("zone_nft:water_temperature")

        if ph is not None:
            if ph < crop.ph_min:
                results.append(Insight(
                    title="Nutrient Solution pH Too Low",
                    message=f"pH is {ph:.1f} — below {crop.ph_min}. Acidic conditions lock out calcium and magnesium.",
                    priority=InsightPriority.HIGH, category="hydroponics",
                    action="Add pH Up solution gradually. Check for acid dosing malfunction.",
                    icon="beaker", metric_name="ph", metric_value=ph,
                ))
            elif ph > crop.ph_max:
                results.append(Insight(
                    title="Nutrient Solution pH Too High",
                    message=f"pH is {ph:.1f} — above {crop.ph_max}. Alkaline conditions lock out iron and manganese.",
                    priority=InsightPriority.HIGH, category="hydroponics",
                    action="Add pH Down solution gradually. Check water source alkalinity.",
                    icon="beaker", metric_name="ph", metric_value=ph,
                ))

        if ec is not None:
            if ec < crop.ec_min:
                results.append(Insight(
                    title="EC Too Low — Underfeeding",
                    message=f"EC is {ec:.2f} mS/cm, below {crop.ec_min}. Plants may show deficiency symptoms (yellowing).",
                    priority=InsightPriority.MEDIUM, category="hydroponics",
                    action="Add concentrated nutrient stock. Check dosing pump.",
                    icon="gauge", metric_name="ec", metric_value=ec,
                ))
            elif ec > crop.ec_max:
                results.append(Insight(
                    title="EC Too High — Risk of Salt Burn",
                    message=f"EC is {ec:.2f} mS/cm, above {crop.ec_max}. Excess salts can damage roots and cause tip burn.",
                    priority=InsightPriority.MEDIUM, category="hydroponics",
                    action="Dilute with fresh water. Reduce nutrient dosing rate.",
                    icon="gauge", metric_name="ec", metric_value=ec,
                ))

        if water_temp is not None:
            if water_temp > 28:
                results.append(Insight(
                    title="Water Temperature Too Warm",
                    message=f"Water is {water_temp:.1f}°C. Above 28°C, dissolved oxygen drops and root diseases (Pythium) thrive.",
                    priority=InsightPriority.HIGH, category="hydroponics",
                    action="Add a chiller or shade the reservoir. Add beneficial microbes.",
                    icon="thermometer", metric_name="water_temperature", metric_value=water_temp,
                ))
            elif water_temp < 16:
                results.append(Insight(
                    title="Water Temperature Too Cold",
                    message=f"Water is {water_temp:.1f}°C. Cold roots slow nutrient uptake and stunt growth.",
                    priority=InsightPriority.MEDIUM, category="hydroponics",
                    action="Add a submersible heater. Insulate pipes and reservoir.",
                    icon="thermometer", metric_name="water_temperature", metric_value=water_temp,
                ))

        return results

    def _analyze_reservoir(self, readings: Dict) -> List[Insight]:
        results = []
        level = readings.get("zone_reservoir:water_level")

        if level is not None:
            trend = self._get_trend_for("zone_reservoir", "water_level")
            if level < 20:
                results.append(Insight(
                    title="Reservoir Level Critical",
                    message=f"Water level is {level:.0f} cm — pump may run dry, causing damage.",
                    priority=InsightPriority.CRITICAL, category="reservoir",
                    action="Refill reservoir immediately. Check for leaks.",
                    icon="waves", metric_name="water_level", metric_value=level,
                ))
            elif level < 35 and trend == "falling":
                results.append(Insight(
                    title="Reservoir Level Dropping",
                    message=f"Water at {level:.0f} cm and declining. Plan a refill to maintain supply.",
                    priority=InsightPriority.MEDIUM, category="reservoir",
                    action="Schedule reservoir refill within the next few hours.",
                    icon="waves", metric_name="water_level", metric_value=level,
                ))

        return results

    def _analyze_efficiency(self, readings: Dict) -> List[Insight]:
        """Cross-sensor analysis for energy/resource efficiency."""
        results = []
        temp = readings.get("zone_air:temperature")
        light = readings.get("zone_air:light_intensity")

        actuators = {a.actuator_id: a.state for a in twin_state.get_all_actuators()}

        if temp is not None and temp < 20 and actuators.get("fan_exhaust") == "on":
            results.append(Insight(
                title="Exhaust Fan Running While Cool",
                message=f"Temperature is already {temp:.1f}°C but the exhaust fan is on. This wastes energy.",
                priority=InsightPriority.LOW, category="efficiency",
                action="Consider turning off the exhaust fan to conserve energy.",
                icon="zap",
            ))

        if temp is not None and temp > 28 and actuators.get("heater_main") == "on":
            results.append(Insight(
                title="Heater Running While Hot",
                message=f"Temperature is {temp:.1f}°C but the heater is on. This is counterproductive.",
                priority=InsightPriority.HIGH, category="efficiency",
                action="Turn off the heater immediately.",
                icon="zap",
            ))

        if light is not None and light > 30000 and actuators.get("light_supplemental") == "on":
            results.append(Insight(
                title="Supplemental Lights Unnecessary",
                message=f"Natural light is {light:.0f} lux — supplemental lights are wasting electricity.",
                priority=InsightPriority.LOW, category="efficiency",
                action="Turn off supplemental lighting during bright daylight.",
                icon="zap",
            ))

        return results

    # ── Summary Generation ──

    def generate_summary(self) -> str:
        """Generate a natural language summary of the greenhouse state."""
        readings = self._get_current_readings()
        crop = self.get_crop_profile()

        temp = readings.get("zone_air:temperature")
        rh = readings.get("zone_air:humidity")
        co2 = readings.get("zone_air:co2")
        moisture = readings.get("zone_bed:soil_moisture")
        nft_ph = readings.get("zone_nft:ph")
        water_level = readings.get("zone_reservoir:water_level")

        parts = []
        parts.append(f"Current crop profile: {crop.name}.")

        if temp is not None and rh is not None:
            vpd = calculate_vpd(temp, rh)
            temp_status = "optimal" if crop.temp_min <= temp <= crop.temp_max else ("too high" if temp > crop.temp_max else "too low")
            parts.append(
                f"The greenhouse air is {temp:.1f}°C ({temp_status}) with {rh:.0f}% humidity. "
                f"VPD is {vpd:.2f} kPa."
            )

        if co2 is not None:
            co2_status = "adequate" if 400 <= co2 <= 1200 else ("low" if co2 < 400 else "elevated")
            parts.append(f"CO₂ level is {co2:.0f} ppm ({co2_status}).")

        if moisture is not None:
            m_trend = self._get_trend_for("zone_bed", "soil_moisture")
            parts.append(f"Substrate moisture is {moisture:.0f}% and {m_trend}.")

        if nft_ph is not None:
            ph_ok = crop.ph_min <= nft_ph <= crop.ph_max
            parts.append(f"Hydroponic pH is {nft_ph:.1f} ({'within range' if ph_ok else 'out of range'}).")

        if water_level is not None:
            parts.append(f"Reservoir level is {water_level:.0f} cm.")

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
                    f"Hello! I'm your greenhouse AI assistant. I can help you with:\n\n"
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
            temp = readings.get("zone_air:temperature")
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
            temp = readings.get("zone_air:temperature")
            if temp is not None:
                trend = self._get_trend_for("zone_air", "temperature")
                stats = self._get_stats_for("zone_air", "temperature")
                status = "optimal" if crop.temp_min <= temp <= crop.temp_max else ("too high" if temp > crop.temp_max else "too low")
                answer = (
                    f"**Air Temperature**: {temp:.1f}°C — {status}\n\n"
                    f"- Ideal range for {crop.name}: {crop.temp_min}-{crop.temp_max}°C (ideal: {crop.temp_ideal}°C)\n"
                    f"- Trend: {trend}\n"
                )
                if stats:
                    answer += f"- Recent stats: min {stats['min']}°C, max {stats['max']}°C, avg {stats['mean']}°C\n"
                if temp > crop.temp_max:
                    answer += f"\n**Action**: Use exhaust fan and ventilation to bring temperature down."
                elif temp < crop.temp_min:
                    answer += f"\n**Action**: Turn on heater. Check for cold drafts."
                return ChatResponse(answer=answer, data_points={"temperature": temp})
            return ChatResponse(answer="Temperature data is not available yet.")

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
            nft_ph = readings.get("zone_nft:ph")
            res_ph = readings.get("zone_reservoir:ph")
            parts = []
            if nft_ph is not None:
                status = "in range" if crop.ph_min <= nft_ph <= crop.ph_max else "out of range"
                parts.append(
                    f"**NFT Channel pH**: {nft_ph:.1f} — {status}\n"
                    f"- Ideal for {crop.name}: {crop.ph_min}-{crop.ph_max}\n"
                )
            if res_ph is not None:
                parts.append(f"**Reservoir pH**: {res_ph:.1f}\n")
            parts.append(
                f"\n**Why pH matters**: pH controls which nutrients dissolve and are available to roots. "
                f"Outside the ideal range, certain elements 'lock out' even if present in solution."
            )
            return ChatResponse(
                answer="\n".join(parts) if parts else "pH data not available yet.",
                data_points={"nft_ph": nft_ph, "reservoir_ph": res_ph},
            )

        if any(w in q for w in ["ec", "electrical conductivity", "nutrient strength", "feed"]):
            nft_ec = readings.get("zone_nft:ec")
            bed_ec = readings.get("zone_bed:ec")
            parts = []
            if nft_ec is not None:
                status = "in range" if crop.ec_min <= nft_ec <= crop.ec_max else ("too low" if nft_ec < crop.ec_min else "too high")
                parts.append(
                    f"**NFT EC**: {nft_ec:.2f} mS/cm — {status}\n"
                    f"- Ideal for {crop.name}: {crop.ec_min}-{crop.ec_max} mS/cm\n"
                )
            if bed_ec is not None:
                parts.append(f"**Substrate EC**: {bed_ec:.2f} mS/cm\n")
            parts.append(
                f"\n**What EC tells you**: EC measures total dissolved salts — a proxy for nutrient concentration. "
                f"Too low = underfeeding. Too high = salt burn and root damage."
            )
            return ChatResponse(answer="\n".join(parts))

        if any(w in q for w in ["water", "irrigat", "when to water", "should i water", "soil moisture"]):
            moisture = readings.get("zone_bed:soil_moisture")
            if moisture is not None:
                trend = self._get_trend_for("zone_bed", "soil_moisture")
                if moisture < 30:
                    answer = f"**Yes, irrigate now!** Soil moisture is {moisture:.0f}% and {trend}. Plants need water immediately."
                elif moisture < 45 and trend == "falling":
                    answer = f"**Plan irrigation soon.** Moisture is {moisture:.0f}% and falling. Water within the next 30 minutes."
                elif moisture > 70:
                    answer = f"**No irrigation needed.** Moisture is {moisture:.0f}%. Soil is well-watered, avoid overwatering."
                else:
                    answer = f"**Moisture is adequate** at {moisture:.0f}% ({trend}). No immediate irrigation needed."
                return ChatResponse(answer=answer, data_points={"soil_moisture": moisture})
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

        if any(w in q for w in ["reservoir", "tank", "water level"]):
            level = readings.get("zone_reservoir:water_level")
            res_ph = readings.get("zone_reservoir:ph")
            res_ec = readings.get("zone_reservoir:ec")
            res_temp = readings.get("zone_reservoir:water_temperature")
            parts = [f"**Reservoir Status:**\n"]
            if level is not None:
                trend = self._get_trend_for("zone_reservoir", "water_level")
                parts.append(f"- Water level: {level:.0f} cm ({trend})")
            if res_ph is not None:
                parts.append(f"- pH: {res_ph:.1f}")
            if res_ec is not None:
                parts.append(f"- EC: {res_ec:.2f} mS/cm")
            if res_temp is not None:
                parts.append(f"- Temperature: {res_temp:.1f}°C")
            return ChatResponse(answer="\n".join(parts))

        if any(w in q for w in ["co2", "carbon", "ventilat"]):
            co2 = readings.get("zone_air:co2")
            if co2 is not None:
                if co2 < 400:
                    advice = "CO₂ is below ambient. Open vents or inject CO₂ to boost photosynthesis."
                elif co2 > 1000:
                    advice = "CO₂ is elevated. Good for enrichment, but check it doesn't exceed 1500 ppm."
                else:
                    advice = "CO₂ is at a healthy level for plant growth."
                return ChatResponse(
                    answer=f"**CO₂ Level**: {co2:.0f} ppm\n\n{advice}\n\nPlants use CO₂ for photosynthesis. "
                           f"Enriching to 800-1200 ppm can boost yields 20-30% in a sealed greenhouse.",
                    data_points={"co2": co2},
                )
            return ChatResponse(answer="CO₂ data not available yet.")

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
