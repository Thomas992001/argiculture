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

MAX_POINTS_PER_SERIES = 10_000


class TimeSeriesStore:
    """Thread-safe in-memory ring-buffer store for sensor telemetry."""

    def __init__(self):
        self._lock = threading.Lock()
        self._series: Dict[str, deque] = defaultdict(
            lambda: deque(maxlen=MAX_POINTS_PER_SERIES)
        )
        self._latest: Dict[str, SensorReading] = {}

    def write(self, reading: SensorReading):
        key = f"{reading.zone_id}:{reading.sensor_type.value}"
        with self._lock:
            self._series[key].append(reading)
            self._latest[key] = reading

    def write_batch(self, readings: List[SensorReading]):
        with self._lock:
            for reading in readings:
                key = f"{reading.zone_id}:{reading.sensor_type.value}"
                self._series[key].append(reading)
                self._latest[key] = reading

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
