import { useState, useRef, useEffect } from "react";
import {
  Bot,
  X,
  Send,
  Sparkles,
  Lightbulb,
  Leaf,
  MessageCircle,
  Zap,
  Loader2,
  Trash2,
  Mic,
  MicOff,
  Globe,
  Hand,
  CheckCircle,
  XCircle,
  Activity,
  Volume2,
  VolumeX,
  Play,
  ExternalLink,
} from "lucide-react";
import { auth, db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { api } from "../api/client";

// ── Language-aware UI + voice recognition ──
const LANGUAGES = {
  en: {
    label: "English",
    ttsLocale: "en-US",
    sttLocale: "en-US",
    placeholder: "Ask anything or give a command...",
    title: "Ask me anything about your greenhouse",
    thinking: "Thinking...",
    listening: "Listening...",
    error: "Sorry, I couldn't process that. Please try again.",
    confirm: "Confirm",
    reject: "Reject",
    cancelled: "❌ Action cancelled by user.",
    agentMode: "Agent Mode • Powered by Gemini",
    clearChat: "Clear chat",
    helloTwinBtn: "👋 Hello Twin",
    quick: [
      { label: "How is my greenhouse?", icon: Sparkles },
      { label: "Should I water now?", icon: Lightbulb },
      { label: "Any problems?", icon: Lightbulb },
      { label: "Give me tips", icon: Sparkles },
      { label: "What's the VPD?", icon: Leaf },
      { label: "Explain pH to me", icon: Leaf },
    ],
  },
  zh: {
    label: "中文",
    ttsLocale: "zh-CN",
    sttLocale: "zh-CN",
    placeholder: "问点什么，或下达指令...",
    title: "关于温室，你想了解什么？",
    thinking: "思考中...",
    listening: "正在聆听...",
    error: "抱歉，处理失败，请重试。",
    confirm: "确认",
    reject: "拒绝",
    cancelled: "❌ 操作已取消",
    agentMode: "代理模式 • Gemini驱动",
    clearChat: "清空对话",
    helloTwinBtn: "👋 小双同学",
    quick: [
      { label: "温室现在怎么样？", icon: Sparkles },
      { label: "现在需要浇水吗？", icon: Lightbulb },
      { label: "有没有问题？", icon: Lightbulb },
      { label: "给我一些建议", icon: Sparkles },
      { label: "VPD 是多少？", icon: Leaf },
      { label: "什么是 pH？", icon: Leaf },
    ],
  },
  ms: {
    label: "Malay",
    ttsLocale: "ms-MY",
    sttLocale: "ms-MY",
    placeholder: "Tanya apa-apa...",
    title: "Tanya saya tentang rumah hijau anda",
    thinking: "Sedang berfikir...",
    listening: "Sedang mendengar...",
    error: "Maaf, gagal memproses. Sila cuba lagi.",
    confirm: "Sahkan",
    reject: "Tolak",
    cancelled: "❌ Tindakan dibatalkan.",
    agentMode: "Mod Ejen • Dikuasakan Gemini",
    clearChat: "Padam sembang",
    helloTwinBtn: "👋 Hai Twin",
    quick: [
      { label: "Bagaimana keadaan rumah hijau?", icon: Sparkles },
      { label: "Patutkah saya siram sekarang?", icon: Lightbulb },
      { label: "Ada masalah?", icon: Lightbulb },
      { label: "Beri saya tip", icon: Sparkles },
      { label: "Berapa VPD?", icon: Leaf },
      { label: "Apa itu pH?", icon: Leaf },
    ],
  },
  ta: {
    label: "Tamil",
    ttsLocale: "ta-IN",
    sttLocale: "ta-IN",
    placeholder: "ஏதேனும் கேளுங்கள்...",
    title: "உங்கள் பசுமை இல்லம் பற்றி என்னிடம் கேளுங்கள்",
    thinking: "சிந்திக்கிறது...",
    listening: "கேட்கிறது...",
    error: "மன்னிக்கவும், செயல்படுத்த முடியவில்லை. மீண்டும் முயற்சிக்கவும்.",
    confirm: "உறுதி செய்",
    reject: "நிராகரி",
    cancelled: "❌ செயல் ரத்து செய்யப்பட்டது",
    agentMode: "முகவர் முறை • Gemini இயக்கப்படுகிறது",
    clearChat: "அரட்டையை அழி",
    helloTwinBtn: "👋 ஹலோ ட்வின்",
    quick: [
      { label: "என் பசுமை இல்லம் எப்படி உள்ளது?", icon: Sparkles },
      { label: "நான் இப்போது தண்ணீர் ஊற்ற வேண்டுமா?", icon: Lightbulb },
      { label: "ஏதேனும் பிரச்சனைகள் உள்ளதா?", icon: Lightbulb },
      { label: "எனக்கு குறிப்புகள் கொடுங்கள்", icon: Sparkles },
      { label: "VPD என்றால் என்ன?", icon: Leaf },
      { label: "pH பற்றி விளக்குங்கள்", icon: Leaf },
    ],
  },
};

const WAKE_WORDS_MAP = {
  en: ["hello twin", "hi twin", "hey twin", "halo twin", "hey twins", "hello twins", "hi, twins", "twins"],
  zh: ["小双同学", "你好小双", "嗨小双", "嘿小双", "你好 twin", "twins", "twin", "hi twin", "hello twin", "hey twin"],
  ms: ["hi twins", "hello twins", "hey twins", "twins", "hi twin", "hello twin", "hey twin", "halo twin", "hi, twins"],
  ta: ["hello twin", "hi twin", "hey twin", "halo twin", "hey twins", "hello twins", "twins", "ஹலோ ட்வின்", "ஹாய் ட்வின்", "ஹே ட்வின்", "ட்வின்ஸ்"],
};


// ── iOS Audio Unlock ──
const unlockAudio = () => {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance("");
    window.speechSynthesis.speak(utterance);
  }
};

function MarkdownLite({ text }) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        let html = line
          .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
          .replace(/`(.+?)`/g, '<code class="px-1 rounded bg-gray-800 text-greenhouse-300 text-[10px] sm:text-[11px]">$1</code>');

        if (/^#{1,3}\s/.test(line)) {
          const content = html.replace(/^#{1,3}\s/, "");
          return <div key={i} className="text-[13px] sm:text-sm font-semibold text-white mt-1" dangerouslySetInnerHTML={{ __html: content }} />;
        }
        if (/^\d+\.\s/.test(html)) return <div key={i} className="pl-3 text-gray-300 text-[13px] sm:text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
        if (html.startsWith("- ")) return (
          <div key={i} className="pl-3 flex gap-1.5 text-gray-300 text-[13px] sm:text-sm">
            <span className="text-greenhouse-400 shrink-0">•</span>
            <span dangerouslySetInnerHTML={{ __html: html.slice(2) }} />
          </div>
        );
        return <p key={i} className="text-gray-300 text-[13px] sm:text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}

// ── Action Cards ──
function ActionsTakenCard({ actions }) {
  if (!actions || actions.length === 0) return null;
  return (
    <div className="mt-2 space-y-1.5">
      {actions.map((a, i) => (
        <div key={i} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs border ${
          a.success
            ? "bg-green-500/10 border-green-500/30 text-green-400"
            : "bg-red-500/10 border-red-500/30 text-red-400"
        }`}>
          {a.success ? <CheckCircle size={12} /> : <XCircle size={12} />}
          <span className="font-medium">{a.actuator_name || a.actuator_id}</span>
          <span className="text-gray-400">→</span>
          <span className="uppercase font-mono">{a.command}</span>
          {a.duration_seconds && (
            <span className="text-gray-500 ml-auto">{a.duration_seconds}s</span>
          )}
        </div>
      ))}
    </div>
  );
}

function ActionsProposedCard({ actions, actionId, onConfirm, onReject, confirming, t }) {
  if (!actions || actions.length === 0) return null;
  return (
    <div className="mt-2 space-y-2">
      <div className="space-y-1.5">
        {actions.map((a, i) => (
          <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Activity size={12} />
            <span className="font-medium">{a.actuator_name || a.actuator_id}</span>
            <span className="text-gray-400">→</span>
            <span className="uppercase font-mono">{a.command}</span>
            {a.duration_seconds && (
              <span className="text-gray-500 ml-auto">{a.duration_seconds}s</span>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onConfirm(actionId)}
          disabled={confirming}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white text-xs font-medium transition-colors"
        >
          {confirming ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
          {t?.confirm || "Confirm"}
        </button>
        <button
          onClick={() => onReject(actionId)}
          disabled={confirming}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-gray-300 text-xs font-medium transition-colors"
        >
          <XCircle size={12} />
          {t?.reject || "Reject"}
        </button>
      </div>
    </div>
  );
}

function VideoCardsSection({ videos }) {
  if (!videos || videos.length === 0) return null;
  return (
    <div className="mt-2.5 space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] text-purple-400 font-medium uppercase tracking-wider">
        <Play size={10} />
        Related Videos
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
        {videos.map((v, i) => (
          <a
            key={v.video_id || i}
            href={v.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 w-[180px] group rounded-lg bg-gray-900/80 border border-gray-700/50 hover:border-purple-500/50 transition-all overflow-hidden hover:shadow-lg hover:shadow-purple-500/10"
          >
            <div className="relative w-full h-[100px] bg-gray-800 overflow-hidden">
              {v.thumbnail ? (
                <img
                  src={v.thumbnail}
                  alt={v.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600">
                  <Play size={24} />
                </div>
              )}
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="w-8 h-8 rounded-full bg-red-600/90 flex items-center justify-center shadow-lg">
                  <Play size={14} className="text-white ml-0.5" />
                </div>
              </div>
            </div>
            <div className="p-2">
              <p className="text-[11px] text-gray-200 font-medium line-clamp-2 leading-tight group-hover:text-white transition-colors">
                {v.title}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[9px] text-gray-500 truncate">{v.channel}</span>
                <ExternalLink size={8} className="text-gray-600 shrink-0" />
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export default function AiAssistant({ onOpenHeyTwin }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState(() => localStorage.getItem("twin_lang") || "zh");
  const [listening, setListening] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const ttsEnabledRef = useRef(true);
  const cloudAudioRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  // Unified helper: stop ALL speech (browser TTS + Cloud TTS audio)
  const stopAllSpeech = () => {
    try { window.speechSynthesis?.cancel(); } catch {}
    if (cloudAudioRef.current) {
      try { cloudAudioRef.current.pause(); cloudAudioRef.current.currentTime = 0; } catch {}
      cloudAudioRef.current = null;
    }
  };

  const t = LANGUAGES[language];

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 200);
  }, [isOpen]);

  useEffect(() => {
    const handleLangChange = () => {
      const stored = localStorage.getItem("twin_lang");
      if (stored && stored !== language) setLanguage(stored);
    };
    window.addEventListener("twin_lang_changed", handleLangChange);
    return () => window.removeEventListener("twin_lang_changed", handleLangChange);
  }, [language]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Stop speech if component unmounts
  useEffect(() => {
    return () => {
      stopAllSpeech();
      window.dispatchEvent(new Event("resume_wake_word"));
    };
  }, []);

  // Set up Web Speech API recognition. Reconfigured when language changes.
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recog = new SpeechRecognition();
    recog.lang = t.sttLocale;
    recog.continuous = false;
    recog.interimResults = false;
    recog.maxAlternatives = 1;

    recog.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) {
        const lower = transcript.toLowerCase();
        
        // Hands-free confirmation/rejection
        const activeActionMsg = messages.slice().reverse().find(m => m.actions_proposed?.length > 0 && m.action_id);
        if (activeActionMsg) {
          const confirmWords = ["yes", "confirm", "ok", "sure", "确认", "ya", "ya betul", "ஆமாம்", "சரி"];
          const rejectWords = ["no", "reject", "cancel", "decline", "拒绝", "tak", "jangan", "இல்லை", "வேண்டாம்"];
          if (confirmWords.some(w => lower.includes(w))) {
            handleConfirm(activeActionMsg.action_id);
            setInput("");
            return;
          } else if (rejectWords.some(w => lower.includes(w))) {
            handleReject(activeActionMsg.action_id);
            setInput("");
            return;
          }
        }

        const triggers = WAKE_WORDS_MAP[language] || WAKE_WORDS_MAP.en;
        if (triggers.some((trigger) => lower.includes(trigger))) {
          triggerHelloTwin(language);
        } else {
          setInput("");
          sendMessage(transcript);
        }
      }
    };
    recog.onerror = () => {
      setListening(false);
      window.dispatchEvent(new Event("resume_wake_word"));
    };
    recog.onend = () => {
      setListening(false);
      window.dispatchEvent(new Event("resume_wake_word"));
    };

    recognitionRef.current = recog;
    return () => {
      try { recog.abort(); } catch {}
      window.dispatchEvent(new Event("resume_wake_word"));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const toggleListening = () => {
    const recog = recognitionRef.current;
    if (!recog) {
      alert("Voice input not supported in this browser. Try Chrome or Edge.");
      return;
    }
    if (listening) {
      try { recog.stop(); } catch {}
      setListening(false);
      window.dispatchEvent(new Event("resume_wake_word"));
    } else {
      try {
        window.dispatchEvent(new Event("pause_wake_word"));
        recog.start();
        setListening(true);
      } catch (e) {
        console.warn("Speech start error:", e);
        setListening(false);
        window.dispatchEvent(new Event("resume_wake_word"));
      }
    }
  };

  // ── Hello Twin trigger ──
  const triggerHelloTwin = async (langOverride = null) => {
    stopAllSpeech();
    const langToUse = typeof langOverride === "string" ? langOverride : language;
    setMessages((prev) => [...prev, {
      id: Date.now(), text: "👋 Hello Twin", isUser: true,
    }]);
    setLoading(true);
    try {
      const response = await api.helloTwin(langToUse);
      setMessages((prev) => [...prev, {
        id: Date.now() + 1,
        text: response.answer,
        isUser: false,
        powered_by: response.powered_by,
        model: response.model,
        intent: response.intent,
        actions_taken: response.actions_taken,
        actions_proposed: response.actions_proposed,
        action_id: response.action_id,
        related_videos: response.related_videos,
      }]);
      speakResponse(response.answer, () => {
        if (response.actions_proposed && response.actions_proposed.length > 0) {
          toggleListening();
        }
      });
    } catch {
      setMessages((prev) => [...prev, {
        id: Date.now() + 1, text: t.error, isUser: false,
      }]);
    } finally {
      setLoading(false);
    }
  };

  // ── Send message via Agent Chat ──
  const sendMessage = async (text) => {
    // Check for Hello Twin in text input
    const lower = text.toLowerCase().trim();
    const triggers = WAKE_WORDS_MAP[language] || WAKE_WORDS_MAP.en;
    
    if (triggers.some((trigger) => lower === trigger || lower.includes(trigger))) {
      return triggerHelloTwin(language);
    }

    stopAllSpeech();
    setMessages((prev) => [...prev, { id: Date.now(), text, isUser: true }]);
    setLoading(true);
    try {
      const response = await api.agentChat(text, "default", language);
      setMessages((prev) => [...prev, {
        id: Date.now() + 1,
        text: response.answer,
        isUser: false,
        powered_by: response.powered_by,
        model: response.model,
        intent: response.intent,
        actions_taken: response.actions_taken,
        actions_proposed: response.actions_proposed,
        action_id: response.action_id,
        related_videos: response.related_videos,
      }]);
      speakResponse(response.answer, () => {
        if (response.actions_proposed && response.actions_proposed.length > 0) {
          toggleListening();
        }
      });
    } catch {
      setMessages((prev) => [...prev, {
        id: Date.now() + 1, text: t.error, isUser: false,
      }]);
    } finally {
      setLoading(false);
    }
  };

  // ── Confirm/Reject proposed actions ──
  const handleConfirm = async (actionId) => {
    setConfirming(true);
    try {
      const response = await api.confirmAction(actionId, language);
      setMessages((prev) => {
        // Remove the confirm/reject buttons from the proposing message
        const updated = prev.map((msg) => {
          if (msg.action_id === actionId) {
            return { ...msg, actions_proposed: [], action_id: null };
          }
          return msg;
        });
        return [...updated, {
          id: Date.now(),
          text: response.answer,
          isUser: false,
          powered_by: response.powered_by,
          intent: response.intent,
          actions_taken: response.actions_taken,
          actions_proposed: [],
        }];
      });
      speakResponse(response.answer, () => {
        toggleListening(); // Re-open mic
      });
    } catch {
      setMessages((prev) => [...prev, {
        id: Date.now(), text: "Failed to confirm action. Please try again.", isUser: false,
      }]);
    } finally {
      setConfirming(false);
    }
  };

  const handleReject = (actionId) => {
    setMessages((prev) => {
      const updated = prev.map((msg) => {
        if (msg.action_id === actionId) {
          return { ...msg, actions_proposed: [], action_id: null };
        }
        return msg;
      });
      return [...updated, {
        id: Date.now(),
        text: t.cancelled,
        isUser: false,
        intent: "cancelled",
      }];
    });
    speakResponse(t.cancelled, () => {
      toggleListening();
    });
  };

  const speakResponse = (text, onEnd) => {
    if (!text) { onEnd?.(); return; }
    if (!ttsEnabledRef.current) { onEnd?.(); return; }

    // Always interrupt any ongoing speech before starting new one
    stopAllSpeech();

    // Tamil: use Cloud TTS via backend
    if (t.ttsLocale.startsWith("ta")) {
      const clean = text
        .replace(/[#*`_>~|]/g, "")
        .replace(/\n{2,}/g, ". ")
        .replace(/---/g, "")
        .slice(0, 500);
      api.cloudTTS(clean, "ta")
        .then((audioUrl) => {
          if (!ttsEnabledRef.current) { URL.revokeObjectURL(audioUrl); onEnd?.(); return; }
          const audio = new Audio(audioUrl);
          cloudAudioRef.current = audio;
          audio.onended = () => { URL.revokeObjectURL(audioUrl); cloudAudioRef.current = null; onEnd?.(); };
          audio.onerror = () => { URL.revokeObjectURL(audioUrl); cloudAudioRef.current = null; onEnd?.(); };
          audio.play().catch(() => { onEnd?.(); });
        })
        .catch((e) => { console.warn("Cloud TTS failed:", e); onEnd?.(); });
      return;
    }

    if (!("speechSynthesis" in window)) { onEnd?.(); return; }
    try {
      const clean = text
        .replace(/[#*`_>~]/g, "")
        .replace(/\n{2,}/g, ". ")
        .slice(0, 500);
      const utter = new SpeechSynthesisUtterance(clean);
      utter.lang = t.ttsLocale;
      utter.rate = 1.25;

      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        let voice;
        if (t.ttsLocale === "en-US") {
          voice = voices.find(v => v.lang.replace('_', '-') === t.ttsLocale && v.name.includes("David"))
               || voices.find(v => v.lang.replace('_', '-') === t.ttsLocale && !v.name.includes("Google"))
               || voices.find(v => v.lang.replace('_', '-') === t.ttsLocale);
        } else {
          voice = voices.find(v => v.lang.replace('_', '-') === t.ttsLocale && v.name.includes("Google"));
          if (!voice) voice = voices.find(v => v.lang.replace('_', '-') === t.ttsLocale);
        }
        
        if (!voice && t.ttsLocale === "ms-MY") {
          voice = voices.find(v => v.lang.startsWith("id") && v.name.includes("Google")) 
               || voices.find(v => v.lang.startsWith("id"));
        }
        if (voice) {
          utter.voice = voice;
        }
      }

      if (onEnd) {
        utter.onend = () => onEnd();
        utter.onerror = () => onEnd();
      }
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn("TTS error:", e);
      onEnd?.();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput("");
    sendMessage(trimmed);
  };

  const voiceSupported =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  return (
    <>
      {/* Floating button — click to open chat, double-click for Hey Twin */}
      {!isOpen && (
        <button onClick={() => { setIsOpen(true); unlockAudio(); }}
          onDoubleClick={(e) => { e.preventDefault(); unlockAudio(); onOpenHeyTwin?.(); }}
          title="Click: Chat | Double-click: Hey Twin | Ctrl+K"
          className="fixed bottom-24 sm:bottom-6 right-6 z-50 w-14 h-14 liquid-glass-btn text-white flex items-center justify-center hover:scale-110">
          <Sparkles size={24} />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-greenhouse-400 rounded-full animate-pulse-green" />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed sm:bottom-6 sm:right-6 bottom-0 right-0 z-50 w-full sm:w-[420px] h-[100dvh] sm:h-auto sm:max-h-[600px] bg-gray-900 border-t sm:border border-gray-700 rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-black/50 flex flex-col animate-slide-up overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gradient-to-r from-gray-900 to-gray-900/95">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-greenhouse-500/30 to-blue-500/20 flex items-center justify-center">
                <Sparkles size={16} className="text-greenhouse-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">TwinMind AI</h3>
                <p className="text-[10px] text-greenhouse-400 flex items-center gap-1">
                  <Zap size={8} /> {t.agentMode}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Language toggle */}
              <div className="relative">
                <button
                  onClick={() => setShowLangMenu((v) => !v)}
                  className="text-gray-400 hover:text-greenhouse-400 p-1.5 flex items-center gap-1"
                  title="Language"
                >
                  <Globe size={14} />
                  <span className="text-[10px] uppercase">{language}</span>
                </button>
                {showLangMenu && (
                  <div className="absolute right-0 top-8 z-10 bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-1 min-w-[110px]">
                    {Object.entries(LANGUAGES).map(([code, cfg]) => (
                      <button
                        key={code}
                        onClick={() => {
                          setLanguage(code);
                          localStorage.setItem("twin_lang", code);
                          if (auth.currentUser) {
                            setDoc(doc(db, "users", auth.currentUser.uid), { twin_lang: code }, { merge: true });
                          }
                          window.dispatchEvent(new Event("twin_lang_changed"));
                          setShowLangMenu(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-700 ${
                          language === code ? "text-greenhouse-400" : "text-gray-300"
                        }`}
                      >
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* TTS Toggle */}
              <button
                onClick={() => {
                  const next = !ttsEnabled;
                  setTtsEnabled(next);
                  ttsEnabledRef.current = next;
                  if (!next) {
                    // Mute: pause ongoing speech
                    try { window.speechSynthesis?.pause(); } catch {}
                    if (cloudAudioRef.current) {
                      try { cloudAudioRef.current.pause(); } catch {}
                    }
                  } else {
                    // Unmute: resume paused speech
                    try { window.speechSynthesis?.resume(); } catch {}
                    if (cloudAudioRef.current) {
                      try { cloudAudioRef.current.play(); } catch {}
                    }
                  }
                }}
                className={`p-1.5 rounded-lg transition-colors ${
                  ttsEnabled ? "text-greenhouse-400 hover:bg-gray-800" : "text-gray-500 hover:bg-gray-800"
                }`}
                title={ttsEnabled ? "Mute voice" : "Enable voice"}
              >
                {ttsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>

              {messages.length > 0 && (
                <button onClick={() => { api.clearChat().catch(()=>{}); setMessages([]); }}
                  className="text-gray-500 hover:text-gray-300 p-1.5" title={t.clearChat}>
                  <Trash2 size={14} />
                </button>
              )}
              <button onClick={() => {
                setIsOpen(false);
                stopAllSpeech();
                if (listening) {
                  try { recognitionRef.current?.stop(); } catch {}
                  setListening(false);
                }
              }} className="text-gray-500 hover:text-gray-300 p-1.5">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[400px]">
            {messages.length === 0 && (
              <div className="text-center py-6">
                <Sparkles size={24} className="mx-auto text-greenhouse-400 mb-2" />
                <p className="text-sm text-gray-400 mb-4">{t.title}</p>

                {/* Hello Twin Button */}
                <button
                  onClick={triggerHelloTwin}
                  disabled={loading}
                  className="mx-auto mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-400 hover:from-amber-500/30 hover:to-orange-500/30 hover:border-amber-500/60 transition-all text-sm font-medium shadow-lg shadow-amber-500/10"
                >
                  <Hand size={16} />
                  {t.helloTwinBtn}
                </button>

                <div className="flex flex-wrap gap-1.5 justify-center">
                  {t.quick.map((q) => (
                    <button key={q.label} onClick={() => sendMessage(q.label)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-[11px] text-gray-400 hover:text-greenhouse-400 hover:border-greenhouse-600/40 transition-colors">
                      <q.icon size={10} />{q.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2.5 ${msg.isUser ? "flex-row-reverse" : ""}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                  msg.isUser ? "bg-blue-500/20 text-blue-400" : "bg-greenhouse-500/20 text-greenhouse-400"
                }`}>
                  {msg.isUser ? <MessageCircle size={12} /> : <Sparkles size={12} />}
                </div>
                <div className={`max-w-[85%] rounded-xl px-3 py-2.5 ${
                  msg.isUser ? "bg-blue-600/20 border border-blue-600/30" : "bg-gray-800/80 border border-gray-700/50"
                }`}>
                  {msg.isUser ? (
                    <p className="text-[13px] sm:text-sm text-blue-200">{msg.text}</p>
                  ) : (
                    <>
                      <MarkdownLite text={msg.text} />
                      <ActionsTakenCard actions={msg.actions_taken} />
                      {msg.actions_proposed && msg.actions_proposed.length > 0 && msg.action_id && (
                        <ActionsProposedCard
                          actions={msg.actions_proposed}
                          actionId={msg.action_id}
                          onConfirm={handleConfirm}
                          onReject={handleReject}
                          confirming={confirming}
                          t={t}
                        />
                      )}
                      <VideoCardsSection videos={msg.related_videos} />
                    </>
                  )}
                  {msg.powered_by && (
                    <div className="mt-1.5 flex items-center gap-1">
                      <Zap size={8} className={msg.powered_by === "google_gemini" ? "text-greenhouse-500" : "text-gray-600"} />
                      <span className="text-[8px] text-gray-600">
                        {msg.powered_by === "google_gemini" ? "Gemini" : "Local AI"}
                        {msg.intent && msg.intent !== "general_chat" && ` • ${msg.intent}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5">
                <div className="w-6 h-6 rounded-full bg-greenhouse-500/20 flex items-center justify-center shrink-0">
                  <Sparkles size={12} className="text-greenhouse-400 animate-pulse" />
                </div>
                <div className="bg-gray-800/80 border border-gray-700/50 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin text-greenhouse-400" />
                    <span className="text-[11px] text-gray-500">{t.thinking}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 border-t border-gray-800 flex gap-2">
            {voiceSupported && (
              <button
                type="button"
                onClick={() => { unlockAudio(); toggleListening(); }}
                disabled={loading}
                title={listening ? t.listening : "Voice input"}
                className={`px-3 py-2 rounded-xl border transition-colors ${
                  listening
                    ? "bg-red-500/20 border-red-500/40 text-red-400 animate-pulse"
                    : "bg-gray-800 border-gray-700 text-gray-400 hover:text-greenhouse-400 hover:border-greenhouse-600/40"
                }`}
              >
                {listening ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
            )}
            <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder={listening ? t.listening : t.placeholder}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-greenhouse-500/50"
              disabled={loading} />
            <button type="submit" disabled={!input.trim() || loading}
              className="px-3 py-2 rounded-xl bg-greenhouse-600 hover:bg-greenhouse-500 disabled:bg-gray-700 disabled:text-gray-500 text-white transition-colors">
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
