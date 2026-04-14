"""
Realistic greenhouse & hydroponic sensor data simulator.

Generates physically plausible time-series with:
  - Diurnal cycles (day/night temperature, light, humidity)
  - Correlated variables (T↑ → RH↓, light → CO₂ uptake)
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
            # Zone A: Greenhouse Air
            ("air_temp_1", SensorType.TEMPERATURE, "zone_air", "°C", 25.0, 5.0, 0.3, -6.0, 10.0, 45.0),
            ("air_rh_1", SensorType.HUMIDITY, "zone_air", "%", 65.0, 10.0, 1.5, 6.0, 20.0, 99.0),
            ("air_co2_1", SensorType.CO2, "zone_air", "ppm", 600.0, 150.0, 20.0, 6.0, 300.0, 2000.0),
            ("air_light_1", SensorType.LIGHT_INTENSITY, "zone_air", "lux", 15000.0, 14000.0, 500.0, -6.0, 0.0, 100000.0),

            # Zone B: Substrate Bed
            ("bed_moisture_1", SensorType.SOIL_MOISTURE, "zone_bed", "%", 45.0, 8.0, 1.0, 3.0, 10.0, 90.0),
            ("bed_temp_1", SensorType.TEMPERATURE, "zone_bed", "°C", 22.0, 3.0, 0.2, -4.0, 10.0, 40.0),
            ("bed_ec_1", SensorType.EC, "zone_bed", "mS/cm", 1.8, 0.3, 0.05, 0.0, 0.0, 5.0),

            # Zone C: Hydroponic NFT
            ("nft_ph_1", SensorType.PH, "zone_nft", "pH", 6.0, 0.3, 0.05, 0.0, 4.0, 9.0),
            ("nft_ec_1", SensorType.EC, "zone_nft", "mS/cm", 2.0, 0.2, 0.03, 0.0, 0.0, 5.0),
            ("nft_water_temp_1", SensorType.WATER_TEMPERATURE, "zone_nft", "°C", 21.0, 2.0, 0.15, -3.0, 10.0, 35.0),

            # Zone D: Reservoir
            ("res_level_1", SensorType.WATER_LEVEL, "zone_reservoir", "cm", 60.0, 5.0, 0.5, 0.0, 0.0, 100.0),
            ("res_ph_1", SensorType.PH, "zone_reservoir", "pH", 5.8, 0.2, 0.03, 0.0, 4.0, 9.0),
            ("res_ec_1", SensorType.EC, "zone_reservoir", "mS/cm", 1.9, 0.15, 0.02, 0.0, 0.0, 5.0),
            ("res_temp_1", SensorType.WATER_TEMPERATURE, "zone_reservoir", "°C", 20.0, 1.5, 0.1, -2.0, 10.0, 35.0),
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
        self._actuator_states = {
            "pump_main": ActuatorState.OFF,
            "pump_nutrient": ActuatorState.OFF,
            "fan_exhaust": ActuatorState.OFF,
            "fan_circulation": ActuatorState.OFF,
            "valve_irrigation": ActuatorState.OFF,
            "heater_main": ActuatorState.OFF,
            "light_supplemental": ActuatorState.OFF,
            "co2_injector": ActuatorState.OFF,
        }

    def _compute_actuator_effects(self) -> Dict[str, float]:
        effects = {}

        if self._actuator_states.get("fan_exhaust") == ActuatorState.ON:
            effects["air_temp_1"] = -2.0
            effects["air_rh_1"] = -5.0
            effects["air_co2_1"] = -50.0

        if self._actuator_states.get("heater_main") == ActuatorState.ON:
            effects["air_temp_1"] = effects.get("air_temp_1", 0) + 4.0
            effects["air_rh_1"] = effects.get("air_rh_1", 0) - 3.0

        if self._actuator_states.get("pump_main") == ActuatorState.ON:
            effects["res_level_1"] = -0.5
            effects["bed_moisture_1"] = 8.0

        if self._actuator_states.get("valve_irrigation") == ActuatorState.ON:
            effects["bed_moisture_1"] = effects.get("bed_moisture_1", 0) + 5.0

        if self._actuator_states.get("co2_injector") == ActuatorState.ON:
            effects["air_co2_1"] = effects.get("air_co2_1", 0) + 200.0

        if self._actuator_states.get("light_supplemental") == ActuatorState.ON:
            effects["air_light_1"] = 8000.0
            effects["air_temp_1"] = effects.get("air_temp_1", 0) + 1.0

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
