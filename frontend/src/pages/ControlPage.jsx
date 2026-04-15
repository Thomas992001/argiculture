import { useState, useEffect, useMemo } from "react";
import { api } from "../api/client";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase";
import { onSnapshot, doc } from "firebase/firestore";
import ControlPanel from "../components/ControlPanel";
import AlertPanel from "../components/AlertPanel";

// Static actuator metadata — matches backend twin_state.py
// Spec: 3x water pumps (per bed) + 2x water pump cables (shared drivers)
const ACTUATOR_DEFS = [
  { actuator_id: "pump_main", name: "Main Water Pump Cable", type: "pump", zone_id: "zone_air" },
  { actuator_id: "pump_nutrient", name: "Nutrient Pump Cable", type: "pump", zone_id: "zone_air" },
  { actuator_id: "pump_a", name: "Water Pump A", type: "pump", zone_id: "zone_bed_a" },
  { actuator_id: "pump_b", name: "Water Pump B", type: "pump", zone_id: "zone_bed_b" },
  { actuator_id: "pump_c", name: "Water Pump C", type: "pump", zone_id: "zone_bed_c" },
];

export default function ControlPage() {
  const [cloudStates, setCloudStates] = useState({});
  const [alerts, setAlerts] = useState([]);

  const fetchAlerts = async () => {
    try {
      const alertsData = await api.getAlerts();
      setAlerts(alertsData);
    } catch { }
  };

  // Merge static metadata with real-time Firestore states
  const mergedActuators = useMemo(() => {
    return ACTUATOR_DEFS.map(act => ({
      ...act,
      state: (act.actuator_id in cloudStates)
        ? (cloudStates[act.actuator_id] ? "on" : "off")
        : "off",
    }));
  }, [cloudStates]);

  // Fetch alerts once (optional, will fail silently if backend is down)
  useEffect(() => {
    fetchAlerts();
  }, []);

  // Listen to Firestore for real-time switch states
  useEffect(() => {
    let unsubscribeSnapshot = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // Clean up previous listener if it exists
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (!user) return;

      console.log("DEBUG: Starting Firestore listener for UID:", user.uid);
      const controlRef = doc(db, "users", user.uid, "control", "latest");

      unsubscribeSnapshot = onSnapshot(controlRef, (snapshot) => {
        const data = snapshot.data();
        if (data) {
          console.log("DEBUG: Received Control Snapshot:", data);
          setCloudStates(data);
        }
      }, (error) => {
        console.error("Firestore listener error:", error);
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

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
          <ControlPanel actuators={mergedActuators} onRefresh={fetchAlerts} />
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-3">Alerts</h3>
          <AlertPanel alerts={alerts} onRefresh={fetchAlerts} />
        </div>
      </div>
    </div>
  );
}

