import {
  Droplets,
  Thermometer,
  Beaker,
  Sun,
} from "lucide-react";

export const SENSOR_DEVICE_DEFS = [
  { id: "air_rh_1", label: "Air Humidity Sensor 1", type: "humidity", zone: "zone_air", icon: Droplets, color: "blue" },
  { id: "air_rh_2", label: "Air Humidity Sensor 2", type: "humidity", zone: "zone_air", icon: Droplets, color: "blue" },
  { id: "air_temp_1", label: "Air Temperature Sensor", type: "temperature", zone: "zone_air", icon: Thermometer, color: "red" },
  { id: "air_light_1", label: "Greenhouse Light Sensor", type: "light", zone: "zone_air", icon: Sun, color: "yellow" },
  { id: "bed_a_temp", label: "Soil Temperature A", type: "soil_temperature", zone: "zone_bed_a", icon: Thermometer, color: "orange" },
  { id: "bed_a_ph", label: "Soil pH Sensor A", type: "soil_ph", zone: "zone_bed_a", icon: Beaker, color: "green" },
  { id: "bed_a_moisture", label: "Soil Moisture Sensor A", type: "soil_moisture", zone: "zone_bed_a", icon: Droplets, color: "cyan" },
  { id: "bed_b_temp", label: "Soil Temperature B", type: "soil_temperature", zone: "zone_bed_b", icon: Thermometer, color: "orange" },
  { id: "bed_b_ph", label: "Soil pH Sensor B", type: "soil_ph", zone: "zone_bed_b", icon: Beaker, color: "green" },
  { id: "bed_b_moisture", label: "Soil Moisture Sensor B", type: "soil_moisture", zone: "zone_bed_b", icon: Droplets, color: "cyan" },
  { id: "bed_c_temp", label: "Soil Temperature C", type: "soil_temperature", zone: "zone_bed_c", icon: Thermometer, color: "orange" },
  { id: "bed_c_ph", label: "Soil pH Sensor C", type: "soil_ph", zone: "zone_bed_c", icon: Beaker, color: "green" },
  { id: "bed_c_moisture", label: "Soil Moisture Sensor C", type: "soil_moisture", zone: "zone_bed_c", icon: Droplets, color: "cyan" },
];

export const PUMP_DEVICE_DEFS = [
  { id: "pump_a", label: "Water Pump A", type: "pump", zone: "zone_bed_a", icon: Droplets, color: "teal" },
  { id: "pump_b", label: "Water Pump B", type: "pump", zone: "zone_bed_b", icon: Droplets, color: "teal" },
  { id: "pump_c", label: "Water Pump C", type: "pump", zone: "zone_bed_c", icon: Droplets, color: "teal" },
];

export const ALL_DEVICE_DEFS = [...SENSOR_DEVICE_DEFS, ...PUMP_DEVICE_DEFS];

export function sensorFirestoreKey(id) {
  return `sensor_${id}`;
}

export function controlFirestoreKey(device) {
  if (device.type === "pump") return device.id;
  return sensorFirestoreKey(device.id);
}
