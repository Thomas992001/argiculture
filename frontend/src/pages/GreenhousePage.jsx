import { useState, useEffect, useCallback } from "react";
import { Thermometer, Droplets, Sun, ArrowLeft } from "lucide-react";
import { api } from "../api/client";
import { useRTDBData } from "../hooks/useRTDBData";
import VirtualGreenhouse from "../components/VirtualGreenhouse";
import SensorCard from "../components/SensorCard";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

const BED_META = {
  zone_bed_a: { label: "Substrate Bed A", color: "#22c55e" },
  zone_bed_b: { label: "Substrate Bed B", color: "#3b82f6" },
  zone_bed_c: { label: "Substrate Bed C", color: "#f59e0b" },
};

export default function GreenhousePage() {
  const [sensorData, setSensorData] = useState({});
  const [selectedBed, setSelectedBed] = useState(null);
  const { data: rtdbData } = useRTDBData();

  const fetchData = useCallback(async () => {
    try {
      const latest = await api.getLatestReadings();
      setSensorData(latest);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (rtdbData && Object.keys(rtdbData).length > 0) {
      setSensorData((prev) => ({ ...prev, ...rtdbData }));
    }
  }, [rtdbData]);

  const temp = sensorData["zone_air:temperature"]?.value;
  const humidity = sensorData["zone_air:humidity"]?.value;
  const light = sensorData["zone_air:light_intensity"]?.value;

  const handleBedSelect = (bedId) => {
    setSelectedBed((prev) => (prev === bedId ? null : bedId));
  };

  const bed = selectedBed ? BED_META[selectedBed] : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">3D Virtual Greenhouse</h2>
        <p className="text-sm text-gray-500 mt-1">
          Click a substrate bed to inspect its sensor data
        </p>
      </div>

      {/* Always-visible greenhouse conditions */}
      <div className="grid grid-cols-3 gap-3">
        <LiveCard
          icon={Thermometer}
          label="Room Temperature"
          value={temp}
          unit="°C"
          color="text-red-400"
          bg="bg-red-400/10"
          border="border-red-400/20"
        />
        <LiveCard
          icon={Droplets}
          label="Humidity"
          value={humidity}
          unit="%"
          color="text-blue-400"
          bg="bg-blue-400/10"
          border="border-blue-400/20"
        />
        <LiveCard
          icon={Sun}
          label="Light"
          value={light}
          unit="lux"
          color="text-yellow-400"
          bg="bg-yellow-400/10"
          border="border-yellow-400/20"
          decimals={0}
        />
      </div>

      {/* 3D scene */}
      <VirtualGreenhouse
        sensorData={sensorData}
        selectedBed={selectedBed}
        onBedSelect={handleBedSelect}
        height="480px"
      />

      {/* Selected bed detail panel */}
      {selectedBed && bed ? (
        <div className="space-y-3 animate-slide-up">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: bed.color }}
              />
              {bed.label}
            </h3>
            <button
              onClick={() => setSelectedBed(null)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 hover:border-gray-600"
            >
              <ArrowLeft size={12} />
              Back to overview
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <SensorCard
              sensorType="soil_temperature"
              value={sensorData[`${selectedBed}:soil_temperature`]?.value}
              quality={sensorData[`${selectedBed}:soil_temperature`]?.quality}
            />
            <SensorCard
              sensorType="soil_ph"
              value={sensorData[`${selectedBed}:soil_ph`]?.value}
              quality={sensorData[`${selectedBed}:soil_ph`]?.quality}
            />
            <SensorCard
              sensorType="soil_moisture"
              value={sensorData[`${selectedBed}:soil_moisture`]?.value}
              quality={sensorData[`${selectedBed}:soil_moisture`]?.quality}
            />
          </div>
        </div>
      ) : (
        <p className="text-center text-sm text-gray-500 py-3">
          Click a substrate bed in the greenhouse to view its sensor data
        </p>
      )}
    </div>
  );
}

function LiveCard({ icon: Icon, label, value, unit, color, bg, border, decimals = 1 }) {
  const display =
    value != null ? (decimals === 0 ? Math.round(value) : value.toFixed(decimals)) : "--";

  return (
    <div className={`${bg} rounded-xl p-3 border ${border}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className={color} />
        <span className="text-[11px] text-gray-400">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-lg font-bold ${color}`}>{display}</span>
        <span className="text-[10px] text-gray-500">{unit}</span>
      </div>
    </div>
  );
}


