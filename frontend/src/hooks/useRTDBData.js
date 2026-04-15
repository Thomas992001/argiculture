import { useState, useEffect } from "react";
import { rtdb, auth } from "../firebase";
import { ref, onValue, off } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";

/**
 * Custom hook to listen for real-time sensor updates from Firebase RTDB.
 * Returns the latest readings for the currently logged-in user.
 */
export function useRTDBData() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let sensorRef = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // Clean up previous listener
      if (sensorRef) {
        off(sensorRef);
        sensorRef = null;
      }

      if (user) {
        const path = `users/${user.uid}/live/latest`;
        console.log("DEBUG: Starting RTDB listener at:", path);
        sensorRef = ref(rtdb, path);

        onValue(sensorRef, (snapshot) => {
          const val = snapshot.val();
          if (val) {
            const normalized = { ...val };
            for (const reading of Object.values(val)) {
              if (
                reading &&
                typeof reading === "object" &&
                reading.zone_id &&
                reading.sensor_type != null
              ) {
                const st =
                  typeof reading.sensor_type === "string"
                    ? reading.sensor_type
                    : reading.sensor_type.value;
                normalized[`${reading.zone_id}:${st}`] = reading;
              }
            }
            const li = normalized["zone_air:light_intensity"];
            const lg = normalized["zone_air:light"];
            if (li?.value != null && (lg == null || lg?.value == null)) {
              normalized["zone_air:light"] = li;
            }
            setData(normalized);
          }
          setLoading(false);
        }, (err) => {
          console.error("RTDB Read Error:", err);
          setLoading(false);
        });
      } else {
        setData({});
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (sensorRef) off(sensorRef);
    };
  }, []);

  return { data, loading };
}
