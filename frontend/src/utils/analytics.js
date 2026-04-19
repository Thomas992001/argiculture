/**
 * Client-side analytics helpers.
 *
 * Keeps the Analytics page functional when the Python backend is offline —
 * everything here operates directly on RTDB history/latest snapshots.
 */

// ─── Timestamp normalization ─────────────────────────────────────────────

/**
 * Convert any reasonable timestamp (ISO string, numeric string, epoch
 * seconds, epoch ms) to epoch ms. Returns NaN if unparsable.
 *
 * Needed because the ESP32 sketch writes `time_t` (seconds) while the
 * Python backend writes ISO strings.
 */
export function readingTimestampMs(timestamp) {
  if (timestamp == null) return NaN;
  if (typeof timestamp === "number") {
    if (!Number.isFinite(timestamp)) return NaN;
    if (timestamp > 0 && timestamp < 1e12) return Math.round(timestamp * 1000);
    return Math.round(timestamp);
  }
  if (typeof timestamp === "string") {
    const trimmed = timestamp.trim();
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const n = Number(trimmed);
      if (!Number.isFinite(n)) return NaN;
      if (n > 0 && n < 1e12) return Math.round(n * 1000);
      return Math.round(n);
    }
    const t = new Date(trimmed).getTime();
    return Number.isFinite(t) ? t : NaN;
  }
  return NaN;
}

// ─── Malaysia Time (MYT / UTC+8) ─────────────────────────────────────────

export const MALAYSIA_TZ = "Asia/Kuala_Lumpur";
export const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;
export const HALF_HOUR_MS = 30 * 60 * 1000;
export const FIVE_MIN_MS = 5 * 60 * 1000;
/** Default X-axis gap (minutes) used by every chart. Change here → all charts update. */
export const CHART_TICK_INTERVAL_MIN = 5;

/**
 * Format an epoch-ms (or any value accepted by `readingTimestampMs`) as
 * `HH:MM` in Malaysia time, regardless of the browser's own timezone.
 */
export function formatMytTime(value) {
  const ms = typeof value === "number" ? value : readingTimestampMs(value);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: MALAYSIA_TZ,
  });
}

/**
 * Format an epoch-ms as a short date+time tooltip label in MYT,
 * e.g. `17 Apr · 12:30 MYT`.
 */
export function formatMytDateTime(value) {
  const ms = typeof value === "number" ? value : readingTimestampMs(value);
  if (!Number.isFinite(ms)) return "";
  const date = new Date(ms).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: MALAYSIA_TZ,
  });
  return `${date} · ${formatMytTime(ms)} MYT`;
}

/**
 * Floor an epoch-ms to the start of its N-minute MYT bucket.
 * Works correctly even when the client's own timezone is not UTC+8.
 */
export function floorToMinuteMyt(ms, intervalMinutes = CHART_TICK_INTERVAL_MIN) {
  if (!Number.isFinite(ms)) return NaN;
  const step = Math.max(1, intervalMinutes) * 60 * 1000;
  const myt = ms + MYT_OFFSET_MS;
  return Math.floor(myt / step) * step - MYT_OFFSET_MS;
}

/**
 * Generate an array of epoch-ms values aligned to every N-minute MYT
 * boundary (e.g. 12:00, 12:05, 12:10 …) within `[startMs, endMs]`.
 *
 * Intended for use as Recharts `<XAxis ticks={…} />`.
 */
export function generateMytTicks(
  startMs,
  endMs,
  intervalMinutes = CHART_TICK_INTERVAL_MIN
) {
  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    endMs <= startMs
  ) {
    return [];
  }
  const step = Math.max(1, intervalMinutes) * 60 * 1000;
  const firstBoundaryMyt =
    Math.ceil((startMs + MYT_OFFSET_MS) / step) * step;
  const firstBoundaryUtc = firstBoundaryMyt - MYT_OFFSET_MS;
  const ticks = [];
  for (let t = firstBoundaryUtc; t <= endMs; t += step) {
    ticks.push(t);
  }
  return ticks;
}

/** @deprecated kept for backward compatibility — use `generateMytTicks`. */
export function generateHalfHourTicks(startMs, endMs) {
  return generateMytTicks(startMs, endMs, 30);
}

// ─── Basic stats ─────────────────────────────────────────────────────────

export function mean(values) {
  if (!values || values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

export function stdev(values, mu) {
  if (!values || values.length < 2) return 0;
  const m = mu ?? mean(values);
  let sq = 0;
  for (const v of values) sq += (v - m) ** 2;
  return Math.sqrt(sq / (values.length - 1));
}

/** OLS slope and intercept of `y = a + b*x`. */
export function linearRegression(xs, ys) {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0 };
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  return { slope, intercept };
}

// ─── Forecast ────────────────────────────────────────────────────────────

/**
 * Holt's double-exponential smoothing: returns final `{ level, trend }`
 * estimates from a series of values. Trend is per-step (not per-time-unit).
 */
function holtSmoothing(values, alpha = 0.5, beta = 0.3) {
  const n = values.length;
  if (n === 0) return { level: 0, trend: 0 };
  if (n === 1) return { level: values[0], trend: 0 };
  let level = values[0];
  let trend = values[1] - values[0];
  for (let i = 1; i < n; i++) {
    const prevLevel = level;
    level = alpha * values[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  return { level, trend };
}

/**
 * Generate a short-horizon forecast that **follows the recent movement**
 * instead of collapsing to a flat line.
 *
 * Strategy (progressive, resilient):
 *   • < 3 points → empty, reason = "insufficient_history"
 *   • ≥ 3 points → Holt's double-exponential smoothing for level + trend,
 *                  then each forecast step = prev + trend + dampened oscillation
 *                  sampled from recent inter-reading deltas.
 *
 * The oscillation echo is damped exponentially so the far-future band
 * gracefully tapers into the pure trend.
 *
 * Response shape matches the old backend `/analytics/forecast` endpoint
 * so `ForecastChart` keeps working.
 */
export function forecastFromHistory(history, {
  horizonMinutes = 30,
  stepMinutes = 2,
  zoneId = "",
  sensorType = "",
} = {}) {
  const cleaned = (history || [])
    .map((r) => {
      if (!r || typeof r !== "object") return null;
      const ms = readingTimestampMs(r.timestamp);
      const v = typeof r.value === "number" ? r.value : Number(r.value);
      if (!Number.isFinite(ms) || !Number.isFinite(v)) return null;
      return { ms, value: v };
    })
    .filter(Boolean)
    .sort((a, b) => a.ms - b.ms);

  if (cleaned.length < 3) {
    return {
      sensor_type: sensorType,
      zone_id: zoneId,
      points: [],
      model_name: "none",
      confidence: 0,
      powered_by: "local",
      reason:
        cleaned.length === 0 ? "no_data" : "insufficient_history",
      history_count: cleaned.length,
    };
  }

  const recent = cleaned.slice(-80);
  const ys = recent.map((p) => p.value);
  const my = mean(ys);

  // Step-wise trend from Holt's smoothing
  const { level, trend: stepTrend } = holtSmoothing(ys, 0.55, 0.3);

  // Inter-reading deltas → drive the oscillation echo so the forecast
  // visually continues the "shape" of the recent signal.
  const deltas = [];
  for (let i = 1; i < ys.length; i++) {
    deltas.push(ys[i] - ys[i - 1]);
  }
  const recentDeltas = deltas.slice(-12);
  const deltaSigma = stdev(recentDeltas, 0) || 0;
  const sigma =
    stdev(ys, my) ||
    deltaSigma ||
    Math.abs(my) * 0.03 ||
    1;

  const modelName =
    recent.length >= 10 ? "holt_trend+delta_echo" : "holt_trend";

  // Confidence: small residuals relative to the signal scale → high confidence
  const scale = Math.max(Math.abs(my), 1);
  const confidence = Math.max(
    0.3,
    Math.min(0.95, 1 - sigma / (scale * 2))
  );

  // Build forecast points
  const lastMs = recent[recent.length - 1].ms;
  const stepMs = Math.max(1, stepMinutes) * 60 * 1000;
  const steps = Math.max(1, Math.round(horizonMinutes / stepMinutes));

  const points = [];
  let prev = level;
  for (let i = 1; i <= steps; i++) {
    const t = lastMs + i * stepMs;

    // Delta echo: cycle through recent deltas so the line keeps
    // "wiggling" the way the real data has been wiggling.
    const delta =
      recentDeltas.length > 0
        ? recentDeltas[(i - 1) % recentDeltas.length]
        : 0;

    // Smooth wave overlay (ensures visible non-flatness even on calm data)
    const wavePhase = (i / Math.max(3, recentDeltas.length)) * Math.PI * 2;
    const wave = Math.sin(wavePhase) * deltaSigma * 0.35;

    // Dampen both the echo and the wave as we look further ahead so the
    // forecast resolves into the pure trend for distant points.
    const damping = Math.exp(-i / Math.max(8, steps));

    const predicted =
      prev + stepTrend + (delta * 0.55 + wave) * damping;

    prev = predicted;

    const widening = 1 + i * 0.05;
    points.push({
      timestamp: new Date(t).toISOString(),
      predicted_value: predicted,
      lower_bound: predicted - 2 * sigma * widening,
      upper_bound: predicted + 2 * sigma * widening,
    });
  }

  const trendLabel =
    Math.abs(stepTrend) < sigma * 0.05
      ? "flat"
      : stepTrend > 0
      ? "rising"
      : "falling";

  return {
    sensor_type: sensorType,
    zone_id: zoneId,
    points,
    model_name: modelName,
    confidence,
    powered_by: "local",
    history_count: cleaned.length,
    last_value: ys[ys.length - 1],
    trend: trendLabel,
  };
}

// ─── Anomaly detection ───────────────────────────────────────────────────

/**
 * Expected healthy ranges used for domain-aware threshold checks.
 * (z-score is still the primary signal — these thresholds add agronomic context.)
 */
export const SENSOR_THRESHOLDS = {
  humidity:         { min: 50,   max: 85,   unit: "%",   label: "Air Humidity" },
  temperature:      { min: 18,   max: 32,   unit: "°C",  label: "Air Temperature" },
  light:            { min: 2000, max: 60000, unit: "lux", label: "Light Level" },
  light_intensity:  { min: 2000, max: 60000, unit: "lux", label: "Light Level" },
  soil_temperature: { min: 18,   max: 30,   unit: "°C",  label: "Soil Temperature" },
  soil_ph:          { min: 5.5,  max: 7.5,  unit: "pH",  label: "Soil pH" },
  soil_moisture:    { min: 30,   max: 75,   unit: "%",   label: "Soil Moisture" },
};

const SUGGESTIONS = {
  soil_moisture_low:
    "Soil is dry — increase irrigation frequency or run the pump for a longer cycle.",
  soil_moisture_high:
    "Soil is water-logged — pause irrigation and check for drainage issues.",
  soil_ph_low:
    "Soil pH is acidic — consider adding dolomitic lime to raise it toward 6.0–6.8.",
  soil_ph_high:
    "Soil pH is alkaline — flush with clean water or add organic matter / sulfur.",
  soil_temperature_low:
    "Substrate is cold — consider root-zone heating or moving beds to a warmer area.",
  soil_temperature_high:
    "Substrate is overheating — shade the bed and increase ventilation.",
  humidity_low:
    "Air is dry — enable foggers / misters to lift humidity toward 60–80%.",
  humidity_high:
    "Air is very humid — ventilate the greenhouse to reduce disease risk.",
  temperature_low:
    "Air temperature is low — check heaters or seal cold air leaks.",
  temperature_high:
    "Air temperature is high — open vents, increase shading, or run fans.",
  light_low:
    "Light is below target — turn on supplemental grow lights if available.",
  light_high:
    "Light is very high — deploy shade cloth to protect plants from scorching.",
};

function buildSuggestion(sensorType, direction) {
  const key = `${sensorType}_${direction}`;
  return SUGGESTIONS[key] || "Monitor this sensor and correlate with nearby zones.";
}

/**
 * Classify a single sensor reading against its own recent history
 * plus agronomic thresholds.
 *
 * @param {{ sensor_id, sensor_type, zone_id, value, unit }} latest
 * @param {Array<{ timestamp, value }>} history
 */
export function detectAnomaly(latest, history) {
  if (!latest || typeof latest.value !== "number") return null;

  const sensorType =
    typeof latest.sensor_type === "string"
      ? latest.sensor_type
      : latest.sensor_type?.value;

  const values = (history || [])
    .map((r) => (typeof r.value === "number" ? r.value : Number(r.value)))
    .filter((v) => Number.isFinite(v));

  const m = values.length >= 2 ? mean(values) : latest.value;
  const s = values.length >= 5 ? stdev(values, m) : 0;
  const z = s > 0 ? (latest.value - m) / s : 0;
  const absZ = Math.abs(z);

  const th = SENSOR_THRESHOLDS[sensorType];
  let thresholdBreach = null;
  if (th) {
    if (latest.value < th.min) thresholdBreach = "low";
    else if (latest.value > th.max) thresholdBreach = "high";
  }

  const isAnomaly = thresholdBreach != null || absZ >= 2.5;

  // Severity
  let severity = "normal";
  if (isAnomaly) {
    if (absZ >= 3.5 || (th && (latest.value < th.min * 0.85 || latest.value > th.max * 1.15))) {
      severity = "critical";
    } else {
      severity = "warning";
    }
  }

  const direction =
    thresholdBreach ||
    (z > 0 ? "high" : "low");

  let description;
  if (thresholdBreach === "low") {
    description = `Value ${latest.value.toFixed(2)} is below healthy minimum (${th.min}${th.unit}).`;
  } else if (thresholdBreach === "high") {
    description = `Value ${latest.value.toFixed(2)} is above healthy maximum (${th.max}${th.unit}).`;
  } else if (absZ >= 2.5) {
    description = `Reading is ${absZ.toFixed(1)}σ away from its own recent average (${m.toFixed(2)}).`;
  } else {
    description = `Reading is within ${absZ.toFixed(1)}σ of recent average.`;
  }

  const suggestion = isAnomaly ? buildSuggestion(sensorType, direction) : null;

  return {
    sensor_id: latest.sensor_id,
    sensor_type: sensorType,
    zone_id: latest.zone_id,
    current_value: latest.value,
    unit: latest.unit || th?.unit || "",
    mean: m,
    std: s,
    anomaly_score: Number(absZ.toFixed(3)),
    is_anomaly: isAnomaly,
    severity,
    direction,
    description,
    suggestion,
    expected_min: th?.min,
    expected_max: th?.max,
    history_count: values.length,
  };
}
