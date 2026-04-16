/**
 * RTDB key helpers.
 * The normalized data in useRTDBData has both zone:sensor_id (raw) and
 * zone:sensor_type (normalized) keys.  We prefer sensor_type keys to stay
 * consistent with ControlPage's resolveReading pattern.
 */

/** Return zone_air entries, preferring type-based keys (humidity, temperature, light…). */
export function entriesForZoneAir(sensorData) {
  const prefix = "zone_air:";
  const entries = Object.entries(sensorData).filter(([key]) => key.startsWith(prefix));
  // Prefer type-based keys (not prefixed with "air_")
  const typeKeys = entries.filter(([k]) => {
    const part = (k.split(":")[1] || "");
    return !part.startsWith("air_");
  });
  if (typeKeys.length > 0) return typeKeys;
  return entries;
}

/**
 * Return entries for a specific bed zone, preferring type-based keys
 * (soil_temperature, soil_ph, soil_moisture) over sensor_id keys (bed_a_temp…).
 */
export function entriesForBedZone(sensorData, zoneBedId) {
  const prefix = `${zoneBedId}:`;
  const entries = Object.entries(sensorData).filter(([key]) => key.startsWith(prefix));
  // Prefer type-based keys (not prefixed with "bed_")
  const typeKeys = entries.filter(([k]) => {
    const part = (k.split(":")[1] || "");
    return !part.startsWith("bed_");
  });
  if (typeKeys.length > 0) return typeKeys;
  return entries;
}

/** Resolve SensorCard sensorType from RTDB reading. */
export function bedSensorCardType(reading, key) {
  if (reading && typeof reading === "object" && reading.sensor_type != null) {
    const st =
      typeof reading.sensor_type === "string"
        ? reading.sensor_type
        : reading.sensor_type.value;
    return st === "light_intensity" ? "light" : st;
  }
  const raw = key.split(":")[1] || "";
  return raw === "light_intensity" ? "light" : raw;
}
