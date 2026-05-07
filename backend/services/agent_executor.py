"""
Agentic AI Executor for the Digital Twin Greenhouse.

Core service that enables:
1. Natural language → structured intent parsing via Gemini
2. "Hello Twin" proactive greeting with status analysis
3. Actuator control execution with auto-off safety timers
4. Execution audit logging
"""

import json
import threading
import time
import uuid
from collections import deque
from datetime import datetime
from typing import Dict, List, Optional

from backend.models import ActuatorCommand, ActuatorState, get_now
from backend.services.twin_state import twin_state
from backend.database import tsdb


# ── Intent Types ──
VALID_INTENTS = [
    "control_actuator",   # Turn on/off specific pumps
    "emergency_stop",     # Stop ALL actuators immediately
    "optimize_environment",  # Multi-step environment optimization (needs confirm)
    "query_status",       # Ask about greenhouse state
    "greeting",           # Hello Twin / general greeting
    "general_chat",       # Normal conversation, no action needed
]

# Actuator ID mapping for natural language resolution
ACTUATOR_ALIASES = {
    # Pump A
    "pump_a": "pump_a", "pump a": "pump_a", "水泵a": "pump_a",
    "bed a": "pump_a", "bed_a": "pump_a", "a泵": "pump_a",
    "pam a": "pump_a",  # Malay
    # Pump B
    "pump_b": "pump_b", "pump b": "pump_b", "水泵b": "pump_b",
    "bed b": "pump_b", "bed_b": "pump_b", "b泵": "pump_b",
    "pam b": "pump_b",
    # Pump C
    "pump_c": "pump_c", "pump c": "pump_c", "水泵c": "pump_c",
    "bed c": "pump_c", "bed_c": "pump_c", "c泵": "pump_c",
    "pam c": "pump_c",

    # --- Sensor Power Channels ---
    # Air Humidity 1
    "sensor_air_rh_1": "sensor_air_rh_1", "air humidity 1": "sensor_air_rh_1", "1号湿度": "sensor_air_rh_1", "湿度1": "sensor_air_rh_1",
    # Air Humidity 2
    "sensor_air_rh_2": "sensor_air_rh_2", "air humidity 2": "sensor_air_rh_2", "2号湿度": "sensor_air_rh_2", "湿度2": "sensor_air_rh_2",
    # Air Temp
    "sensor_air_temp_1": "sensor_air_temp_1", "air temperature": "sensor_air_temp_1", "空气温度": "sensor_air_temp_1", "空温": "sensor_air_temp_1",
    # Air Light
    "sensor_air_light_1": "sensor_air_light_1", "greenhouse light": "sensor_air_light_1", "光照传感器": "sensor_air_light_1", "光照": "sensor_air_light_1",
    # Bed A
    "sensor_bed_a_temp": "sensor_bed_a_temp", "soil temperature a": "sensor_bed_a_temp", "A床土温": "sensor_bed_a_temp", "A床土壤温度": "sensor_bed_a_temp",
    "sensor_bed_a_ph": "sensor_bed_a_ph", "soil ph a": "sensor_bed_a_ph", "A床ph": "sensor_bed_a_ph", "A床酸碱度": "sensor_bed_a_ph",
    "sensor_bed_a_moisture": "sensor_bed_a_moisture", "soil moisture a": "sensor_bed_a_moisture", "A床水分": "sensor_bed_a_moisture", "A床土壤水分": "sensor_bed_a_moisture",
    # Bed B
    "sensor_bed_b_temp": "sensor_bed_b_temp", "soil temperature b": "sensor_bed_b_temp", "B床土温": "sensor_bed_b_temp", "B床土壤温度": "sensor_bed_b_temp",
    "sensor_bed_b_ph": "sensor_bed_b_ph", "soil ph b": "sensor_bed_b_ph", "B床ph": "sensor_bed_b_ph", "B床酸碱度": "sensor_bed_b_ph",
    "sensor_bed_b_moisture": "sensor_bed_b_moisture", "soil moisture b": "sensor_bed_b_moisture", "B床水分": "sensor_bed_b_moisture", "B床土壤水分": "sensor_bed_b_moisture",
    # Bed C
    "sensor_bed_c_temp": "sensor_bed_c_temp", "soil temperature c": "sensor_bed_c_temp", "C床土温": "sensor_bed_c_temp", "C床土壤温度": "sensor_bed_c_temp",
    "sensor_bed_c_ph": "sensor_bed_c_ph", "soil ph c": "sensor_bed_c_ph", "C床ph": "sensor_bed_c_ph", "C床酸碱度": "sensor_bed_c_ph",
    "sensor_bed_c_moisture": "sensor_bed_c_moisture", "soil moisture c": "sensor_bed_c_moisture", "C床水分": "sensor_bed_c_moisture", "C床土壤水分": "sensor_bed_c_moisture",
}

# Maximum pump-on duration (safety cap)
MAX_PUMP_DURATION_SECONDS = 300  # 5 minutes
DEFAULT_PUMP_DURATION_SECONDS = 60

# Intent parsing prompt for Gemini
INTENT_PARSE_PROMPT = """You are an intent parser for a greenhouse digital twin system.
The greenhouse has these actuators:
- pump_a (Water Pump A) — controls irrigation for Bed A
- pump_b (Water Pump B) — controls irrigation for Bed B
- pump_c (Water Pump C) — controls irrigation for Bed C
- sensor_air_rh_1 (Air Humidity 1 Power)
- sensor_air_rh_2 (Air Humidity 2 Power)
- sensor_air_temp_1 (Air Temperature Power)
- sensor_air_light_1 (Greenhouse Light Power)
- sensor_bed_a_temp, sensor_bed_a_ph, sensor_bed_a_moisture (Soil Sensors Bed A)
- sensor_bed_b_temp, sensor_bed_b_ph, sensor_bed_b_moisture (Soil Sensors Bed B)
- sensor_bed_c_temp, sensor_bed_c_ph, sensor_bed_c_moisture (Soil Sensors Bed C)

Parse the user's natural language message into a structured JSON response.
"关闭所有传感器" or "开启所有电源" means controlling all matching sensor_xxx actuators.
"所有泵" means just pump_a/b/c.
"全部关掉" / "所有开关" means EVERYTHING (pumps + sensors).

## Rules:
1. If the user wants to control a specific pump, set intent="control_actuator"
2. If the user says "stop all" / "emergency stop" / "所有泵停了" / "全部关掉", set intent="emergency_stop"
3. If the user wants to optimize for a crop or adjust environment broadly, set intent="optimize_environment"
4. If the user asks about status/conditions/readings, set intent="query_status"
5. If the user says hello/hi/greets, set intent="greeting"
6. For everything else, set intent="general_chat"

## For control_actuator intent:
- Simple single-pump on/off: set requires_confirmation=false
- Multiple pumps at once: set requires_confirmation=true
- "浇水" / "water" without specifying a bed means ALL pumps → requires_confirmation=true

## For emergency_stop intent:
- Always set requires_confirmation=false (safety first)

## For optimize_environment intent:
- Always set requires_confirmation=true

## Output format (JSON only, no markdown):
{
  "intent": "control_actuator",
  "actions": [
    {"actuator_id": "pump_a", "command": "on", "duration_seconds": 60}
  ],
  "reasoning": "Brief explanation of what was parsed",
  "requires_confirmation": false,
  "response_text": "A friendly response message to show the user, in the SAME LANGUAGE as the user's message. Use emoji. If executing, confirm what was done. If proposing, explain what will be done."
}

For query_status, greeting, general_chat intents: set actions=[] and requires_confirmation=false.
For greeting intent: make response_text a warm greeting.

IMPORTANT: Output ONLY valid JSON. No markdown code fences. Respond in the same language the user used.
"""

HELLO_TWIN_PROMPT = """You are GreenMind, the AI assistant for a small-scale greenhouse digital twin system.
The user just triggered the "Hello Twin" wake word. Generate a proactive, friendly greeting that:

1. Greets warmly with emoji (👋)
2. Shows a **quick status overview** of ALL sensor data provided (use actual values)
3. Highlights any **warnings or anomalies** (⚠️) — e.g. low soil moisture, high temperature, pH out of range
4. Proactively suggests 2-3 helpful things you can do for them
5. Asks what they need help with

Use the sensor data provided below. Be specific with numbers. Keep it concise but informative.
Format with markdown. Use emoji liberally.

IMPORTANT: If there are active alerts, mention them prominently. If everything is normal, say so with confidence.
Respond in the same language context — if sensor data looks like a Chinese system, respond in Chinese; otherwise default to English.
"""


class AgentExecutor:
    """Agentic AI executor — parses intent, executes actions, logs everything."""

    def __init__(self):
        self._execution_log: deque = deque(maxlen=200)
        self._pending_actions: Dict[str, dict] = {}  # action_id → action bundle
        self._auto_off_timers: Dict[str, threading.Timer] = {}

    # ── Hello Twin ──

    async def hello_twin(self, language: str = None) -> dict:
        """Generate a proactive greeting with full greenhouse status analysis."""
        from backend.services.gemini_advisor import gemini_advisor, _build_sensor_context

        context = _build_sensor_context()

        if not gemini_advisor.is_available:
            # Fallback: build a basic greeting from raw data
            return self._fallback_hello_twin(context, language)

        lang_map = {
            "en": "English",
            "zh": "Chinese (Simplified, 简体中文)",
            "ms": "Bahasa Melayu",
            "ta": "Tamil",
        }
        lang_name = lang_map.get(language, language) if language else None
        lang_instruction = f"[Please respond in {lang_name}.]\n" if lang_name else ""

        prompt = f"{lang_instruction}{HELLO_TWIN_PROMPT}\n\n{context}\n\nGenerate the Hello Twin greeting now."

        try:
            response = await gemini_advisor._generate_async(prompt)
            self._log_action("hello_twin", "greeting", {}, response[:200])
            return {
                "answer": response,
                "intent": "greeting",
                "actions_taken": [],
                "actions_proposed": [],
                "model": gemini_advisor._active_model,
                "powered_by": "google_gemini",
            }
        except Exception as e:
            print(f"[AgentExecutor] Hello Twin error: {e}")
            import traceback
            with open("hello_twin_error.txt", "w", encoding="utf-8") as f:
                f.write(traceback.format_exc())
            return self._fallback_hello_twin(context, language)

    def _fallback_hello_twin(self, context: str, language: str = None) -> dict:
        """Build a basic greeting when Gemini is not available."""
        # Extract some basic data from twin state
        actuators = twin_state.get_all_actuators()
        alerts = twin_state.get_alerts()

        pump_status = ", ".join(
            f"{a.name}: {'🟢 ON' if a.state == ActuatorState.ON else '⚪ OFF'}"
            for a in actuators
        )
        alert_text = ""
        if alerts:
            alert_text = "\n\n⚠️ **Active Alerts:**\n" + "\n".join(
                f"- [{a.severity.value.upper()}] {a.message}" for a in alerts[:5]
            )

        greeting = (
            f"👋 **Hello! I'm GreenMind, your greenhouse AI assistant.**\n\n"
            f"📊 **Actuator Status:** {pump_status}\n"
            f"{alert_text}\n\n"
            f"What would you like me to help with?\n"
            f"- 💧 Control irrigation\n"
            f"- 📋 Generate a status report\n"
            f"- 🔍 Check for problems"
        )

        return {
            "answer": greeting,
            "intent": "greeting",
            "actions_taken": [],
            "actions_proposed": [],
            "model": "fallback",
            "powered_by": "local_rules",
        }

    # ── Agent Chat (full pipeline) ──

    async def agent_chat(self, message: str, language: str = None) -> dict:
        """
        Full agentic chat pipeline:
        1. Parse intent via Gemini
        2. Execute or propose actions
        3. Return result with action details
        """
        from backend.services.gemini_advisor import (
            gemini_advisor, _build_sensor_context,
        )

        # Check for Hello Twin trigger
        lower_msg = message.lower().strip()
        wake_words_map = {
            "en": ["hello twin", "hi twin", "hey twin", "halo twin", "hey twins", "hello twins", "hi, twins", "twins"],
            "zh": ["你好小双", "嗨小双", "嘿小双", "小双同学"],
            "ms": ["hai maya", "hello maya", "maya", "hai si kembar", "hello si kembar", "si kembar"],
            "ta": ["hello twin", "hi twin", "hey twin", "halo twin", "hey twins", "hello twins", "twins"]
        }
        
        active_lang = language if language else "en"
        hello_triggers = wake_words_map.get(active_lang, wake_words_map["en"])
        
        if any(trigger in lower_msg for trigger in hello_triggers):
            return await self.hello_twin(active_lang)

        if not gemini_advisor.is_available:
            # Fall back to regular chat
            result = await gemini_advisor.chat(message)
            return {
                "answer": result.get("answer", ""),
                "intent": "general_chat",
                "actions_taken": [],
                "actions_proposed": [],
                "model": result.get("model", ""),
                "powered_by": result.get("powered_by", ""),
            }

        # Step 1: Parse intent
        context = _build_sensor_context()
        lang_instruction = ""
        if language:
            lang_map = {"en": "English", "zh": "Chinese (Simplified)", "ms": "Bahasa Melayu", "ta": "Tamil"}
            lang_name = lang_map.get(language, language)
            lang_instruction = f"\n[Respond in {lang_name}.]\n"

        parse_prompt = (
            f"{INTENT_PARSE_PROMPT}\n\n"
            f"## Current Greenhouse State:\n{context}\n\n"
            f"{lang_instruction}"
            f"## User Message:\n{message}\n\n"
            f"Parse this message and return JSON:"
        )

        try:
            raw_response = await gemini_advisor._generate_async(parse_prompt, {
                "response_mime_type": "application/json",
            })

            # Parse the JSON response
            parsed = self._safe_parse_json(raw_response)
            if not parsed:
                # If JSON parse fails, fall back to regular chat
                result = await gemini_advisor.chat(message)
                return {
                    "answer": result.get("answer", ""),
                    "intent": "general_chat",
                    "actions_taken": [],
                    "actions_proposed": [],
                    "model": result.get("model", ""),
                    "powered_by": result.get("powered_by", ""),
                }

            intent = parsed.get("intent", "general_chat")
            actions = parsed.get("actions", [])
            requires_confirmation = parsed.get("requires_confirmation", False)
            response_text = parsed.get("response_text", "")
            reasoning = parsed.get("reasoning", "")

            # Step 2: Handle by intent type
            if intent == "emergency_stop":
                return await self._handle_emergency_stop(response_text)

            elif intent == "control_actuator" and actions:
                if requires_confirmation:
                    return self._propose_actions(actions, response_text, reasoning)
                else:
                    return self._execute_actions(actions, response_text, reasoning)

            elif intent == "optimize_environment" and actions:
                return self._propose_actions(actions, response_text, reasoning)

            elif intent in ("query_status", "greeting", "general_chat"):
                # For non-action intents, if Gemini gave a response_text, use it
                # Otherwise fall back to regular chat for richer response
                if response_text:
                    answer = response_text
                else:
                    result = await gemini_advisor.chat(message)
                    answer = result.get("answer", "")

                return {
                    "answer": answer,
                    "intent": intent,
                    "actions_taken": [],
                    "actions_proposed": [],
                    "model": gemini_advisor._active_model,
                    "powered_by": "google_gemini",
                }

            else:
                # Fallback to regular chat
                result = await gemini_advisor.chat(message)
                return {
                    "answer": result.get("answer", ""),
                    "intent": "general_chat",
                    "actions_taken": [],
                    "actions_proposed": [],
                    "model": result.get("model", ""),
                    "powered_by": result.get("powered_by", ""),
                }

        except Exception as e:
            print(f"[AgentExecutor] agent_chat error: {e}")
            import traceback
            traceback.print_exc()
            # Fallback to regular chat
            try:
                result = await gemini_advisor.chat(message)
                return {
                    "answer": result.get("answer", ""),
                    "intent": "general_chat",
                    "actions_taken": [],
                    "actions_proposed": [],
                    "model": result.get("model", ""),
                    "powered_by": result.get("powered_by", ""),
                }
            except Exception:
                return {
                    "answer": "Sorry, I encountered an error. Please try again.",
                    "intent": "error",
                    "actions_taken": [],
                    "actions_proposed": [],
                    "model": "",
                    "powered_by": "error",
                }

    # ── Action Execution ──

    def _execute_actions(self, actions: list, response_text: str, reasoning: str) -> dict:
        """Execute actions directly (no confirmation needed)."""
        taken = []
        for action in actions:
            actuator_id = action.get("actuator_id", "")
            command_str = action.get("command", "off").lower()
            duration = action.get("duration_seconds", DEFAULT_PUMP_DURATION_SECONDS)

            # Resolve aliases
            actuator_id = ACTUATOR_ALIASES.get(actuator_id.lower(), actuator_id)

            # Validate
            command = ActuatorState.ON if command_str == "on" else ActuatorState.OFF
            duration = min(duration or DEFAULT_PUMP_DURATION_SECONDS, MAX_PUMP_DURATION_SECONDS)

            # Execute
            result = twin_state.set_actuator(
                ActuatorCommand(actuator_id=actuator_id, command=command)
            )

            if result:
                action_record = {
                    "actuator_id": actuator_id,
                    "actuator_name": result.name,
                    "command": command.value,
                    "duration_seconds": duration if command == ActuatorState.ON else None,
                    "success": True,
                    "timestamp": get_now().isoformat(),
                }
                taken.append(action_record)
                self._log_action("execute", actuator_id, action, f"OK: {command.value}")

                # Set auto-off timer for ON commands (Only for PUMPS)
                if command == ActuatorState.ON and duration and result.type == "pump":
                    self._schedule_auto_off(actuator_id, duration)
            else:
                taken.append({
                    "actuator_id": actuator_id,
                    "command": command_str,
                    "success": False,
                    "error": f"Actuator '{actuator_id}' not found",
                })
                self._log_action("execute", actuator_id, action, "FAIL: not found")

        return {
            "answer": response_text,
            "intent": "control_actuator",
            "actions_taken": taken,
            "actions_proposed": [],
            "model": self._get_model_name(),
            "powered_by": "google_gemini",
        }

    def _propose_actions(self, actions: list, response_text: str, reasoning: str) -> dict:
        """Propose actions that need user confirmation."""
        action_id = str(uuid.uuid4())[:8]

        proposed = []
        for action in actions:
            actuator_id = action.get("actuator_id", "")
            actuator_id = ACTUATOR_ALIASES.get(actuator_id.lower(), actuator_id)
            command_str = action.get("command", "off").lower()
            duration = min(
                action.get("duration_seconds", DEFAULT_PUMP_DURATION_SECONDS),
                MAX_PUMP_DURATION_SECONDS,
            )

            # Look up the actuator name
            all_actuators = twin_state.get_all_actuators()
            name = actuator_id
            for a in all_actuators:
                if a.actuator_id == actuator_id:
                    name = a.name
                    break

            proposed.append({
                "actuator_id": actuator_id,
                "actuator_name": name,
                "command": command_str,
                "duration_seconds": duration if command_str == "on" else None,
            })

        # Store for later confirmation
        self._pending_actions[action_id] = {
            "actions": actions,
            "reasoning": reasoning,
            "created_at": time.time(),
        }

        # Cleanup old pending actions (older than 5 minutes)
        self._cleanup_pending()

        return {
            "answer": response_text,
            "intent": "control_actuator",
            "actions_taken": [],
            "actions_proposed": proposed,
            "action_id": action_id,
            "model": self._get_model_name(),
            "powered_by": "google_gemini",
        }

    async def confirm_action(self, action_id: str) -> dict:
        """Execute a previously proposed action set after user confirmation."""
        bundle = self._pending_actions.pop(action_id, None)
        if not bundle:
            return {
                "answer": "⚠️ This action has expired or was already executed. Please try again.",
                "intent": "error",
                "actions_taken": [],
                "actions_proposed": [],
                "powered_by": "system",
            }

        actions = bundle["actions"]
        reasoning = bundle["reasoning"]
        result = self._execute_actions(
            actions,
            f"✅ Confirmed! Executing {len(actions)} action(s)...",
            reasoning,
        )
        result["answer"] = f"✅ **Actions confirmed and executed!**\n\n{reasoning}"
        return result

    async def _handle_emergency_stop(self, response_text: str) -> dict:
        """Execute emergency stop: turn off ALL actuators."""
        actuators = twin_state.get_all_actuators()
        taken = []
        for act in actuators:
            twin_state.set_actuator(
                ActuatorCommand(actuator_id=act.actuator_id, command=ActuatorState.OFF)
            )
            taken.append({
                "actuator_id": act.actuator_id,
                "actuator_name": act.name,
                "command": "off",
                "success": True,
                "timestamp": get_now().isoformat(),
            })

        # Cancel all auto-off timers
        for timer in self._auto_off_timers.values():
            timer.cancel()
        self._auto_off_timers.clear()

        self._log_action("emergency_stop", "ALL", {}, f"Stopped {len(actuators)} actuators")

        if not response_text:
            response_text = f"🛑 **Emergency Stop!** All {len(actuators)} actuators have been turned off."

        return {
            "answer": response_text,
            "intent": "emergency_stop",
            "actions_taken": taken,
            "actions_proposed": [],
            "model": self._get_model_name(),
            "powered_by": "google_gemini",
        }

    # ── Auto-Off Timer ──

    def _schedule_auto_off(self, actuator_id: str, duration_seconds: int):
        """Schedule automatic pump shutoff after the specified duration."""
        # Cancel any existing timer for this actuator
        existing = self._auto_off_timers.pop(actuator_id, None)
        if existing:
            existing.cancel()

        def _auto_off():
            print(f"[AgentExecutor] Auto-off: {actuator_id} after {duration_seconds}s")
            twin_state.set_actuator(
                ActuatorCommand(actuator_id=actuator_id, command=ActuatorState.OFF)
            )
            self._auto_off_timers.pop(actuator_id, None)
            self._log_action("auto_off", actuator_id, {"duration": duration_seconds}, "OK")

        timer = threading.Timer(duration_seconds, _auto_off)
        timer.daemon = True
        timer.start()
        self._auto_off_timers[actuator_id] = timer
        print(f"[AgentExecutor] Auto-off scheduled: {actuator_id} in {duration_seconds}s")

    # ── Helpers ──

    def _safe_parse_json(self, text: str) -> Optional[dict]:
        """Attempt to parse JSON from Gemini response, handling edge cases."""
        text = text.strip()
        # Remove markdown code fences if present
        if text.startswith("```"):
            lines = text.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            text = "\n".join(lines)
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Try to find JSON object in the text
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                try:
                    return json.loads(text[start:end])
                except json.JSONDecodeError:
                    pass
        return None

    def _log_action(self, action_type: str, target: str, details: dict, result: str):
        """Log an AI-initiated action for audit trail."""
        entry = {
            "timestamp": get_now().isoformat(),
            "action_type": action_type,
            "target": target,
            "details": details,
            "result": result,
        }
        self._execution_log.append(entry)
        print(f"[AgentExecutor] LOG: {action_type} → {target} = {result}")

    def _get_model_name(self) -> str:
        try:
            from backend.services.gemini_advisor import gemini_advisor
            return gemini_advisor._active_model
        except Exception:
            return ""

    def _cleanup_pending(self):
        """Remove pending actions older than 5 minutes."""
        now = time.time()
        expired = [
            aid for aid, bundle in self._pending_actions.items()
            if now - bundle["created_at"] > 300
        ]
        for aid in expired:
            del self._pending_actions[aid]

    def get_execution_log(self, limit: int = 50) -> list:
        """Return recent execution log entries."""
        return list(self._execution_log)[-limit:]


# Singleton
agent_executor = AgentExecutor()
