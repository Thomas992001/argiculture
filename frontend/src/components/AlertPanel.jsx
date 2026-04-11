import { useState, useEffect } from "react";
import { AlertTriangle, AlertCircle, Info, Check } from "lucide-react";
import { api } from "../api/client";

const SEVERITY_STYLES = {
  critical: {
    icon: AlertCircle,
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
    badge: "bg-red-500",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    text: "text-yellow-400",
    badge: "bg-yellow-500",
  },
  info: {
    icon: Info,
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-400",
    badge: "bg-blue-500",
  },
};

export default function AlertPanel({ alerts = [], onRefresh }) {
  const handleAcknowledge = async (alertId) => {
    try {
      await api.acknowledgeAlert(alertId);
      onRefresh?.();
    } catch (err) {
      console.error("Failed to acknowledge alert:", err);
    }
  };

  if (alerts.length === 0) {
    return (
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6 text-center">
        <Check size={32} className="mx-auto text-greenhouse-400 mb-2" />
        <p className="text-gray-400 text-sm">All systems normal</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {alerts.map((alert) => {
        const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info;
        const Icon = style.icon;

        return (
          <div
            key={alert.alert_id}
            className={`flex items-start gap-3 p-3 rounded-lg border ${style.bg} ${style.border} animate-slide-up`}
          >
            <Icon size={16} className={`${style.text} mt-0.5 shrink-0`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${style.text}`}>{alert.message}</p>
              <p className="text-[10px] text-gray-500 mt-1">
                {new Date(alert.timestamp).toLocaleTimeString()}
                {alert.zone_id && ` • ${alert.zone_id}`}
              </p>
            </div>
            <button
              onClick={() => handleAcknowledge(alert.alert_id)}
              className="text-gray-500 hover:text-gray-300 transition-colors shrink-0"
              title="Acknowledge"
            >
              <Check size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
