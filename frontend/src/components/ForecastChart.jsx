import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { Zap, Brain, TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";
import {
  readingTimestampMs,
  formatMytTime,
  formatMytDateTime,
  generateMytTicks,
} from "../utils/analytics";

const TREND_META = {
  rising: { Icon: TrendingUp, color: "text-emerald-400", label: "Rising" },
  falling: { Icon: TrendingDown, color: "text-rose-400", label: "Falling" },
  flat: { Icon: Minus, color: "text-sky-400", label: "Stable" },
};

export default function ForecastChart({
  forecastData = null,
  history = [],
  title = "",
  accentColor = "#22c55e",
  height = 260,
  loading = false,
}) {
  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/70 to-slate-950/70 p-5 backdrop-blur-xl">
        <div className="h-4 w-40 rounded bg-white/5 mb-3 animate-pulse" />
        <div className="h-[240px] rounded-lg bg-white/[0.03] border border-white/5 animate-pulse" />
      </div>
    );
  }

  const hasForecast =
    forecastData && Array.isArray(forecastData.points) && forecastData.points.length > 0;
  const hasHistory = Array.isArray(history) && history.length > 0;

  // Empty but data-aware state
  if (!hasForecast && !hasHistory) {
    const reason = forecastData?.reason;
    const msg =
      reason === "no_data"
        ? "No sensor data in Firebase yet — waiting for first reading."
        : reason === "insufficient_history"
        ? `Only ${forecastData?.history_count ?? 0} point(s) collected — forecast starts at 3+.`
        : "No sensor data available for this channel.";
    return (
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-950/60 p-6 text-center backdrop-blur-xl">
        <Activity size={22} className="mx-auto text-slate-500 mb-2" />
        <p className="text-sm text-slate-400">{title}</p>
        <p className="text-xs text-slate-500 mt-1">{msg}</p>
      </div>
    );
  }

  // Merge history + forecast into one timeline (all timestamps in epoch-ms)
  const rowsByMs = new Map();

  for (const p of history || []) {
    const ms = readingTimestampMs(p.timestamp);
    if (!Number.isFinite(ms)) continue;
    const row = rowsByMs.get(ms) || { ms };
    row.actual = typeof p.value === "number" ? p.value : Number(p.value);
    rowsByMs.set(ms, row);
  }

  let lastActual = null;
  const sortedHistory = Array.from(rowsByMs.values()).sort((a, b) => a.ms - b.ms);
  if (sortedHistory.length > 0) lastActual = sortedHistory[sortedHistory.length - 1].actual;

  for (const p of (forecastData?.points || [])) {
    const ms = readingTimestampMs(p.timestamp || p.time);
    if (!Number.isFinite(ms)) continue;
    const row = rowsByMs.get(ms) || { ms };
    row.predicted = p.predicted_value ?? p.predicted;
    row.lower = p.lower_bound ?? p.lower;
    row.upper = p.upper_bound ?? p.upper;
    rowsByMs.set(ms, row);
  }

  const rows = Array.from(rowsByMs.values()).sort((a, b) => a.ms - b.ms);

  // Anchor forecast visually to the last actual
  if (lastActual != null && forecastData?.points?.length > 0) {
    const firstForecastIdx = rows.findIndex((r) => r.predicted != null);
    if (firstForecastIdx > 0) {
      rows[firstForecastIdx - 1].predicted = lastActual;
      rows[firstForecastIdx - 1].lower = lastActual;
      rows[firstForecastIdx - 1].upper = lastActual;
    }
  }

  const isGemini = forecastData?.powered_by === "google_gemini";
  const trend = TREND_META[forecastData?.trend] || TREND_META.flat;
  const TrendIcon = trend.Icon;
  const confidencePct = Math.round(((forecastData?.confidence ?? 0) * 100));

  // Reference line separating past from future (numeric ms on the X axis)
  const firstForecastMs = forecastData?.points?.[0]
    ? readingTimestampMs(forecastData.points[0].timestamp)
    : null;

  const startMs = rows[0]?.ms;
  const endMs = rows[rows.length - 1]?.ms;
  const ticks = generateMytTicks(startMs, endMs, 5);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/70 to-slate-950/80 p-5 backdrop-blur-xl transition-all hover:border-white/20 hover:shadow-lg hover:shadow-emerald-500/5">
      <div
        className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full blur-3xl opacity-30"
        style={{ background: accentColor }}
      />

      <div className="flex items-start justify-between mb-3 gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">
            {title || `Forecast — ${forecastData?.sensor_type} (${forecastData?.zone_id})`}
          </h3>
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
            <span className={`inline-flex items-center gap-1 ${trend.color}`}>
              <TrendIcon size={12} />
              {trend.label}
            </span>
            <span>•</span>
            <span>Model: <span className="text-slate-300">{forecastData?.model_name || "—"}</span></span>
            <span>•</span>
            <span>Confidence: <span className="text-slate-300">{confidencePct}%</span></span>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-medium ${
            isGemini
              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
              : "bg-slate-800/80 text-slate-300 border border-slate-700"
          }`}
        >
          <Zap size={10} />
          {isGemini ? "Gemini" : "Local ML"}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={rows}>
          <defs>
            <linearGradient id={`band-${accentColor}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accentColor} stopOpacity={0.35} />
              <stop offset="100%" stopColor={accentColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            dataKey="ms"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            ticks={ticks.length > 0 ? ticks : undefined}
            tickFormatter={formatMytTime}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            stroke="#334155"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            stroke="#334155"
            domain={["auto", "auto"]}
          />
          <Tooltip
            labelFormatter={formatMytDateTime}
            contentStyle={{
              backgroundColor: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "10px",
              fontSize: 12,
              boxShadow: "0 10px 30px -10px rgba(0,0,0,.5)",
            }}
            labelStyle={{ color: "#cbd5e1" }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />

          {/* Confidence band */}
          <Area
            type="monotone"
            dataKey="upper"
            stroke="none"
            fill={`url(#band-${accentColor})`}
            name="Upper bound"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="lower"
            stroke="none"
            fill="#0f172a"
            name="Lower bound"
            isAnimationActive={false}
          />

          {/* Actual history */}
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#60a5fa"
            strokeWidth={2.2}
            dot={false}
            name="Actual"
            isAnimationActive={false}
          />

          {/* Forecast */}
          <Line
            type="monotone"
            dataKey="predicted"
            stroke={accentColor}
            strokeWidth={2.2}
            strokeDasharray="5 4"
            dot={false}
            name="Forecast"
            isAnimationActive={false}
          />

          {Number.isFinite(firstForecastMs) && (
            <ReferenceLine
              x={firstForecastMs}
              stroke="#64748b"
              strokeDasharray="2 3"
              label={{
                value: "now",
                fill: "#94a3b8",
                fontSize: 10,
                position: "top",
              }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {forecastData?.ai_analysis && (
        <div className="mt-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Brain size={12} className="text-emerald-400" />
            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
              Gemini Analysis
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
            {forecastData.ai_analysis}
          </p>
        </div>
      )}
    </div>
  );
}
