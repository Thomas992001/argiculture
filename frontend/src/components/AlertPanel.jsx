import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Check,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { api } from "../api/client";
import { formatMytDateTime } from "../utils/analytics";

const SEVERITY_STYLES = {
  critical: {
    icon: AlertCircle,
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
    badge: "bg-red-500",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    text: "text-yellow-400",
    badge: "bg-yellow-500",
  },
  info: {
    icon: Info,
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-400",
    badge: "bg-blue-500",
  },
};

const SENSOR_ID_TO_TYPE = {
  air_rh: "humidity",
  air_temp: "temperature",
  air_light: "light",
  bed_a_temp: "soil_temperature",
  bed_a_ph: "soil_ph",
  bed_a_moisture: "soil_moisture",
  bed_b_temp: "soil_temperature",
  bed_b_ph: "soil_ph",
  bed_b_moisture: "soil_moisture",
  bed_c_temp: "soil_temperature",
  bed_c_ph: "soil_ph",
  bed_c_moisture: "soil_moisture",
};

function inferSensorType(alert) {
  if (alert.sensor_id) {
    const baseId = alert.sensor_id.replace(/_\d+$/, "");
    if (SENSOR_ID_TO_TYPE[baseId]) return SENSOR_ID_TO_TYPE[baseId];
  }

  const msg = (alert.message || "").toLowerCase();
  if (msg.includes("humidity")) return "humidity";
  if (msg.includes("light")) return "light";
  if (msg.includes("soil temperature") || msg.includes("soil temp")) return "soil_temperature";
  if (msg.includes("temperature") || msg.includes("temp")) return "temperature";
  if (msg.includes("ph")) return "soil_ph";
  if (msg.includes("moisture")) return "soil_moisture";

  return "humidity";
}

function inferZone(alert, sensorType) {
  if (alert.zone_id) {
    const isSoilType = sensorType.startsWith("soil_");
    if (isSoilType && alert.zone_id.startsWith("zone_bed")) return "zone_bed";
    if (!isSoilType) return "zone_air";
    return isSoilType ? "zone_bed" : "zone_air";
  }
  return sensorType.startsWith("soil_") ? "zone_bed" : "zone_air";
}

function AlertItem({ alert, onAcknowledge }) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info;
  const Icon = style.icon;

  const handleViewData = (e) => {
    e.stopPropagation();
    const sensorType = inferSensorType(alert);
    const zone = inferZone(alert, sensorType);
    navigate(`/sensors?zone=${zone}&sensor=${sensorType}`);
  };

  const isAnomaly = alert.source === "anomaly";
  const unit = alert.unit || "";
  const hasRange = alert.expected_min != null && alert.expected_max != null;

  return (
    <div
      className={`p-3 rounded-lg border ${style.bg} ${style.border} animate-slide-up cursor-pointer transition-all hover:brightness-110`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-3">
        <Icon size={16} className={`${style.text} mt-0.5 shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm ${style.text} font-medium`}>
              {alert.sensor_id || alert.message}
            </p>
            {alert.direction && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${style.badge} text-white`}>
                {alert.direction === "low" ? "Low" : alert.direction === "high" ? "High" : alert.severity}
              </span>
            )}
          </div>
          {alert.sensor_id && alert.message && (
            <p className="text-[11px] text-gray-400 mt-0.5">{alert.message}</p>
          )}
          {!expanded && (
            <p className="text-[10px] text-gray-500 mt-1">
              {formatMytDateTime(alert.timestamp)}
              {alert.zone_id && ` · ${alert.zone_id}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {expanded ? (
            <ChevronDown size={14} className="text-gray-500" />
          ) : (
            <ChevronRight size={14} className="text-gray-500" />
          )}
        </div>
      </div>

      {alert.suggestion && (
        <div className="mt-2 ml-7 flex items-start gap-2 p-2 rounded-md bg-white/[0.04] border border-white/5">
          <Sparkles size={11} className="text-amber-300 mt-0.5 shrink-0" />
          <p className="text-[11px] text-gray-300 leading-relaxed">
            {alert.suggestion}
          </p>
        </div>
      )}

      {expanded && (
        <div className="mt-2.5 ml-7 animate-slide-up">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-gray-500 mb-2">
            <span>{formatMytDateTime(alert.timestamp)}</span>
            {alert.zone_id && <span>Zone: {alert.zone_id}</span>}
            {alert.value != null && (
              <span>
                Value: {alert.value.toFixed(1)}
                {unit && ` ${unit}`}
              </span>
            )}
            {hasRange && (
              <span>
                Expected: {alert.expected_min}–{alert.expected_max}
                {unit && ` ${unit}`}
              </span>
            )}
            {alert.anomaly_score != null && (
              <span>z: {alert.anomaly_score.toFixed(2)}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleViewData}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md bg-gray-800/80 border border-gray-700/50 text-greenhouse-400 hover:bg-gray-700/80 transition-colors"
            >
              <BarChart3 size={12} />
              View Data
            </button>
            {!isAnomaly && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAcknowledge(alert.alert_id);
                }}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md bg-gray-800/80 border border-gray-700/50 text-gray-400 hover:text-gray-200 hover:bg-gray-700/80 transition-colors"
              >
                <Check size={12} />
                Acknowledge
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AlertPanel({ alerts = [], onRefresh }) {
  const handleAcknowledge = async (alertId) => {
    try {
      await api.acknowledgeAlert(alertId);
      onRefresh?.();
    } catch (err) {
      console.error("Failed to acknowledge alert:", err);
    }
  };

  if (alerts.length === 0) {
    return (
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6 text-center">
        <Check size={32} className="mx-auto text-greenhouse-400 mb-2" />
        <p className="text-gray-400 text-sm">All systems normal</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {alerts.map((alert) => (
        <AlertItem
          key={alert.alert_id}
          alert={alert}
          onAcknowledge={handleAcknowledge}
        />
      ))}
    </div>
  );
}
