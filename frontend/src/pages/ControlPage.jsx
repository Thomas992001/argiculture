import { useState, useEffect, useMemo } from "react";
import {
  Wifi,
  WifiOff,
  CircleDot,
  Loader2,
  AlertOctagon,
  AlertCircle,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { api } from "../api/client";
import { onAuthStateChanged } from "firebase/auth";
import { db, rtdb, auth } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { ref, update, onValue, off } from "firebase/database";
import { useRTDBData } from "../hooks/useRTDBData";
import { useAlerts } from "../contexts/AlertsProvider";
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
  const [backendAlerts, setBackendAlerts] = useState([]);
  const { data: rtdbData } = useRTDBData();
  const {
    alerts: anomalyAlerts,
    topAlert,
    attentionNeeded,
    criticalCount,
    warningCount,
  } = useAlerts();

  const sensorData = rtdbData || {};

  const mergedAlerts = useMemo(() => {
    const covered = new Set(anomalyAlerts.map((a) => a.sensor_id));
    const extras = (backendAlerts || []).filter(
      (a) => !a.sensor_id || !covered.has(a.sensor_id)
    );
    return [...anomalyAlerts, ...extras];
  }, [anomalyAlerts, backendAlerts]);

  const fetchAlerts = async () => {
    try {
      const alertsData = await api.getAlerts();
      setBackendAlerts(alertsData || []);
    } catch { }
  };

  const handleDeviceToggle = async (device, nextOn) => {
    const user = auth.currentUser;
    if (!user) return;
    const controlRef = ref(rtdb, `users/${user.uid}/live/sensors`);
    try {
      await update(controlRef, { [controlFirestoreKey(device)]: nextOn });
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
    const controlRef = ref(rtdb, `users/${user.uid}/live/sensors`);
    const updates = {};
    POWER_DEVICE_DEFS.forEach((d) => {
      updates[controlFirestoreKey(d)] = false;
    });
    try {
      await update(controlRef, updates);
    } catch (e) {
      console.error("All sensors off error:", e);
    }
  };

  const handleAllSensorsOn = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const controlRef = ref(rtdb, `users/${user.uid}/live/sensors`);
    const updates = {};
    POWER_DEVICE_DEFS.forEach((d) => {
      updates[controlFirestoreKey(d)] = true;
    });
    try {
      await update(controlRef, updates);
    } catch (e) {
      console.error("All sensors on error:", e);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  useEffect(() => {
    let sensorRef = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (sensorRef) {
        off(sensorRef);
        sensorRef = null;
      }

      if (!user) return;

      const path = `users/${user.uid}/live/sensors`;
      sensorRef = ref(rtdb, path);

      onValue(sensorRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setCloudStates(data);
        }
      }, (error) => {
        console.error("RTDB listener error:", error);
      });
    });

    return () => {
      unsubscribeAuth();
      if (sensorRef) off(sensorRef);
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

      {attentionNeeded && topAlert && (
        <ControlAttentionBanner
          alert={topAlert}
          criticalCount={criticalCount}
          warningCount={warningCount}
        />
      )}

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
          <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
            Alerts
            {mergedAlerts.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-300">
                {mergedAlerts.length} active
              </span>
            )}
          </h3>
          <AlertPanel alerts={mergedAlerts} onRefresh={fetchAlerts} />
        </div>
      </div>
    </div>
  );
}

function ControlAttentionBanner({ alert, criticalCount, warningCount }) {
  const isCritical = alert.severity === "critical";
  const Icon = isCritical ? AlertCircle : AlertTriangle;
  const palette = isCritical
    ? {
        bg: "from-red-500/15 via-rose-500/10 to-orange-500/5",
        border: "border-red-500/30",
        ring: "ring-red-500/30",
        icon: "text-red-300",
        title: "text-red-200",
        glow: "bg-red-500/20",
      }
    : {
        bg: "from-yellow-500/15 via-amber-500/10 to-orange-500/5",
        border: "border-yellow-500/30",
        ring: "ring-yellow-500/25",
        icon: "text-yellow-300",
        title: "text-yellow-200",
        glow: "bg-yellow-500/20",
      };

  const unit = alert.unit || "";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${palette.border} bg-gradient-to-br ${palette.bg} backdrop-blur-sm ring-1 ${palette.ring} p-4 animate-slide-up`}
    >
      <div className={`absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl ${palette.glow}`} />
      <div className="relative flex items-start gap-4">
        <div className={`shrink-0 w-10 h-10 rounded-xl ${palette.glow} flex items-center justify-center`}>
          <Icon size={20} className={palette.icon} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-semibold ${palette.title}`}>
              {alert.sensor_id} needs attention
            </p>
            <span className="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-black/40 text-white">
              {alert.severity}
            </span>
          </div>
          <p className="text-[13px] text-gray-200 mt-1">{alert.message}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-[11px] text-gray-400">
            {alert.value != null && (
              <span>
                Current: <span className="text-white font-medium">{alert.value.toFixed(1)}{unit && ` ${unit}`}</span>
              </span>
            )}
            {alert.expected_min != null && alert.expected_max != null && (
              <span>Expected: {alert.expected_min}–{alert.expected_max}{unit && ` ${unit}`}</span>
            )}
            {alert.zone_id && <span>Zone: {alert.zone_id}</span>}
            {(criticalCount + warningCount > 1) && (
              <span className="text-gray-300">
                +{criticalCount + warningCount - 1} more
              </span>
            )}
          </div>
          {alert.suggestion && (
            <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-white/[0.06] border border-white/10">
              <Sparkles size={14} className="text-amber-300 mt-0.5 shrink-0" />
              <p className="text-[12px] text-gray-200 leading-relaxed">
                {alert.suggestion}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}