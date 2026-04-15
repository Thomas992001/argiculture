import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Thermometer,
  Droplets,
  AlertTriangle,
  Server,
  Sparkles,
  Beaker,
  Sun,
  Cloud,
  CloudRain,
  Wind,
  CloudSun,
} from "lucide-react";
import { api } from "../api/client";
import { useRTDBData } from "../hooks/useRTDBData";
import SensorCard from "../components/SensorCard";
import RealtimeChart from "../components/RealtimeChart";
import AlertPanel from "../components/AlertPanel";
import { AiSummaryBanner, AiInsightPanel } from "../components/AiInsightCards";
import {
  entriesForBedZone,
  entriesForZoneAir,
  bedSensorCardType,
} from "../utils/bedSensorKeys";

const BED_ZONES = [
  { value: "zone_bed_a", label: "Substrate A", color: "#22c55e" },
  { value: "zone_bed_b", label: "Substrate B", color: "#3b82f6" },
  { value: "zone_bed_c", label: "Substrate C", color: "#f59e0b" },
];

// Hide legacy / unwanted RTDB keys (e.g. CO2) from the Greenhouse Condition grid
const HIDDEN_ZONE_AIR_TYPES = new Set(["co2"]);

export default function OverviewPage() {
  const [sensorData, setSensorData] = useState({});
  const [prevData, setPrevData] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [status, setStatus] = useState(null);
  const [airHistory, setAirHistory] = useState([]);
  const [bedMoistureHistories, setBedMoistureHistories] = useState({});
  const [weather, setWeather] = useState(null);
  const { data: rtdbData } = useRTDBData();

  const fetchMeta = useCallback(async () => {
    try {
      const [alertsData, statusData] = await Promise.all([
        api.getAlerts(),
        api.getStatus(),
      ]);
      setAlerts(alertsData);
      setStatus(statusData);
    } catch (err) {
      console.error("Failed to fetch overview meta:", err);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const [airHist, ...bedHists] = await Promise.all([
        api.getSensorHistory("zone_air", "humidity", 30),
        ...BED_ZONES.map((bed) =>
          api.getSensorHistory(bed.value, "soil_moisture", 30)
        ),
      ]);
      setAirHistory(airHist);
      const histories = {};
      BED_ZONES.forEach((bed, i) => {
        histories[bed.value] = bedHists[i];
      });
      setBedMoistureHistories(histories);
    } catch {
      // ignore
    }
  }, []);

  const fetchWeather = useCallback(async () => {
    try {
      const data = await api.getWeather();
      setWeather(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchMeta();
    fetchHistory();
    fetchWeather();
    const interval = setInterval(() => {
      fetchMeta();
      fetchHistory();
    }, 5000);
    const weatherInterval = setInterval(fetchWeather, 300000);
    return () => {
      clearInterval(interval);
      clearInterval(weatherInterval);
    };
  }, [fetchMeta, fetchHistory, fetchWeather]);

  useEffect(() => {
    if (rtdbData && Object.keys(rtdbData).length > 0) {
      setPrevData(sensorData);
      setSensorData(rtdbData);
    }
  }, [rtdbData]);

  const airReadingsRaw = entriesForZoneAir(sensorData)
    .filter(([key, reading]) => {
      if (!reading || typeof reading !== "object") return false;
      const st =
        reading.sensor_type != null
          ? typeof reading.sensor_type === "string"
            ? reading.sensor_type
            : reading.sensor_type.value
          : key.split(":")[1];
      const type = (st || "").toLowerCase();
      return !HIDDEN_ZONE_AIR_TYPES.has(type);
    })
    .map(([key, reading]) => ({
      key,
      sensorType: bedSensorCardType(reading, key),
      ...reading,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const bySensorType = new Map();
  for (const r of airReadingsRaw) {
    if (bySensorType.has(r.sensorType)) continue;
    bySensorType.set(r.sensorType, r);
  }
  const airReadings = Array.from(bySensorType.values());

  const bedMoistureSeries = BED_ZONES.map((bed) => ({
    label: bed.label,
    data: bedMoistureHistories[bed.value] || [],
    color: bed.color,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard Overview</h2>
          <p className="text-sm text-gray-500 mt-1">
            Real-time monitoring of your greenhouse digital twin
          </p>
        </div>
        {status && (
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1.5">
              <Server size={14} />
              <span>Sensors: {status.active_sensors}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity size={14} className="text-greenhouse-400" />
              <span>
                {status.simulator_running ? "Simulator Active" : "Offline"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Status cards row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <GlowCard
          icon={Thermometer}
          label="Air Temperature"
          value={getAvg(sensorData, "temperature")}
          unit="°C"
          gradient="from-red-500/20 to-orange-500/10"
          iconColor="text-red-400"
          valueColor="text-red-300"
          borderColor="border-red-500/20"
        />
        <GlowCard
          icon={Droplets}
          label="Air Humidity"
          value={getAvg(sensorData, "humidity")}
          unit="%"
          gradient="from-blue-500/20 to-cyan-500/10"
          iconColor="text-blue-400"
          valueColor="text-blue-300"
          borderColor="border-blue-500/20"
        />
        <GlowCard
          icon={Sun}
          label="Light Level"
          value={getAvg(sensorData, "light")}
          unit="lux"
          gradient="from-yellow-500/20 to-amber-500/10"
          iconColor="text-yellow-400"
          valueColor="text-yellow-300"
          borderColor="border-yellow-500/20"
          formatLarge
        />
        <GlowCard
          icon={Beaker}
          label="Avg Soil pH"
          value={getAvg(sensorData, "soil_ph")}
          unit=""
          gradient="from-green-500/20 to-emerald-500/10"
          iconColor="text-green-400"
          valueColor="text-green-300"
          borderColor="border-green-500/20"
        />
        <GlowCard
          icon={AlertTriangle}
          label="Active Alerts"
          value={alerts.length}
          unit=""
          gradient={alerts.length > 0 ? "from-yellow-500/20 to-orange-500/10" : "from-gray-500/10 to-gray-600/5"}
          iconColor={alerts.length > 0 ? "text-yellow-400" : "text-gray-500"}
          valueColor={alerts.length > 0 ? "text-yellow-300" : "text-gray-400"}
          borderColor={alerts.length > 0 ? "border-yellow-500/20" : "border-gray-700/30"}
          isInteger
        />
      </div>

      {/* Weather Widget */}
      {weather && !weather.error && (
        <WeatherWidget weather={weather} />
      )}

      {/* AI Summary */}
      <AiSummaryBanner />

      {/* Charts + AI Insights + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <RealtimeChart
            data={airHistory}
            sensorType="humidity"
            height={250}
            title="Air Humidity (Last 30 min)"
          />
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
              <Sparkles size={14} className="text-greenhouse-400" />
              AI Suggestions
            </h3>
            <AiInsightPanel maxItems={4} compact />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">
              Recent Alerts
            </h3>
            <AlertPanel alerts={alerts} onRefresh={fetchMeta} />
          </div>
        </div>
      </div>

      {/* Greenhouse Condition sensors */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">
          Greenhouse Condition
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {airReadings.map((r) => {
            const prevReading = prevData[r.key];
            return (
              <SensorCard
                key={r.key}
                sensorType={r.sensorType}
                value={r.value}
                prevValue={prevReading?.value}
                quality={r.quality}
              />
            );
          })}
        </div>
      </div>

      {/* Substrate Bed sensors */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">
          Substrate Bed
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {BED_ZONES.map((bed) => {
            const readings = entriesForBedZone(sensorData, bed.value).map(
              ([key, reading]) => ({
                key,
                sensorType: bedSensorCardType(reading, key),
                ...reading,
              })
            );
            return (
              <div key={bed.value}>
                <h4 className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: bed.color }}
                  />
                  {bed.label}
                </h4>
                <div className="space-y-2">
                  {readings.map((r) => {
                    const prevReading = prevData[r.key];
                    return (
                      <SensorCard
                        key={r.key}
                        sensorType={r.sensorType}
                        value={r.value}
                        prevValue={prevReading?.value}
                        quality={r.quality}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Substrate Bed moisture chart */}
      <RealtimeChart
        series={bedMoistureSeries}
        sensorType="soil_moisture"
        height={250}
        title="Soil Moisture — Substrate A / B / C (Last 30 min)"
      />
    </div>
  );
}

function GlowCard({ icon: Icon, label, value, unit, gradient, iconColor, valueColor, borderColor, formatLarge = false, isInteger = false }) {
  const formatValue = (val) => {
    if (typeof val !== "number") return "--";
    if (isInteger) return val;
    if (formatLarge && val >= 1000) return Math.round(val).toLocaleString();
    return val.toFixed(1);
  };

  return (
    <div className={`relative overflow-hidden rounded-xl border ${borderColor} bg-gradient-to-br ${gradient} p-4 transition-all hover:scale-[1.02]`}>
      <div className="absolute top-0 right-0 w-20 h-20 opacity-[0.07]">
        <Icon size={80} className={iconColor} />
      </div>
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <Icon size={16} className={iconColor} />
          <span className="text-xs text-gray-400 font-medium">{label}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`text-2xl font-bold ${valueColor}`}>
            {formatValue(value)}
          </span>
          {unit && <span className="text-xs text-gray-500">{unit}</span>}
        </div>
      </div>
    </div>
  );
}

const WEATHER_ICONS = {
  "Clear sky": Sun,
  "Mainly clear": CloudSun,
  "Partly cloudy": CloudSun,
  "Overcast": Cloud,
  "Fog": Cloud,
  "Light drizzle": CloudRain,
  "Drizzle": CloudRain,
  "Dense drizzle": CloudRain,
  "Slight rain": CloudRain,
  "Rain": CloudRain,
  "Heavy rain": CloudRain,
  "Rain showers": CloudRain,
  "Thunderstorm": CloudRain,
};

function WeatherWidget({ weather }) {
  const current = weather?.current || {};
  const forecast = weather?.next_12h || {};
  const condition = current.condition || "Unknown";
  const WeatherIcon = WEATHER_ICONS[condition] || Cloud;

  const hourly = (forecast.hourly || []).slice(0, 6);

  return (
    <div className="rounded-xl border border-sky-500/15 bg-gradient-to-r from-sky-900/20 via-blue-900/15 to-indigo-900/10 p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-500/15 flex items-center justify-center">
            <WeatherIcon size={24} className="text-sky-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-sky-300">{condition}</p>
            <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
              {current.temp_c != null && (
                <span className="flex items-center gap-1">
                  <Thermometer size={11} className="text-red-400" />
                  {current.temp_c}°C
                </span>
              )}
              {current.humidity_pct != null && (
                <span className="flex items-center gap-1">
                  <Droplets size={11} className="text-blue-400" />
                  {current.humidity_pct}%
                </span>
              )}
              {current.wind_kmh != null && (
                <span className="flex items-center gap-1">
                  <Wind size={11} className="text-gray-400" />
                  {current.wind_kmh} km/h
                </span>
              )}
              {current.cloud_cover_pct != null && (
                <span className="flex items-center gap-1">
                  <Cloud size={11} className="text-gray-400" />
                  {current.cloud_cover_pct}%
                </span>
              )}
            </div>
          </div>
        </div>
        {forecast.max_rain_prob_pct != null && (
          <div className="text-right text-xs">
            <p className="text-gray-500">12h Rain</p>
            <p className={`text-sm font-semibold ${forecast.max_rain_prob_pct > 50 ? "text-sky-400" : "text-gray-400"}`}>
              {forecast.max_rain_prob_pct}%
            </p>
          </div>
        )}
      </div>

      {/* Hourly mini forecast */}
      {hourly.length > 0 && (
        <div className="mt-3 pt-3 border-t border-sky-500/10 grid grid-cols-6 gap-2">
          {hourly.map((h, i) => {
            const time = h.time ? new Date(h.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
            const HIcon = WEATHER_ICONS[h.condition] || Cloud;
            return (
              <div key={i} className="text-center">
                <p className="text-[10px] text-gray-500">{time}</p>
                <HIcon size={14} className="mx-auto my-1 text-sky-400/60" />
                <p className="text-[11px] font-medium text-gray-300">{h.temp_c != null ? `${h.temp_c}°` : "--"}</p>
                {h.rain_prob_pct != null && h.rain_prob_pct > 0 && (
                  <p className="text-[9px] text-sky-400">{h.rain_prob_pct}%</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getAvg(sensorData, sensorType) {
  const values = Object.entries(sensorData)
    .filter(([key]) => {
      const t = key.split(":")[1];
      if (sensorType === "light") {
        return t === "light" || t === "light_intensity";
      }
      return key.endsWith(`:${sensorType}`);
    })
    .map(([, r]) => r.value)
    .filter((v) => v != null);
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
