import { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  Send,
  Mic,
  MicOff,
  Loader2,
  CheckCircle,
  XCircle,
  Activity,
  Zap,
  Lightbulb,
  Leaf,
} from "lucide-react";
import { api } from "../api/client";
import { auth, db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import "../styles/HeyTwinDialog.css";

// ── Markdown-lite renderer ──
function MarkdownLite({ text }) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <div className="hey-twin-response-text">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: 4 }} />;
        let html = line
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/`(.+?)`/g, '<code>$1</code>');

        if (/^#{1,3}\s/.test(line)) {
          const content = html.replace(/^#{1,3}\s/, "");
          return <div key={i} style={{ fontWeight: 600, color: "#fff", marginTop: 4 }} dangerouslySetInnerHTML={{ __html: content }} />;
        }
        if (/^\d+\.\s/.test(html)) return <div key={i} style={{ paddingLeft: 12, color: "#d1d5db" }} dangerouslySetInnerHTML={{ __html: html }} />;
        if (html.startsWith("- ")) return (
          <div key={i} style={{ paddingLeft: 12, display: "flex", gap: 6, color: "#d1d5db" }}>
            <span style={{ color: "#4ade80", flexShrink: 0 }}>•</span>
            <span dangerouslySetInnerHTML={{ __html: html.slice(2) }} />
          </div>
        );
        return <p key={i} style={{ margin: 0 }} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}



const WAKE_WORDS_MAP = {
  en: ["hello twin", "hi twin", "hey twin", "halo twin", "hey twins", "hello twins", "hi, twins", "twins"],
  zh: ["小双同学", "你好小双", "嗨小双", "嘿小双", "你好 twin", "twins", "twin", "hi twin", "hello twin", "hey twin"],
  ms: ["hi twins", "hello twins", "hey twins", "twins", "hi twin", "hello twin", "hey twin", "halo twin", "hi, twins"],
  ta: ["hello twin", "hi twin", "hey twin", "halo twin", "hey twins", "hello twins", "twins", "ஹலோ ட்வின்", "ஹலோ ட்வின்ஸ்", "ட்வின்", "ட்வின்ஸ்"],
};

const UI_TEXT = {
  en: {
    title: "Hey Twin",
    listening: "Listening...",
    thinking: "Thinking...",
    placeholder: "Ask anything or give a command...",
    confirm: "Confirm",
    reject: "Reject",
    cancelled: "❌ Action cancelled by user.",
    error: "Sorry, something went wrong. Please try again.",
    connError: "Sorry, I couldn't connect. Please try again.",
    hintOpen: "to open",
    hintClose: "to close",
    hintWake: "🎤 say \"Hey Twin\"",
    helloTwinBtn: "👋 Hello Twin",
    quick: [
      { label: "How's my greenhouse?", icon: Sparkles },
      { label: "Should I water now?", icon: Lightbulb },
      { label: "Any problems?", icon: Activity },
      { label: "What's the VPD?", icon: Leaf },
    ]
  },
  zh: {
    title: "小双同学",
    listening: "正在聆听...",
    thinking: "思考中...",
    placeholder: "问点什么，或下达指令...",
    confirm: "确认",
    reject: "拒绝",
    cancelled: "❌ 操作已取消",
    error: "抱歉，处理失败，请重试。",
    connError: "抱歉，无法连接，请重试。",
    hintOpen: "打开",
    hintClose: "关闭",
    hintWake: "🎤 喊 \"小双同学\"",
    helloTwinBtn: "👋 小双同学",
    quick: [
      { label: "温室现在怎么样？", icon: Sparkles },
      { label: "现在需要浇水吗？", icon: Lightbulb },
      { label: "有没有问题？", icon: Activity },
      { label: "VPD是多少？", icon: Leaf },
    ]
  },
  ms: {
    title: "Hey Twin",
    listening: "Sedang mendengar...",
    thinking: "Sedang berfikir...",
    placeholder: "Tanya apa-apa...",
    confirm: "Sahkan",
    reject: "Tolak",
    cancelled: "❌ Tindakan dibatalkan.",
    error: "Maaf, gagal memproses. Sila cuba lagi.",
    connError: "Maaf, tidak dapat menyambung. Sila cuba lagi.",
    hintOpen: "untuk buka",
    hintClose: "untuk tutup",
    hintWake: "🎤 sebut \"Hey Twin\"",
    helloTwinBtn: "👋 Hai Twin",
    quick: [
      { label: "Bagaimana rumah hijau saya?", icon: Sparkles },
      { label: "Patutkah saya siram sekarang?", icon: Lightbulb },
      { label: "Ada masalah?", icon: Activity },
      { label: "Berapa VPD?", icon: Leaf },
    ]
  },
  ta: {
    title: "Hey Twin",
    listening: "கேட்கிறது...",
    thinking: "சிந்திக்கிறது...",
    placeholder: "ஏதேனும் கேளுங்கள்...",
    confirm: "உறுதி செய்",
    reject: "நிராகரி",
    cancelled: "❌ செயல் ரத்து செய்யப்பட்டது",
    error: "மன்னிக்கவும், செயல்படுத்த முடியவில்லை. மீண்டும் முயற்சிக்கவும்.",
    connError: "மன்னிக்கவும், இணைக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.",
    hintOpen: "திறக்க",
    hintClose: "மூட",
    hintWake: "🎤 \"Hey Twin\" என்று சொல்லுங்கள்",
    helloTwinBtn: "👋 ஹலோ ட்வின்",
    quick: [
      { label: "என் பசுமை இல்லம் எப்படி உள்ளது?", icon: Sparkles },
      { label: "நான் இப்போது தண்ணீர் ஊற்ற வேண்டுமா?", icon: Lightbulb },
      { label: "ஏதேனும் பிரச்சனைகள் உள்ளதா?", icon: Activity },
      { label: "VPD என்றால் என்ன?", icon: Leaf },
    ]
  }
};


// ── TTS helper ──
function speak(text, onEnd, langCode = "en-US") {
  if (!("speechSynthesis" in window) || !text) {
    onEnd?.();
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const clean = text
      .replace(/[#*`_>~]/g, "")
      .replace(/\n{2,}/g, ". ")
      .slice(0, 500);
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = langCode;
    utter.rate = 1.0;

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      let voice;
      if (langCode === "en-US") {
        // User prefers the default Windows male voice (e.g. Microsoft David)
        voice = voices.find(v => v.lang.replace('_', '-') === langCode && v.name.includes("David"))
             || voices.find(v => v.lang.replace('_', '-') === langCode && !v.name.includes("Google"))
             || voices.find(v => v.lang.replace('_', '-') === langCode);
      } else {
        // Prefer Google/Cloud voices for other languages as they sound more natural
        voice = voices.find(v => v.lang.replace('_', '-') === langCode && v.name.includes("Google"));
        if (!voice) voice = voices.find(v => v.lang.replace('_', '-') === langCode);
      }
      
      // Fallback: If no Malay voice exists, Indonesian (id-ID) is very similar and widely supported
      if (!voice && langCode === "ms-MY") {
        voice = voices.find(v => v.lang.startsWith("id") && v.name.includes("Google")) 
             || voices.find(v => v.lang.startsWith("id"));
      }

      if (voice) {
        utter.voice = voice;
      }
    }

    if (onEnd) {
      utter.onend = onEnd;
      utter.onerror = (e) => {
        console.warn("TTS Error:", e);
        onEnd();
      };
    }
    window.speechSynthesis.speak(utter);
  } catch (e) {
    console.warn("TTS Catch Error:", e);
    onEnd?.();
  }
}

// ── iOS Audio Unlock ──
const unlockAudio = () => {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance("");
    window.speechSynthesis.speak(utterance);
  }
};

export default function HeyTwinDialog({ isOpen, onClose }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [listening, setListening] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const responseRef = useRef(null);
  const hasGreetedRef = useRef(false);

  // ── Create a fresh speech recognition instance each time we need one ──
  const createRecognition = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;

    const recog = new SR();
    const savedLang = localStorage.getItem("twin_lang");
    const localeMap = { en: "en-US", zh: "zh-CN", ms: "ms-MY", ta: "ta-IN" };
    recog.lang = (savedLang && localeMap[savedLang]) ? localeMap[savedLang] : (navigator.language || "en-US");
    recog.continuous = false;
    recog.interimResults = false;

    recog.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) {
        const lower = transcript.toLowerCase();
        const activeLang = localStorage.getItem("twin_lang") || "en";
        const triggers = WAKE_WORDS_MAP[activeLang] || WAKE_WORDS_MAP.en;
        if (triggers.some((t) => lower.includes(t))) {
          triggerHelloTwin(activeLang);
        } else {
          sendMessage(transcript);
        }
      }
    };
    recog.onerror = () => setListening(false);
    recog.onend = () => setListening(false);

    return recog;
  }, []);

  // ── Start listening (creates fresh instance each time) ──
  const startListening = useCallback(() => {
    // Abort any existing
    try { recognitionRef.current?.abort(); } catch {}
    
    const recog = createRecognition();
    if (!recog) return;
    recognitionRef.current = recog;
    
    try {
      recog.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [createRecognition]);

  const stopListening = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch {}
    setListening(false);
  }, []);

  // ── On open: greet with TTS then auto-listen ──
  useEffect(() => {
    if (isOpen) {
      setClosing(false);
      setResponse(null);
      setInput("");
      setListening(false);
      hasGreetedRef.current = false;

      // Greet then listen
      const timer = setTimeout(() => {
        if (!hasGreetedRef.current) {
          hasGreetedRef.current = true;
          const lang = localStorage.getItem("twin_lang") || "en";
          const greetings = {
            en: "What can I help you with?",
            zh: "有什么我可以帮你的吗？",
            ms: "Apa yang boleh saya bantu?",
            ta: "நான் உங்களுக்கு எப்படி உதவ முடியும்?"
          };
          const ttsLangs = { en: "en-US", zh: "zh-CN", ms: "ms-MY", ta: "ta-IN" };
          speak(greetings[lang] || greetings.en, () => {
            // After TTS finishes, auto-start listening
            startListening();
          }, ttsLangs[lang] || "en-US");
        }
      }, 400);

      return () => clearTimeout(timer);
    } else {
      // Cleanup on close
      stopListening();
      try { window.speechSynthesis?.cancel(); } catch {}
    }
  }, [isOpen, startListening, stopListening]);

  // Scroll response into view
  useEffect(() => {
    if (response) {
      responseRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [response]);

  // ── Close with animation ──
  const handleClose = useCallback(() => {
    stopListening();
    try { window.speechSynthesis?.cancel(); } catch {}
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 200);
  }, [onClose, stopListening]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, handleClose]);

  // ── Hello Twin ──
  const triggerHelloTwin = async (langOverride = null) => {
    stopListening();
    try { window.speechSynthesis?.cancel(); } catch {}
    setLoading(true);
    setResponse(null);
    const langToUse = langOverride || localStorage.getItem("twin_lang") || "en";
    try {
      const res = await api.helloTwin(langToUse);
      setResponse(res);
      const ttsLangs = { en: "en-US", zh: "zh-CN", ms: "ms-MY", ta: "ta-IN" };
      // Speak the response, then auto-listen for follow-up
      speak(res.answer, () => startListening(), ttsLangs[langToUse] || "en-US");
    } catch {
      const lang = localStorage.getItem("twin_lang") || "en";
      const t = UI_TEXT[lang] || UI_TEXT.en;
      setResponse({ answer: t.connError, powered_by: "error" });
    } finally {
      setLoading(false);
    }
  };

  // ── Send message ──
  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput("");
    stopListening();
    try { window.speechSynthesis?.cancel(); } catch {}

    const lower = msg.toLowerCase();
    const activeLang = localStorage.getItem("twin_lang") || "en";
    const triggers = WAKE_WORDS_MAP[activeLang] || WAKE_WORDS_MAP.en;
    if (triggers.some((t) => lower.includes(t))) {
      return triggerHelloTwin();
    }

    setLoading(true);
    setResponse(null);
    try {
      const lang = localStorage.getItem("twin_lang") || "en";
      const res = await api.agentChat(msg, "default", lang);
      setResponse(res);
      const ttsLangs = { en: "en-US", zh: "zh-CN", ms: "ms-MY", ta: "ta-IN" };
      // Speak the response, then auto-listen for follow-up
      speak(res.answer, () => startListening(), ttsLangs[lang] || "en-US");
    } catch {
      const lang = localStorage.getItem("twin_lang") || "en";
      const t = UI_TEXT[lang] || UI_TEXT.en;
      setResponse({ answer: t.error, powered_by: "error" });
    } finally {
      setLoading(false);
    }
  };

  // ── Toggle voice ──
  const toggleListening = () => {
    unlockAudio();
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // ── Confirm / Reject ──
  const handleConfirm = async (actionId) => {
    setConfirming(true);
    try {
      const activeLang = localStorage.getItem("twin_lang") || "en";
      const res = await api.confirmAction(actionId, activeLang);
      setResponse((prev) => ({
        ...prev,
        answer: res.answer,
        actions_taken: res.actions_taken,
        actions_proposed: [],
        action_id: null,
      }));
      const ttsLangs = { en: "en-US", zh: "zh-CN", ms: "ms-MY", ta: "ta-IN" };
      speak(res.answer, null, ttsLangs[activeLang] || "en-US");
    } catch {
      // keep current response
    } finally {
      setConfirming(false);
    }
  };

  const handleReject = () => {
    const lang = localStorage.getItem("twin_lang") || "en";
    const t = UI_TEXT[lang] || UI_TEXT.en;
    setResponse((prev) => ({
      ...prev,
      actions_proposed: [],
      action_id: null,
      answer: prev.answer + "\n\n" + t.cancelled,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage();
  };

  const voiceSupported = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  if (!isOpen) return null;

  const currentLang = typeof window !== "undefined" ? localStorage.getItem("twin_lang") || "en" : "en";
  const t = UI_TEXT[currentLang] || UI_TEXT.en;

  return (
    <div
      className={`hey-twin-backdrop ${closing ? "closing" : ""}`}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="hey-twin-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header Orb */}
        <div className="hey-twin-header">
          <div className={`hey-twin-orb ${listening ? "listening" : ""} ${loading ? "loading" : ""}`}>
            <div className="hey-twin-orb-ring" />
            <div className="hey-twin-orb-ring" />
            <div className="hey-twin-orb-icon">
              <Sparkles size={20} />
            </div>
          </div>
          <div className="hey-twin-title">
            {listening ? t.listening : loading ? t.thinking : t.title}
          </div>
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="hey-twin-input-area">
          {voiceSupported && (
            <button
              type="button"
              onClick={toggleListening}
              disabled={loading}
              className={`hey-twin-btn ${listening ? "active" : ""}`}
              title={listening ? "Stop listening" : "Voice input"}
            >
              {listening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={listening ? t.listening : t.placeholder}
            className="hey-twin-input"
            disabled={loading}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="hey-twin-btn hey-twin-btn-send"
          >
            <Send size={16} />
          </button>
        </form>

        {/* Quick actions (when no response) */}
        {!response && !loading && (
          <div className="hey-twin-quick">
            <button
              className="hey-twin-quick-btn"
              onClick={() => { unlockAudio(); triggerHelloTwin(); }}
              style={{ borderColor: "rgba(245, 158, 11, 0.25)", color: "#fbbf24" }}
            >
              {t.helloTwinBtn}
            </button>
            {t.quick.map((q) => (
              <button
                key={q.label}
                className="hey-twin-quick-btn"
                onClick={() => sendMessage(q.label)}
              >
                <q.icon size={12} /> {q.label}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="hey-twin-loading">
            <Loader2 size={16} className="hey-twin-loading-spinner" />
            <span>{t.thinking}</span>
          </div>
        )}

        {/* Response */}
        {response && !loading && (
          <div className="hey-twin-response" ref={responseRef}>
            <div className="hey-twin-response-bubble">
              <MarkdownLite text={response.answer} />

              {/* Actions taken */}
              {response.actions_taken?.length > 0 && (
                <div className="hey-twin-actions">
                  {response.actions_taken.map((a, i) => (
                    <div key={i} className={`hey-twin-action-item ${a.success ? "taken-success" : "taken-fail"}`}>
                      {a.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
                      <span style={{ fontWeight: 500 }}>{a.actuator_name || a.actuator_id}</span>
                      <span style={{ color: "rgba(255,255,255,0.3)" }}>→</span>
                      <span style={{ fontFamily: "monospace", textTransform: "uppercase" }}>{a.command}</span>
                      {a.duration_seconds && (
                        <span style={{ marginLeft: "auto", opacity: 0.5 }}>{a.duration_seconds}s</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Actions proposed */}
              {response.actions_proposed?.length > 0 && response.action_id && (
                <>
                  <div className="hey-twin-actions">
                    {response.actions_proposed.map((a, i) => (
                      <div key={i} className="hey-twin-action-item proposed">
                        <Activity size={14} />
                        <span style={{ fontWeight: 500 }}>{a.actuator_name || a.actuator_id}</span>
                        <span style={{ color: "rgba(255,255,255,0.3)" }}>→</span>
                        <span style={{ fontFamily: "monospace", textTransform: "uppercase" }}>{a.command}</span>
                        {a.duration_seconds && (
                          <span style={{ marginLeft: "auto", opacity: 0.5 }}>{a.duration_seconds}s</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="hey-twin-action-btns">
                    <button
                      onClick={() => handleConfirm(response.action_id)}
                      disabled={confirming}
                      className="hey-twin-confirm-btn"
                    >
                      {confirming ? <Loader2 size={14} className="hey-twin-loading-spinner" /> : <CheckCircle size={14} />}
                      {t.confirm}
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={confirming}
                      className="hey-twin-reject-btn"
                    >
                      <XCircle size={14} /> {t.reject}
                    </button>
                  </div>
                </>
              )}

              {/* Powered by badge */}
              {response.powered_by && (
                <div className="hey-twin-powered">
                  <Zap size={8} />
                  <span>
                    {response.powered_by === "google_gemini" ? "Gemini" : response.powered_by}
                    {response.intent && response.intent !== "general_chat" && ` • ${response.intent}`}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer hints */}
        <div className="hey-twin-footer">
          <div className="hey-twin-hint">
            <span className="hey-twin-kbd">Ctrl</span>
            <span>+</span>
            <span className="hey-twin-kbd">K</span>
            <span style={{ marginLeft: 4 }}>{t.hintOpen}</span>
          </div>
          <div className="hey-twin-hint">
            <span className="hey-twin-kbd">ESC</span>
            <span style={{ marginLeft: 4 }}>{t.hintClose}</span>
          </div>
          <div className="hey-twin-hint">
            {t.hintWake}
          </div>
        </div>
      </div>
    </div>
  );
}
