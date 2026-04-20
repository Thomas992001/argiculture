import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  Legend,
} from "recharts";
import {
  readingTimestampMs,
  formatMytTime,
  formatMytDateTime,
  generateMytTicks,
} from "../utils/analytics";

const COLORS = {
  humidity: "#60a5fa",
  temperature: "#f87171",
  light: "#facc15",
  light_intensity: "#facc15",
  soil_temperature: "#fb923c",
  soil_ph: "#4ade80",
  soil_moisture: "#22d3ee",
};

function tooltipLabelFormatter(ms) {
  return formatMytDateTime(ms);
}

export default function RealtimeChart({
  data = [],
  series = null,
  sensorType = "humidity",
  height = 200,
  showArea = true,
  title = "",
}) {
  const color = COLORS[sensorType] || "#9ca3af";

  // ─── Multi-series mode (e.g. Substrate A / B / C) ──────────────────────
  if (series && series.length > 0) {
    const byMs = new Map();
    for (const s of series) {
      for (const point of s.data || []) {
        const ms = readingTimestampMs(point.timestamp);
        if (!Number.isFinite(ms)) continue;
        const row = byMs.get(ms) || { ms };
        row[s.label] = typeof point.value === "number" ? point.value : Number(point.value);
        byMs.set(ms, row);
      }
    }
    const mergedData = Array.from(byMs.values()).sort((a, b) => a.ms - b.ms);

    const startMs = mergedData[0]?.ms;
    const endMs = mergedData[mergedData.length - 1]?.ms;
    const ticks = generateMytTicks(startMs, endMs, 5);

    return (
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
        {title && (
          <h3 className="text-sm font-medium text-gray-400 mb-3">{title}</h3>
        )}
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={mergedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="ms"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              ticks={ticks.length > 0 ? ticks : undefined}
              tickFormatter={formatMytTime}
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              stroke="#4b5563"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              stroke="#4b5563"
              domain={["auto", "auto"]}
            />
            <Tooltip
              labelFormatter={tooltipLabelFormatter}
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
                fontSize: 12,
              }}
              labelStyle={{ color: "#9ca3af" }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "#9ca3af" }}
            />
            {series.map((s) => (
              <Line
                key={s.label}
                type="monotone"
                dataKey={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ─── Single-series mode ────────────────────────────────────────────────
  const rawChartData = (data || [])
    .map((point) => {
      const ms = readingTimestampMs(point.timestamp);
      const value =
        typeof point.value === "number" ? point.value : Number(point.value);
      if (!Number.isFinite(ms) || !Number.isFinite(value)) return null;
      return { ms, value };
    })
    .filter(Boolean)
    .sort((a, b) => a.ms - b.ms);

  const chartData = [];
  const seenMs = new Set();
  for (const pt of rawChartData) {
    if (!seenMs.has(pt.ms)) {
      seenMs.add(pt.ms);
      chartData.push(pt);
    }
  }

  const startMs = chartData[0]?.ms;
  const endMs = chartData[chartData.length - 1]?.ms;
  const ticks = generateMytTicks(startMs, endMs, 5);

  return (
    <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
      {title && (
        <h3 className="text-sm font-medium text-gray-400 mb-3">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="ms"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            ticks={ticks.length > 0 ? ticks : undefined}
            tickFormatter={formatMytTime}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            stroke="#4b5563"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            stroke="#4b5563"
            domain={["auto", "auto"]}
          />
          <Tooltip
            labelFormatter={tooltipLabelFormatter}
            contentStyle={{
              backgroundColor: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "8px",
              fontSize: 12,
            }}
            labelStyle={{ color: "#9ca3af" }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={showArea ? 0.1 : 0}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
