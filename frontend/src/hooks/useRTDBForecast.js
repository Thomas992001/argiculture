import { useMemo } from "react";
import { useRTDBHistory } from "./useRTDBHistory";
import { forecastFromHistory } from "../utils/analytics";

/**
 * Client-side forecast derived from RTDB history.
 *
 * Works entirely without the Python backend. Returns a response shape that
 * matches the old `/analytics/forecast` endpoint so `ForecastChart` renders
 * unchanged.
 *
 * @param {string} zoneId              e.g. "zone_bed_a"
 * @param {string} sensorType          e.g. "soil_moisture"
 * @param {object} options
 * @param {number} options.historyMinutes  look-back window (default 120)
 * @param {number} options.horizonMinutes  forecast horizon (default 30)
 * @param {number} options.stepMinutes     minutes between forecast points
 */
export function useRTDBForecast(
  zoneId,
  sensorType,
  { historyMinutes = 120, horizonMinutes = 30, stepMinutes = 2 } = {}
) {
  const { data: history, loading } = useRTDBHistory(
    zoneId,
    sensorType,
    historyMinutes
  );

  const forecast = useMemo(
    () =>
      forecastFromHistory(history, {
        horizonMinutes,
        stepMinutes,
        zoneId,
        sensorType,
      }),
    [history, horizonMinutes, stepMinutes, zoneId, sensorType]
  );

  return { forecast, history, loading };
}
