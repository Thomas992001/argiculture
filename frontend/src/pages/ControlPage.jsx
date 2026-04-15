import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../api/client";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase";
import { onSnapshot, doc } from "firebase/firestore";
import ControlPanel from "../components/ControlPanel";
import AlertPanel from "../components/AlertPanel";

export default function ControlPage() {
  const [actuators, setActuators] = useState([]);
  const [cloudStates, setCloudStates] = useState({});
  const [alerts, setAlerts] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const [acts, alertsData] = await Promise.all([
        api.getActuators(),
        api.getAlerts(),
      ]);
      setActuators(acts);
      setAlerts(alertsData);
    } catch (err) { }
  }, []);

  // Merge metadata from API with real-time states from Firestore
  const mergedActuators = useMemo(() => {
    return actuators.map(act => {
      if (act.actuator_id in cloudStates) {
        return {
          ...act,
          state: cloudStates[act.actuator_id] ? "on" : "off"
        };
      }
      return act;
    });
  }, [actuators, cloudStates]);

  // Fetch base metadata once
  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
          <ControlPanel actuators={mergedActuators} onRefresh={fetchData} />
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-3">Alerts</h3>
          <AlertPanel alerts={alerts} onRefresh={fetchData} />
        </div>
      </div>
    </div>
  );
}
