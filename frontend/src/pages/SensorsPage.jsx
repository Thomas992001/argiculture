import { useState, useEffect, useCallback } from "react";
import { Brain, Zap } from "lucide-react";
import { api } from "../api/client";
// import { useWebSocket } from "../hooks/useWebSocket";
import { useRTDBData } from "../hooks/useRTDBData";
import SensorCard from "../components/SensorCard";
import RealtimeChart from "../components/RealtimeChart";

const SENSOR_TYPES = [
  { value: "temperature", label: "Temperature" },
  { value: "humidity", label: "Humidity" },
  { value: "co2", label: "CO₂" },
  { value: "light_intensity", label: "Light" },
  { value: "soil_moisture", label: "Soil Moisture" },
  { value: "ec", label: "EC" },
  { value: "ph", label: "pH" },
  { value: "water_temperature", label: "Water Temp" },
  { value: "water_level", label: "Water Level" },
];

const ZONES = [
  { value: "zone_air", label: "Greenhouse Air" },
  { value: "zone_bed", label: "Substrate Bed" },
  { value: "zone_nft", label: "Hydroponic NFT" },
  { value: "zone_reservoir", label: "Reservoir" },
];

export default function SensorsPage() {
  const [selectedZone, setSelectedZone] = useState("zone_air");
  const [selectedSensor, setSelectedSensor] = useState("temperature");
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [sensorData, setSensorData] = useState({});
  const [timeWindow, setTimeWindow] = useState(30);
  // const { lastMessage } = useWebSocket();
  const { data: rtdbData } = useRTDBData();

  const fetchHistory = useCallback(async () => {
    try {
      const [histData, statsData] = await Promise.all([
        api.getSensorHistory(selectedZone, selectedSensor, timeWindow),
        api.getStatistics(selectedZone, selectedSensor),
      ]);
      setHistory(histData);
      setStats(statsData);
    } catch {
      // ignore
    }
  }, [selectedZone, selectedSensor, timeWindow]);

  const fetchLatest = useCallback(async () => {
    try {
      const data = await api.getLatestReadings();
      setSensorData(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    fetchLatest();
    const interval = setInterval(() => {
      fetchHistory();
      fetchLatest();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchHistory, fetchLatest]);

  // Use Firebase RTDB for real-time updates
  useEffect(() => {
    if (rtdbData && Object.keys(rtdbData).length > 0) {
      setSensorData(prev => ({ ...prev, ...rtdbData }));
    }
  }, [rtdbData]);

  /* WebSocket listener commented out per user request
  useEffect(() => {
    if (lastMessage?.type === "sensor_update") {
      const updated = { ...sensorData };
      for (const r of lastMessage.readings) {
        updated[`${r.zone_id}:${r.sensor_type}`] = r;
      }
      setSensorData(updated);
    }
  }, [lastMessage]);
  */

  const zoneReadings = Object.entries(sensorData)
    .filter(([key]) => key.startsWith(selectedZone))
    .map(([key, r]) => ({ key, sensorType: key.split(":")[1], ...r }));

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
          {SENSOR_TYPES.map((s) => (
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

      {/* Current readings for zone */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {zoneReadings.map((r) => (
          <SensorCard
            key={r.key}
            sensorType={r.sensorType}
            value={r.value}
            quality={r.quality}
          />
        ))}
      </div>

      {/* Chart */}
      <RealtimeChart
        data={history}
        sensorType={selectedSensor}
        height={300}
        title={`${selectedSensor} — ${selectedZone} (Last ${timeWindow} min)`}
      />

      {/* Statistics */}
      {stats && !stats.error && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-gray-400">Statistics</h3>
            {stats.powered_by && (
              <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full ${
                stats.powered_by === "google_gemini"
                  ? "bg-greenhouse-500/15 text-greenhouse-400 border border-greenhouse-500/30"
                  : "bg-gray-700/50 text-gray-400 border border-gray-600/30"
              }`}>
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
                <p className="text-[10px] text-gray-500 uppercase">{s.label}</p>
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
