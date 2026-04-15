"""
Weather Service — pulls live weather + short-term forecast from Open-Meteo.

Open-Meteo is free and requires no API key. We fetch for the greenhouse
location (Kuala Lumpur by default) and cache for 10 minutes so the Gemini
advisor and automation engine can reference real outdoor conditions
when reasoning about indoor dynamics.
"""

import time
import threading
import urllib.request
import urllib.parse
import json
from typing import Optional, Dict, Any

# Greenhouse site coords — KL. Replace for your location if needed.
SITE_LAT = 3.139
SITE_LON = 101.6869

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
CACHE_TTL_SECONDS = 600  # 10 min


class WeatherService:
    def __init__(self, lat: float = SITE_LAT, lon: float = SITE_LON):
        self.lat = lat
        self.lon = lon
        self._cache: Optional[Dict[str, Any]] = None
        self._cache_ts: float = 0.0
        self._lock = threading.Lock()

    def get_weather(self, force_refresh: bool = False) -> Dict[str, Any]:
        """Return current weather + 12h forecast. Cached 10 min."""
        with self._lock:
            if (
                not force_refresh
                and self._cache is not None
                and (time.time() - self._cache_ts) < CACHE_TTL_SECONDS
            ):
                return self._cache

        data = self._fetch()
        with self._lock:
            if data:
                self._cache = data
                self._cache_ts = time.time()
            elif self._cache is not None:
                data = self._cache  # serve stale on fetch failure
        return data or self._empty()

    def _fetch(self) -> Optional[Dict[str, Any]]:
        params = {
            "latitude": self.lat,
            "longitude": self.lon,
            "current": "temperature_2m,relative_humidity_2m,precipitation,"
                       "weather_code,wind_speed_10m,cloud_cover",
            "hourly": "temperature_2m,relative_humidity_2m,precipitation_probability,"
                      "precipitation,weather_code,cloud_cover",
            "forecast_days": 2,
            "timezone": "Asia/Kuala_Lumpur",
        }
        url = f"{OPEN_METEO_URL}?{urllib.parse.urlencode(params)}"
        try:
            with urllib.request.urlopen(url, timeout=8) as resp:
                raw = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            print(f"[WeatherService] Fetch error: {e}")
            return None

        current = raw.get("current", {}) or {}
        hourly = raw.get("hourly", {}) or {}

        # Next 12 hours summary
        times = hourly.get("time", [])[:12]
        temps = hourly.get("temperature_2m", [])[:12]
        rhs = hourly.get("relative_humidity_2m", [])[:12]
        prec_prob = hourly.get("precipitation_probability", [])[:12]
        prec = hourly.get("precipitation", [])[:12]
        codes = hourly.get("weather_code", [])[:12]

        forecast = []
        for i, t in enumerate(times):
            forecast.append({
                "time": t,
                "temp_c": temps[i] if i < len(temps) else None,
                "humidity_pct": rhs[i] if i < len(rhs) else None,
                "rain_prob_pct": prec_prob[i] if i < len(prec_prob) else None,
                "rain_mm": prec[i] if i < len(prec) else None,
                "condition": _wmo_description(codes[i]) if i < len(codes) else "",
            })

        # Aggregate next-12h stats for quick decisioning
        valid_temps = [t for t in temps if t is not None]
        valid_probs = [p for p in prec_prob if p is not None]
        max_temp = max(valid_temps) if valid_temps else None
        min_temp = min(valid_temps) if valid_temps else None
        max_rain_prob = max(valid_probs) if valid_probs else 0
        total_rain = sum(p for p in prec if p is not None) if prec else 0.0

        return {
            "location": {"lat": self.lat, "lon": self.lon},
            "current": {
                "temp_c": current.get("temperature_2m"),
                "humidity_pct": current.get("relative_humidity_2m"),
                "precipitation_mm": current.get("precipitation"),
                "wind_kmh": current.get("wind_speed_10m"),
                "cloud_cover_pct": current.get("cloud_cover"),
                "condition": _wmo_description(current.get("weather_code")),
            },
            "next_12h": {
                "max_temp_c": max_temp,
                "min_temp_c": min_temp,
                "max_rain_prob_pct": max_rain_prob,
                "total_rain_mm": round(total_rain, 1),
                "hourly": forecast,
            },
            "fetched_at": time.time(),
        }

    def _empty(self) -> Dict[str, Any]:
        return {
            "location": {"lat": self.lat, "lon": self.lon},
            "current": {},
            "next_12h": {"hourly": []},
            "error": "weather unavailable",
        }


# WMO weather code → short text (the codes Open-Meteo returns)
_WMO = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Drizzle", 55: "Dense drizzle",
    61: "Slight rain", 63: "Rain", 65: "Heavy rain",
    71: "Slight snow", 73: "Snow", 75: "Heavy snow",
    80: "Rain showers", 81: "Heavy rain showers", 82: "Violent rain showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Severe thunderstorm",
}


def _wmo_description(code) -> str:
    try:
        return _WMO.get(int(code), f"Code {code}")
    except (TypeError, ValueError):
        return "Unknown"


weather_service = WeatherService()
