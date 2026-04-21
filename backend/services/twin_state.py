"""
Digital Twin State Manager.
Maintains the live virtual representation of the greenhouse.
"""

import threading
from datetime import datetime
from typing import Callable, Dict, List, Optional

from backend.models import (
    Zone, ZoneType, Actuator, ActuatorState, ActuatorCommand,
    GreenhouseState, SensorReading, Alert, AlertSeverity, get_now,
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
        self._actuator_sink: Optional[Callable[[str, ActuatorState], None]] = None
        self.current_uid: Optional[str] = None

        self._initialize_zones()
        self._initialize_actuators()

    def start_control_listener(self, uid: str):
        """Listen to control signals from Firestore to trigger actuators."""
        if not db_fs:
            return
        
        self.current_uid = uid

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

    def bind_actuator_sink(self, sink: Callable[[str, ActuatorState], None]):
        """Notify simulator (or hardware) whenever a pump actuator changes."""
        self._actuator_sink = sink

    def _initialize_zones(self):
        zone_defs = [
            ("zone_air", "Greenhouse Condition", ZoneType.GREENHOUSE_AIR,
             ["air_rh_1", "air_rh_2", "air_temp_1", "air_light_1"],
             ["sensor_air_rh_1", "sensor_air_rh_2", "sensor_air_temp_1", "sensor_air_light_1"]),
            ("zone_bed_a", "Substrate A", ZoneType.SUBSTRATE_BED_A,
             ["bed_a_temp", "bed_a_ph", "bed_a_moisture"],
             ["pump_a", "sensor_bed_a_temp", "sensor_bed_a_ph", "sensor_bed_a_moisture"]),
            ("zone_bed_b", "Substrate B", ZoneType.SUBSTRATE_BED_B,
             ["bed_b_temp", "bed_b_ph", "bed_b_moisture"],
             ["pump_b", "sensor_bed_b_temp", "sensor_bed_b_ph", "sensor_bed_b_moisture"]),
            ("zone_bed_c", "Substrate C", ZoneType.SUBSTRATE_BED_C,
             ["bed_c_temp", "bed_c_ph", "bed_c_moisture"],
             ["pump_c", "sensor_bed_c_temp", "sensor_bed_c_ph", "sensor_bed_c_moisture"]),
        ]
        for zone_id, name, ztype, sensors, actuators in zone_defs:
            self._zones[zone_id] = Zone(
                zone_id=zone_id, name=name, type=ztype,
                sensors=sensors, actuators=actuators,
            )

    def _initialize_actuators(self):
        actuator_defs = [
            ("pump_a", "Water Pump A", "pump", "zone_bed_a"),
            ("pump_b", "Water Pump B", "pump", "zone_bed_b"),
            ("pump_c", "Water Pump C", "pump", "zone_bed_c"),
            # Sensor Power Channels (Mapped to Firestore keys: sensor_${id})
            ("sensor_air_rh_1", "Air Humidity 1 Power", "sensor_power", "zone_air"),
            ("sensor_air_rh_2", "Air Humidity 2 Power", "sensor_power", "zone_air"),
            ("sensor_air_temp_1", "Air Temperature Power", "sensor_power", "zone_air"),
            ("sensor_air_light_1", "Greenhouse Light Power", "sensor_power", "zone_air"),
            ("sensor_bed_a_temp", "Soil Temp A Power", "sensor_power", "zone_bed_a"),
            ("sensor_bed_a_ph", "Soil pH A Power", "sensor_power", "zone_bed_a"),
            ("sensor_bed_a_moisture", "Soil Moisture A Power", "sensor_power", "zone_bed_a"),
            ("sensor_bed_b_temp", "Soil Temp B Power", "sensor_power", "zone_bed_b"),
            ("sensor_bed_b_ph", "Soil pH B Power", "sensor_power", "zone_bed_b"),
            ("sensor_bed_b_moisture", "Soil Moisture B Power", "sensor_power", "zone_bed_b"),
            ("sensor_bed_c_temp", "Soil Temp C Power", "sensor_power", "zone_bed_c"),
            ("sensor_bed_c_ph", "Soil pH C Power", "sensor_power", "zone_bed_c"),
            ("sensor_bed_c_moisture", "Soil Moisture C Power", "sensor_power", "zone_bed_c"),
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
            actuator.last_changed = get_now()
            result = actuator
            aid = command.actuator_id
            state = command.command

        if self._actuator_sink and aid in self._actuators:
            try:
                self._actuator_sink(aid, state)
            except Exception as e:
                print(f"[TwinState] Actuator sink error: {e}")
        
        # NEW: Sync to Firestore so the UI (ControlPage) reflects this change
        self._sync_actuator_to_cloud(aid, state)
        
        return result

    def _sync_actuator_to_cloud(self, aid: str, state: ActuatorState):
        """Push a single actuator state change to Firestore."""
        if not db_fs or not self.current_uid:
            return
        
        def _task():
            try:
                uid = self.current_uid
                doc_ref = db_fs.collection("users").document(uid).collection("control").document("latest")
                # Update only the specific control key (boolean value)
                doc_ref.update({aid: (state == ActuatorState.ON)})
                print(f"DEBUG: Synced {aid}={state.value} to Cloud for {uid}")
            except Exception as e:
                print(f"[TwinState] Error syncing {aid} to cloud: {e}")

        import threading
        threading.Thread(target=_task, daemon=True).start()

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
        
        self.current_uid = uid
            
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
