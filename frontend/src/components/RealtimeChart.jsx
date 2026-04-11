import { useState, useEffect, useRef } from "react";
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
} from "recharts";

const COLORS = {
  temperature: "#f87171",
  humidity: "#60a5fa",
  co2: "#a78bfa",
  light_intensity: "#facc15",
  soil_moisture: "#22d3ee",
  ec: "#fb923c",
  ph: "#4ade80",
  water_temperature: "#2dd4bf",
  water_level: "#818cf8",
};

export default function RealtimeChart({
  data = [],
  sensorType = "temperature",
  height = 200,
  showArea = true,
  title = "",
}) {
  const color = COLORS[sensorType] || "#9ca3af";

  const chartData = data.map((point) => ({
    time: new Date(point.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    value: point.value,
  }));

  const Chart = showArea ? AreaChart : LineChart;
  const DataElement = showArea ? Area : Line;

  return (
    <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
      {title && (
        <h3 className="text-sm font-medium text-gray-400 mb-3">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <Chart data={chartData}>
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
          {showArea ? (
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
          ) : (
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          )}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}
