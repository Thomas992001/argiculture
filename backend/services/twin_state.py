"""
Digital Twin State Manager.
Maintains the live virtual representation of the greenhouse.
"""

import threading
from datetime import datetime
from typing import Dict, List, Optional

from backend.models import (
    Zone, ZoneType, Actuator, ActuatorState, ActuatorCommand,
    GreenhouseState, SensorReading, Alert, AlertSeverity,
)
from backend.firebase_admin_config import db_fs


class TwinStateManager:
    """Keeps a live in-memory model of the entire greenhouse."""

    def __init__(self):
        self._lock = threading.Lock()
        self._zones: Dict[str, Zone] = {}
        self._actuators: Dict[str, Actuator] = {}
        self._alerts: List[Alert] = []
        self._alert_counter = 0
        self._firestore_watch = None

        self._initialize_zones()
        self._initialize_actuators()

    def start_control_listener(self, uid: str):
        """Listen to control signals from Firestore to trigger actuators."""
        if not db_fs:
            return

        if self._firestore_watch:
            self._firestore_watch.unsubscribe()

        doc_ref = db_fs.collection("users").document(uid).collection("control").document("latest")

        def on_snapshot(doc_snapshot, changes, read_time):
            for doc in doc_snapshot:
                data = doc.to_dict()
                if not data:
                    continue
                
                print(f"DEBUG: Cloud Control Signal Received: {data}")
                for aid, state_bool in data.items():
                    if aid in self._actuators:
                        cmd = ActuatorState.ON if state_bool else ActuatorState.OFF
                        self.set_actuator(ActuatorCommand(actuator_id=aid, command=cmd))

        self._firestore_watch = doc_ref.on_snapshot(on_snapshot)
        print(f"DEBUG: Firestore Listener started for {doc_ref.path}")

    def _initialize_zones(self):
        zone_defs = [
            ("zone_air", "Greenhouse Air", ZoneType.GREENHOUSE_AIR,
             ["air_temp_1", "air_rh_1", "air_co2_1", "air_light_1"],
             ["fan_exhaust", "fan_circulation", "heater_main", "co2_injector", "light_supplemental"]),
            ("zone_bed", "Substrate Bed", ZoneType.SUBSTRATE_BED,
             ["bed_moisture_1", "bed_temp_1", "bed_ec_1"],
             ["valve_irrigation"]),
            ("zone_nft", "Hydroponic NFT", ZoneType.HYDROPONIC_NFT,
             ["nft_ph_1", "nft_ec_1", "nft_water_temp_1"],
             ["pump_nutrient"]),
            ("zone_reservoir", "Water Reservoir", ZoneType.RESERVOIR,
             ["res_level_1", "res_ph_1", "res_ec_1", "res_temp_1"],
             ["pump_main"]),
        ]
        for zone_id, name, ztype, sensors, actuators in zone_defs:
            self._zones[zone_id] = Zone(
                zone_id=zone_id, name=name, type=ztype,
                sensors=sensors, actuators=actuators,
            )

    def _initialize_actuators(self):
        actuator_defs = [
            ("pump_main", "Main Water Pump", "pump", "zone_reservoir"),
            ("pump_nutrient", "Nutrient Pump", "pump", "zone_nft"),
            ("fan_exhaust", "Exhaust Fan", "fan", "zone_air"),
            ("fan_circulation", "Circulation Fan", "fan", "zone_air"),
            ("valve_irrigation", "Irrigation Valve", "valve", "zone_bed"),
            ("heater_main", "Main Heater", "heater", "zone_air"),
            ("light_supplemental", "Supplemental Light", "light", "zone_air"),
            ("co2_injector", "CO₂ Injector", "injector", "zone_air"),
        ]
        for aid, name, atype, zone_id in actuator_defs:
            self._actuators[aid] = Actuator(
                actuator_id=aid, name=name, type=atype, zone_id=zone_id,
            )

    def update_readings(self, readings: List[SensorReading]):
        with self._lock:
            for r in readings:
                zone = self._zones.get(r.zone_id)
                if zone:
                    zone.current_readings[r.sensor_type.value] = r.value

    def set_actuator(self, command: ActuatorCommand) -> Optional[Actuator]:
        with self._lock:
            actuator = self._actuators.get(command.actuator_id)
            if not actuator:
                return None
            actuator.state = command.command
            actuator.current_value = command.value or (1.0 if command.command == ActuatorState.ON else 0.0)
            actuator.last_changed = datetime.utcnow()
            return actuator

    def add_alert(self, severity: AlertSeverity, message: str,
                  sensor_id: str = None, zone_id: str = None,
                  value: float = None, threshold: float = None) -> Alert:
        with self._lock:
            self._alert_counter += 1
            alert = Alert(
                alert_id=f"alert_{self._alert_counter}",
                severity=severity,
                message=message,
                sensor_id=sensor_id,
                zone_id=zone_id,
                value=value,
                threshold=threshold,
            )
            self._alerts.append(alert)
            if len(self._alerts) > 200:
                self._alerts = self._alerts[-200:]
            return alert

    def acknowledge_alert(self, alert_id: str) -> bool:
        with self._lock:
            for alert in self._alerts:
                if alert.alert_id == alert_id:
                    alert.acknowledged = True
                    return True
        return False

    def get_state(self) -> GreenhouseState:
        with self._lock:
            unack_alerts = [a for a in self._alerts if not a.acknowledged]
            critical = any(a.severity == AlertSeverity.CRITICAL for a in unack_alerts)
            return GreenhouseState(
                zones=dict(self._zones),
                actuators=dict(self._actuators),
                alerts=unack_alerts[-50:],
                system_health="critical" if critical else "healthy",
            )

    def get_zone(self, zone_id: str) -> Optional[Zone]:
        with self._lock:
            return self._zones.get(zone_id)

    def get_all_zones(self) -> List[Zone]:
        with self._lock:
            return list(self._zones.values())

    def get_all_actuators(self) -> List[Actuator]:
        with self._lock:
            return list(self._actuators.values())

    def get_alerts(self, include_acknowledged: bool = False) -> List[Alert]:
        with self._lock:
            if include_acknowledged:
                return list(self._alerts[-50:])
            return [a for a in self._alerts if not a.acknowledged][-50:]

    def push_actuators_to_cloud(self, uid: str):
        """Push the current in-memory state of all actuators to Firestore for initialization."""
        if not db_fs:
            return
        
        with self._lock:
            # Flatten actuator states into a simple {id: boolean} map
            states = {
                aid: (act.state == ActuatorState.ON)
                for aid, act in self._actuators.items()
            }
            
        def _task():
            try:
                doc_ref = db_fs.collection("users").document(uid).collection("control").document("latest")
                doc_ref.set(states, merge=True)
                print(f"DEBUG: Initialized Firestore control states for {uid}")
            except Exception as e:
                print(f"Error syncing actuators to cloud: {e}")

        threading.Thread(target=_task, daemon=True).start()

    def pull_actuators_from_cloud(self, uid: str):
        """Fetch the current cloud state and apply it to local actuators."""
        if not db_fs:
            return
            
        def _task():
            try:
                doc_ref = db_fs.collection("users").document(uid).collection("control").document("latest")
                doc = doc_ref.get()
                if doc.exists:
                    data = doc.to_dict()
                    print(f"DEBUG: Restoring states from Cloud: {data}")
                    for aid, state_bool in data.items():
                        if aid in self._actuators:
                            cmd = ActuatorState.ON if state_bool else ActuatorState.OFF
                            self.set_actuator(ActuatorCommand(actuator_id=aid, command=cmd))
                else:
                    print(f"DEBUG: No previous cloud state found for {uid}, skipping pull.")
            except Exception as e:
                print(f"Error pulling actuators from cloud: {e}")

        threading.Thread(target=_task, daemon=True).start()


twin_state = TwinStateManager()
