"""
In-memory time-series store with optional InfluxDB backend.
Provides a self-contained data layer so the system works without Docker.
"""

import time
import threading
from collections import defaultdict, deque
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Tuple

from backend.models import SensorReading
from backend.firebase_admin_config import root_ref

MAX_POINTS_PER_SERIES = 10_000
RTDB_HISTORY_LIMIT = 100


class TimeSeriesStore:
    """Thread-safe in-memory ring-buffer store for sensor telemetry with Firebase sync."""

    def __init__(self):
        self._lock = threading.Lock()
        self._series: Dict[str, deque] = defaultdict(
            lambda: deque(maxlen=MAX_POINTS_PER_SERIES)
        )
        self._latest: Dict[str, SensorReading] = {}
        self.current_uid: Optional[str] = None
        self._rtdb_listener = None

    def set_active_uid(self, uid: str):
        """Bind the simulator to a specific user's Firebase path."""
        with self._lock:
            self.current_uid = uid
        print(f"DEBUG: Firebase Sync activated for UID: {uid}")

    def start_rtdb_listener(self, uid: str):
        """Listen to real-time updates FROM the cloud to sync back to local."""
        if not root_ref:
            return

        # Close existing listener if any
        if self._rtdb_listener:
            try:
                self._rtdb_listener.close()
            except:
                pass

        def on_data_change(event):
            if event.data:
                # event.data should be a dict of sensor values
                # Path: users/{uid}/live/latest
                with self._lock:
                    for key, val in event.data.items():
                        # Key here might be composite or direct
                        # We just update _latest for analytics/advisor to be aware
                        pass
                print(f"DEBUG: Cloud Telemetry Event Received: {event.path}")

        path = f"users/{uid}/live/latest"
        self._rtdb_listener = root_ref.child(path).listen(on_data_change)
        print(f"DEBUG: RTDB Listener started for {path}")

    def write(self, reading: SensorReading):
        self.write_batch([reading])

    def write_batch(self, readings: List[SensorReading]):
        # One series per physical sensor so history length matches tick rate for all types.
        with self._lock:
            for reading in readings:
                key = f"{reading.zone_id}:{reading.sensor_id}"
                self._series[key].append(reading)
                self._latest[key] = reading
            
            # Use a copy of readings and uid for the background sync
            uid = self.current_uid
            payload = [r for r in readings]

        # Sync to Firebase in a background thread to avoid blocking the simulator
        if uid and root_ref:
            threading.Thread(
                target=self._background_cloud_sync,
                args=(uid, payload),
                daemon=True
            ).start()

    def _background_cloud_sync(self, uid: str, readings: List[SensorReading]):
        """Perform cloud I/O in the background."""
        try:
            # 1. Update Aggregate 'Latest' Snapshot (Highly efficient for Frontend)
            latest_ref = root_ref.child(f"users/{uid}/live/latest")
            # RTDB keys: zone:sensor_id (unique per device); last in batch wins for same id.
            snapshot = {
                f"{r.zone_id}:{r.sensor_id}": r.model_dump(mode='json')
                for r in readings
            }
            latest_ref.update(snapshot)

            # 2. Update History (More expensive, but now async)
            for r in readings:
                path = f"users/{uid}/live/history/{r.zone_id}/{r.sensor_id}"
                history_ref = root_ref.child(path)
                
                # Push new entry
                history_ref.push(r.model_dump(mode='json'))
                
                # NOTE: Pruning (get + delete) is removed here because it's too slow.
                # In a real production app, this would be handled by a Cloud Function 
                # or a separate low-priority cleanup task to save Spark quota.
        except Exception as e:
            print(f"Error in background cloud sync: {e}")

    def _merge_readings_zone_type(
        self, zone_id: str, sensor_type: str
    ) -> List[SensorReading]:
        """All points for sensors of this type in the zone, sorted by time."""
        prefix = f"{zone_id}:"
        with self._lock:
            merged: List[SensorReading] = []
            for key, deq in self._series.items():
                if not key.startswith(prefix) or not deq:
                    continue
                if deq[-1].sensor_type.value != sensor_type:
                    continue
                merged.extend(list(deq))
        merged.sort(key=lambda r: r.timestamp)
        return merged

    def query(
        self,
        zone_id: str,
        sensor_type: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 500,
    ) -> List[SensorReading]:
        data = self._merge_readings_zone_type(zone_id, sensor_type)

        if start_time:
            data = [r for r in data if r.timestamp >= start_time]
        if end_time:
            data = [r for r in data if r.timestamp <= end_time]

        return data[-limit:]

    def get_latest(self, zone_id: str, sensor_type: str) -> Optional[SensorReading]:
        """Most recent reading among sensors of this type in the zone."""
        with self._lock:
            candidates = [
                r
                for r in self._latest.values()
                if r.zone_id == zone_id and r.sensor_type.value == sensor_type
            ]
        if not candidates:
            return None
        return max(candidates, key=lambda r: r.timestamp)

    def get_all_latest(self) -> Dict[str, SensorReading]:
        with self._lock:
            return dict(self._latest)

    def get_series_keys(self) -> List[str]:
        with self._lock:
            return list(self._series.keys())

    def get_recent_values(
        self, zone_id: str, sensor_type: str, count: int = 100
    ) -> List[Tuple[datetime, float]]:
        merged = self._merge_readings_zone_type(zone_id, sensor_type)
        tail = merged[-count:]
        return [(r.timestamp, r.value) for r in tail]

    def get_recent_values_for_sensor(
        self, zone_id: str, sensor_id: str, count: int = 100
    ) -> List[Tuple[datetime, float]]:
        key = f"{zone_id}:{sensor_id}"
        with self._lock:
            data = list(self._series.get(key, []))
        return [(r.timestamp, r.value) for r in data[-count:]]


# Singleton store
tsdb = TimeSeriesStore()
