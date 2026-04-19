import { useEffect, useRef, useState } from "react";
import { rtdb, auth } from "../firebase";
import { ref, onValue } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { useRTDBData } from "./useRTDBData";
import {
  detectAnomaly,
  readingTimestampMs,
} from "../utils/analytics";
import { SENSOR_DEVICE_DEFS } from "../utils/sensorDevices";

/**
 * Client-side anomaly detection across every known sensor.
 *
 * Works without the backend: it subscribes once to
 * `users/{uid}/live/history` and combines those readings with the latest
 * snapshot from `useRTDBData` to run z-score + agronomic-threshold checks.
 */
export function useRTDBAnomalies({ historyMinutes = 120 } = {}) {
  const { data: latest } = useRTDBData();
  const [historyByKey, setHistoryByKey] = useState({});
  const [loading, setLoading] = useState(true);
  const unsubRef = useRef(null);

  useEffect(() => {
    const cleanup = () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      cleanup();
      if (!user) {
        setHistoryByKey({});
        setLoading(false);
        return;
      }

      const path = `users/${user.uid}/live/history`;
      const rootRef = ref(rtdb, path);

      const unsub = onValue(
        rootRef,
        (snapshot) => {
          const val = snapshot.val() || {};
          const cutoff = Date.now() - historyMinutes * 60 * 1000;
          const next = {};

          for (const [zoneId, sensorsObj] of Object.entries(val)) {
            if (!sensorsObj || typeof sensorsObj !== "object") continue;
            for (const [sensorId, readingsObj] of Object.entries(sensorsObj)) {
              if (!readingsObj || typeof readingsObj !== "object") continue;
              const readings = Object.values(readingsObj)
                .map((r) => {
                  if (!r || typeof r !== "object") return null;
                  const ms = readingTimestampMs(r.timestamp);
                  const v = Number(r.value);
                  if (!Number.isFinite(ms) || !Number.isFinite(v)) return null;
                  return { ...r, _ms: ms, value: v };
                })
                .filter(Boolean)
                .sort((a, b) => a._ms - b._ms);

              // Prefer points inside window; fall back to last 60.
              let windowed = readings.filter((r) => r._ms >= cutoff);
              if (windowed.length === 0 && readings.length > 0) {
                windowed = readings.slice(-60);
              }
              next[`${zoneId}:${sensorId}`] = windowed;
            }
          }

          setHistoryByKey(next);
          setLoading(false);
        },
        (err) => {
          console.error("[useRTDBAnomalies] RTDB read error:", err);
          setLoading(false);
        }
      );

      unsubRef.current = () => unsub();
    });

    return () => {
      cleanup();
      unsubAuth();
    };
  }, [historyMinutes]);

  // Build per-sensor anomaly result from latest + history.
  const sensors = [];
  const latestBySensorId = {};

  // 1) From latest snapshot (keys look like `zone_id:sensor_id` OR `zone_id:sensor_type`)
  for (const [, reading] of Object.entries(latest || {})) {
    if (!reading || typeof reading !== "object") continue;
    if (!reading.sensor_id || !reading.zone_id) continue;
    latestBySensorId[`${reading.zone_id}:${reading.sensor_id}`] = reading;
  }

  // 2) Ensure every well-known sensor is represented (so we can flag "no_data")
  for (const def of SENSOR_DEVICE_DEFS) {
    const key = `${def.zone}:${def.id}`;
    const latestReading = latestBySensorId[key];
    const history = historyByKey[key] || [];

    if (!latestReading && history.length === 0) {
      sensors.push({
        sensor_id: def.id,
        sensor_type: def.type,
        zone_id: def.zone,
        current_value: null,
        is_anomaly: false,
        severity: "offline",
        description: "No data received from this sensor yet.",
        suggestion:
          "Check the physical sensor / ESP32 node is powered and reporting.",
        history_count: 0,
      });
      continue;
    }

    const effectiveLatest =
      latestReading ||
      (history.length > 0
        ? history[history.length - 1]
        : null);

    if (!effectiveLatest) continue;

    const result = detectAnomaly(
      {
        sensor_id: def.id,
        sensor_type: def.type,
        zone_id: def.zone,
        value: effectiveLatest.value,
        unit: effectiveLatest.unit,
      },
      history
    );
    if (result) sensors.push(result);
  }

  const detected = sensors.filter((s) => s.is_anomaly);
  const critical = detected.filter((s) => s.severity === "critical");
  const warnings = detected.filter((s) => s.severity === "warning");
  const normal = sensors.filter((s) => !s.is_anomaly && s.severity !== "offline");
  const offline = sensors.filter((s) => s.severity === "offline");

  return {
    sensors,
    detected,
    critical,
    warnings,
    normal,
    offline,
    loading,
    powered_by: "local",
  };
}
