import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";
import { useWebSocket } from "../hooks/useWebSocket";
import VirtualGreenhouse from "../components/VirtualGreenhouse";
import SensorCard from "../components/SensorCard";

export default function GreenhousePage() {
  const [sensorData, setSensorData] = useState({});
  const [actuatorStates, setActuatorStates] = useState({});
  const { lastMessage } = useWebSocket();

  const fetchData = useCallback(async () => {
    try {
      const [latest, actuators] = await Promise.all([
        api.getLatestReadings(),
        api.getActuators(),
      ]);
      setSensorData(latest);
      const states = {};
      for (const act of actuators) {
        states[act.actuator_id] = act.state;
      }
      setActuatorStates(states);
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
    if (lastMessage?.type === "sensor_update") {
      const updated = { ...sensorData };
      for (const r of lastMessage.readings) {
        updated[`${r.zone_id}:${r.sensor_type}`] = r;
      }
      setSensorData(updated);
    }
  }, [lastMessage]);

  const keyReadings = [
    { key: "zone_air:temperature", type: "temperature" },
    { key: "zone_air:humidity", type: "humidity" },
    { key: "zone_air:co2", type: "co2" },
    { key: "zone_bed:soil_moisture", type: "soil_moisture" },
    { key: "zone_nft:ph", type: "ph" },
    { key: "zone_reservoir:water_level", type: "water_level" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">3D Virtual Greenhouse</h2>
        <p className="text-sm text-gray-500 mt-1">
          Interactive digital twin visualization — drag to rotate, scroll to
          zoom
        </p>
      </div>

      <VirtualGreenhouse
        sensorData={sensorData}
        actuatorStates={actuatorStates}
        height="500px"
      />

      {/* Key readings overlay */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {keyReadings.map(({ key, type }) => {
          const reading = sensorData[key];
          return (
            <SensorCard
              key={key}
              sensorType={type}
              value={reading?.value}
              quality={reading?.quality}
            />
          );
        })}
      </div>
    </div>
  );
}
