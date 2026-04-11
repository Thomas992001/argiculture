import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Thermometer,
  Droplets,
  AlertTriangle,
  Server,
  Sparkles,
} from "lucide-react";
import { api } from "../api/client";
import { useWebSocket } from "../hooks/useWebSocket";
import SensorCard from "../components/SensorCard";
import RealtimeChart from "../components/RealtimeChart";
import AlertPanel from "../components/AlertPanel";
import { AiSummaryBanner, AiInsightPanel } from "../components/AiInsightCards";

const ZONE_LABELS = {
  zone_air: "Greenhouse Air",
  zone_bed: "Substrate Bed",
  zone_nft: "Hydroponic NFT",
  zone_reservoir: "Reservoir",
};

export default function OverviewPage() {
  const [sensorData, setSensorData] = useState({});
  const [prevData, setPrevData] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const { lastMessage } = useWebSocket();

  const fetchData = useCallback(async () => {
    try {
      const [latest, alertsData, statusData] = await Promise.all([
        api.getLatestReadings(),
        api.getAlerts(),
        api.getStatus(),
      ]);
      setPrevData(sensorData);
      setSensorData(latest);
      setAlerts(alertsData);
      setStatus(statusData);
    } catch (err) {
      console.error("Failed to fetch overview data:", err);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const data = await api.getSensorHistory("zone_air", "temperature", 30);
      setHistory(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchHistory();
    const interval = setInterval(() => {
      fetchData();
      fetchHistory();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchData, fetchHistory]);

  useEffect(() => {
    if (lastMessage?.type === "sensor_update") {
      setPrevData(sensorData);
      const updated = { ...sensorData };
      for (const r of lastMessage.readings) {
        const key = `${r.zone_id}:${r.sensor_type}`;
        updated[key] = r;
      }
      setSensorData(updated);
    }
  }, [lastMessage]);

  const sensorEntries = Object.entries(sensorData);
  const groupedByZone = {};
  for (const [key, reading] of sensorEntries) {
    const zoneId = reading.zone_id || key.split(":")[0];
    if (!groupedByZone[zoneId]) groupedByZone[zoneId] = [];
    groupedByZone[zoneId].push({ key, ...reading });
  }

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatusCard
          icon={Thermometer}
          label="Avg Temperature"
          value={getAvg(sensorData, "temperature")}
          unit="°C"
          color="text-red-400"
          bg="bg-red-400/10"
        />
        <StatusCard
          icon={Droplets}
          label="Avg Humidity"
          value={getAvg(sensorData, "humidity")}
          unit="%"
          color="text-blue-400"
          bg="bg-blue-400/10"
        />
        <StatusCard
          icon={Activity}
          label="Active Sensors"
          value={status?.active_sensors || 0}
          unit=""
          color="text-greenhouse-400"
          bg="bg-greenhouse-400/10"
        />
        <StatusCard
          icon={AlertTriangle}
          label="Active Alerts"
          value={alerts.length}
          unit=""
          color={alerts.length > 0 ? "text-yellow-400" : "text-gray-400"}
          bg={alerts.length > 0 ? "bg-yellow-400/10" : "bg-gray-400/10"}
        />
      </div>

      {/* AI Summary */}
      <AiSummaryBanner />

      {/* Chart + AI Insights + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <RealtimeChart
            data={history}
            sensorType="temperature"
            height={250}
            title="Air Temperature (Last 30 min)"
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
            <AlertPanel alerts={alerts} onRefresh={fetchData} />
          </div>
        </div>
      </div>

      {/* Zone sensor grid */}
      {Object.entries(groupedByZone).map(([zoneId, readings]) => (
        <div key={zoneId}>
          <h3 className="text-sm font-semibold text-gray-300 mb-3">
            {ZONE_LABELS[zoneId] || zoneId}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {readings.map((r) => {
              const sType = r.sensor_type || r.key.split(":")[1];
              const prevReading = prevData[r.key];
              return (
                <SensorCard
                  key={r.key}
                  sensorType={sType}
                  value={r.value}
                  prevValue={prevReading?.value}
                  quality={r.quality}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusCard({ icon: Icon, label, value, unit, color, bg }) {
  return (
    <div className={`${bg} rounded-xl p-4 border border-gray-800`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className={color} />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-xl font-bold ${color}`}>
          {typeof value === "number" ? value.toFixed(1) : value}
        </span>
        {unit && <span className="text-xs text-gray-500">{unit}</span>}
      </div>
    </div>
  );
}

function getAvg(sensorData, sensorType) {
  const values = Object.entries(sensorData)
    .filter(([key]) => key.includes(sensorType))
    .map(([, r]) => r.value)
    .filter((v) => v != null);
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
