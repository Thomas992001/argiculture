import { useState } from "react";
import {
  Power,
  Fan,
  Droplets,
  Flame,
  Sun,
  Wind,
  AlertOctagon,
  Loader2,
} from "lucide-react";
import { api } from "../api/client";
import { db, auth } from "../firebase";
import { doc, setDoc } from "firebase/firestore";

const ACTUATOR_CONFIG = {
  pump_main: { icon: Droplets, label: "Main Pump", color: "blue" },
  pump_nutrient: { icon: Droplets, label: "Nutrient Pump", color: "cyan" },
  fan_exhaust: { icon: Fan, label: "Exhaust Fan", color: "purple" },
  fan_circulation: { icon: Wind, label: "Circulation Fan", color: "indigo" },
  valve_irrigation: { icon: Droplets, label: "Irrigation Valve", color: "teal" },
  heater_main: { icon: Flame, label: "Main Heater", color: "red" },
  light_supplemental: { icon: Sun, label: "Supplemental Light", color: "yellow" },
  co2_injector: { icon: Wind, label: "CO₂ Injector", color: "green" },
};

function ActuatorSwitch({ actuator, onToggle }) {
  const [loading, setLoading] = useState(false);
  const config = ACTUATOR_CONFIG[actuator.actuator_id] || {
    icon: Power,
    label: actuator.name,
    color: "gray",
  };
  const Icon = config.icon;
  const isOn = actuator.state === "on";

  const handleToggle = async () => {
    setLoading(true);
    try {
      await onToggle(actuator.actuator_id, isOn ? "off" : "on");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
        isOn
          ? `border-${config.color}-500/30 bg-${config.color}-500/10`
          : "border-gray-700 bg-gray-900/50"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`p-2 rounded-lg ${
            isOn ? `bg-${config.color}-500/20` : "bg-gray-800"
          }`}
        >
          <Icon
            size={18}
            className={isOn ? `text-${config.color}-400` : "text-gray-500"}
          />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-200">{config.label}</p>
          <p className="text-[10px] text-gray-500">{actuator.zone_id}</p>
        </div>
      </div>

      <button
        onClick={handleToggle}
        disabled={loading}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          isOn ? "bg-greenhouse-500" : "bg-gray-700"
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
              isOn ? "translate-x-6" : "translate-x-0.5"
            }`}
          />
        )}
      </button>
    </div>
  );
}

export default function ControlPanel({ actuators = [], onRefresh }) {
  const handleToggle = async (actuatorId, command) => {
    const user = auth.currentUser;
    if (!user) return;

    const controlRef = doc(db, "users", user.uid, "control", "latest");
    const state = command === "on";

    try {
      await setDoc(controlRef, { [actuatorId]: state }, { merge: true });
      // We don't call onRefresh here anymore because the 
      // ControlPage will be listening to Firestore snapshots
    } catch (error) {
      console.error("Firestore control error:", error);
    }
  };

  const handleEmergencyStop = async () => {
    const user = auth.currentUser;
    if (!user || !window.confirm("Emergency stop: turn off ALL actuators?")) return;

    const controlRef = doc(db, "users", user.uid, "control", "latest");
    
    // Construct all-off object
    const allOff = {};
    actuators.forEach(act => {
      allOff[act.actuator_id] = false;
    });

    try {
      await setDoc(controlRef, allOff, { merge: true });
    } catch (error) {
       console.error("Emergency stop error:", error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {actuators.map((act) => (
          <ActuatorSwitch
            key={act.actuator_id}
            actuator={act}
            onToggle={handleToggle}
          />
        ))}
      </div>

      <button
        onClick={handleEmergencyStop}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-600/20 border border-red-600/40 text-red-400 hover:bg-red-600/30 transition-colors font-medium"
      >
        <AlertOctagon size={18} />
        Emergency Stop — All Actuators OFF
      </button>
    </div>
  );
}
