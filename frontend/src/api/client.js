const API_BASE = "/api";

async function fetchJSON(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export const api = {
  getStatus: () => fetchJSON("/status"),
  getLatestReadings: () => fetchJSON("/sensors/latest"),
  getSensorHistory: (zoneId, sensorType, minutes = 60) =>
    fetchJSON(
      `/sensors/history?zone_id=${zoneId}&sensor_type=${sensorType}&minutes=${minutes}`
    ),
  getTwinState: () => fetchJSON("/twin/state"),
  getZones: () => fetchJSON("/twin/zones"),
  getActuators: () => fetchJSON("/twin/actuators"),
  getAlerts: () => fetchJSON("/twin/alerts"),
  acknowledgeAlert: (alertId) =>
    fetchJSON(`/twin/alerts/${alertId}/acknowledge`, { method: "POST" }),
  controlActuator: (actuatorId, command, value = null) =>
    fetchJSON("/control/actuator", {
      method: "POST",
      body: JSON.stringify({
        actuator_id: actuatorId,
        command,
        value,
      }),
    }),
  emergencyStop: () => fetchJSON("/control/emergency-stop", { method: "POST" }),
  getForecast: (zoneId, sensorType, horizonMinutes = 60) =>
    fetchJSON(
      `/analytics/forecast?zone_id=${zoneId}&sensor_type=${sensorType}&horizon_minutes=${horizonMinutes}`
    ),
  getAnomalies: () => fetchJSON("/analytics/anomalies"),
  getStatistics: (zoneId, sensorType) =>
    fetchJSON(
      `/analytics/statistics?zone_id=${zoneId}&sensor_type=${sensorType}`
    ),

  // AI Advisor (Gemini-powered)
  getInsights: () => fetchJSON("/advisor/insights"),
  getSummary: () => fetchJSON("/advisor/summary"),
  getAdvisorStatus: () => fetchJSON("/advisor/status"),
  chatWithAdvisor: (message, sessionId = "default", language = null) =>
    fetchJSON("/advisor/chat", {
      method: "POST",
      body: JSON.stringify({ message, session_id: sessionId, language }),
    }),
  clearChat: (sessionId = "default") =>
    fetchJSON(`/advisor/chat/clear?session_id=${sessionId}`, { method: "POST" }),
  getDailyReport: (language = null) => fetchJSON(`/advisor/daily-report${language ? `?language=${language}` : ""}`),
  getGrowPlan: (crop = "lettuce", weeks = 4, language = null) =>
    fetchJSON("/advisor/grow-plan", {
      method: "POST",
      body: JSON.stringify({ crop, weeks, language }),
    }),
  whatIfAnalysis: (scenario, language = null) =>
    fetchJSON("/advisor/what-if", {
      method: "POST",
      body: JSON.stringify({ scenario, language }),
    }),
  diagnosePlantImage: (file, description = "", language = null) => {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("description", description);
    if (language) formData.append("language", language);
    return fetch(`${API_BASE}/advisor/diagnose-image`, {
      method: "POST",
      body: formData,
    }).then((r) => {
      if (!r.ok) throw new Error(`API error: ${r.status}`);
      return r.json();
    });
  },
  getAutomationSchedule: (language = null) => fetchJSON(`/advisor/automation-schedule${language ? `?language=${language}` : ""}`),
  learnTopic: (topic, language = null) => fetchJSON(`/advisor/learn/${encodeURIComponent(topic)}${language ? `?language=${language}` : ""}`),
  getCropProfiles: () => fetchJSON("/advisor/crops"),
  setActiveCrop: (cropName) =>
    fetchJSON(`/advisor/crop/${cropName}`, { method: "POST" }),
  getVpdInfo: () => fetchJSON("/advisor/vpd"),
  getWeather: () => fetchJSON("/advisor/weather"),
  refreshWeather: () => fetchJSON("/advisor/weather/refresh"),
  getAutomationStatus: () => fetchJSON("/advisor/automation/status"),
  setAutomationEnabled: (enabled) =>
    fetchJSON(`/advisor/automation/enabled?enabled=${enabled ? "true" : "false"}`, {
      method: "POST",
    }),
  forecastSoilConditions: (horizonHours = 4) =>
    fetchJSON(`/advisor/forecast-soil?horizon_hours=${horizonHours}`),
  bindSimulator: (token) =>
    fetchJSON("/simulator/bind", {
      method: "POST",
      body: JSON.stringify({ idToken: token }),
    }),

  // Agentic AI
  agentChat: (message, sessionId = "default", language = null) =>
    fetchJSON("/advisor/agent-chat", {
      method: "POST",
      body: JSON.stringify({ message, session_id: sessionId, language }),
    }),
  helloTwin: (language = null) => fetchJSON(`/advisor/hello-twin${language ? `?language=${language}` : ""}`),
  confirmAction: (actionId, language = null) =>
    fetchJSON("/advisor/confirm-action", {
      method: "POST",
      body: JSON.stringify({ action_id: actionId, language }),
    }),
  getAgentLog: (limit = 50) => fetchJSON(`/advisor/agent-log?limit=${limit}`),
  searchVideos: (query, language = "en", maxResults = 3) =>
    fetchJSON(`/advisor/search-videos?q=${encodeURIComponent(query)}&language=${language}&max_results=${maxResults}`),

  // Cloud TTS (for languages without native browser voice support)
  cloudTTS: async (text, language = "ta") => {
    const res = await fetch(`${API_BASE}/advisor/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language }),
    });
    if (!res.ok) throw new Error(`TTS error: ${res.status}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
};
