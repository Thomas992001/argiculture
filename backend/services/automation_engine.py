"""
Automation Engine — closed-loop actuator rules.

This is the "if hot + soil moisture low, turn on the pump" piece of the spec.
Runs after the rules engine on every sensor tick. Unlike the alert rules
engine (which only emits warnings), this engine actually drives actuators.

Current rules:
  - Per-bed auto irrigation: if outdoor/indoor temp is high AND that bed's
    soil moisture is low → turn the bed's pump ON for a short pulse.
  - Cool-down to prevent flapping / over-watering.
  - Weather-aware: skip irrigation if significant rain is expected soon.
"""

import time
from dataclasses import dataclass, field
from typing import Dict, List, Callable, Optional

from backend.models import (
    SensorReading, SensorType, ActuatorState, ActuatorCommand,
)
from backend.services.twin_state import twin_state
from backend.services.weather_service import weather_service


# Thresholds — tunable. Defaults chosen for lettuce-ish crops in a KL climate.
HOT_AIR_TEMP_C = 30.0
DRY_MOISTURE_PCT = 30.0
PUMP_PULSE_SECONDS = 45          # keep pump on for this long per trigger
PUMP_COOLDOWN_SECONDS = 300      # min gap between auto-triggers on same bed
RAIN_SKIP_THRESHOLD_PCT = 60     # skip auto-irrigation if rain prob > this
RAIN_SKIP_MM_THRESHOLD = 2.0     # ...or expected rain > this in 12h


BED_CONFIG = [
    # (bed_zone, moisture_sensor_id, pump_actuator_id)
    ("zone_bed_a", "bed_a_moisture", "pump_a"),
    ("zone_bed_b", "bed_b_moisture", "pump_b"),
    ("zone_bed_c", "bed_c_moisture", "pump_c"),
]


@dataclass
class PumpRuntime:
    last_triggered: float = 0.0    # unix ts of last auto-on
    turn_off_at: float = 0.0       # unix ts when auto-off should fire
    auto_active: bool = False      # True while in an auto pulse
    last_decision: str = ""        # human-readable explanation
    decisions: list = field(default_factory=list)  # rolling log


class AutomationEngine:
    """Closed-loop automation that acts on sensor data by driving actuators."""

    def __init__(
        self,
        simulator_setter: Optional[Callable[[str, ActuatorState], None]] = None,
    ):
        self._enabled = True
        self._simulator_setter = simulator_setter
        self._pump_rt: Dict[str, PumpRuntime] = {
            pump_id: PumpRuntime() for _, _, pump_id in BED_CONFIG
        }
        self._event_log: List[dict] = []

    def set_enabled(self, enabled: bool):
        self._enabled = enabled

    @property
    def enabled(self) -> bool:
        return self._enabled

    def bind_simulator(self, setter: Callable[[str, ActuatorState], None]):
        """Called from main.py so we can flip simulator actuator state too."""
        self._simulator_setter = setter

    def evaluate(self, readings: List[SensorReading]):
        """Called on every sensor tick. Dispatches all rules."""
        if not self._enabled:
            return

        now = time.time()

        # Build a quick lookup: (zone_id, sensor_type) → value
        current: Dict[tuple, float] = {}
        for r in readings:
            current[(r.zone_id, r.sensor_type.value)] = r.value

        weather = weather_service.get_weather()
        air_temp = (weather.get("current", {}) or {}).get("temp_c")

        # 1. Handle pending auto-off (end of pulse)
        for _, _, pump_id in BED_CONFIG:
            rt = self._pump_rt[pump_id]
            if rt.auto_active and now >= rt.turn_off_at:
                self._set_pump(pump_id, ActuatorState.OFF)
                rt.auto_active = False
                msg = f"{pump_id} pulse finished ({PUMP_PULSE_SECONDS}s)"
                rt.last_decision = msg
                self._log(pump_id, "pump_auto_off", msg)

        # 2. Weather skip check
        skip_reason = self._weather_skip_reason(weather)

        # 3. Per-bed auto-irrigation trigger
        for zone, moisture_sensor, pump_id in BED_CONFIG:
            rt = self._pump_rt[pump_id]
            moisture = current.get((zone, SensorType.SOIL_MOISTURE.value))
            if moisture is None:
                continue

            if rt.auto_active:
                continue  # already pulsing

            if (now - rt.last_triggered) < PUMP_COOLDOWN_SECONDS:
                continue  # cooldown

            is_hot = air_temp is not None and air_temp >= HOT_AIR_TEMP_C
            is_dry = moisture <= DRY_MOISTURE_PCT

            if not (is_hot and is_dry):
                continue

            if skip_reason:
                msg = (
                    f"{pump_id} would trigger (temp={air_temp:.1f}°C, "
                    f"moisture={moisture:.1f}%) but SKIPPED: {skip_reason}"
                )
                rt.last_decision = msg
                self._log(pump_id, "pump_skipped", msg)
                # mark cooldown to prevent log spam
                rt.last_triggered = now
                continue

            # Fire the pulse
            self._set_pump(pump_id, ActuatorState.ON)
            rt.auto_active = True
            rt.last_triggered = now
            rt.turn_off_at = now + PUMP_PULSE_SECONDS
            msg = (
                f"{pump_id} auto-ON: air {air_temp:.1f}°C ≥ {HOT_AIR_TEMP_C}°C "
                f"AND {zone} moisture {moisture:.1f}% ≤ {DRY_MOISTURE_PCT}%. "
                f"Pulse {PUMP_PULSE_SECONDS}s."
            )
            rt.last_decision = msg
            self._log(pump_id, "pump_auto_on", msg)

    def _weather_skip_reason(self, weather: dict) -> Optional[str]:
        if not weather:
            return None
        nxt = weather.get("next_12h", {}) or {}
        rain_prob = nxt.get("max_rain_prob_pct") or 0
        rain_mm = nxt.get("total_rain_mm") or 0.0
        if rain_prob >= RAIN_SKIP_THRESHOLD_PCT and rain_mm >= RAIN_SKIP_MM_THRESHOLD:
            return (
                f"rain {rain_prob}% prob, {rain_mm} mm expected in next 12h"
            )
        return None

    def _set_pump(self, pump_id: str, state: ActuatorState):
        # Update twin state (canonical)
        twin_state.set_actuator(ActuatorCommand(actuator_id=pump_id, command=state))
        # Update simulator so physical effects propagate
        if self._simulator_setter:
            try:
                self._simulator_setter(pump_id, state)
            except Exception as e:
                print(f"[AutomationEngine] simulator setter error: {e}")

    def _log(self, pump_id: str, event_type: str, message: str):
        entry = {
            "timestamp": time.time(),
            "pump_id": pump_id,
            "event": event_type,
            "message": message,
        }
        self._event_log.append(entry)
        if len(self._event_log) > 100:
            self._event_log = self._event_log[-100:]
        print(f"[AutomationEngine] {message}")

    def get_status(self) -> dict:
        return {
            "enabled": self._enabled,
            "thresholds": {
                "hot_air_temp_c": HOT_AIR_TEMP_C,
                "dry_moisture_pct": DRY_MOISTURE_PCT,
                "pulse_seconds": PUMP_PULSE_SECONDS,
                "cooldown_seconds": PUMP_COOLDOWN_SECONDS,
                "rain_skip_prob_pct": RAIN_SKIP_THRESHOLD_PCT,
                "rain_skip_mm": RAIN_SKIP_MM_THRESHOLD,
            },
            "pumps": {
                pump_id: {
                    "auto_active": rt.auto_active,
                    "last_triggered": rt.last_triggered,
                    "turn_off_at": rt.turn_off_at,
                    "last_decision": rt.last_decision,
                }
                for pump_id, rt in self._pump_rt.items()
            },
            "recent_events": self._event_log[-20:],
        }


automation_engine = AutomationEngine()
