import { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  Thermometer,
  Droplets,
  Wind,
  Gauge,
  Beaker,
  Sun,
  Waves,
  Zap,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronRight,
} from "lucide-react";
import { api } from "../api/client";

const ICON_MAP = {
  thermometer: Thermometer,
  droplets: Droplets,
  wind: Wind,
  gauge: Gauge,
  beaker: Beaker,
  sun: Sun,
  waves: Waves,
  zap: Zap,
  check: CheckCircle,
  info: Info,
};

const PRIORITY_STYLES = {
  critical: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
    badge: "bg-red-500",
    badgeText: "text-white",
  },
  high: {
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    text: "text-orange-400",
    badge: "bg-orange-500",
    badgeText: "text-white",
  },
  medium: {
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    text: "text-yellow-400",
    badge: "bg-yellow-500",
    badgeText: "text-black",
  },
  low: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-400",
    badge: "bg-blue-500",
    badgeText: "text-white",
  },
  info: {
    bg: "bg-greenhouse-500/10",
    border: "border-greenhouse-500/30",
    text: "text-greenhouse-400",
    badge: "bg-greenhouse-500",
    badgeText: "text-white",
  },
};

function InsightCard({ insight, compact = false }) {
  const [expanded, setExpanded] = useState(false);
  const style = PRIORITY_STYLES[insight.priority] || PRIORITY_STYLES.info;
  const Icon = ICON_MAP[insight.icon] || Info;

  if (compact) {
    return (
      <div
        className={`flex items-center gap-3 p-3 rounded-lg border ${style.bg} ${style.border} cursor-pointer hover:brightness-110 transition-all`}
        onClick={() => setExpanded(!expanded)}
      >
        <Icon size={16} className={`${style.text} shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${style.text} truncate`}>
            {insight.title}
          </p>
          {expanded && (
            <div className="mt-1.5 animate-slide-up">
              <p className="text-xs text-gray-400">{insight.message}</p>
              {insight.action && (
                <p className="text-xs text-greenhouse-400 mt-1 flex items-center gap-1">
                  <ChevronRight size={10} />
                  {insight.action}
                </p>
              )}
            </div>
          )}
        </div>
        <span
          className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${style.badge} ${style.badgeText} shrink-0 uppercase`}
        >
          {insight.priority}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`p-4 rounded-xl border ${style.bg} ${style.border} animate-slide-up`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${style.bg}`}>
          <Icon size={18} className={style.text} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={`text-sm font-semibold ${style.text}`}>
              {insight.title}
            </h4>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${style.badge} ${style.badgeText} uppercase`}
            >
              {insight.priority}
            </span>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            {insight.message}
          </p>
          {insight.action && (
            <div className="mt-2 flex items-start gap-1.5 p-2 rounded-md bg-gray-800/50">
              <Sparkles size={12} className="text-greenhouse-400 mt-0.5 shrink-0" />
              <p className="text-xs text-greenhouse-300">{insight.action}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AiInsightPanel({ maxItems = 5, compact = false }) {
  const [insights, setInsights] = useState([]);
  const [poweredBy, setPoweredBy] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchInsights = useCallback(async () => {
    try {
      const data = await api.getInsights();
      const items = data.insights || data;
      setInsights(Array.isArray(items) ? items : []);
      setPoweredBy(data.powered_by || null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights();
    const interval = setInterval(fetchInsights, 60000);
    return () => clearInterval(interval);
  }, [fetchInsights]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-gray-500 text-sm">
        <Sparkles size={14} className="animate-pulse" />
        Analyzing greenhouse data...
      </div>
    );
  }

  const displayed = insights.slice(0, maxItems);
  const actionable = displayed.filter((i) => i.priority !== "info");
  const infoItems = displayed.filter((i) => i.priority === "info");

  return (
    <div className="space-y-2">
      {poweredBy && (
        <div className="flex items-center gap-1.5 mb-1">
          <Zap size={10} className={poweredBy === "google_gemini" ? "text-greenhouse-500" : "text-gray-600"} />
          <span className="text-[9px] text-gray-500">
            {poweredBy === "google_gemini" ? "Powered by Google Gemini" : "Local AI"}
          </span>
        </div>
      )}
      {actionable.length === 0 && infoItems.length === 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-greenhouse-500/10 border border-greenhouse-500/30">
          <CheckCircle size={16} className="text-greenhouse-400" />
          <p className="text-sm text-greenhouse-400">
            All systems optimal — no actions needed
          </p>
        </div>
      )}
      {actionable.map((insight, i) => (
        <InsightCard key={i} insight={insight} compact={compact} />
      ))}
      {infoItems.length > 0 && !compact && (
        <div className="pt-1">
          {infoItems.map((insight, i) => (
            <InsightCard key={`info-${i}`} insight={insight} compact />
          ))}
        </div>
      )}
    </div>
  );
}

export function AiSummaryBanner() {
  const [summary, setSummary] = useState("");
  const [poweredBy, setPoweredBy] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const data = await api.getSummary();
        setSummary(data.summary);
        setPoweredBy(data.powered_by || null);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
    const interval = setInterval(fetchSummary, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !summary) return null;

  const isGemini = poweredBy === "google_gemini";

  return (
    <div className="bg-gradient-to-r from-greenhouse-900/40 to-gray-900/40 border border-greenhouse-700/30 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-greenhouse-500/20 flex items-center justify-center shrink-0">
          <Sparkles size={16} className="text-greenhouse-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-greenhouse-400">
              AI Summary
            </h3>
            <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full ${
              isGemini
                ? "bg-greenhouse-500/15 text-greenhouse-400 border border-greenhouse-500/30"
                : "bg-gray-700/50 text-gray-400 border border-gray-600/30"
            }`}>
              <Zap size={8} />
              {isGemini ? "Gemini" : "Local"}
            </span>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">{summary}</p>
        </div>
      </div>
    </div>
  );
}

export default InsightCard;
