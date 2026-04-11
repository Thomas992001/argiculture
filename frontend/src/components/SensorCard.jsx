import {
  Thermometer,
  Droplets,
  Wind,
  Sun,
  Waves,
  Gauge,
  Beaker,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

const SENSOR_CONFIG = {
  temperature: {
    icon: Thermometer,
    color: "text-red-400",
    bg: "bg-red-400/10",
    border: "border-red-400/20",
    unit: "°C",
    label: "Temperature",
  },
  humidity: {
    icon: Droplets,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/20",
    unit: "%",
    label: "Humidity",
  },
  co2: {
    icon: Wind,
    color: "text-purple-400",
    bg: "bg-purple-400/10",
    border: "border-purple-400/20",
    unit: "ppm",
    label: "CO₂",
  },
  light_intensity: {
    icon: Sun,
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/20",
    unit: "lux",
    label: "Light",
  },
  soil_moisture: {
    icon: Droplets,
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
    border: "border-cyan-400/20",
    unit: "%",
    label: "Soil Moisture",
  },
  ec: {
    icon: Gauge,
    color: "text-orange-400",
    bg: "bg-orange-400/10",
    border: "border-orange-400/20",
    unit: "mS/cm",
    label: "EC",
  },
  ph: {
    icon: Beaker,
    color: "text-green-400",
    bg: "bg-green-400/10",
    border: "border-green-400/20",
    unit: "pH",
    label: "pH",
  },
  water_temperature: {
    icon: Thermometer,
    color: "text-teal-400",
    bg: "bg-teal-400/10",
    border: "border-teal-400/20",
    unit: "°C",
    label: "Water Temp",
  },
  water_level: {
    icon: Waves,
    color: "text-indigo-400",
    bg: "bg-indigo-400/10",
    border: "border-indigo-400/20",
    unit: "cm",
    label: "Water Level",
  },
};

export default function SensorCard({ sensorType, value, prevValue, quality }) {
  const config = SENSOR_CONFIG[sensorType] || {
    icon: Gauge,
    color: "text-gray-400",
    bg: "bg-gray-400/10",
    border: "border-gray-400/20",
    unit: "",
    label: sensorType,
  };

  const Icon = config.icon;
  const trend = prevValue != null ? value - prevValue : 0;
  const isLowQuality = quality != null && quality < 0.5;

  return (
    <div
      className={`rounded-xl border ${config.border} ${config.bg} p-4 animate-slide-up transition-all hover:scale-[1.02]`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={18} className={config.color} />
          <span className="text-sm text-gray-400">{config.label}</span>
        </div>
        {isLowQuality && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
            LOW QUALITY
          </span>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <span className={`text-2xl font-bold ${config.color}`}>
            {typeof value === "number" ? value.toFixed(1) : "--"}
          </span>
          <span className="text-sm text-gray-500 ml-1">{config.unit}</span>
        </div>

        {trend !== 0 && (
          <div
            className={`flex items-center gap-0.5 text-xs ${
              trend > 0 ? "text-red-400" : "text-blue-400"
            }`}
          >
            {trend > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            {Math.abs(trend).toFixed(1)}
          </div>
        )}
      </div>
    </div>
  );
}
