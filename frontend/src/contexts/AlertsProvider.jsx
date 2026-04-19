import { createContext, useContext, useMemo } from "react";
import { useRTDBAnomalies } from "../hooks/useRTDBAnomalies";

/**
 * Global alerts context.
 *
 * Single source of truth for anomalies / alerts across Overview, Analytics
 * and Control. `useRTDBAnomalies` is subscribed to exactly once at the
 * provider level — every consuming component re-renders whenever the
 * underlying RTDB data changes.
 */
const AlertsContext = createContext(null);

/**
 * Map a raw anomaly result (from useRTDBAnomalies) into the unified alert
 * shape that AlertPanel and banners expect.
 */
function anomalyToAlert(a) {
  const direction = a.direction;
  const threshold =
    direction === "low"
      ? a.expected_min
      : direction === "high"
      ? a.expected_max
      : undefined;

  return {
    alert_id: `anomaly:${a.zone_id}:${a.sensor_id}`,
    source: "anomaly",
    sensor_id: a.sensor_id,
    sensor_type: a.sensor_type,
    zone_id: a.zone_id,
    severity: a.severity,               // "critical" | "warning"
    direction,                          // "low" | "high"
    message: a.description,
    suggestion: a.suggestion,
    value: a.current_value,
    unit: a.unit,
    threshold,
    expected_min: a.expected_min,
    expected_max: a.expected_max,
    anomaly_score: a.anomaly_score,
    timestamp: new Date().toISOString(),
  };
}

export function AlertsProvider({ children }) {
  const anomalyState = useRTDBAnomalies({ historyMinutes: 180 });

  const value = useMemo(() => {
    const alerts = (anomalyState.detected || []).map(anomalyToAlert);

    // Sort: critical first, then warning; within each, highest z-score first
    alerts.sort((a, b) => {
      const sev = (s) => (s === "critical" ? 0 : s === "warning" ? 1 : 2);
      const d = sev(a.severity) - sev(b.severity);
      if (d !== 0) return d;
      return (b.anomaly_score || 0) - (a.anomaly_score || 0);
    });

    const critical = alerts.filter((a) => a.severity === "critical");
    const warnings = alerts.filter((a) => a.severity === "warning");

    return {
      alerts,
      critical,
      warnings,
      criticalCount: critical.length,
      warningCount: warnings.length,
      attentionNeeded: alerts.length > 0,
      topAlert: alerts[0] || null,
      anomalyState,      // full state (normal/offline/etc) for Analytics
      loading: anomalyState.loading,
    };
  }, [anomalyState]);

  return (
    <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>
  );
}

export function useAlerts() {
  const ctx = useContext(AlertsContext);
  if (!ctx) {
    // Return a safe default so pages still render if the provider is missing
    return {
      alerts: [],
      critical: [],
      warnings: [],
      criticalCount: 0,
      warningCount: 0,
      attentionNeeded: false,
      topAlert: null,
      anomalyState: {
        sensors: [],
        detected: [],
        critical: [],
        warnings: [],
        normal: [],
        offline: [],
        loading: false,
      },
      loading: false,
    };
  }
  return ctx;
}
