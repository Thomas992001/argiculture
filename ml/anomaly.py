"""
Anomaly detection for greenhouse sensor streams.
Uses Isolation Forest for multivariate anomaly detection
and residual z-score for fast univariate checks.
"""

import numpy as np
from datetime import datetime
from typing import List, Tuple, Optional
from dataclasses import dataclass


@dataclass
class AnomalyResult:
    is_anomaly: bool
    score: float
    description: str
    expected_min: float
    expected_max: float


class UnivariateDetector:
    """Fast z-score based anomaly detection on rolling windows."""

    def __init__(self, window_size: int = 50, z_threshold: float = 3.0):
        self.window_size = window_size
        self.z_threshold = z_threshold

    def check(self, values: List[float], current_value: float) -> AnomalyResult:
        if len(values) < 10:
            return AnomalyResult(False, 0.0, "Insufficient data", current_value - 1, current_value + 1)

        window = values[-self.window_size:]
        mean = float(np.mean(window))
        std = float(np.std(window))

        if std < 1e-6:
            return AnomalyResult(False, 0.0, "Constant signal", mean - 0.1, mean + 0.1)

        z_score = abs(current_value - mean) / std
        is_anomaly = z_score > self.z_threshold

        expected_min = mean - self.z_threshold * std
        expected_max = mean + self.z_threshold * std

        desc = "Normal"
        if is_anomaly:
            direction = "high" if current_value > mean else "low"
            desc = f"Anomalous: value is {direction} (z={z_score:.1f})"

        return AnomalyResult(
            is_anomaly=is_anomaly,
            score=min(z_score / (self.z_threshold * 2), 1.0),
            description=desc,
            expected_min=round(expected_min, 2),
            expected_max=round(expected_max, 2),
        )


class RateOfChangeDetector:
    """Detects sudden spikes or drops that indicate sensor faults."""

    def __init__(self, max_rate_per_step: float = None):
        self.max_rate_per_step = max_rate_per_step

    def check(self, values: List[float], sensor_type: str) -> AnomalyResult:
        if len(values) < 3:
            return AnomalyResult(False, 0.0, "Insufficient data", 0, 0)

        rate_limits = {
            "temperature": 2.0,
            "humidity": 5.0,
            "soil_moisture": 5.0,
            "ec": 0.5,
            "ph": 0.3,
            "water_temperature": 1.0,
            "water_level": 3.0,
            "light": 5000.0,
            "light_intensity": 5000.0,
        }

        max_rate = self.max_rate_per_step or rate_limits.get(sensor_type, 10.0)
        recent_rates = [abs(values[i] - values[i-1]) for i in range(-min(5, len(values)-1), 0)]

        if not recent_rates:
            return AnomalyResult(False, 0.0, "Normal", 0, 0)

        max_observed = max(recent_rates)
        is_anomaly = max_observed > max_rate
        score = min(max_observed / (max_rate * 2), 1.0) if max_rate > 0 else 0.0

        return AnomalyResult(
            is_anomaly=is_anomaly,
            score=score,
            description=f"Spike detected (rate={max_observed:.2f})" if is_anomaly else "Normal rate",
            expected_min=-max_rate,
            expected_max=max_rate,
        )


class IsolationForestDetector:
    """Multivariate anomaly detection using Isolation Forest."""

    def __init__(self, contamination: float = 0.05):
        self.contamination = contamination
        self._model = None
        self._fitted = False
        self._sklearn_available = False
        self._try_import()

    def _try_import(self):
        try:
            from sklearn.ensemble import IsolationForest
            self._sklearn_available = True
        except ImportError:
            self._sklearn_available = False

    def fit(self, data: np.ndarray):
        if not self._sklearn_available or len(data) < 20:
            return

        from sklearn.ensemble import IsolationForest
        self._model = IsolationForest(
            contamination=self.contamination,
            random_state=42,
            n_estimators=100,
        )
        self._model.fit(data)
        self._fitted = True

    def predict(self, sample: np.ndarray) -> AnomalyResult:
        if not self._fitted or self._model is None:
            return AnomalyResult(False, 0.0, "Model not fitted", 0, 0)

        score = float(self._model.decision_function(sample.reshape(1, -1))[0])
        prediction = int(self._model.predict(sample.reshape(1, -1))[0])
        is_anomaly = prediction == -1

        return AnomalyResult(
            is_anomaly=is_anomaly,
            score=max(0, -score),
            description="Multivariate anomaly detected" if is_anomaly else "Normal",
            expected_min=0,
            expected_max=0,
        )


class AnomalyDetectionService:
    """Combines multiple detectors for robust anomaly detection."""

    def __init__(self):
        self.univariate = UnivariateDetector()
        self.rate_checker = RateOfChangeDetector()
        self.isolation_forest = IsolationForestDetector()

    def check_reading(
        self,
        historical_values: List[float],
        current_value: float,
        sensor_type: str,
    ) -> AnomalyResult:
        z_result = self.univariate.check(historical_values, current_value)
        rate_result = self.rate_checker.check(
            historical_values + [current_value], sensor_type
        )

        if z_result.is_anomaly or rate_result.is_anomaly:
            combined_score = max(z_result.score, rate_result.score)
            descriptions = []
            if z_result.is_anomaly:
                descriptions.append(z_result.description)
            if rate_result.is_anomaly:
                descriptions.append(rate_result.description)

            return AnomalyResult(
                is_anomaly=True,
                score=combined_score,
                description="; ".join(descriptions),
                expected_min=z_result.expected_min,
                expected_max=z_result.expected_max,
            )

        return z_result


anomaly_service = AnomalyDetectionService()
