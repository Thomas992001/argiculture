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
} from "lucide-react";
import { api } from "../api/client";

const QUICK_QUESTIONS = [
  { label: "How is my greenhouse?", icon: Sparkles },
  { label: "Should I water now?", icon: Lightbulb },
  { label: "Any problems?", icon: Lightbulb },
  { label: "Give me tips", icon: Sparkles },
  { label: "What's the VPD?", icon: Leaf },
  { label: "Explain pH to me", icon: Leaf },
];

function MarkdownLite({ text }) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        let html = line
          .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
          .replace(/`(.+?)`/g, '<code class="px-1 rounded bg-gray-800 text-greenhouse-300 text-[11px]">$1</code>');

        if (/^#{1,3}\s/.test(line)) {
          const content = html.replace(/^#{1,3}\s/, "");
          return <div key={i} className="text-sm font-semibold text-white mt-1" dangerouslySetInnerHTML={{ __html: content }} />;
        }
        if (/^\d+\.\s/.test(html)) return <div key={i} className="pl-3 text-gray-300" dangerouslySetInnerHTML={{ __html: html }} />;
        if (html.startsWith("- ")) return (
          <div key={i} className="pl-3 flex gap-1.5 text-gray-300">
            <span className="text-greenhouse-400 shrink-0">•</span>
            <span dangerouslySetInnerHTML={{ __html: html.slice(2) }} />
          </div>
        );
        return <p key={i} className="text-gray-300" dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}

export default function AiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 200);
  }, [isOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text) => {
    setMessages((prev) => [...prev, { id: Date.now(), text, isUser: true }]);
    setLoading(true);
    try {
      const response = await api.chatWithAdvisor(text);
      setMessages((prev) => [...prev, {
        id: Date.now() + 1, text: response.answer, isUser: false,
        powered_by: response.powered_by, model: response.model,
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        id: Date.now() + 1, text: "Sorry, I couldn't process that. Please try again.", isUser: false,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput("");
    sendMessage(trimmed);
  };

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-greenhouse-600 to-greenhouse-700 hover:from-greenhouse-500 hover:to-greenhouse-600 text-white shadow-lg shadow-greenhouse-600/30 flex items-center justify-center transition-all hover:scale-110">
          <Sparkles size={24} />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-greenhouse-400 rounded-full animate-pulse-green" />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[420px] max-h-[600px] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl shadow-black/50 flex flex-col animate-slide-up overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gradient-to-r from-gray-900 to-gray-900/95">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-greenhouse-500/30 to-blue-500/20 flex items-center justify-center">
                <Sparkles size={16} className="text-greenhouse-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">GreenMind AI</h3>
                <p className="text-[10px] text-greenhouse-400 flex items-center gap-1">
                  <Zap size={8} /> Powered by Google Gemini
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button onClick={() => { api.clearChat().catch(()=>{}); setMessages([]); }}
                  className="text-gray-500 hover:text-gray-300 p-1.5" title="Clear chat">
                  <Trash2 size={14} />
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-300 p-1.5">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[400px]">
            {messages.length === 0 && (
              <div className="text-center py-6">
                <Sparkles size={24} className="mx-auto text-greenhouse-400 mb-2" />
                <p className="text-sm text-gray-400 mb-4">Ask me anything about your greenhouse</p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {QUICK_QUESTIONS.map((q) => (
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
                    <p className="text-sm text-blue-200">{msg.text}</p>
                  ) : (
                    <MarkdownLite text={msg.text} />
                  )}
                  {msg.powered_by && (
                    <div className="mt-1.5 flex items-center gap-1">
                      <Zap size={8} className={msg.powered_by === "google_gemini" ? "text-greenhouse-500" : "text-gray-600"} />
                      <span className="text-[8px] text-gray-600">
                        {msg.powered_by === "google_gemini" ? "Gemini" : "Local AI"}
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
                    <span className="text-[11px] text-gray-500">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 border-t border-gray-800 flex gap-2">
            <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
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
