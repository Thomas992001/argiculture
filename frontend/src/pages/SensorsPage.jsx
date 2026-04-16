import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Brain, Zap } from "lucide-react";
import { api } from "../api/client";
import { useRTDBData } from "../hooks/useRTDBData";
import { useRTDBHistory } from "../hooks/useRTDBHistory";
import SensorCard from "../components/SensorCard";
import { entriesForBedZone, entriesForZoneAir } from "../utils/bedSensorKeys";
import RealtimeChart from "../components/RealtimeChart";

const ZONES = [
  { value: "zone_air", label: "Greenhouse Condition" },
  { value: "zone_bed", label: "Substrate Bed" },
];

const SENSOR_TYPES_BY_ZONE = {
  zone_air: [
    { value: "humidity", label: "Air Humidity" },
    { value: "temperature", label: "Air Temperature" },
    { value: "light", label: "Light Level" },
  ],
  zone_bed: [
    { value: "soil_temperature", label: "Soil Temperature" },
    { value: "soil_ph", label: "Soil pH Value" },
    { value: "soil_moisture", label: "Soil Moisture" },
  ],
};

const BED_ZONES = [
  { value: "zone_bed_a", label: "Substrate A", color: "#22c55e" },
  { value: "zone_bed_b", label: "Substrate B", color: "#3b82f6" },
  { value: "zone_bed_c", label: "Substrate C", color: "#f59e0b" },
];

/** Firebase / RTDB often uses `light_intensity`; app treats it as `light` for display. */
function normalizeLightSensorType(type) {
  return type === "light_intensity" ? "light" : type;
}

function readingSensorType(r, key) {
  if (r && typeof r === "object" && r.sensor_type != null) {
    const st =
      typeof r.sensor_type === "string" ? r.sensor_type : r.sensor_type.value;
    return normalizeLightSensorType(st);
  }
  return normalizeLightSensorType(key.split(":")[1] || "");
}

function buildGreenhouseZoneReadings(sensorData, allowedTypes) {
  const rows = entriesForZoneAir(sensorData)
    .filter(([key, r]) => {
      if (!r || typeof r !== "object") return false;
      const sensorType = readingSensorType(r, key);
      if (!sensorType) return false;
      return allowedTypes.includes(sensorType) || sensorType === "light_intensity";
    })
    .map(([key, r]) => ({
      key,
      sensorType: readingSensorType(r, key),
      ...r,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const bySensorType = new Map();
  for (const row of rows) {
    if (bySensorType.has(row.sensorType)) continue;
    bySensorType.set(row.sensorType, row);
  }
  return Array.from(bySensorType.values());
}

export default function SensorsPage() {
  const [searchParams] = useSearchParams();
  const initialZone = searchParams.get("zone") || "zone_air";
  const initialSensor = searchParams.get("sensor") || "humidity";

  const [selectedZone, setSelectedZone] = useState(initialZone);
  const [selectedSensor, setSelectedSensor] = useState(initialSensor);
  const [stats, setStats] = useState(null);
  const [sensorData, setSensorData] = useState({});
  const [timeWindow, setTimeWindow] = useState(30);
  const [highlightSensor, setHighlightSensor] = useState(null);
  const { data: rtdbData } = useRTDBData();
  const highlightRef = useRef(null);

  const isSubstrateBed = selectedZone === "zone_bed";
  const sensorTypes = SENSOR_TYPES_BY_ZONE[selectedZone] || [];

  // Chart history — directly from RTDB
  const { data: histAir } = useRTDBHistory("zone_air", selectedSensor, timeWindow);
  const { data: histBedA } = useRTDBHistory("zone_bed_a", selectedSensor, timeWindow);
  const { data: histBedB } = useRTDBHistory("zone_bed_b", selectedSensor, timeWindow);
  const { data: histBedC } = useRTDBHistory("zone_bed_c", selectedSensor, timeWindow);

  // Handle navigation with flash highlight
  useEffect(() => {
    const sensorParam = searchParams.get("sensor");
    const zoneParam = searchParams.get("zone");
    if (sensorParam && zoneParam) {
      setSelectedZone(zoneParam);
      setSelectedSensor(sensorParam);
      setHighlightSensor(sensorParam);

      const timer = setTimeout(() => {
        if (highlightRef.current) {
          highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 300);

      const clearTimer = setTimeout(() => setHighlightSensor(null), 2000);
      return () => {
        clearTimeout(timer);
        clearTimeout(clearTimer);
      };
    }
  }, [searchParams]);

  useEffect(() => {
    const firstType = sensorTypes[0]?.value;
    if (firstType && !searchParams.get("sensor")) setSelectedSensor(firstType);
  }, [selectedZone]);

  // Stats still come from backend API (Gemini-powered)
  const fetchStats = useCallback(async () => {
    try {
      const zone = isSubstrateBed ? BED_ZONES[0].value : selectedZone;
      let statsData = await api.getStatistics(zone, selectedSensor);
      if (
        selectedSensor === "light" &&
        selectedZone === "zone_air" &&
        !statsData?.mean
      ) {
        try {
          statsData = await api.getStatistics(selectedZone, "light_intensity");
        } catch { /* ignore */ }
      }
      setStats(statsData);
    } catch { /* ignore */ }
  }, [selectedZone, selectedSensor, isSubstrateBed]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  useEffect(() => {
    if (rtdbData && Object.keys(rtdbData).length > 0) {
      setSensorData(rtdbData);
    }
  }, [rtdbData]);

  const allowedTypes = sensorTypes.map(s => s.value);

  const zoneReadings = isSubstrateBed
    ? Object.entries(sensorData)
        .filter(([key]) => {
          const [zone, type] = key.split(":");
          return zone === selectedZone && allowedTypes.includes(type);
        })
        .map(([key, r]) => ({
          key,
          sensorType: key.split(":")[1],
          ...r,
        }))
    : buildGreenhouseZoneReadings(sensorData, allowedTypes);

  const history = isSubstrateBed ? [] : histAir;
  const bedSeries = isSubstrateBed
    ? [
        { label: "Substrate A", data: histBedA, color: "#22c55e" },
        { label: "Substrate B", data: histBedB, color: "#3b82f6" },
        { label: "Substrate C", data: histBedC, color: "#f59e0b" },
      ]
    : [];

  const sensorLabel =
    sensorTypes.find((s) => s.value === selectedSensor)?.label ||
    selectedSensor;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Sensor Explorer</h2>
        <p className="text-sm text-gray-500 mt-1">
          Detailed view of individual sensor streams
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={selectedZone}
          onChange={(e) => setSelectedZone(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-greenhouse-500"
        >
          {ZONES.map((z) => (
            <option key={z.value} value={z.value}>
              {z.label}
            </option>
          ))}
        </select>

        <select
          value={selectedSensor}
          onChange={(e) => setSelectedSensor(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-greenhouse-500"
        >
          {sensorTypes.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          value={timeWindow}
          onChange={(e) => setTimeWindow(Number(e.target.value))}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-greenhouse-500"
        >
          <option value={10}>Last 10 min</option>
          <option value={30}>Last 30 min</option>
          <option value={60}>Last 1 hour</option>
          <option value={180}>Last 3 hours</option>
          <option value={720}>Last 12 hours</option>
        </select>
      </div>

      {/* Current readings */}
      {isSubstrateBed ? (
        <div className="space-y-4">
          {BED_ZONES.map((bed) => {
            const readings = entriesForBedZone(sensorData, bed.value).map(
              ([key, r]) => ({
                key,
                sensorType: readingSensorType(r, key),
                ...r,
              })
            );
            return (
              <div key={bed.value}>
                <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: bed.color }}
                  />
                  {bed.label}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {readings.map((r) => {
                    const isTarget = highlightSensor === r.sensorType;
                    return (
                      <div
                        key={r.key}
                        ref={isTarget ? highlightRef : null}
                        className={isTarget ? "animate-flash-highlight rounded-xl" : ""}
                      >
                        <SensorCard
                          sensorType={r.sensorType}
                          value={r.value}
                          quality={r.quality}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {zoneReadings.map((r) => {
            const isTarget = highlightSensor === r.sensorType;
            return (
              <div
                key={r.key}
                ref={isTarget ? highlightRef : null}
                className={isTarget ? "animate-flash-highlight rounded-xl" : ""}
              >
                <SensorCard
                  sensorType={r.sensorType}
                  value={r.value}
                  quality={r.quality}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Chart */}
      {isSubstrateBed ? (
        <RealtimeChart
          series={bedSeries}
          sensorType={selectedSensor}
          height={300}
          title={`${sensorLabel} — Substrate A / B / C (Last ${timeWindow} min)`}
        />
      ) : (
        <RealtimeChart
          data={history}
          sensorType={selectedSensor}
          height={300}
          title={`${sensorLabel} — Greenhouse Condition (Last ${timeWindow} min)`}
        />
      )}

      {/* Statistics */}
      {stats && !stats.error && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-gray-400">Statistics</h3>
            {stats.powered_by && (
              <span
                className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full ${
                  stats.powered_by === "google_gemini"
                    ? "bg-greenhouse-500/15 text-greenhouse-400 border border-greenhouse-500/30"
                    : "bg-gray-700/50 text-gray-400 border border-gray-600/30"
                }`}
              >
                <Zap size={8} />
                {stats.powered_by === "google_gemini" ? "Gemini" : "Local"}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: "Mean", value: stats.mean },
              { label: "Std Dev", value: stats.std },
              { label: "Min", value: stats.min },
              { label: "Max", value: stats.max },
              { label: "Median", value: stats.median },
              { label: "Latest", value: stats.latest },
              { label: "Trend", value: stats.trend },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-gray-900/50 rounded-lg border border-gray-800 p-3 text-center"
              >
                <p className="text-[10px] text-gray-500 uppercase">
                  {s.label}
                </p>
                <p className="text-lg font-semibold text-gray-200 mt-1">
                  {typeof s.value === "number" ? s.value.toFixed(2) : "--"}
                </p>
              </div>
            ))}
          </div>

          {stats.ai_interpretation && (
            <div className="p-3 rounded-lg bg-greenhouse-500/5 border border-greenhouse-500/20">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Brain size={12} className="text-greenhouse-400" />
                <span className="text-[10px] font-semibold text-greenhouse-400 uppercase tracking-wider">
                  Gemini Interpretation
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-line">
                {stats.ai_interpretation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
