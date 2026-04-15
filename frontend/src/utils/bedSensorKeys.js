/**
 * RTDB live keys use zone:sensor_id; useRTDBData also adds legacy zone:type keys.
 */

/** zone_air:air_rh_1, zone_air:air_temp_1, … — omit duplicate zone_air:humidity etc. */
export function entriesForZoneAir(sensorData) {
  const prefix = "zone_air:";
  const entries = Object.entries(sensorData).filter(([key]) => key.startsWith(prefix));
  const perDevice = entries.filter(([k]) =>
    (k.split(":")[1] || "").startsWith("air_")
  );
  if (perDevice.length > 0) return perDevice;
  return entries;
}

/**
 * zone_bed_*:bed_* keys; omit duplicate zone:soil_* legacy keys when both exist.
 */
export function entriesForBedZone(sensorData, zoneBedId) {
  const prefix = `${zoneBedId}:`;
  const entries = Object.entries(sensorData).filter(([key]) => key.startsWith(prefix));
  const perDevice = entries.filter(([k]) =>
    (k.split(":")[1] || "").startsWith("bed_")
  );
  if (perDevice.length > 0) return perDevice;
  return entries;
}

/** Resolve SensorCard sensorType from RTDB reading (sensor_id keys need sensor_type field). */
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
