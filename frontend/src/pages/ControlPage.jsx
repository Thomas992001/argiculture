import { useState, useEffect } from "react";
import {
  Wifi,
  WifiOff,
  CircleDot,
  Loader2,
  AlertOctagon,
} from "lucide-react";
import { api } from "../api/client";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase";
import { onSnapshot, doc, setDoc } from "firebase/firestore";
import { useRTDBData } from "../hooks/useRTDBData";
import AlertPanel from "../components/AlertPanel";
import {
  SENSOR_DEVICE_DEFS,
  PUMP_DEVICE_DEFS,
  ALL_DEVICE_DEFS as POWER_DEVICE_DEFS,
  controlFirestoreKey,
} from "../utils/sensorDevices";

const COLOR_MAP = {
  blue: { text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  red: { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  yellow: { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  orange: { text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  green: { text: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
  cyan: { text: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
  teal: { text: "text-teal-400", bg: "bg-teal-500/10", border: "border-teal-500/20" },
};

const ZONE_LABELS = {
  zone_air: "Greenhouse",
  zone_bed_a: "Substrate A",
  zone_bed_b: "Substrate B",
  zone_bed_c: "Substrate C",
};

const UNIT_MAP = {
  humidity: "%",
  temperature: "°C",
  light: "lux",
  soil_temperature: "°C",
  soil_ph: "pH",
  soil_moisture: "%",
  pump: "",
};


function resolveReading(sensorData, sensor) {
  // Try exact device key first (zone:sensor_id), e.g. zone_air:air_rh_1
  let reading = sensorData[`${sensor.zone}:${sensor.id}`];
  // Fall back to zone:type for backwards compat
  if (reading?.value == null) {
    reading = sensorData[`${sensor.zone}:${sensor.type}`];
  }
  if (
    sensor.type === "light" &&
    (reading?.value == null || reading?.value === undefined)
  ) {
    reading = sensorData[`${sensor.zone}:light_intensity`];
  }
  return reading;
}

function SensorPowerRow({ sensor, sensorData, cloudStates, onToggle }) {
  const [loading, setLoading] = useState(false);
  const colorStyle = COLOR_MAP[sensor.color] || COLOR_MAP.blue;
  const Icon = sensor.icon;
  const unit = UNIT_MAP[sensor.type] || "";
  const reading = resolveReading(sensorData, sensor);
  const hasData = reading && reading.value != null;

  const fsKey = controlFirestoreKey(sensor);
  const poweredOn = cloudStates[fsKey] !== false;

  const formatVal = (val) => {
    if (val == null) return "--";
    if (val >= 1000) return Math.round(val).toLocaleString();
    return val.toFixed(1);
  };

  const handleClick = async () => {
    setLoading(true);
    try {
      await onToggle(sensor, !poweredOn);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-xl border ${colorStyle.border} ${colorStyle.bg} transition-all ${
        !poweredOn ? "opacity-75" : ""
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={`p-2 rounded-lg ${colorStyle.bg} shrink-0`}>
          <Icon size={16} className={colorStyle.text} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-200 truncate">{sensor.label}</p>
          <p className="text-[10px] text-gray-500">
            {ZONE_LABELS[sensor.zone] || sensor.zone} · {sensor.id}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="text-right hidden sm:block">
          <p
            className={`text-sm font-bold ${
              poweredOn && hasData ? colorStyle.text : "text-gray-600"
            }`}
          >
            {sensor.type === "pump"
              ? poweredOn
                ? "On"
                : "—"
              : (
                <>
                  {poweredOn ? formatVal(reading?.value) : "—"}{" "}
                  <span className="text-[10px] text-gray-500 font-normal">{unit}</span>
                </>
              )}
          </p>
          {!poweredOn && sensor.type !== "pump" && (
            <p className="text-[9px] text-gray-500">Power off</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {poweredOn && (hasData || sensor.type === "pump") ? (
            <Wifi size={12} className="text-greenhouse-400" />
          ) : (
            <WifiOff size={12} className="text-gray-600" />
          )}
        </div>
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          title={
            poweredOn
              ? sensor.type === "pump"
                ? "Turn pump off"
                : "Cut sensor power"
              : sensor.type === "pump"
                ? "Turn pump on"
                : "Enable sensor"
          }
          className={`relative w-12 h-6 rounded-full shrink-0 transition-colors ${
            poweredOn ? "bg-greenhouse-500" : "bg-gray-700"
          }`}
        >
          {loading ? (
            <Loader2
              size={14}
              className="absolute top-1 left-1 animate-spin text-white"
            />
          ) : (
            <div
              className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${
                poweredOn ? "translate-x-6" : "translate-x-0.5"
              }`}
            />
          )}
        </button>
      </div>
    </div>
  );
}

export default function ControlPage() {
  const [cloudStates, setCloudStates] = useState({});
  const [alerts, setAlerts] = useState([]);
  const { data: rtdbData } = useRTDBData();

  const sensorData = rtdbData || {};

  const fetchAlerts = async () => {
    try {
      const alertsData = await api.getAlerts();
      setAlerts(alertsData);
    } catch { }
  };

  const handleDeviceToggle = async (device, nextOn) => {
    const user = auth.currentUser;
    if (!user) return;
    const controlRef = doc(db, "users", user.uid, "control", "latest");
    try {
      await setDoc(
        controlRef,
        { [controlFirestoreKey(device)]: nextOn },
        { merge: true }
      );
    } catch (e) {
      console.error("Device power toggle error:", e);
    }
  };

  const handleAllSensorsOff = async () => {
    if (!window.confirm("Turn OFF power for all sensors and pumps? (You can turn them back on individually.)")) {
      return;
    }
    const user = auth.currentUser;
    if (!user) return;
    const controlRef = doc(db, "users", user.uid, "control", "latest");
    const updates = {};
    POWER_DEVICE_DEFS.forEach((d) => {
      updates[controlFirestoreKey(d)] = false;
    });
    try {
      await setDoc(controlRef, updates, { merge: true });
    } catch (e) {
      console.error("All sensors off error:", e);
    }
  };

  const handleAllSensorsOn = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const controlRef = doc(db, "users", user.uid, "control", "latest");
    const updates = {};
    POWER_DEVICE_DEFS.forEach((d) => {
      updates[controlFirestoreKey(d)] = true;
    });
    try {
      await setDoc(controlRef, updates, { merge: true });
    } catch (e) {
      console.error("All sensors on error:", e);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  useEffect(() => {
    let unsubscribeSnapshot = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (!user) return;

      const controlRef = doc(db, "users", user.uid, "control", "latest");

      unsubscribeSnapshot = onSnapshot(controlRef, (snapshot) => {
        const data = snapshot.data();
        if (data) {
          setCloudStates(data);
        }
      }, (error) => {
        console.error("Firestore listener error:", error);
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Device Control & Inventory</h2>
        <p className="text-sm text-gray-500 mt-1">
          Control water pumps and sensor power switches (stored in Firestore)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <CircleDot size={14} className="text-blue-400" />
                Sensors — power
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleAllSensorsOn}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-800 border border-gray-700 text-greenhouse-400 hover:bg-gray-700"
                >
                  All ON
                </button>
                <button
                  type="button"
                  onClick={handleAllSensorsOff}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-800 border border-gray-700 text-orange-400 hover:bg-gray-700"
                >
                  All OFF
                </button>
              </div>
            </div>
            <p className="text-[11px] text-gray-500 mb-3">
              Toggle supplies logical power to each sensor channel and water pumps. Default is ON when not set.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {POWER_DEVICE_DEFS.map((sensor) => (
                <SensorPowerRow
                  key={sensor.id}
                  sensor={sensor}
                  sensorData={sensorData}
                  cloudStates={cloudStates}
                  onToggle={handleDeviceToggle}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={handleAllSensorsOff}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-orange-600/15 border border-orange-600/35 text-orange-300 hover:bg-orange-600/25 transition-colors text-sm font-medium"
            >
              <AlertOctagon size={16} />
              Emergency — All sensors & pumps OFF
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-3">Alerts</h3>
          <AlertPanel alerts={alerts} onRefresh={fetchAlerts} />
        </div>
      </div>
    </div>
  );
}
