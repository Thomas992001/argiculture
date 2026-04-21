"""
Realistic greenhouse & hydroponic sensor data simulator.

Generates physically plausible time-series with:
  - Diurnal cycles (day/night temperature, light, humidity)
  - Correlated variables (T↑ → RH↓, light → transpiration)
  - Drift, noise, and occasional anomalies
  - Actuator feedback (pump on → water level rises)
"""

import math
import random
import time
import threading
from datetime import datetime
from typing import Dict, Callable, Optional, List

from backend.models import (
    SensorReading,
    SensorType,
    ZoneType,
    Actuator,
    ActuatorState,
    get_now,
)


class SensorSimulator:
    """Generates one sensor's value with realistic dynamics."""

    def __init__(
        self,
        sensor_id: str,
        sensor_type: SensorType,
        zone_id: str,
        unit: str,
        base_value: float,
        amplitude: float,
        noise_std: float,
        phase_offset: float = 0.0,
        min_val: float = float("-inf"),
        max_val: float = float("inf"),
        drift_rate: float = 0.0,
    ):
        self.sensor_id = sensor_id
        self.sensor_type = sensor_type
        self.zone_id = zone_id
        self.unit = unit
        self.base_value = base_value
        self.amplitude = amplitude
        self.noise_std = noise_std
        self.phase_offset = phase_offset
        self.min_val = min_val
        self.max_val = max_val
        self.drift_rate = drift_rate

        self._value = base_value
        self._anomaly_active = False
        self._anomaly_bias = 0.0

    def generate(self, elapsed_hours: float, actuator_effect: float = 0.0) -> SensorReading:
        diurnal = self.amplitude * math.sin(
            2 * math.pi * (elapsed_hours + self.phase_offset) / 24.0
        )
        drift = self.drift_rate * elapsed_hours
        noise = random.gauss(0, self.noise_std)

        raw = self.base_value + diurnal + drift + noise + actuator_effect + self._anomaly_bias
        self._value = max(self.min_val, min(self.max_val, raw))

        quality = 0.2 if self._anomaly_active else 1.0

        return SensorReading(
            sensor_id=self.sensor_id,
            sensor_type=self.sensor_type,
            zone_id=self.zone_id,
            value=round(self._value, 2),
            unit=self.unit,
            timestamp=get_now(),
            quality=quality,
        )

    def inject_anomaly(self, bias: float):
        self._anomaly_active = True
        self._anomaly_bias = bias

    def clear_anomaly(self):
        self._anomaly_active = False
        self._anomaly_bias = 0.0

    @property
    def current_value(self) -> float:
        return self._value


class GreenhouseSimulator:
    """Full greenhouse simulation with multiple zones and correlated sensors."""

    def __init__(self):
        self._start_time = time.time()
        self._sensors: Dict[str, SensorSimulator] = {}
        self._actuator_states: Dict[str, ActuatorState] = {}
        self._callbacks: List[Callable] = []
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._time_speedup = 60.0  # 1 real second = 1 simulated minute

        self._setup_sensors()
        self._setup_actuators()

    def _setup_sensors(self):
        sensors_config = [
            # Greenhouse Condition (zone_air) — air humidity, temperature, light
            ("air_rh_1", SensorType.HUMIDITY, "zone_air", "%", 65.0, 10.0, 1.5, 6.0, 20.0, 99.0),
            ("air_rh_2", SensorType.HUMIDITY, "zone_air", "%", 63.0, 9.5, 1.7, 6.5, 20.0, 99.0),
            ("air_temp_1", SensorType.TEMPERATURE, "zone_air", "°C", 26.0, 4.0, 0.3, -3.0, 10.0, 45.0),
            ("air_light_1", SensorType.LIGHT, "zone_air", "lux", 15000.0, 12000.0, 500.0, 0.0, 0.0, 100000.0),

            # Substrate A (zone_bed_a) — soil temp x1, pH x1, moisture x1
            ("bed_a_temp", SensorType.SOIL_TEMPERATURE, "zone_bed_a", "°C", 22.0, 3.0, 0.2, -4.0, 10.0, 40.0),
            ("bed_a_ph", SensorType.SOIL_PH, "zone_bed_a", "pH", 6.2, 0.3, 0.04, 0.0, 4.0, 9.0),
            ("bed_a_moisture", SensorType.SOIL_MOISTURE, "zone_bed_a", "%", 45.0, 8.0, 1.0, 3.0, 10.0, 90.0),

            # Substrate B (zone_bed_b) — soil temp x1, pH x1, moisture x1
            ("bed_b_temp", SensorType.SOIL_TEMPERATURE, "zone_bed_b", "°C", 23.0, 2.5, 0.25, -3.5, 10.0, 40.0),
            ("bed_b_ph", SensorType.SOIL_PH, "zone_bed_b", "pH", 6.0, 0.25, 0.05, 0.5, 4.0, 9.0),
            ("bed_b_moisture", SensorType.SOIL_MOISTURE, "zone_bed_b", "%", 48.0, 7.0, 1.2, 2.5, 10.0, 90.0),

            # Substrate C (zone_bed_c) — soil temp x1, pH x1, moisture x1
            ("bed_c_temp", SensorType.SOIL_TEMPERATURE, "zone_bed_c", "°C", 21.5, 2.8, 0.22, -4.5, 10.0, 40.0),
            ("bed_c_ph", SensorType.SOIL_PH, "zone_bed_c", "pH", 5.9, 0.35, 0.04, -0.5, 4.0, 9.0),
            ("bed_c_moisture", SensorType.SOIL_MOISTURE, "zone_bed_c", "%", 42.0, 9.0, 0.9, 3.5, 10.0, 90.0),
        ]

        for cfg in sensors_config:
            sid, stype, zone, unit, base, amp, noise, phase, mn, mx = cfg
            self._sensors[sid] = SensorSimulator(
                sensor_id=sid,
                sensor_type=stype,
                zone_id=zone,
                unit=unit,
                base_value=base,
                amplitude=amp,
                noise_std=noise,
                phase_offset=phase,
                min_val=mn,
                max_val=mx,
            )

    def _setup_actuators(self):
        # Spec: 3x water pumps (one per substrate bed) + 2x pump driver cables
        self._actuator_states = {
            "pump_a": ActuatorState.OFF,
            "pump_b": ActuatorState.OFF,
            "pump_c": ActuatorState.OFF,
        }

    def _compute_actuator_effects(self) -> Dict[str, float]:
        effects = {}

        if self._actuator_states.get("pump_a") == ActuatorState.ON:
            effects["bed_a_moisture"] = effects.get("bed_a_moisture", 0) + 5.0
        if self._actuator_states.get("pump_b") == ActuatorState.ON:
            effects["bed_b_moisture"] = effects.get("bed_b_moisture", 0) + 5.0
        if self._actuator_states.get("pump_c") == ActuatorState.ON:
            effects["bed_c_moisture"] = effects.get("bed_c_moisture", 0) + 5.0

        return effects

    def set_actuator(self, actuator_id: str, state: ActuatorState):
        if actuator_id in self._actuator_states:
            self._actuator_states[actuator_id] = state

    def get_actuator_states(self) -> Dict[str, ActuatorState]:
        return dict(self._actuator_states)

    def generate_readings(self) -> List[SensorReading]:
        elapsed_real = time.time() - self._start_time
        elapsed_hours = (elapsed_real * self._time_speedup) / 3600.0

        effects = self._compute_actuator_effects()
        readings = []

        for sensor_id, sensor in self._sensors.items():
            # Check power state for this sensor (mapped to sensor_xxx actuator)
            power_id = f"sensor_{sensor_id}"
            power_state = self._actuator_states.get(power_id, ActuatorState.ON)

            if power_state == ActuatorState.OFF:
                readings.append(SensorReading(
                    sensor_id=sensor.sensor_id,
                    sensor_type=sensor.sensor_type,
                    zone_id=sensor.zone_id,
                    value=0.0,
                    unit=sensor.unit,
                    timestamp=get_now(),
                    quality=0.0,  # 0.0 means completely offline
                ))
                continue

            effect = effects.get(sensor_id, 0.0)
            reading = sensor.generate(elapsed_hours, effect)
            readings.append(reading)

        return readings

    def on_data(self, callback: Callable):
        self._callbacks.append(callback)

    def _run_loop(self, interval: float):
        while self._running:
            readings = self.generate_readings()
            for cb in self._callbacks:
                try:
                    cb(readings)
                except Exception as e:
                    print(f"[Simulator] Callback error: {e}")
            time.sleep(interval)

    def start(self, interval: float = 5.0):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(
            target=self._run_loop, args=(interval,), daemon=True
        )
        self._thread.start()
        print(f"[Simulator] Started (interval={interval}s, speedup={self._time_speedup}x)")

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        print("[Simulator] Stopped")

    @property
    def sensor_ids(self) -> List[str]:
        return list(self._sensors.keys())

    @property
    def is_running(self) -> bool:
        return self._running
