"""
Time-series forecasting for greenhouse climate and moisture.
Uses XGBoost for tabular features with lag-based feature engineering.
Falls back to simple exponential smoothing when insufficient data.
"""

import numpy as np
from datetime import datetime, timedelta
from typing import List, Tuple, Optional

from backend.models import ForecastPoint


def build_lag_features(values: List[float], lags: List[int] = None) -> Optional[np.ndarray]:
    """Build a feature matrix from lagged values for XGBoost."""
    if lags is None:
        lags = [1, 2, 3, 5, 10, 20]

    max_lag = max(lags)
    if len(values) <= max_lag + 1:
        return None

    arr = np.array(values)
    n_samples = len(arr) - max_lag
    features = np.zeros((n_samples, len(lags) + 3))

    for i, lag in enumerate(lags):
        features[:, i] = arr[max_lag - lag: len(arr) - lag]

    window = min(10, max_lag)
    for j in range(n_samples):
        start_idx = max_lag + j - window
        end_idx = max_lag + j
        segment = arr[start_idx:end_idx]
        features[j, len(lags)] = np.mean(segment)
        features[j, len(lags) + 1] = np.std(segment)
        features[j, len(lags) + 2] = segment[-1] - segment[0]

    targets = arr[max_lag:]
    return features, targets


class GreenhouseForecaster:
    """Multi-step forecaster using XGBoost when available, else exponential smoothing."""

    def __init__(self):
        self._models = {}
        self._xgboost_available = False
        self._try_import_xgboost()

    def _try_import_xgboost(self):
        try:
            import xgboost
            self._xgboost_available = True
        except ImportError:
            self._xgboost_available = False

    def forecast(
        self,
        historical_values: List[Tuple[datetime, float]],
        horizon_minutes: int = 60,
        step_minutes: int = 5,
    ) -> List[ForecastPoint]:
        if len(historical_values) < 10:
            return self._naive_forecast(historical_values, horizon_minutes, step_minutes)

        values = [v for _, v in historical_values]

        if self._xgboost_available and len(values) >= 30:
            return self._xgboost_forecast(historical_values, values, horizon_minutes, step_minutes)

        return self._ema_forecast(historical_values, values, horizon_minutes, step_minutes)

    def _xgboost_forecast(
        self,
        historical: List[Tuple[datetime, float]],
        values: List[float],
        horizon_minutes: int,
        step_minutes: int,
    ) -> List[ForecastPoint]:
        import xgboost as xgb

        result = build_lag_features(values)
        if result is None:
            return self._ema_forecast(historical, values, horizon_minutes, step_minutes)

        features, targets = result
        split = max(1, int(len(features) * 0.8))
        X_train, y_train = features[:split], targets[:split]

        model = xgb.XGBRegressor(
            n_estimators=50, max_depth=4, learning_rate=0.1,
            verbosity=0, n_jobs=1,
        )
        model.fit(X_train, y_train)

        last_ts = historical[-1][0]
        steps = horizon_minutes // step_minutes
        predictions = []
        current_values = list(values)

        noise_std = np.std(values[-50:]) * 0.1 if len(values) >= 50 else np.std(values) * 0.1

        for i in range(steps):
            result = build_lag_features(current_values)
            if result is None:
                break
            feat, _ = result
            pred = float(model.predict(feat[-1:].reshape(1, -1))[0])
            current_values.append(pred)

            ts = last_ts + timedelta(minutes=step_minutes * (i + 1))
            spread = noise_std * (1 + i * 0.15)
            predictions.append(ForecastPoint(
                timestamp=ts,
                predicted_value=round(pred, 2),
                lower_bound=round(pred - 2 * spread, 2),
                upper_bound=round(pred + 2 * spread, 2),
            ))

        return predictions

    def _ema_forecast(
        self,
        historical: List[Tuple[datetime, float]],
        values: List[float],
        horizon_minutes: int,
        step_minutes: int,
    ) -> List[ForecastPoint]:
        alpha = 0.3
        ema = values[0]
        for v in values[1:]:
            ema = alpha * v + (1 - alpha) * ema

        trend = 0.0
        if len(values) >= 5:
            recent = values[-5:]
            trend = (recent[-1] - recent[0]) / len(recent)

        noise_std = float(np.std(values[-20:])) if len(values) >= 20 else float(np.std(values))
        last_ts = historical[-1][0]
        steps = horizon_minutes // step_minutes
        predictions = []

        for i in range(steps):
            pred = ema + trend * (i + 1)
            ts = last_ts + timedelta(minutes=step_minutes * (i + 1))
            spread = noise_std * (1 + i * 0.2)
            predictions.append(ForecastPoint(
                timestamp=ts,
                predicted_value=round(pred, 2),
                lower_bound=round(pred - 2 * spread, 2),
                upper_bound=round(pred + 2 * spread, 2),
            ))

        return predictions

    def _naive_forecast(
        self,
        historical: List[Tuple[datetime, float]],
        horizon_minutes: int,
        step_minutes: int,
    ) -> List[ForecastPoint]:
        if not historical:
            return []
        last_ts, last_val = historical[-1]
        steps = horizon_minutes // step_minutes
        return [
            ForecastPoint(
                timestamp=last_ts + timedelta(minutes=step_minutes * (i + 1)),
                predicted_value=round(last_val, 2),
                lower_bound=round(last_val - 2.0, 2),
                upper_bound=round(last_val + 2.0, 2),
            )
            for i in range(steps)
        ]


forecaster = GreenhouseForecaster()
