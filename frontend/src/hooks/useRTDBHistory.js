import { useState, useEffect, useRef } from "react";
import { rtdb, auth } from "../firebase";
import { ref, query, limitToLast, onValue } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { SENSOR_DEVICE_DEFS } from "../utils/sensorDevices";

/**
 * Map a (zoneId, sensorType) pair to the physical sensor_ids
 * stored under RTDB history.  Handles light/light_intensity aliasing.
 */
function findSensorIds(zoneId, sensorType) {
  const t = sensorType === "light_intensity" ? "light" : sensorType;
  return SENSOR_DEVICE_DEFS
    .filter((d) => d.zone === zoneId && (d.type === t || d.type === sensorType))
    .map((d) => d.id);
}

/**
 * Real-time hook that reads from RTDB `users/{uid}/live/history/{zone}/{sensor_id}`.
 *
 * Returns merged, time-filtered readings sorted by timestamp — same shape
 * the backend API used to return (so RealtimeChart works unchanged).
 *
 * @param {string} zoneId        e.g. "zone_air", "zone_bed_a"
 * @param {string} sensorType    e.g. "humidity", "soil_temperature"
 * @param {number} limitMinutes  only return readings within this window
 */
export function useRTDBHistory(zoneId, sensorType, limitMinutes = 30) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const unsubsRef = useRef([]);

  useEffect(() => {
    const cleanup = () => {
      unsubsRef.current.forEach((fn) => fn());
      unsubsRef.current = [];
    };

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      cleanup();

      if (!user) {
        setData([]);
        setLoading(false);
        return;
      }

      const sensorIds = findSensorIds(zoneId, sensorType);

      if (sensorIds.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      // One listener per physical sensor; merge results on every update
      const readingsMap = {};

      for (const sid of sensorIds) {
        const path = `users/${user.uid}/live/history/${zoneId}/${sid}`;
        const histQuery = query(ref(rtdb, path), limitToLast(200));

        const unsub = onValue(
          histQuery,
          (snapshot) => {
            const val = snapshot.val();
            readingsMap[sid] = val ? Object.values(val) : [];

            // Re-merge on every callback
            const cutoff = Date.now() - limitMinutes * 60 * 1000;
            const merged = Object.values(readingsMap)
              .flat()
              .filter((r) => r.timestamp && new Date(r.timestamp).getTime() >= cutoff)
              .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            setData(merged);
            setLoading(false);
          },
          (err) => {
            console.error(`RTDB history error (${path}):`, err);
            setLoading(false);
          },
        );

        unsubsRef.current.push(unsub);
      }
    });

    return () => {
      cleanup();
      unsubAuth();
    };
  }, [zoneId, sensorType, limitMinutes]);

  return { data, loading };
}
