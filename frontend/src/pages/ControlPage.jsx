import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";
import ControlPanel from "../components/ControlPanel";
import AlertPanel from "../components/AlertPanel";

export default function ControlPage() {
  const [actuators, setActuators] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const [acts, alertsData] = await Promise.all([
        api.getActuators(),
        api.getAlerts(),
      ]);
      setActuators(acts);
      setAlerts(alertsData);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Actuator Control</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manual control of pumps, fans, valves, and other actuators
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h3 className="text-sm font-medium text-gray-400 mb-3">
            Actuators
          </h3>
          <ControlPanel actuators={actuators} onRefresh={fetchData} />
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-3">Alerts</h3>
          <AlertPanel alerts={alerts} onRefresh={fetchData} />
        </div>
      </div>
    </div>
  );
}
