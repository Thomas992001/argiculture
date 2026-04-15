import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";
import { SENSOR_DEVICE_DEFS, sensorFirestoreKey } from "../utils/sensorDevices";

/**
 * Listens to Firestore `users/{uid}/control/latest` for sensor power states.
 * Returns { controlStates, activeSensorCount }.
 */
export function useControlStates() {
  const [controlStates, setControlStates] = useState({});

  useEffect(() => {
    let unsubSnapshot = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubSnapshot) {
        unsubSnapshot();
        unsubSnapshot = null;
      }

      if (!user) {
        setControlStates({});
        return;
      }

      const controlRef = doc(db, "users", user.uid, "control", "latest");
      unsubSnapshot = onSnapshot(
        controlRef,
        (snapshot) => {
          setControlStates(snapshot.data() || {});
        },
        (err) => {
          console.error("Firestore control listener error:", err);
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, []);

  const activeSensorCount = SENSOR_DEVICE_DEFS.filter((d) => {
    const key = sensorFirestoreKey(d.id);
    return controlStates[key] !== false;
  }).length;

  return { controlStates, activeSensorCount };
}
