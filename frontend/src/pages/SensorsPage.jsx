import { useState, useEffect, useCallback } from "react";
import { Brain, Zap } from "lucide-react";
import { api } from "../api/client";
import { useRTDBData } from "../hooks/useRTDBData";
import SensorCard from "../components/SensorCard";
import RealtimeChart from "../components/RealtimeChart";

const ZONES = [
  { value: "zone_air", label: "Greenhouse Condition" },
  { value: "zone_bed", label: "Substrate Bed" },
];

const SENSOR_TYPES_BY_ZONE = {
  zone_air: [
    { value: "temperature", label: "Temperature" },
    { value: "humidity", label: "Humidity" },
    { value: "light_intensity", label: "Light" },
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

export default function SensorsPage() {
  const [selectedZone, setSelectedZone] = useState("zone_air");
  const [selectedSensor, setSelectedSensor] = useState("temperature");
  const [history, setHistory] = useState([]);
  const [bedHistories, setBedHistories] = useState({});
  const [stats, setStats] = useState(null);
  const [sensorData, setSensorData] = useState({});
  const [timeWindow, setTimeWindow] = useState(30);
  const { data: rtdbData } = useRTDBData();

  const isSubstrateBed = selectedZone === "zone_bed";
  const sensorTypes = SENSOR_TYPES_BY_ZONE[selectedZone] || [];

  useEffect(() => {
    const firstType = sensorTypes[0]?.value;
    if (firstType) setSelectedSensor(firstType);
  }, [selectedZone]);

  const fetchHistory = useCallback(async () => {
    try {
      if (isSubstrateBed) {
        const results = await Promise.all(
          BED_ZONES.map((bed) =>
            api.getSensorHistory(bed.value, selectedSensor, timeWindow)
          )
        );
        const histories = {};
        BED_ZONES.forEach((bed, i) => {
          histories[bed.value] = results[i];
        });
        setBedHistories(histories);

        const statsData = await api.getStatistics(
          BED_ZONES[0].value,
          selectedSensor
        );
        setStats(statsData);
      } else {
        const [histData, statsData] = await Promise.all([
          api.getSensorHistory(selectedZone, selectedSensor, timeWindow),
          api.getStatistics(selectedZone, selectedSensor),
        ]);
        setHistory(histData);
        setStats(statsData);
      }
    } catch {
      // ignore
    }
  }, [selectedZone, selectedSensor, timeWindow, isSubstrateBed]);

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, [fetchHistory]);

  // Sensor data comes exclusively from RTDB
  useEffect(() => {
    if (rtdbData && Object.keys(rtdbData).length > 0) {
      setSensorData(rtdbData);
    }
  }, [rtdbData]);

  const allowedTypes = sensorTypes.map(s => s.value);

  const zoneReadings = Object.entries(sensorData)
    .filter(([key]) => {
      const [zone, type] = key.split(":");
      return zone === selectedZone && allowedTypes.includes(type);
    })
    .map(([key, r]) => ({
      key,
      sensorType: key.split(":")[1],
      ...r,
    }));

  const bedSeries = isSubstrateBed
    ? BED_ZONES.map((bed) => ({
        label: bed.label,
        data: bedHistories[bed.value] || [],
        color: bed.color,
      }))
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
            const readings = Object.entries(sensorData)
              .filter(([key]) => key.startsWith(bed.value))
              .map(([key, r]) => ({
                key,
                sensorType: key.split(":")[1],
                ...r,
              }));
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
                  {readings.map((r) => (
                    <SensorCard
                      key={r.key}
                      sensorType={r.sensorType}
                      value={r.value}
                      quality={r.quality}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {zoneReadings.map((r) => (
            <SensorCard
              key={r.key}
              sensorType={r.sensorType}
              value={r.value}
              quality={r.quality}
            />
          ))}
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
