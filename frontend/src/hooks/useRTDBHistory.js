import { useState, useEffect, useRef } from "react";
import { rtdb, auth } from "../firebase";
import { ref, query, limitToLast, onValue } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { SENSOR_DEVICE_DEFS } from "../utils/sensorDevices";
import { readingTimestampMs } from "../utils/analytics";

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
      console.log(
        `[useRTDBHistory] ${zoneId}/${sensorType} → sensor_ids:`,
        sensorIds,
      );

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

            // Normalize every reading's timestamp to ISO (handles ESP32 epoch-seconds)
            const allPoints = Object.values(readingsMap)
              .flat()
              .map((r) => {
                if (!r || typeof r !== "object") return null;
                const ms = readingTimestampMs(r.timestamp);
                if (!Number.isFinite(ms)) return null;
                return { ...r, _ms: ms, timestamp: new Date(ms).toISOString() };
              })
              .filter(Boolean)
              .sort((a, b) => a._ms - b._ms);

            // Prefer points inside the requested window…
            const cutoff = Date.now() - limitMinutes * 60 * 1000;
            let windowed = allPoints.filter((r) => r._ms >= cutoff);

            // …but if none fall in the window (e.g. seed data or clock skew),
            // fall back to the most-recent 60 points so the chart isn't blank.
            if (windowed.length === 0 && allPoints.length > 0) {
              windowed = allPoints.slice(-60);
              console.warn(
                `[useRTDBHistory] No points within last ${limitMinutes} min for ` +
                `${zoneId}/${sid}; showing last ${windowed.length} stored points instead.`
              );
            }

            const merged = windowed.map(({ _ms, ...rest }) => rest);
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
