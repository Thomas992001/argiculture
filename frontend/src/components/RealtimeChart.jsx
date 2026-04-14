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

const COLORS = {
  temperature: "#f87171",
  humidity: "#60a5fa",
  light_intensity: "#facc15",
  soil_temperature: "#fb923c",
  soil_ph: "#4ade80",
  soil_moisture: "#22d3ee",
};

export default function RealtimeChart({
  data = [],
  series = null,
  sensorType = "temperature",
  height = 200,
  showArea = true,
  title = "",
}) {
  const color = COLORS[sensorType] || "#9ca3af";

  if (series && series.length > 0) {
    const timeMap = {};
    for (const s of series) {
      for (const point of s.data) {
        const time = new Date(point.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        if (!timeMap[time]) timeMap[time] = { time };
        timeMap[time][s.label] = point.value;
      }
    }
    const mergedData = Object.values(timeMap).sort((a, b) =>
      a.time.localeCompare(b.time)
    );

    return (
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
        {title && (
          <h3 className="text-sm font-medium text-gray-400 mb-3">{title}</h3>
        )}
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={mergedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              stroke="#4b5563"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              stroke="#4b5563"
              domain={["auto", "auto"]}
            />
            <Tooltip
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
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const chartData = data.map((point) => ({
    time: new Date(point.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    value: point.value,
  }));

  return (
    <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
      {title && (
        <h3 className="text-sm font-medium text-gray-400 mb-3">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            stroke="#4b5563"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            stroke="#4b5563"
            domain={["auto", "auto"]}
          />
          <Tooltip
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
            fillOpacity={0.1}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
