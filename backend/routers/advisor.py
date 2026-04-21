"""
AI Advisor API — powered by Google Gemini with automatic model fallback.

All endpoints feed live sensor data to Gemini for real AI responses.
Falls back to local rule-based engine if Gemini API key is not configured.
"""

from fastapi import APIRouter, Query, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Optional, Dict

from backend.config import settings
from backend.services.gemini_advisor import gemini_advisor
from backend.services.ai_advisor import advisor as rule_advisor, CROP_PROFILES, calculate_vpd, calculate_dew_point
from backend.services.weather_service import weather_service
from backend.services.automation_engine import automation_engine
from backend.services.agent_executor import agent_executor
from backend.database import tsdb

router = APIRouter(prefix="/api/advisor", tags=["AI Advisor (Gemini)"])


# ── Request / Response Models ──

class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"
    language: Optional[str] = None  # "en" | "zh" | "ms" (Malay) | any ISO name


class WhatIfRequest(BaseModel):
    scenario: str


class GrowPlanRequest(BaseModel):
    crop: str = "lettuce"
    weeks: int = 4


class ChatResponseModel(BaseModel):
    answer: str
    model: str = ""
    powered_by: str = ""
    insights: Optional[List[dict]] = None


class AgentChatRequest(BaseModel):
    message: str
    session_id: str = "default"
    language: Optional[str] = None


class AgentChatResponse(BaseModel):
    answer: str
    intent: str = "general_chat"
    actions_taken: List[dict] = []
    actions_proposed: List[dict] = []
    action_id: Optional[str] = None
    model: str = ""
    powered_by: str = ""


class ConfirmActionRequest(BaseModel):
    action_id: str


class InsightResponse(BaseModel):
    title: str
    message: str
    priority: str
    category: str
    action: Optional[str]
    icon: str
    metric_name: Optional[str]
    metric_value: Optional[float]


class CropProfileResponse(BaseModel):
    name: str
    temp_range: str
    humidity_range: str
    ph_range: str
    ec_range: str
    vpd_range: str
    light_hours: float
    notes: str


# ── Core Chat (Gemini-powered) ──

@router.post("/chat", response_model=ChatResponseModel)
async def chat(request: ChatRequest):
    """Chat with the AI advisor. Powered by Google Gemini with live sensor context."""
    # If a language is requested, prepend an instruction so Gemini replies in that language.
    # Farmers in Malaysia commonly use English, Chinese, and Bahasa Melayu.
    language_map = {
        "en": "English",
        "zh": "Chinese (Simplified, \u7b80\u4f53\u4e2d\u6587)",
        "ms": "Bahasa Melayu",
        "ta": "Tamil",
    }
    msg = request.message
    if request.language:
        lang_name = language_map.get(request.language, request.language)
        msg = f"[Please respond in {lang_name}.]\n{msg}"

    result = await gemini_advisor.chat(msg, request.session_id)
    return ChatResponseModel(
        answer=result.get("answer", ""),
        model=result.get("model", ""),
        powered_by=result.get("powered_by", ""),
        insights=result.get("insights"),
    )


@router.post("/chat/clear")
async def clear_chat(session_id: str = "default"):
    """Clear conversation history to start fresh."""
    gemini_advisor.clear_chat(session_id)
    return {"status": "cleared", "session_id": session_id}


# ── Agentic AI Endpoints ──

@router.post("/agent-chat", response_model=AgentChatResponse)
async def agent_chat(request: AgentChatRequest):
    """
    Agentic AI chat — parses natural language intent, executes actuator commands,
    and returns results with action details. Supports Hello Twin wake word.
    """
    lang_map = {
        "en": "English",
        "zh": "Chinese (Simplified, 简体中文)",
        "ms": "Bahasa Melayu",
        "ta": "Tamil",
    }
    language = request.language

    result = await agent_executor.agent_chat(request.message, language)
    return AgentChatResponse(
        answer=result.get("answer", ""),
        intent=result.get("intent", "general_chat"),
        actions_taken=result.get("actions_taken", []),
        actions_proposed=result.get("actions_proposed", []),
        action_id=result.get("action_id"),
        model=result.get("model", ""),
        powered_by=result.get("powered_by", ""),
    )


@router.get("/hello-twin", response_model=AgentChatResponse)
async def hello_twin():
    """Trigger a Hello Twin proactive greeting with full greenhouse status analysis."""
    result = await agent_executor.hello_twin()
    return AgentChatResponse(
        answer=result.get("answer", ""),
        intent=result.get("intent", "greeting"),
        actions_taken=result.get("actions_taken", []),
        actions_proposed=result.get("actions_proposed", []),
        model=result.get("model", ""),
        powered_by=result.get("powered_by", ""),
    )


@router.post("/confirm-action", response_model=AgentChatResponse)
async def confirm_action(request: ConfirmActionRequest):
    """Confirm and execute a previously proposed action set."""
    result = await agent_executor.confirm_action(request.action_id)
    return AgentChatResponse(
        answer=result.get("answer", ""),
        intent=result.get("intent", "control_actuator"),
        actions_taken=result.get("actions_taken", []),
        actions_proposed=result.get("actions_proposed", []),
        model=result.get("model", ""),
        powered_by=result.get("powered_by", ""),
    )


@router.get("/agent-log")
async def get_agent_log(limit: int = Query(50, ge=1, le=200)):
    """Retrieve the AI agent's execution audit log."""
    return {"log": agent_executor.get_execution_log(limit)}


# ── Creative AI Functions ──

@router.get("/daily-report")
async def get_daily_report():
    """Generate a comprehensive AI-powered daily greenhouse report."""
    return await gemini_advisor.generate_daily_report()


@router.post("/grow-plan")
async def get_grow_plan(request: GrowPlanRequest):
    """Generate a week-by-week AI growing plan for a specific crop."""
    return await gemini_advisor.generate_grow_plan(request.crop, request.weeks)


@router.post("/what-if")
async def what_if_analysis(request: WhatIfRequest):
    """Simulate a what-if scenario. Ask 'What happens if I turn off the fan?'"""
    return await gemini_advisor.what_if_scenario(request.scenario)


@router.post("/diagnose-image")
async def diagnose_plant_image(
    image: UploadFile = File(...),
    description: str = Form(""),
):
    """Upload a plant image for AI-powered health diagnosis using Gemini Vision."""
    image_bytes = await image.read()
    return await gemini_advisor.diagnose_plant_image(image_bytes, description)


@router.post("/explain-anomaly")
async def explain_anomaly(
    sensor_id: str = Query(...),
    sensor_type: str = Query(...),
    zone_id: str = Query(...),
    value: float = Query(...),
):
    """Get a plain-language AI explanation of a sensor anomaly."""
    return await gemini_advisor.explain_anomaly(sensor_id, sensor_type, zone_id, value)


@router.get("/automation-schedule")
async def get_automation_schedule():
    """Generate an AI-optimized 24-hour automation schedule."""
    return await gemini_advisor.suggest_automation_schedule()


@router.get("/learn/{topic}")
async def learn_topic(topic: str):
    """Learn about a greenhouse topic with beginner-friendly AI explanations."""
    return await gemini_advisor.educational_explain(topic)


# ── Status ──

@router.get("/status")
async def advisor_status():
    """Check if Gemini AI is connected and available."""
    import time
    now = time.time()
    active_model = gemini_advisor._pick_model() if gemini_advisor.is_available else None
    blocked = {
        m: max(0, int(t - now))
        for m, t in gemini_advisor._blocked_models.items()
        if t > now
    }
    return {
        "gemini_available": gemini_advisor.is_available,
        "model": active_model or settings.gemini_model,
        "active_model": active_model,
        "error": gemini_advisor._init_error if not gemini_advisor.is_available else None,
        "fallback_active": not gemini_advisor.is_available,
        "all_models_blocked": active_model is None and gemini_advisor.is_available,
        "blocked_models": blocked,
    }


# ── Existing endpoints (still useful) ──

@router.get("/insights")
async def get_insights():
    """Get AI-generated insights — Gemini first, rule-based fallback."""
    # Try Gemini first
    gemini_result = await gemini_advisor.generate_insights()
    if gemini_result and "insights" in gemini_result:
        return {
            "insights": gemini_result["insights"],
            "powered_by": "google_gemini",
        }

    # Fallback to rule-based
    insights = rule_advisor.generate_insights()
    return {
        "insights": [
            {
                "title": i.title, "message": i.message,
                "priority": i.priority.value, "category": i.category,
                "action": i.action, "icon": i.icon,
                "metric_name": i.metric_name, "metric_value": i.metric_value,
            }
            for i in insights
        ],
        "powered_by": "local_rules",
    }


@router.get("/summary")
async def get_summary():
    """Get AI-generated summary — Gemini first, rule-based fallback."""
    gemini_result = await gemini_advisor.generate_summary()
    if gemini_result:
        return gemini_result

    return {"summary": rule_advisor.generate_summary(), "powered_by": "local_rules"}


@router.get("/crops", response_model=List[CropProfileResponse])
async def get_crop_profiles():
    """List all available crop profiles."""
    return [
        CropProfileResponse(
            name=cp.name,
            temp_range=f"{cp.temp_min}-{cp.temp_max}°C",
            humidity_range=f"{cp.rh_min}-{cp.rh_max}%",
            ph_range=f"{cp.ph_min}-{cp.ph_max}",
            ec_range=f"{cp.ec_min}-{cp.ec_max} mS/cm",
            vpd_range=f"{cp.vpd_min}-{cp.vpd_max} kPa",
            light_hours=cp.light_hours,
            notes=cp.notes,
        )
        for cp in CROP_PROFILES.values()
    ]


@router.post("/crop/{crop_name}")
async def set_active_crop(crop_name: str):
    """Set the active crop profile."""
    if crop_name.lower() not in CROP_PROFILES:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Crop not found. Available: {list(CROP_PROFILES.keys())}")
    rule_advisor.set_crop(crop_name.lower())
    cp = rule_advisor.get_crop_profile()
    return {"status": "ok", "active_crop": cp.name, "message": f"Now monitoring for {cp.name}."}


@router.get("/weather")
async def get_weather():
    """Live outdoor weather + 12-hour forecast for the farm location."""
    return weather_service.get_weather()


@router.get("/weather/refresh")
async def refresh_weather():
    """Force-refresh the weather cache."""
    return weather_service.get_weather(force_refresh=True)


@router.get("/automation/status")
async def automation_status():
    """Inspect the closed-loop automation engine (auto-irrigation)."""
    return automation_engine.get_status()


@router.post("/automation/enabled")
async def set_automation_enabled(enabled: bool = Query(...)):
    """Enable or disable the closed-loop automation engine."""
    automation_engine.set_enabled(enabled)
    return {"enabled": automation_engine.enabled}


@router.get("/forecast-soil")
async def forecast_soil_conditions(horizon_hours: int = Query(4, ge=1, le=24)):
    """
    Gemini-powered forecast for soil moisture / temperature / pH + air humidity
    over the next few hours. Combines sensor history with live weather.
    """
    if not gemini_advisor.is_available:
        return {"forecast": "Gemini not available.", "powered_by": "fallback"}

    from backend.services.gemini_advisor import _build_sensor_context, _build_history_context
    context = _build_sensor_context()

    history_lines = ["## Recent Sensor Statistics"]
    for zone, sensor in [
        ("zone_air", "humidity"), ("zone_air", "temperature"), ("zone_air", "light"),
        ("zone_bed_a", "soil_moisture"), ("zone_bed_a", "soil_temperature"), ("zone_bed_a", "soil_ph"),
        ("zone_bed_b", "soil_moisture"), ("zone_bed_b", "soil_temperature"), ("zone_bed_b", "soil_ph"),
        ("zone_bed_c", "soil_moisture"), ("zone_bed_c", "soil_temperature"), ("zone_bed_c", "soil_ph"),
    ]:
        history_lines.append(f"- {zone}/{sensor}: {_build_history_context(zone, sensor, 100)}")

    prompt = (
        f"{context}\n\n{chr(10).join(history_lines)}\n\n---\n\n"
        f"Predict what will happen to these sensors over the NEXT {horizon_hours} HOURS:\n"
        f"- Air humidity\n- Soil moisture (beds A/B/C)\n- Soil temperature (beds A/B/C)\n- Soil pH (beds A/B/C)\n\n"
        f"Use the outdoor weather forecast to reason about indoor dynamics. "
        f"For each metric, give:\n"
        f"1. Predicted direction (rising / falling / stable)\n"
        f"2. Predicted range at +{horizon_hours}h\n"
        f"3. Risk flag (ok / watch / act now)\n"
        f"4. One-line reason tied to weather or actuator state\n\n"
        f"Finish with a **Top 3 actions** section. Format with markdown."
    )

    try:
        response = await gemini_advisor._generate_async(prompt)
        return {
            "forecast": response,
            "horizon_hours": horizon_hours,
            "powered_by": "google_gemini",
        }
    except Exception as e:
        return {"forecast": f"Error: {e}", "powered_by": "error"}


@router.get("/vpd")
async def get_vpd_info():
    """Get current VPD calculation — prefers air temp, falls back to avg soil temp."""
    air_temp_r = tsdb.get_latest("zone_air", "temperature")
    rh_r = tsdb.get_latest("zone_air", "humidity")
    if air_temp_r:
        temp = air_temp_r.value
    else:
        soil_temps = [
            tsdb.get_latest(f"zone_bed_{bed}", "soil_temperature")
            for bed in ("a", "b", "c")
        ]
        valid_temps = [r for r in soil_temps if r is not None]
        if not valid_temps:
            return {"error": "Sensor data not available"}
        temp = sum(r.value for r in valid_temps) / len(valid_temps)
    if not rh_r:
        return {"error": "Sensor data not available"}
    rh = rh_r.value
    vpd = calculate_vpd(temp, rh)
    dp = calculate_dew_point(temp, rh)
    crop = rule_advisor.get_crop_profile()
    status = "optimal" if crop.vpd_min <= vpd <= crop.vpd_max else ("low" if vpd < crop.vpd_min else "high")
    return {
        "vpd_kpa": vpd, "temperature_c": round(temp, 1),
        "humidity_percent": round(rh, 1), "dew_point_c": dp,
        "status": status, "ideal_range": f"{crop.vpd_min}-{crop.vpd_max} kPa",
        "crop": crop.name,
    }
