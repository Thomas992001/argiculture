import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue, off } from "firebase/database";
import { rtdb, auth } from "../firebase";
import { SENSOR_DEVICE_DEFS, sensorFirestoreKey } from "../utils/sensorDevices";

/**
 * Listens to RTDB `users/{uid}/live/sensors` for sensor power states.
 * Returns { controlStates, activeSensorCount }.
 */
export function useControlStates() {
  const [controlStates, setControlStates] = useState({});

  useEffect(() => {
    let sensorRef = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (sensorRef) {
        off(sensorRef);
        sensorRef = null;
      }

      if (!user) {
        setControlStates({});
        return;
      }

      sensorRef = ref(rtdb, `users/${user.uid}/live/sensors`);
      onValue(
        sensorRef,
        (snapshot) => {
          setControlStates(snapshot.val() || {});
        },
        (err) => {
          console.error("RTDB control listener error:", err);
        }
      );
    });

    return () => {
      unsubAuth();
      if (sensorRef) off(sensorRef);
    };
  }, []);

  const activeSensorCount = SENSOR_DEVICE_DEFS.filter((d) => {
    const key = sensorFirestoreKey(d.id);
    return controlStates[key] !== false;
  }).length;

  return { controlStates, activeSensorCount };
}
