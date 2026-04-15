import { useState, useEffect, useCallback } from "react";
import { Brain, ShieldAlert, TrendingUp, Zap } from "lucide-react";
import { api } from "../api/client";
import ForecastChart from "../components/ForecastChart";

const FORECAST_OPTIONS = [
  { zone: "zone_air", sensor: "humidity", label: "Air Humidity Forecast" },
  { zone: "zone_bed_a", sensor: "soil_temperature", label: "Soil Temperature Forecast" },
  { zone: "zone_bed_a", sensor: "soil_ph", label: "Soil pH Value Forecast" },
  { zone: "zone_bed_a", sensor: "soil_moisture", label: "Soil Moisture Forecast" },
];

export default function AnalyticsPage() {
  const [selectedForecast, setSelectedForecast] = useState(0);
  const [forecastData, setForecastData] = useState(null);
  const [anomalyResult, setAnomalyResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [anomalyLoading, setAnomalyLoading] = useState(false);

  const fetchForecast = useCallback(async () => {
    const opt = FORECAST_OPTIONS[selectedForecast];
    setLoading(true);
    try {
      const data = await api.getForecast(opt.zone, opt.sensor, 60);
      setForecastData(data);
    } catch {
      setForecastData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedForecast]);

  const fetchAnomalies = useCallback(async () => {
    setAnomalyLoading(true);
    try {
      const data = await api.getAnomalies();
      setAnomalyResult(data);
    } catch {
      setAnomalyResult(null);
    } finally {
      setAnomalyLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchForecast();
    fetchAnomalies();
    const interval = setInterval(() => {
      fetchForecast();
      fetchAnomalies();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchForecast, fetchAnomalies]);

  const sensors = anomalyResult?.sensors || [];
  const detectedAnomalies = sensors.filter((a) => a.is_anomaly);
  const normalSensors = sensors.filter((a) => !a.is_anomaly);
  const anomalyPoweredBy = anomalyResult?.powered_by;
  const isGeminiAnomaly = anomalyPoweredBy === "google_gemini";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">AI Analytics</h2>
        <p className="text-sm text-gray-500 mt-1">
          All analytics powered by Google Gemini AI
        </p>
      </div>

      {/* Forecast section */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <TrendingUp size={18} className="text-greenhouse-400" />
          <h3 className="text-lg font-semibold text-gray-200">Forecasting</h3>
        </div>

        <div className="flex flex-wrap gap-2">
          {FORECAST_OPTIONS.map((opt, i) => (
            <button
              key={i}
              onClick={() => setSelectedForecast(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedForecast === i
                  ? "bg-greenhouse-600/30 text-greenhouse-400 border border-greenhouse-600/40"
                  : "bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-12 text-center">
            <Brain size={32} className="mx-auto text-gray-600 animate-pulse mb-2" />
            <p className="text-gray-500 text-sm">Generating forecast with Gemini...</p>
          </div>
        ) : (
          <ForecastChart forecastData={forecastData} height={280} />
        )}
      </div>

      {/* Anomaly detection section */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <ShieldAlert size={18} className="text-yellow-400" />
          <h3 className="text-lg font-semibold text-gray-200">
            Anomaly Detection
          </h3>
          <span className="text-xs text-gray-500">
            {sensors.length} sensors monitored
          </span>
          {anomalyPoweredBy && (
            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${
              isGeminiAnomaly
                ? "bg-greenhouse-500/15 text-greenhouse-400 border border-greenhouse-500/30"
                : "bg-gray-800 text-gray-500 border border-gray-700"
            }`}>
              <Zap size={8} />
              {isGeminiAnomaly ? "Gemini" : "Local"}
            </span>
          )}
        </div>

        {anomalyLoading && (
          <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-8 text-center">
            <Brain size={24} className="mx-auto text-gray-600 animate-pulse mb-2" />
            <p className="text-gray-500 text-sm">Analyzing anomalies with Gemini...</p>
          </div>
        )}

        {detectedAnomalies.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-red-400 font-medium">
              Anomalies Detected ({detectedAnomalies.length})
            </p>
            {detectedAnomalies.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20"
              >
                <div>
                  <p className="text-sm text-red-300">{a.sensor_id}</p>
                  <p className="text-xs text-gray-500">{a.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-400">
                    {a.current_value?.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    Expected: {a.expected_min?.toFixed(1)} — {a.expected_max?.toFixed(1)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Gemini AI analysis of anomalies */}
        {anomalyResult?.ai_analysis && (
          <div className="p-4 rounded-xl bg-greenhouse-500/5 border border-greenhouse-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Brain size={14} className="text-greenhouse-400" />
              <span className="text-xs font-semibold text-greenhouse-400 uppercase tracking-wider">
                Gemini Anomaly Analysis
              </span>
            </div>
            <div className="text-xs text-gray-400 leading-relaxed whitespace-pre-line">
              {anomalyResult.ai_analysis}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {normalSensors.map((a, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-900/50 border border-gray-800"
            >
              <div>
                <p className="text-sm text-gray-300">{a.sensor_id}</p>
                <p className="text-[10px] text-gray-500">
                  {a.sensor_type} • {a.zone_id}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-greenhouse-400">
                  {a.current_value?.toFixed(2)}
                </p>
                <p className="text-[10px] text-gray-500">
                  Score: {a.anomaly_score?.toFixed(3)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
