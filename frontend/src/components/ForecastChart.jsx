import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Zap, Brain } from "lucide-react";

export default function ForecastChart({
  forecastData = null,
  height = 250,
}) {
  if (!forecastData || !forecastData.points || forecastData.points.length === 0) {
    return (
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6 text-center">
        <p className="text-gray-500 text-sm">
          Collecting data for forecast...
        </p>
      </div>
    );
  }

  const chartData = forecastData.points.map((p) => {
    const ts = p.timestamp || p.time;
    return {
      time: new Date(ts).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      predicted: p.predicted_value ?? p.predicted,
      lower: p.lower_bound ?? p.lower,
      upper: p.upper_bound ?? p.upper,
    };
  });

  const isGemini = forecastData.powered_by === "google_gemini";

  return (
    <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-400">
          Forecast — {forecastData.sensor_type} ({forecastData.zone_id})
        </h3>
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <span className="px-1.5 py-0.5 rounded bg-gray-800">
            Model: {forecastData.model_name}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-gray-800">
            Confidence: {((forecastData.confidence || 0) * 100).toFixed(0)}%
          </span>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${
            isGemini
              ? "bg-greenhouse-500/15 text-greenhouse-400 border border-greenhouse-500/30"
              : "bg-gray-800 text-gray-500"
          }`}>
            <Zap size={8} />
            {isGemini ? "Gemini" : "Local"}
          </span>
        </div>
      </div>
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
          />
          <Area
            type="monotone"
            dataKey="upper"
            stroke="none"
            fill="#22c55e"
            fillOpacity={0.05}
          />
          <Area
            type="monotone"
            dataKey="lower"
            stroke="none"
            fill="#22c55e"
            fillOpacity={0.05}
          />
          <Area
            type="monotone"
            dataKey="predicted"
            stroke="#22c55e"
            fill="#22c55e"
            fillOpacity={0.15}
            strokeWidth={2}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      {forecastData.ai_analysis && (
        <div className="mt-3 p-3 rounded-lg bg-greenhouse-500/5 border border-greenhouse-500/20">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Brain size={12} className="text-greenhouse-400" />
            <span className="text-[10px] font-semibold text-greenhouse-400 uppercase tracking-wider">
              Gemini Analysis
            </span>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-line">
            {forecastData.ai_analysis}
          </p>
        </div>
      )}
    </div>
  );
}
