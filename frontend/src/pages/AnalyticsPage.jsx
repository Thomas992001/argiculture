import { useMemo, useState } from "react";
import {
  Brain,
  ShieldAlert,
  TrendingUp,
  Zap,
  Thermometer,
  Droplets,
  Beaker,
  Sun,
  Gauge,
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
  WifiOff,
  Sparkles,
  Activity,
} from "lucide-react";
import ForecastChart from "../components/ForecastChart";
import { useRTDBForecast } from "../hooks/useRTDBForecast";
import { useAlerts } from "../contexts/AlertsProvider";

// ─── Sensor catalogue for the Analytics page ─────────────────────────────

const SENSOR_TYPE_STYLES = {
  humidity:          { icon: Droplets,    accent: "#60a5fa", color: "text-sky-300",     chip: "bg-sky-500/10 border-sky-500/30",      label: "Air Humidity" },
  temperature:       { icon: Thermometer, accent: "#f87171", color: "text-rose-300",    chip: "bg-rose-500/10 border-rose-500/30",    label: "Air Temperature" },
  light:             { icon: Sun,         accent: "#fbbf24", color: "text-amber-300",   chip: "bg-amber-500/10 border-amber-500/30",  label: "Light" },
  light_intensity:   { icon: Sun,         accent: "#fbbf24", color: "text-amber-300",   chip: "bg-amber-500/10 border-amber-500/30",  label: "Light" },
  soil_temperature:  { icon: Thermometer, accent: "#fb923c", color: "text-orange-300",  chip: "bg-orange-500/10 border-orange-500/30", label: "Soil Temp" },
  soil_ph:           { icon: Beaker,      accent: "#4ade80", color: "text-emerald-300", chip: "bg-emerald-500/10 border-emerald-500/30", label: "Soil pH" },
  soil_moisture:     { icon: Droplets,    accent: "#22d3ee", color: "text-cyan-300",    chip: "bg-cyan-500/10 border-cyan-500/30",    label: "Soil Moisture" },
};

function sensorStyle(t) {
  const key = t === "light_intensity" ? "light" : t;
  return (
    SENSOR_TYPE_STYLES[key] || {
      icon: Gauge,
      accent: "#94a3b8",
      color: "text-slate-300",
      chip: "bg-slate-700/30 border-slate-600/40",
      label: t,
    }
  );
}

const BED_ZONES = [
  { zone: "zone_bed_a", label: "Substrate A", short: "Bed A", dot: "#22c55e" },
  { zone: "zone_bed_b", label: "Substrate B", short: "Bed B", dot: "#3b82f6" },
  { zone: "zone_bed_c", label: "Substrate C", short: "Bed C", dot: "#f59e0b" },
];

const ZONE_SHORT = {
  zone_air: "Air",
  zone_bed_a: "Bed A",
  zone_bed_b: "Bed B",
  zone_bed_c: "Bed C",
};

const FORECAST_TABS = [
  // Soil tabs render 3 charts (A/B/C)
  { key: "soil_moisture",    label: "Soil Moisture",    group: "soil" },
  { key: "soil_temperature", label: "Soil Temperature", group: "soil" },
  { key: "soil_ph",          label: "Soil pH",          group: "soil" },
  // Air tabs render 1 chart
  { key: "humidity",         label: "Air Humidity",     group: "air", zone: "zone_air" },
  { key: "temperature",      label: "Air Temperature",  group: "air", zone: "zone_air" },
  { key: "light",            label: "Light",            group: "air", zone: "zone_air" },
];

// ─── Small UI atoms ──────────────────────────────────────────────────────

function StatusBadge({ count, tone, icon: Icon, label }) {
  const tones = {
    critical: "bg-rose-500/10 border-rose-500/30 text-rose-300",
    warning:  "bg-amber-500/10 border-amber-500/30 text-amber-300",
    normal:   "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    offline:  "bg-slate-500/10 border-slate-500/30 text-slate-300",
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs ${tones[tone]}`}>
      <Icon size={12} />
      <span className="font-semibold">{count}</span>
      <span className="opacity-80">{label}</span>
    </div>
  );
}

function AnomalyCard({ anomaly, emphasis = false }) {
  const style = sensorStyle(anomaly.sensor_type);
  const Icon = style.icon;

  const severityMeta = {
    critical: { label: "CRITICAL", badge: "bg-rose-500 text-white", glow: "shadow-rose-500/20" },
    warning:  { label: "WARNING",  badge: "bg-amber-500 text-white", glow: "shadow-amber-500/20" },
    offline:  { label: "OFFLINE",  badge: "bg-slate-500 text-white", glow: "shadow-slate-500/10" },
    normal:   { label: "NORMAL",   badge: "bg-emerald-500 text-white", glow: "shadow-emerald-500/10" },
  }[anomaly.severity] || { label: anomaly.severity, badge: "bg-slate-500 text-white", glow: "" };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${style.chip} p-4 backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${severityMeta.glow} ${
        emphasis ? "ring-1 ring-white/5" : ""
      }`}
    >
      <div
        className="pointer-events-none absolute -top-12 -right-12 h-28 w-28 rounded-full opacity-20 blur-3xl"
        style={{ background: style.accent }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`p-2 rounded-xl border ${style.chip}`}>
            <Icon size={16} className={style.color} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-sm font-semibold ${style.color} truncate`}>
                {anomaly.sensor_id}
              </p>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${severityMeta.badge}`}>
                {severityMeta.label}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {style.label} · {ZONE_SHORT[anomaly.zone_id] || anomaly.zone_id}
            </p>
            {anomaly.description && (
              <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">
                {anomaly.description}
              </p>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-lg font-bold ${style.color} leading-none`}>
            {anomaly.current_value != null ? anomaly.current_value.toFixed(2) : "—"}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">
            {anomaly.unit}
          </p>
          {anomaly.expected_min != null && (
            <p className="text-[10px] text-slate-500 mt-1">
              ok: {anomaly.expected_min}–{anomaly.expected_max}
            </p>
          )}
          {anomaly.anomaly_score != null && anomaly.anomaly_score > 0 && (
            <p className="text-[10px] text-slate-500 mt-0.5">
              z: {anomaly.anomaly_score.toFixed(2)}
            </p>
          )}
        </div>
      </div>

      {anomaly.suggestion && (
        <div className="relative mt-3 flex gap-2 items-start p-2.5 rounded-lg bg-white/[0.04] border border-white/5">
          <Sparkles size={12} className="text-amber-300 mt-0.5 shrink-0" />
          <p className="text-[11px] text-slate-300 leading-relaxed">
            {anomaly.suggestion}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Forecast sections ───────────────────────────────────────────────────

function SoilForecastCard({ zoneId, sensorType, label, accent }) {
  const { forecast, history, loading } = useRTDBForecast(zoneId, sensorType, {
    historyMinutes: 180,
    horizonMinutes: 30,
    stepMinutes: 2,
  });
  return (
    <ForecastChart
      forecastData={forecast}
      history={history}
      loading={loading}
      title={label}
      accentColor={accent}
      height={240}
    />
  );
}

function AirForecastCard({ sensorType, label, accent }) {
  const { forecast, history, loading } = useRTDBForecast("zone_air", sensorType, {
    historyMinutes: 180,
    horizonMinutes: 30,
    stepMinutes: 2,
  });
  return (
    <ForecastChart
      forecastData={forecast}
      history={history}
      loading={loading}
      title={label}
      accentColor={accent}
      height={260}
    />
  );
}

// ─── Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [tabKey, setTabKey] = useState("soil_moisture");

  const tab = useMemo(
    () => FORECAST_TABS.find((t) => t.key === tabKey) || FORECAST_TABS[0],
    [tabKey]
  );
  const style = sensorStyle(tab.key);

  const { anomalyState } = useAlerts();
  const { critical, warnings, normal, offline, loading: anomalyLoading } = anomalyState;

  const detectedSorted = [...critical, ...warnings];
  const noIssues =
    !anomalyLoading &&
    critical.length === 0 &&
    warnings.length === 0 &&
    normal.length + offline.length > 0;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/70 via-slate-900/50 to-slate-950/70 p-6 backdrop-blur-xl">
        <div className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="relative flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              AI Analytics
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-xl">
              Real-time forecasting & anomaly detection across all substrate beds
              and greenhouse air sensors — powered directly by your Firebase RTDB
              history.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-800/70 border border-slate-700">
              <Activity size={10} className="text-emerald-400" />
              Live RTDB
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-800/70 border border-slate-700">
              <Zap size={10} className="text-amber-400" />
              Local ML
            </span>
          </div>
        </div>
      </div>

      {/* Forecast section */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
            <TrendingUp size={16} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Forecasting</h3>
            <p className="text-xs text-slate-500">
              Next 30 minutes · history-driven linear / moving-average model
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {FORECAST_TABS.map((t) => {
            const selected = t.key === tabKey;
            const s = sensorStyle(t.key);
            const Icon = s.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTabKey(t.key)}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  selected
                    ? `${s.chip} ${s.color} shadow-md`
                    : "bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <Icon size={12} className={selected ? s.color : "text-slate-500 group-hover:text-slate-300"} />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab.group === "soil" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {BED_ZONES.map((bed) => (
              <SoilForecastCard
                key={bed.zone}
                zoneId={bed.zone}
                sensorType={tab.key}
                label={`${style.label} — ${bed.label}`}
                accent={style.accent}
              />
            ))}
          </div>
        ) : (
          <AirForecastCard
            sensorType={tab.key}
            label={`${style.label} — Greenhouse Air`}
            accent={style.accent}
          />
        )}
      </section>

      {/* Anomaly section */}
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/25">
              <ShieldAlert size={16} className="text-rose-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100">
                Anomaly Detection
              </h3>
              <p className="text-xs text-slate-500">
                Z-score + agronomic threshold rules · {normal.length + critical.length + warnings.length} sensors monitored
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge count={critical.length} tone="critical" icon={AlertOctagon} label="Critical" />
            <StatusBadge count={warnings.length} tone="warning" icon={AlertTriangle} label="Warning" />
            <StatusBadge count={normal.length} tone="normal" icon={CheckCircle} label="Normal" />
            {offline.length > 0 && (
              <StatusBadge count={offline.length} tone="offline" icon={WifiOff} label="Offline" />
            )}
          </div>
        </div>

        {/* Skeleton while subscribing */}
        {anomalyLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-28 rounded-2xl border border-white/5 bg-white/[0.03] animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Empty / all good state */}
        {noIssues && (
          <div className="flex items-center gap-3 p-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] backdrop-blur-xl">
            <CheckCircle size={22} className="text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-300">All sensors normal</p>
              <p className="text-xs text-slate-400">
                No anomalies detected across {normal.length} active sensor{normal.length === 1 ? "" : "s"}.
              </p>
            </div>
          </div>
        )}

        {/* Detected anomalies */}
        {detectedSorted.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium">
              <AlertOctagon size={12} className="text-rose-400" />
              <span className="text-rose-300">Attention needed</span>
              <span className="text-slate-500">({detectedSorted.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {detectedSorted.map((a) => (
                <AnomalyCard
                  key={`${a.zone_id}:${a.sensor_id}`}
                  anomaly={a}
                  emphasis
                />
              ))}
            </div>
          </div>
        )}

        {/* Normal sensors — compact grid */}
        {normal.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium">
              <CheckCircle size={12} className="text-emerald-400" />
              <span className="text-emerald-300">Within healthy range</span>
              <span className="text-slate-500">({normal.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {normal.map((a) => (
                <AnomalyCard key={`${a.zone_id}:${a.sensor_id}`} anomaly={a} />
              ))}
            </div>
          </div>
        )}

        {/* Offline sensors */}
        {offline.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium">
              <WifiOff size={12} className="text-slate-400" />
              <span className="text-slate-300">No data yet</span>
              <span className="text-slate-500">({offline.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {offline.map((a) => (
                <AnomalyCard key={`${a.zone_id}:${a.sensor_id}`} anomaly={a} />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Footer hint */}
      <div className="flex items-center gap-2 text-[11px] text-slate-500">
        <Brain size={12} />
        <span>
          All predictions and anomaly suggestions are generated locally from
          live Firebase data — no backend required.
        </span>
      </div>
    </div>
  );
}
