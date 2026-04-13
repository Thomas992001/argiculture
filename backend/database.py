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

    def set_active_uid(self, uid: str):
        """Bind the simulator to a specific user's Firebase path."""
        with self._lock:
            self.current_uid = uid
        print(f"DEBUG: Firebase Sync activated for UID: {uid}")

    def write(self, reading: SensorReading):
        self.write_batch([reading])

    def write_batch(self, readings: List[SensorReading]):
        with self._lock:
            for reading in readings:
                key = f"{reading.zone_id}:{reading.sensor_type.value}"
                self._series[key].append(reading)
                self._latest[key] = reading
            
            # Sync to Firebase if a user is currently 'bound'
            if self.current_uid and root_ref:
                self._update_rtdb_history(readings)

    def _update_rtdb_history(self, readings: List[SensorReading]):
        """Direct implementation from test_buffer.py for cloud sync."""
        if not self.current_uid or not root_ref:
            return

        for r in readings:
            path = f"users/{self.current_uid}/live/history/{r.zone_id}/{r.sensor_type.value}"
            history_ref = root_ref.child(path)
            
            # Push new reading
            new_entry_ref = history_ref.push(r.model_dump(mode='json'))
            
            # Pruning logic: keep only top 100
            snapshot = history_ref.get()
            if snapshot and len(snapshot) > RTDB_HISTORY_LIMIT:
                # Sort keys and remove oldest
                keys = sorted(snapshot.keys())
                for i in range(len(keys) - RTDB_HISTORY_LIMIT):
                    history_ref.child(keys[i]).delete()

    def query(
        self,
        zone_id: str,
        sensor_type: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 500,
    ) -> List[SensorReading]:
        key = f"{zone_id}:{sensor_type}"
        with self._lock:
            data = list(self._series.get(key, []))

        if start_time:
            data = [r for r in data if r.timestamp >= start_time]
        if end_time:
            data = [r for r in data if r.timestamp <= end_time]

        return data[-limit:]

    def get_latest(self, zone_id: str, sensor_type: str) -> Optional[SensorReading]:
        key = f"{zone_id}:{sensor_type}"
        with self._lock:
            return self._latest.get(key)

    def get_all_latest(self) -> Dict[str, SensorReading]:
        with self._lock:
            return dict(self._latest)

    def get_series_keys(self) -> List[str]:
        with self._lock:
            return list(self._series.keys())

    def get_recent_values(
        self, zone_id: str, sensor_type: str, count: int = 100
    ) -> List[Tuple[datetime, float]]:
        key = f"{zone_id}:{sensor_type}"
        with self._lock:
            data = list(self._series.get(key, []))
        return [(r.timestamp, r.value) for r in data[-count:]]


# Singleton store
tsdb = TimeSeriesStore()
