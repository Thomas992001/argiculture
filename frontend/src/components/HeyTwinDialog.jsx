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

const QUICK_ACTIONS = [
  { label: "How's my greenhouse?", icon: Sparkles },
  { label: "Should I water now?", icon: Lightbulb },
  { label: "Any problems?", icon: Activity },
  { label: "What's the VPD?", icon: Leaf },
];

const HELLO_TWIN_TRIGGERS = [
  "hello twin", "hi twin", "hey twin", "halo twin",
  "你好孪生", "嗨孪生",
];

// ── TTS helper ──
function speak(text, onEnd) {
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
    utter.lang = "en-US";
    utter.rate = 1.0;
    if (onEnd) utter.onend = onEnd;
    window.speechSynthesis.speak(utter);
  } catch {
    onEnd?.();
  }
}

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
    recog.lang = "en-US";
    recog.continuous = false;
    recog.interimResults = false;

    recog.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) {
        const lower = transcript.toLowerCase();
        if (HELLO_TWIN_TRIGGERS.some((t) => lower.includes(t))) {
          triggerHelloTwin();
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
          speak("What can I help you with?", () => {
            // After TTS finishes, auto-start listening
            startListening();
          });
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
  const triggerHelloTwin = async () => {
    stopListening();
    setLoading(true);
    setResponse(null);
    try {
      const res = await api.helloTwin();
      setResponse(res);
      // Speak the response, then auto-listen for follow-up
      speak(res.answer, () => startListening());
    } catch {
      setResponse({ answer: "Sorry, I couldn't connect. Please try again.", powered_by: "error" });
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

    const lower = msg.toLowerCase();
    if (HELLO_TWIN_TRIGGERS.some((t) => lower.includes(t))) {
      return triggerHelloTwin();
    }

    setLoading(true);
    setResponse(null);
    try {
      const res = await api.agentChat(msg, "hey-twin", null);
      setResponse(res);
      // Speak the response, then auto-listen for follow-up
      speak(res.answer, () => startListening());
    } catch {
      setResponse({ answer: "Sorry, something went wrong. Please try again.", powered_by: "error" });
    } finally {
      setLoading(false);
    }
  };

  // ── Toggle voice ──
  const toggleListening = () => {
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
      const res = await api.confirmAction(actionId);
      setResponse((prev) => ({
        ...prev,
        answer: res.answer,
        actions_taken: res.actions_taken,
        actions_proposed: [],
        action_id: null,
      }));
      speak(res.answer);
    } catch {
      // keep current response
    } finally {
      setConfirming(false);
    }
  };

  const handleReject = () => {
    setResponse((prev) => ({
      ...prev,
      actions_proposed: [],
      action_id: null,
      answer: prev.answer + "\n\n❌ Action cancelled.",
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage();
  };

  const voiceSupported = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  if (!isOpen) return null;

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
            {listening ? "Listening..." : loading ? "Thinking..." : "Hey Twin"}
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
            placeholder={listening ? "Listening..." : "Ask anything or give a command..."}
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
              onClick={triggerHelloTwin}
              style={{ borderColor: "rgba(245, 158, 11, 0.25)", color: "#fbbf24" }}
            >
              👋 Hello Twin
            </button>
            {QUICK_ACTIONS.map((q) => (
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
            <span>Thinking...</span>
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
                      Confirm
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={confirming}
                      className="hey-twin-reject-btn"
                    >
                      <XCircle size={14} /> Reject
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
            <span style={{ marginLeft: 4 }}>to open</span>
          </div>
          <div className="hey-twin-hint">
            <span className="hey-twin-kbd">ESC</span>
            <span style={{ marginLeft: 4 }}>to close</span>
          </div>
          <div className="hey-twin-hint">
            🎤 say &quot;Hey Twin&quot;
          </div>
        </div>
      </div>
    </div>
  );
}
