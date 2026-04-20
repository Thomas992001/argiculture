import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bot,
  Send,
  Sparkles,
  Lightbulb,
  Leaf,
  Droplets,
  Thermometer,
  Wind,
  Beaker,
  MessageCircle,
  Gauge,
  FileText,
  Calendar,
  HelpCircle,
  Zap,
  Camera,
  BookOpen,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Upload,
  Trash2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Languages,
  Hand,
  Activity,
} from "lucide-react";
import { api } from "../api/client";
import { AiInsightPanel } from "../components/AiInsightCards";

const LANGUAGES = [
  { code: "en-US", label: "English", ttsLang: "en-US" },
  { code: "ms-MY", label: "Bahasa Melayu", ttsLang: "ms-MY" },
  { code: "zh-CN", label: "中文", ttsLang: "zh-CN" },
  { code: "ta-IN", label: "தமிழ்", ttsLang: "ta-IN" },
];

const HELLO_TWIN_TRIGGERS = [
  "hello twin", "hi twin", "hey twin", "halo twin",
  "你好孪生", "你好双胞", "嗨孪生",
];

const QUICK_ACTIONS = [
  { label: "👋 Hello Twin", icon: Hand, color: "text-amber-400", isHelloTwin: true },
  { label: "How is my greenhouse?", icon: Sparkles, color: "text-greenhouse-400" },
  { label: "Any problems?", icon: Lightbulb, color: "text-yellow-400" },
  { label: "Should I water now?", icon: Droplets, color: "text-blue-400" },
  { label: "Explain VPD to me", icon: BookOpen, color: "text-purple-400" },
  { label: "Temperature analysis", icon: Thermometer, color: "text-red-400" },
  { label: "Check pH and EC", icon: Beaker, color: "text-green-400" },
  { label: "What crops suit my setup?", icon: Leaf, color: "text-greenhouse-400" },
];

const AI_TOOLS = [
  { id: "hellotwin", label: "Hello Twin", icon: Hand, color: "text-amber-400",
    description: "Proactive AI greeting with full status analysis" },
  { id: "report", label: "Daily Report", icon: FileText, color: "text-orange-400",
    description: "Generate a full AI-powered greenhouse analysis report" },
  { id: "schedule", label: "Smart Schedule", icon: Calendar, color: "text-blue-400",
    description: "AI-optimized 24-hour automation schedule" },
  { id: "whatif", label: "What-If Scenario", icon: HelpCircle, color: "text-purple-400",
    description: "Simulate changes before making them" },
  { id: "growplan", label: "Grow Plan", icon: Leaf, color: "text-greenhouse-400",
    description: "Week-by-week growing plan for any crop" },
  { id: "diagnose", label: "Plant Doctor", icon: Camera, color: "text-pink-400",
    description: "Upload a photo to diagnose plant health" },
  { id: "learn", label: "Learn", icon: BookOpen, color: "text-cyan-400",
    description: "Beginner-friendly topic explanations" },
];

function MarkdownRenderer({ text }) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1.5" />;
        let html = line
          .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
          .replace(/\*(.+?)\*/g, '<em class="text-gray-300">$1</em>')
          .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 rounded bg-gray-800 text-greenhouse-300 text-xs">$1</code>');

        if (/^#{1,3}\s/.test(line)) {
          const level = line.match(/^(#{1,3})/)[1].length;
          const content = html.replace(/^#{1,3}\s/, "");
          const sizes = { 1: "text-lg font-bold text-white mt-3", 2: "text-base font-semibold text-gray-200 mt-2", 3: "text-sm font-semibold text-gray-300 mt-2" };
          return <div key={i} className={sizes[level]} dangerouslySetInnerHTML={{ __html: content }} />;
        }
        if (/^\d+\.\s/.test(html)) return <div key={i} className="pl-3 text-gray-300 text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
        if (html.startsWith("- ")) return (
          <div key={i} className="pl-3 flex gap-2 text-sm text-gray-300">
            <span className="text-greenhouse-400 shrink-0">•</span>
            <span dangerouslySetInnerHTML={{ __html: html.slice(2) }} />
          </div>
        );
        if (html.startsWith("|")) return <div key={i} className="text-xs text-gray-400 font-mono" dangerouslySetInnerHTML={{ __html: html }} />;
        return <p key={i} className="text-sm text-gray-300" dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}

export default function AssistantPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [geminiStatus, setGeminiStatus] = useState(null);
  const [vpd, setVpd] = useState(null);
  const [crops, setCrops] = useState([]);
  const [activeTool, setActiveTool] = useState(null);
  const [toolInput, setToolInput] = useState("");
  const [selectedCrop, setSelectedCrop] = useState("lettuce");
  const [imageFile, setImageFile] = useState(null);
  const [voiceLang, setVoiceLang] = useState("en-US");
  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  const speechSupported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => {
    api.getAdvisorStatus().then(setGeminiStatus).catch(() => {});
    api.getVpdInfo().then(setVpd).catch(() => {});
    api.getCropProfiles().then(setCrops).catch(() => {});
  }, []);

  const speakText = useCallback((text) => {
    if (!ttsEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const plain = text
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/`(.+?)`/g, "$1")
      .replace(/#{1,3}\s/g, "")
      .replace(/\|/g, " ")
      .replace(/---/g, "");
    const maxLen = 500;
    const chunk = plain.length > maxLen ? plain.slice(0, maxLen) + "..." : plain;
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.lang = voiceLang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }, [ttsEnabled, voiceLang]);

  const startListening = useCallback(() => {
    if (!speechSupported) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = voiceLang;
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) {
        setInput(transcript);
        setIsListening(false);
        const lower = transcript.toLowerCase();
        if (HELLO_TWIN_TRIGGERS.some((t) => lower.includes(t))) {
          triggerHelloTwin();
        } else {
          sendMessage(transcript);
        }
        setInput("");
      }
    };
    recognition.onerror = (event) => {
      console.warn("Speech recognition error:", event.error);
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      setIsListening(false);
    }
  }, [voiceLang, speechSupported]);

  const stopListening = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch (e) {}
    setIsListening(false);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const addBotMessage = useCallback((text, extra = {}) => {
    setMessages((prev) => [...prev, {
      id: Date.now() + Math.random(), text, isUser: false, ...extra,
    }]);
    speakText(text);
  }, [speakText]);

  const triggerHelloTwin = async () => {
    setMessages((prev) => [...prev, { id: Date.now(), text: "👋 Hello Twin", isUser: true }]);
    setLoading(true);
    try {
      const response = await api.helloTwin();
      addBotMessage(response.answer, {
        model: response.model, powered_by: response.powered_by,
        intent: response.intent, actions_taken: response.actions_taken,
        actions_proposed: response.actions_proposed, action_id: response.action_id,
      });
    } catch {
      addBotMessage("Sorry, Hello Twin failed. Please check if the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (text) => {
    const lower = text.toLowerCase().trim();
    if (HELLO_TWIN_TRIGGERS.some((t) => lower.includes(t))) {
      return triggerHelloTwin();
    }
    setMessages((prev) => [...prev, { id: Date.now(), text, isUser: true }]);
    setLoading(true);
    try {
      const response = await api.agentChat(text, "default", voiceLang);
      addBotMessage(response.answer, {
        model: response.model, powered_by: response.powered_by,
        intent: response.intent, actions_taken: response.actions_taken,
        actions_proposed: response.actions_proposed, action_id: response.action_id,
      });
    } catch {
      addBotMessage("Sorry, something went wrong. Please check if the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = async (actionId) => {
    setConfirming(true);
    try {
      const response = await api.confirmAction(actionId);
      setMessages((prev) => {
        const updated = prev.map((msg) =>
          msg.action_id === actionId ? { ...msg, actions_proposed: [], action_id: null } : msg
        );
        return [...updated, {
          id: Date.now() + Math.random(), text: response.answer, isUser: false,
          powered_by: response.powered_by, intent: response.intent,
          actions_taken: response.actions_taken, actions_proposed: [],
        }];
      });
    } catch {
      addBotMessage("Failed to confirm action. Please try again.");
    } finally {
      setConfirming(false);
    }
  };

  const handleRejectAction = (actionId) => {
    setMessages((prev) => {
      const updated = prev.map((msg) =>
        msg.action_id === actionId ? { ...msg, actions_proposed: [], action_id: null } : msg
      );
      return [...updated, {
        id: Date.now() + Math.random(), text: "❌ Action cancelled by user.", isUser: false, intent: "cancelled",
      }];
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput("");
    sendMessage(trimmed);
  };

  const runTool = async (toolId) => {
    setLoading(true);
    try {
      let result;
      switch (toolId) {
        case "hellotwin":
          await triggerHelloTwin();
          setLoading(false);
          return;
        case "report":
          setMessages((prev) => [...prev, { id: Date.now(), text: "Generate a daily greenhouse report", isUser: true }]);
          result = await api.getDailyReport();
          addBotMessage(result.report, { powered_by: result.powered_by });
          break;
        case "schedule":
          setMessages((prev) => [...prev, { id: Date.now(), text: "Create a smart 24-hour automation schedule", isUser: true }]);
          result = await api.getAutomationSchedule();
          addBotMessage(result.schedule, { powered_by: result.powered_by });
          break;
        case "whatif":
          if (!toolInput.trim()) { setLoading(false); return; }
          setMessages((prev) => [...prev, { id: Date.now(), text: `What if: ${toolInput}`, isUser: true }]);
          result = await api.whatIfAnalysis(toolInput);
          addBotMessage(result.analysis, { powered_by: result.powered_by });
          setToolInput("");
          setActiveTool(null);
          break;
        case "growplan":
          setMessages((prev) => [...prev, { id: Date.now(), text: `Create a grow plan for ${selectedCrop}`, isUser: true }]);
          result = await api.getGrowPlan(selectedCrop, 4);
          addBotMessage(result.plan, { powered_by: result.powered_by });
          setActiveTool(null);
          break;
        case "diagnose":
          if (!imageFile) { setLoading(false); return; }
          setMessages((prev) => [...prev, { id: Date.now(), text: `Diagnose plant image: ${imageFile.name}`, isUser: true }]);
          result = await api.diagnosePlantImage(imageFile, toolInput);
          addBotMessage(result.diagnosis, { powered_by: result.powered_by });
          setImageFile(null);
          setToolInput("");
          setActiveTool(null);
          break;
        case "learn":
          if (!toolInput.trim()) { setLoading(false); return; }
          setMessages((prev) => [...prev, { id: Date.now(), text: `Teach me about: ${toolInput}`, isUser: true }]);
          result = await api.learnTopic(toolInput);
          addBotMessage(result.explanation, { powered_by: result.powered_by });
          setToolInput("");
          setActiveTool(null);
          break;
        default:
          break;
      }
    } catch (err) {
      const msg = err.message || "Unknown error";
      const isRateLimit = msg.includes("429") || msg.includes("rate") || msg.includes("quota");
      addBotMessage(
        isRateLimit
          ? "The AI is temporarily rate-limited by Google. The system will automatically switch to a backup model. Please try again in a moment."
          : `Error: ${msg}`,
        { powered_by: isRateLimit ? "rate_limited" : "error" }
      );
      api.getAdvisorStatus().then(setGeminiStatus).catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  const clearChat = async () => {
    await api.clearChat().catch(() => {});
    setMessages([]);
  };

  const geminiOk = geminiStatus?.gemini_available;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot size={28} className="text-greenhouse-400" />
            AI Assistant
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Powered by Google Gemini — real AI with live greenhouse sensor data
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Language selector */}
          <div className="relative">
            <button onClick={() => setShowLangMenu(!showLangMenu)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors">
              <Languages size={12} />
              {LANGUAGES.find((l) => l.code === voiceLang)?.label || "English"}
            </button>
            {showLangMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[140px]">
                {LANGUAGES.map((lang) => (
                  <button key={lang.code}
                    onClick={() => { setVoiceLang(lang.code); setShowLangMenu(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-700 transition-colors ${
                      voiceLang === lang.code ? "text-greenhouse-400 font-medium" : "text-gray-300"
                    }`}>
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* TTS toggle */}
          <button onClick={() => { setTtsEnabled(!ttsEnabled); window.speechSynthesis?.cancel(); }}
            title={ttsEnabled ? "Mute voice output" : "Enable voice output"}
            className={`p-1.5 rounded-lg transition-colors ${
              ttsEnabled ? "text-greenhouse-400 hover:bg-greenhouse-500/10" : "text-gray-500 hover:bg-gray-800"
            }`}>
            {ttsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>

          {/* Gemini status */}
          {geminiStatus && (
            <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${
              geminiStatus.all_models_blocked
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : geminiOk
                  ? "bg-greenhouse-500/10 border-greenhouse-500/30 text-greenhouse-400"
                  : "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
            }`}>
              {geminiStatus.all_models_blocked ? <XCircle size={12} /> : geminiOk ? <CheckCircle size={12} /> : <XCircle size={12} />}
              {geminiStatus.all_models_blocked
                ? "Rate limited"
                : geminiOk
                  ? `Gemini ${geminiStatus.active_model || geminiStatus.model}`
                  : "Local Mode"}
            </div>
          )}
          <button onClick={() => api.getAdvisorStatus().then(setGeminiStatus)}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Chat — main area */}
        <div className="lg:col-span-3 flex flex-col bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800 overflow-hidden" style={{ height: "700px" }}>
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-10">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-greenhouse-500/30 to-blue-500/20 flex items-center justify-center mb-4">
                  <Sparkles size={28} className="text-greenhouse-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">GreenMind AI</h3>
                <p className="text-sm text-gray-500 max-w-md mb-6">
                  I'm a real AI that analyzes your greenhouse sensors in real-time. Ask me anything — I'll give you data-driven, expert advice.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-w-2xl">
                  {QUICK_ACTIONS.map((q) => (
                    <button key={q.label} onClick={() => q.isHelloTwin ? triggerHelloTwin() : sendMessage(q.label)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs transition-all text-left ${
                        q.isHelloTwin
                          ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-500/40 text-amber-400 hover:from-amber-500/30 hover:to-orange-500/30 font-medium"
                          : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-greenhouse-600/40"
                      }`}>
                      <q.icon size={14} className={`${q.color} shrink-0`} />
                      <span>{q.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 animate-slide-up ${msg.isUser ? "flex-row-reverse" : ""}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.isUser ? "bg-blue-500/20 text-blue-400" : "bg-greenhouse-500/20 text-greenhouse-400"
                }`}>
                  {msg.isUser ? <MessageCircle size={15} /> : <Sparkles size={15} />}
                </div>
                <div className={`max-w-[85%] rounded-xl px-4 py-3 ${
                  msg.isUser ? "bg-blue-600/20 border border-blue-600/30" : "bg-gray-800/70 border border-gray-700/50"
                }`}>
                  {msg.isUser ? (
                    <p className="text-sm text-blue-200">{msg.text}</p>
                  ) : (
                    <>
                      <MarkdownRenderer text={msg.text} />
                      {/* Actions Taken Cards */}
                      {msg.actions_taken && msg.actions_taken.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {msg.actions_taken.map((a, i) => (
                            <div key={i} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs border ${
                              a.success ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-red-500/10 border-red-500/30 text-red-400"
                            }`}>
                              {a.success ? <CheckCircle size={12} /> : <XCircle size={12} />}
                              <span className="font-medium">{a.actuator_name || a.actuator_id}</span>
                              <span className="text-gray-400">→</span>
                              <span className="uppercase font-mono">{a.command}</span>
                              {a.duration_seconds && <span className="text-gray-500 ml-auto">{a.duration_seconds}s</span>}
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Actions Proposed Cards with Confirm/Reject */}
                      {msg.actions_proposed && msg.actions_proposed.length > 0 && msg.action_id && (
                        <div className="mt-2 space-y-2">
                          <div className="space-y-1.5">
                            {msg.actions_proposed.map((a, i) => (
                              <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs bg-amber-500/10 border border-amber-500/30 text-amber-400">
                                <Activity size={12} />
                                <span className="font-medium">{a.actuator_name || a.actuator_id}</span>
                                <span className="text-gray-400">→</span>
                                <span className="uppercase font-mono">{a.command}</span>
                                {a.duration_seconds && <span className="text-gray-500 ml-auto">{a.duration_seconds}s</span>}
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleConfirmAction(msg.action_id)} disabled={confirming}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white text-xs font-medium transition-colors">
                              {confirming ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />} Confirm
                            </button>
                            <button onClick={() => handleRejectAction(msg.action_id)} disabled={confirming}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-gray-300 text-xs font-medium transition-colors">
                              <XCircle size={12} /> Reject
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {msg.powered_by && (
                    <div className="mt-2 pt-1.5 border-t border-gray-700/30 flex items-center gap-1.5">
                      <Zap size={9} className={msg.powered_by === "google_gemini" ? "text-greenhouse-400" : "text-yellow-400"} />
                      <span className="text-[9px] text-gray-600">
                        {msg.powered_by === "google_gemini" ? `Google Gemini • ${msg.model || ""}` : "Local AI (set API key for Gemini)"}
                        {msg.intent && msg.intent !== "general_chat" && ` • ${msg.intent}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 animate-slide-up">
                <div className="w-8 h-8 rounded-full bg-greenhouse-500/20 flex items-center justify-center shrink-0">
                  <Sparkles size={15} className="text-greenhouse-400 animate-pulse" />
                </div>
                <div className="bg-gray-800/70 border border-gray-700/50 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-greenhouse-400" />
                    <span className="text-xs text-gray-500">Gemini is thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Active tool input panel */}
          {activeTool && (
            <div className="px-4 py-3 bg-gray-800/50 border-t border-gray-800">
              {activeTool === "whatif" && (
                <div className="flex gap-2">
                  <input value={toolInput} onChange={(e) => setToolInput(e.target.value)}
                    placeholder="e.g. 'What if I turn off the exhaust fan for 2 hours?'"
                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    onKeyDown={(e) => e.key === "Enter" && runTool("whatif")} />
                  <button onClick={() => runTool("whatif")} disabled={loading} className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm">Analyze</button>
                  <button onClick={() => setActiveTool(null)} className="px-2 text-gray-500 hover:text-gray-300"><XCircle size={16} /></button>
                </div>
              )}
              {activeTool === "growplan" && (
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-gray-400">Crop:</span>
                  <select value={selectedCrop} onChange={(e) => setSelectedCrop(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200">
                    {crops.filter(c => c.name !== "General Greenhouse").map((c) => (
                      <option key={c.name} value={c.name.toLowerCase()}>{c.name}</option>
                    ))}
                  </select>
                  <button onClick={() => runTool("growplan")} disabled={loading} className="px-3 py-2 rounded-lg bg-greenhouse-600 hover:bg-greenhouse-500 text-white text-sm">Generate Plan</button>
                  <button onClick={() => setActiveTool(null)} className="px-2 text-gray-500 hover:text-gray-300"><XCircle size={16} /></button>
                </div>
              )}
              {activeTool === "diagnose" && (
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <button onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-pink-600/20 border border-pink-600/30 text-pink-400 text-sm hover:bg-pink-600/30">
                      <Upload size={14} /> {imageFile ? imageFile.name : "Choose Image"}
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                      onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                    <input value={toolInput} onChange={(e) => setToolInput(e.target.value)}
                      placeholder="Describe symptoms (optional)"
                      className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500" />
                    <button onClick={() => runTool("diagnose")} disabled={loading || !imageFile} className="px-3 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:bg-gray-700 text-white text-sm">Diagnose</button>
                    <button onClick={() => setActiveTool(null)} className="px-2 text-gray-500 hover:text-gray-300"><XCircle size={16} /></button>
                  </div>
                </div>
              )}
              {activeTool === "learn" && (
                <div className="flex gap-2">
                  <input value={toolInput} onChange={(e) => setToolInput(e.target.value)}
                    placeholder="e.g. 'VPD', 'nutrient lockout', 'photosynthesis', 'Pythium'..."
                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    onKeyDown={(e) => e.key === "Enter" && runTool("learn")} />
                  <button onClick={() => runTool("learn")} disabled={loading} className="px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm">Explain</button>
                  <button onClick={() => setActiveTool(null)} className="px-2 text-gray-500 hover:text-gray-300"><XCircle size={16} /></button>
                </div>
              )}
            </div>
          )}

          {/* Input + Voice Controls */}
          <form onSubmit={handleSubmit} className="p-4 border-t border-gray-800 flex gap-2 items-center">
            {speechSupported && (
              <button type="button" onClick={isListening ? stopListening : startListening}
                title={isListening ? "Stop listening" : "Voice input"}
                className={`px-3 py-2.5 rounded-xl transition-colors ${
                  isListening
                    ? "bg-red-600 hover:bg-red-500 text-white animate-pulse"
                    : "bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200"
                }`}>
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            )}
            <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? "Listening..." : "Ask GreenMind anything..."}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-greenhouse-500/50"
              disabled={loading} />
            <button type="submit" disabled={!input.trim() || loading}
              className="px-4 py-2.5 rounded-xl bg-greenhouse-600 hover:bg-greenhouse-500 disabled:bg-gray-700 disabled:text-gray-500 text-white transition-colors">
              <Send size={16} />
            </button>
            {messages.length > 0 && (
              <button type="button" onClick={clearChat} title="Clear conversation"
                className="px-3 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors">
                <Trash2 size={16} />
              </button>
            )}
          </form>
        </div>

        {/* Sidebar — AI Tools + Status */}
        <div className="space-y-4">
          {/* AI Tools */}
          <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Zap size={14} className="text-greenhouse-400" />
              AI Power Tools
            </h3>
            <div className="space-y-2">
              {AI_TOOLS.map((tool) => (
                <button key={tool.id}
                  onClick={() => {
                    if (tool.id === "report" || tool.id === "schedule" || tool.id === "hellotwin") { runTool(tool.id); }
                    else { setActiveTool(tool.id); setToolInput(""); }
                  }}
                  disabled={loading}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    activeTool === tool.id
                      ? "bg-greenhouse-600/10 border-greenhouse-600/40"
                      : "bg-gray-800/50 border-gray-700/50 hover:border-gray-600"
                  }`}>
                  <div className="flex items-center gap-2.5">
                    <tool.icon size={16} className={tool.color} />
                    <div>
                      <p className="text-xs font-medium text-gray-200">{tool.label}</p>
                      <p className="text-[10px] text-gray-500">{tool.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* VPD Widget */}
          {vpd && !vpd.error && (
            <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                <Gauge size={14} className="text-purple-400" /> VPD
              </h3>
              <div className="text-2xl font-bold text-purple-400">{vpd.vpd_kpa} <span className="text-xs text-gray-500">kPa</span></div>
              <div className={`text-[10px] mt-1 ${vpd.status === "optimal" ? "text-greenhouse-400" : "text-yellow-400"}`}>
                {vpd.status.toUpperCase()} • {vpd.temperature_c}°C • {vpd.humidity_percent}% RH
              </div>
            </div>
          )}

          {/* AI Insights (rule-based, fast) */}
          <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
              <Sparkles size={14} className="text-greenhouse-400" /> Quick Insights
            </h3>
            <AiInsightPanel maxItems={5} compact />
          </div>
        </div>
      </div>
    </div>
  );
}
