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
  ImagePlus,
} from "lucide-react";
import { api } from "../api/client";
import { AiInsightPanel } from "../components/AiInsightCards";
import { auth, db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";

const LANGUAGES = [
  { 
    code: "en", label: "English", ttsLang: "en-US", sttLang: "en-US", confirm: "Confirm", reject: "Reject", cancelled: "❌ Action cancelled by user.",
    ui: {
      title: "AI Assistant",
      subtitle: "Powered by Google Gemini — real AI with live greenhouse sensor data",
      welcomeTitle: "TwinMind AI",
      welcomeDesc: "I'm a real AI that analyzes your greenhouse sensors in real-time. Ask me anything — I'll give you data-driven, expert advice.",
      inputPlaceholder: "Ask TwinMind anything...",
      listening: "Listening...",
      thinking: "Gemini is thinking...",
      toolsTitle: "AI Power Tools",
      insightsTitle: "Quick Insights",
      helloTwinBtn: "👋 Hello Twin",
      clearChatTitle: "Clear conversation",
      reportText: "Generate a daily greenhouse report",
      scheduleText: "Create a smart 24-hour automation schedule",
      quickActions: [
        { label: "👋 Hello Twin", isHelloTwin: true },
        { label: "How is my greenhouse?" },
        { label: "Any problems?" },
        { label: "Should I water now?" },
        { label: "Explain VPD to me" },
        { label: "Temperature analysis" },
        { label: "Check pH and EC" },
        { label: "What crops suit my setup?" },
      ],
      aiTools: [
        { id: "hellotwin", label: "Hello Twin", description: "Proactive AI greeting with full status analysis" },
        { id: "report", label: "Daily Report", description: "Generate a full AI-powered greenhouse analysis report" },
        { id: "schedule", label: "Smart Schedule", description: "AI-optimized 24-hour automation schedule" },
        { id: "whatif", label: "What-If Scenario", description: "Simulate changes before making them" },
        { id: "growplan", label: "Grow Plan", description: "Week-by-week growing plan for any crop" },
        { id: "diagnose", label: "Plant Doctor", description: "Upload a photo to diagnose plant health" },
        { id: "learn", label: "Learn", description: "Beginner-friendly topic explanations" },
      ],
      errFail: "Sorry, Hello Twin failed. Please check if the backend is running.",
      errSomething: "Sorry, something went wrong. Please check if the backend is running."
    }
  },
  { 
    code: "ms", label: "Bahasa Melayu", ttsLang: "ms-MY", sttLang: "ms-MY", confirm: "Sahkan", reject: "Tolak", cancelled: "❌ Tindakan dibatalkan.",
    ui: {
      title: "Pembantu AI",
      subtitle: "Dikuasakan oleh Google Gemini — AI sebenar dengan penderia langsung",
      welcomeTitle: "TwinMind AI",
      welcomeDesc: "Saya AI sebenar yang menganalisis penderia rumah hijau anda secara langsung. Tanya saya apa-apa — saya akan beri nasihat pakar berdasarkan data.",
      inputPlaceholder: "Tanya TwinMind apa-apa...",
      listening: "Mendengar...",
      thinking: "Gemini sedang berfikir...",
      toolsTitle: "Alat Kuasa AI",
      insightsTitle: "Wawasan Pantas",
      helloTwinBtn: "👋 Hai Twin",
      clearChatTitle: "Padam perbualan",
      reportText: "Jana laporan harian rumah hijau",
      scheduleText: "Buat jadual automasi 24 jam pintar",
      quickActions: [
        { label: "👋 Hai Twin", isHelloTwin: true },
        { label: "Bagaimana keadaan rumah hijau?" },
        { label: "Ada masalah?" },
        { label: "Patutkah saya siram sekarang?" },
        { label: "Terangkan VPD" },
        { label: "Analisis suhu" },
        { label: "Periksa pH dan EC" },
        { label: "Tanaman apa yang sesuai?" },
      ],
      aiTools: [
        { id: "hellotwin", label: "Hai Twin", description: "Ucapan AI proaktif dengan analisis status penuh" },
        { id: "report", label: "Laporan Harian", description: "Jana laporan analisis rumah hijau penuh AI" },
        { id: "schedule", label: "Jadual Pintar", description: "Jadual automasi 24-jam dioptimumkan AI" },
        { id: "whatif", label: "Senario Jika", description: "Simulasi perubahan sebelum melakukannya" },
        { id: "growplan", label: "Pelan Tumbesaran", description: "Pelan tanaman mingguan untuk mana-mana tanaman" },
        { id: "diagnose", label: "Doktor Tumbuhan", description: "Muat naik foto untuk diagnosis kesihatan tumbuhan" },
        { id: "learn", label: "Belajar", description: "Penerangan topik mesra pemula" },
      ],
      errFail: "Maaf, Hello Twin gagal. Sila periksa bahagian belakang.",
      errSomething: "Maaf, sesuatu tidak kena. Sila periksa bahagian belakang."
    }
  },
  { 
    code: "zh", label: "中文", ttsLang: "zh-CN", sttLang: "zh-CN", confirm: "确认", reject: "拒绝", cancelled: "❌ 操作已取消",
    ui: {
      title: "AI 助手",
      subtitle: "由 Google Gemini 驱动 — 结合温室实时数据的真 AI",
      welcomeTitle: "TwinMind AI",
      welcomeDesc: "我是实时分析温室数据的真 AI。随便问我，我将为你提供由数据驱动的专业建议。",
      inputPlaceholder: "向 TwinMind 提问...",
      listening: "正在聆听...",
      thinking: "Gemini 思考中...",
      toolsTitle: "AI 工具箱",
      insightsTitle: "快速洞察",
      helloTwinBtn: "👋 小双同学",
      clearChatTitle: "清除对话",
      reportText: "生成每日温室分析报告",
      scheduleText: "创建智能24小时自动化计划",
      quickActions: [
        { label: "👋 小双同学", isHelloTwin: true },
        { label: "温室现在怎么样？" },
        { label: "有没有问题？" },
        { label: "现在需要浇水吗？" },
        { label: "为我解释 VPD" },
        { label: "温度分析" },
        { label: "检查 pH 和 EC" },
        { label: "哪些作物适合我？" },
      ],
      aiTools: [
        { id: "hellotwin", label: "小双同学", description: "主动播报温室所有状态与分析" },
        { id: "report", label: "每日报告", description: "生成由AI驱动的温室全面分析报告" },
        { id: "schedule", label: "智能计划", description: "AI优化的24小时自动化计划" },
        { id: "whatif", label: "假设场景", description: "在执行操作前模拟更改结果" },
        { id: "growplan", label: "种植计划", description: "为任何作物生成每周种植计划" },
        { id: "diagnose", label: "植物医生", description: "上传照片诊断植物健康状况" },
        { id: "learn", label: "学习", description: "新手友好的种植主题讲解" },
      ],
      errFail: "抱歉，“小双同学”唤醒失败，请检查后端是否运行。",
      errSomething: "抱歉，出错了。请检查后端是否运行。"
    }
  },
  { 
    code: "ta", label: "தமிழ்", ttsLang: "ta-IN", sttLang: "ta-IN", confirm: "உறுதி செய்", reject: "நிராகரி", cancelled: "❌ செயல் ரத்து செய்யப்பட்டது",
    ui: {
      title: "AI உதவியாளர்",
      subtitle: "Google Gemini மூலம் இயக்கப்படுகிறது — நேரடி சென்சார் தரவுடன்",
      welcomeTitle: "TwinMind AI",
      welcomeDesc: "நான் உங்கள் பசுமை இல்ல சென்சார்களை நிகழ்நேரத்தில் பகுப்பாய்வு செய்யும் AI. எதை வேண்டுமானாலும் கேளுங்கள்.",
      inputPlaceholder: "TwinMind-யிடம் ஏதேனும் கேளுங்கள்...",
      listening: "கேட்கிறது...",
      thinking: "Gemini சிந்திக்கிறது...",
      toolsTitle: "AI கருவிகள்",
      insightsTitle: "விரைவான நுண்ணறிவுகள்",
      helloTwinBtn: "👋 ஹலோ ட்வின்",
      clearChatTitle: "உரையாடலை அழி",
      reportText: "தினசரி பசுமை இல்ல அறிக்கையை உருவாக்கு",
      scheduleText: "24 மணிநேர தானியங்கி அட்டவணையை உருவாக்கு",
      quickActions: [
        { label: "👋 ஹலோ ட்வின்", isHelloTwin: true },
        { label: "என் பசுமை இல்லம் எப்படி உள்ளது?" },
        { label: "ஏதேனும் பிரச்சனைகள் உள்ளதா?" },
        { label: "நான் இப்போது தண்ணீர் ஊற்ற வேண்டுமா?" },
        { label: "VPD பற்றி விளக்குங்கள்" },
        { label: "வெப்பநிலை பகுப்பாய்வு" },
        { label: "pH மற்றும் EC ஐ சரிபார்க்கவும்" },
        { label: "எந்த பயிர்கள் பொருத்தமானவை?" },
      ],
      aiTools: [
        { id: "hellotwin", label: "ஹலோ ட்வின்", description: "முழு நிலை பகுப்பாய்வுடன் AI வாழ்த்து" },
        { id: "report", label: "தினசரி அறிக்கை", description: "முழு AI-ஆல் உருவாக்கப்பட்ட பகுப்பாய்வு அறிக்கை" },
        { id: "schedule", label: "ஸ்மார்ட் அட்டவணை", description: "AI-ஆல் உகந்த 24-மணிநேர அட்டவணை" },
        { id: "whatif", label: "என்ன நடக்கும்? (What-If)", description: "மாற்றங்களைச் செய்வதற்கு முன் உருவகப்படுத்தவும்" },
        { id: "growplan", label: "வளர்ப்பு திட்டம்", description: "எந்தவொரு பயிருக்கும் வாராந்திர வளர்ப்பு திட்டம்" },
        { id: "diagnose", label: "தாவர மருத்துவர்", description: "தாவர ஆரோக்கியத்தைக் கண்டறிய புகைப்படத்தைப் பதிவேற்றவும்" },
        { id: "learn", label: "அறிந்து கொள்", description: "தொடக்கநிலையாளர்களுக்கான விளக்கங்கள்" },
      ],
      errFail: "மன்னிக்கவும், Hello Twin தோல்வியடைந்தது. பின்தளம் இயங்குகிறதா என சரிபார்க்கவும்.",
      errSomething: "மன்னிக்கவும், பிழை ஏற்பட்டுள்ளது. பின்தளம் இயங்குகிறதா என சரிபார்க்கவும்."
    }
  },
];

const WAKE_WORDS_MAP = {
  en: ["hello twin", "hi twin", "hey twin", "halo twin", "hey twins", "hello twins", "hi, twins", "twins"],
  zh: ["小双同学", "你好小双", "嗨小双", "嘿小双", "你好 twin", "twins", "twin", "hi twin", "hello twin", "hey twin"],
  ms: ["hi twins", "hello twins", "hey twins", "twins", "hi twin", "hello twin", "hey twin", "halo twin", "hi, twins"],
  ta: ["hello twin", "hi twin", "hey twin", "halo twin", "hey twins", "hello twins", "twins", "ஹலோ ட்வின்", "ஹலோ ட்வின்ஸ்", "ட்வின்", "ட்வின்ஸ்"],
};

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
        if (/^\d+\.\s/.test(html)) return <div key={i} className="pl-3 text-gray-300 text-xs sm:text-sm md:text-base" dangerouslySetInnerHTML={{ __html: html }} />;
        if (html.startsWith("- ")) return (
          <div key={i} className="pl-3 flex gap-2 text-xs sm:text-sm md:text-base text-gray-300">
            <span className="text-greenhouse-400 shrink-0">•</span>
            <span dangerouslySetInnerHTML={{ __html: html.slice(2) }} />
          </div>
        );
        if (html.startsWith("|")) return <div key={i} className="text-[10px] sm:text-xs md:text-sm text-gray-400 font-mono" dangerouslySetInnerHTML={{ __html: html }} />;
        return <p key={i} className="text-xs sm:text-sm md:text-base text-gray-300" dangerouslySetInnerHTML={{ __html: html }} />;
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
  const [voiceLang, setVoiceLang] = useState(() => localStorage.getItem("twin_lang") || "en");
  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const ttsEnabledRef = useRef(true);
  const cloudAudioRef = useRef(null);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

  // Unified helper: stop ALL speech (browser TTS + Cloud TTS audio)
  const stopAllSpeech = useCallback(() => {
    try { window.speechSynthesis?.cancel(); } catch {}
    if (cloudAudioRef.current) {
      try { cloudAudioRef.current.pause(); cloudAudioRef.current.currentTime = 0; } catch {}
      cloudAudioRef.current = null;
    }
  }, []);

  const toggleTts = () => {
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
  };

  const speechSupported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => {
    api.getAdvisorStatus().then(setGeminiStatus).catch(() => {});
    api.getVpdInfo().then(setVpd).catch(() => {});
    api.getCropProfiles().then(setCrops).catch(() => {});

    const handleLangChange = () => {
      const stored = localStorage.getItem("twin_lang");
      if (stored) setVoiceLang(stored);
    };
    window.addEventListener("twin_lang_changed", handleLangChange);
    return () => {
      window.removeEventListener("twin_lang_changed", handleLangChange);
      stopAllSpeech();
    };
  }, [stopAllSpeech]);

  const speakText = useCallback((text) => {
    if (!text) return;
    if (!ttsEnabledRef.current) return;
    const selected = LANGUAGES.find((l) => l.code === voiceLang);
    const langCode = selected ? selected.ttsLang : "en-US";

    // Always interrupt any ongoing speech before starting new one
    stopAllSpeech();

    // Tamil: use Cloud TTS via backend
    if (langCode.startsWith("ta")) {
      const clean = String(text)
        .replace(/[#*`_>~|]/g, "")
        .replace(/\n{2,}/g, ". ")
        .replace(/---/g, "")
        .slice(0, 500);
      api.cloudTTS(clean, "ta")
        .then((audioUrl) => {
          if (!ttsEnabledRef.current) { URL.revokeObjectURL(audioUrl); return; }
          const audio = new Audio(audioUrl);
          cloudAudioRef.current = audio;
          audio.onended = () => { URL.revokeObjectURL(audioUrl); cloudAudioRef.current = null; };
          audio.onerror = () => { URL.revokeObjectURL(audioUrl); cloudAudioRef.current = null; };
          audio.play().catch(() => {});
        })
        .catch((e) => console.warn("Cloud TTS failed:", e));
      return;
    }

    if (!window.speechSynthesis) return;
    const plain = String(text)
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/`(.+?)`/g, "$1")
      .replace(/#{1,3}\s/g, "")
      .replace(/\|/g, " ")
      .replace(/---/g, "");
    const maxLen = 500;
    const chunk = plain.length > maxLen ? plain.slice(0, maxLen) + "..." : plain;
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.lang = langCode;
    utterance.rate = 1.25;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      let voice;
      if (langCode === "en-US") {
        voice = voices.find(v => v.lang.replace('_', '-') === langCode && v.name.includes("David"))
             || voices.find(v => v.lang.replace('_', '-') === langCode && !v.name.includes("Google"))
             || voices.find(v => v.lang.replace('_', '-') === langCode);
      } else {
        voice = voices.find(v => v.lang.replace('_', '-') === langCode && v.name.includes("Google"));
        if (!voice) voice = voices.find(v => v.lang.replace('_', '-') === langCode);
      }
      
      if (!voice && langCode === "ms-MY") {
        voice = voices.find(v => v.lang.startsWith("id") && v.name.includes("Google")) 
             || voices.find(v => v.lang.startsWith("id"));
      }
      if (voice) {
        utterance.voice = voice;
      }
    }

    window.speechSynthesis.speak(utterance);
  }, [voiceLang, stopAllSpeech]);

  const startListening = useCallback(() => {
    if (!speechSupported) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recog = new SpeechRecognition();
    const selected = LANGUAGES.find((l) => l.code === voiceLang);
    recog.lang = selected ? selected.sttLang : "en-US";
    recog.continuous = false;

    recog.onstart = () => setIsListening(true);
    recog.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) {
        const lower = transcript.toLowerCase();
        const activeLang = voiceLang || "en";
        const triggers = WAKE_WORDS_MAP[activeLang] || WAKE_WORDS_MAP.en;
        
        if (triggers.some((t) => lower.includes(t))) {
          handleHelloTwin(activeLang);
        } else {
          setInput(transcript);
          handleSend(transcript);
        }
      }
    };
    recog.onerror = (event) => {
      console.warn("Speech recognition error:", event.error);
      setIsListening(false);
    };
    recog.onend = () => setIsListening(false);

    recognitionRef.current = recog;
    try {
      recog.start();
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

  const handleHelloTwin = async (langOverride = null) => {
    stopAllSpeech();
    setLoading(true);
    setInput("");
    try {
      const activeLang = langOverride || voiceLang || "en";
      const response = await api.helloTwin(activeLang);
      addBotMessage(response.answer, {
        model: response.model, powered_by: response.powered_by,
        intent: response.intent, actions_taken: response.actions_taken,
        actions_proposed: response.actions_proposed, action_id: response.action_id,
      });
    } catch {
      const selected = LANGUAGES.find((l) => l.code === (langOverride || voiceLang || "en")) || LANGUAGES[0];
      addBotMessage(selected.ui.errFail);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (textOverride) => {
    const text = typeof textOverride === "string" ? textOverride : input;
    if (!text.trim() && !imageFile) return;
    stopAllSpeech();

    const lower = text.toLowerCase().trim();
    const triggers = WAKE_WORDS_MAP[voiceLang] || WAKE_WORDS_MAP.en;
    if (triggers.some((t) => lower === t || lower.includes(t))) {
      return handleHelloTwin(voiceLang);
    }
    setMessages((prev) => [...prev, { id: Date.now(), text, isUser: true }]);
    setLoading(true);
    try {
      const activeLang = voiceLang || "en";
      const response = await api.agentChat(text, "default", activeLang);
      addBotMessage(response.answer, {
        model: response.model, powered_by: response.powered_by,
        intent: response.intent, actions_taken: response.actions_taken,
        actions_proposed: response.actions_proposed, action_id: response.action_id,
      });
    } catch {
      const selected = LANGUAGES.find((l) => l.code === (voiceLang || "en")) || LANGUAGES[0];
      addBotMessage(selected.ui.errSomething);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = async (actionId) => {
    setConfirming(true);
    try {
      const response = await api.confirmAction(actionId, voiceLang);
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
    const activeLang = LANGUAGES.find((l) => l.code === voiceLang) || LANGUAGES[0];
    setMessages((prev) => {
      const updated = prev.map((msg) =>
        msg.action_id === actionId ? { ...msg, actions_proposed: [], action_id: null } : msg
      );
      return [...updated, {
        id: Date.now() + Math.random(), text: activeLang.cancelled, isUser: false, intent: "cancelled",
      }];
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput("");
    handleSend(trimmed);
  };

  const runTool = async (toolId) => {
    stopAllSpeech();
    setLoading(true);
    const activeLang = voiceLang || "en";
    try {
      let result;
      switch (toolId) {
        case "hellotwin":
          await handleHelloTwin();
          setLoading(false);
          return;
        case "report":
          setMessages((prev) => [...prev, { id: Date.now(), text: (LANGUAGES.find((l) => l.code === voiceLang) || LANGUAGES[0]).ui.reportText, isUser: true }]);
          result = await api.getDailyReport(activeLang);
          addBotMessage(result.report, { powered_by: result.powered_by });
          break;
        case "schedule":
          setMessages((prev) => [...prev, { id: Date.now(), text: (LANGUAGES.find((l) => l.code === voiceLang) || LANGUAGES[0]).ui.scheduleText, isUser: true }]);
          result = await api.getAutomationSchedule(activeLang);
          addBotMessage(result.schedule, { powered_by: result.powered_by });
          break;
        case "whatif":
          if (!toolInput.trim()) { setLoading(false); return; }
          {
            const ti = toolInput;
            setToolInput("");
            setActiveTool(null);
            setMessages((prev) => [...prev, { id: Date.now(), text: `What if: ${ti}`, isUser: true }]);
            result = await api.whatIfAnalysis(ti, activeLang);
            addBotMessage(result.analysis, { powered_by: result.powered_by });
          }
          break;
        case "growplan":
          {
            const crop = selectedCrop;
            setActiveTool(null);
            setMessages((prev) => [...prev, { id: Date.now(), text: `Create a grow plan for ${crop}`, isUser: true }]);
            result = await api.getGrowPlan(crop, 4, activeLang);
            addBotMessage(result.plan, { powered_by: result.powered_by });
          }
          break;
        case "diagnose":
          if (!imageFile) { setLoading(false); return; }
          {
            const previewUrl = imagePreview;
            const file = imageFile;
            const ti = toolInput;
            setImageFile(null);
            setImagePreview(null);
            setToolInput("");
            setActiveTool(null);
            setMessages((prev) => [...prev, { id: Date.now(), text: `Diagnose plant image: ${file.name}`, isUser: true, imageUrl: previewUrl }]);
            result = await api.diagnosePlantImage(file, ti, activeLang);
            addBotMessage(result.diagnosis, { powered_by: result.powered_by });
          }
          break;
        case "learn":
          if (!toolInput.trim()) { setLoading(false); return; }
          {
            const ti = toolInput;
            setToolInput("");
            setActiveTool(null);
            setMessages((prev) => [...prev, { id: Date.now(), text: `Teach me about: ${ti}`, isUser: true }]);
            result = await api.learnTopic(ti, activeLang);
            addBotMessage(result.explanation, { powered_by: result.powered_by });
          }
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

  const currentLangObj = LANGUAGES.find((l) => l.code === voiceLang) || LANGUAGES[0];
  const ui = currentLangObj.ui;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot size={28} className="text-greenhouse-400" />
            {ui.title}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {ui.subtitle}
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
                    onClick={() => { 
                      setVoiceLang(lang.code);
                      localStorage.setItem("twin_lang", lang.code);
                      if (auth.currentUser) {
                        setDoc(doc(db, "users", auth.currentUser.uid), { twin_lang: lang.code }, { merge: true });
                      }
                      window.dispatchEvent(new Event("twin_lang_changed"));
                      setShowLangMenu(false); 
                    }}
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
          <button onClick={toggleTts}
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
        <div className="lg:col-span-3 flex flex-col bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800 overflow-hidden h-[80vh] min-h-[500px] max-h-[800px] lg:h-[700px] lg:max-h-none">
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-10">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-greenhouse-500/30 to-blue-500/20 flex items-center justify-center mb-4">
                  <Sparkles size={28} className="text-greenhouse-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">{ui.welcomeTitle}</h3>
                <p className="text-sm text-gray-500 max-w-md mb-6">
                  {ui.welcomeDesc}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-w-2xl">
                  {QUICK_ACTIONS.map((q, i) => {
                    const tLabel = ui.quickActions?.[i]?.label || q.label;
                    return (
                      <button key={i} onClick={() => q.isHelloTwin ? handleHelloTwin() : handleSend(tLabel)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-[10px] sm:text-xs md:text-sm transition-all text-left ${
                          q.isHelloTwin
                            ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-500/40 text-amber-400 hover:from-amber-500/30 hover:to-orange-500/30 font-medium"
                            : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-greenhouse-600/40"
                        }`}>
                        <q.icon size={14} className={`${q.color} shrink-0`} />
                        <span>{tLabel}</span>
                      </button>
                    );
                  })}
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
                    <div>
                      {msg.imageUrl && (
                        <img src={msg.imageUrl} alt="Uploaded" className="w-32 h-32 object-cover rounded-lg border border-blue-500/30 mb-2" />
                      )}
                      <p className="text-xs sm:text-sm md:text-base text-blue-200">{msg.text}</p>
                    </div>
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
                              {confirming ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />} {LANGUAGES.find((l) => l.code === voiceLang)?.confirm || "Confirm"}
                            </button>
                            <button onClick={() => handleRejectAction(msg.action_id)} disabled={confirming}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-gray-300 text-xs font-medium transition-colors">
                              <XCircle size={12} /> {LANGUAGES.find((l) => l.code === voiceLang)?.reject || "Reject"}
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
                    <span className="text-xs text-gray-500">{ui.thinking}</span>
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
                <div className="space-y-3">
                  {/* Drag & Drop zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file && file.type.startsWith("image/")) {
                        setImageFile(file);
                        setImagePreview(URL.createObjectURL(file));
                      }
                    }}
                    onClick={() => !imageFile && fileInputRef.current?.click()}
                    className={`relative rounded-xl border-2 border-dashed transition-all cursor-pointer ${
                      dragOver
                        ? "border-pink-400 bg-pink-500/10"
                        : imageFile
                          ? "border-pink-500/30 bg-pink-500/5"
                          : "border-gray-700 bg-gray-800/30 hover:border-gray-600 hover:bg-gray-800/50"
                    }`}
                  >
                    {imagePreview ? (
                      <div className="flex items-center gap-3 p-3">
                        <img src={imagePreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg border border-gray-700" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-pink-400 font-medium truncate">{imageFile?.name}</p>
                          <p className="text-[10px] text-gray-500">{imageFile ? `${(imageFile.size / 1024).toFixed(1)} KB` : ""}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setImageFile(null); setImagePreview(null); }}
                          className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 py-5">
                        <ImagePlus size={24} className={dragOver ? "text-pink-400" : "text-gray-500"} />
                        <p className="text-xs text-gray-400">
                          <span className="text-pink-400 font-medium">Click to upload</span> or drag & drop
                        </p>
                        <p className="text-[10px] text-gray-600">JPG, PNG, WebP</p>
                      </div>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setImageFile(file);
                        setImagePreview(URL.createObjectURL(file));
                      }
                    }} />
                  <div className="flex gap-2 items-center">
                    <input value={toolInput} onChange={(e) => setToolInput(e.target.value)}
                      placeholder="Describe symptoms (optional)"
                      className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500" />
                    <button onClick={() => runTool("diagnose")} disabled={loading || !imageFile} className="px-3 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:bg-gray-700 text-white text-sm">Diagnose</button>
                    <button onClick={() => { setActiveTool(null); setImageFile(null); setImagePreview(null); }} className="px-2 text-gray-500 hover:text-gray-300"><XCircle size={16} /></button>
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
              placeholder={isListening ? ui.listening : ui.inputPlaceholder}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-greenhouse-500/50"
              disabled={loading} />
            <button type="submit" disabled={!input.trim() || loading}
              className="px-4 py-2.5 rounded-xl bg-greenhouse-600 hover:bg-greenhouse-500 disabled:bg-gray-700 disabled:text-gray-500 text-white transition-colors">
              <Send size={16} />
            </button>
            {messages.length > 0 && (
              <button type="button" onClick={clearChat} title={ui.clearChatTitle}
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
              {ui.toolsTitle}
            </h3>
            <div className="space-y-2">
              {AI_TOOLS.map((tool) => {
                const tInfo = ui.aiTools?.find((t) => t.id === tool.id) || tool;
                return (
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
                      <p className="text-[11px] sm:text-xs md:text-sm font-medium text-gray-200">{tInfo.label}</p>
                      <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-500">{tInfo.description}</p>
                    </div>
                  </div>
                </button>
                );
              })}
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
              <Sparkles size={14} className="text-greenhouse-400" /> {ui.insightsTitle}
            </h3>
            <AiInsightPanel maxItems={5} compact />
          </div>
        </div>
      </div>
    </div>
  );
}
