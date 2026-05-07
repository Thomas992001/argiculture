import { useState, useEffect, useCallback, useRef } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { api } from "./api/client";
import Layout from "./components/Layout";
import OverviewPage from "./pages/OverviewPage";
import SensorsPage from "./pages/SensorsPage";
import ControlPage from "./pages/ControlPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import GreenhousePage from "./pages/GreenhousePage";
import AssistantPage from "./pages/AssistantPage";
import LoginPage from "./pages/LoginPage";
import AiAssistant from "./components/AiAssistant";
import HeyTwinDialog from "./components/HeyTwinDialog";
import { AlertsProvider } from "./contexts/AlertsProvider";

const WAKE_WORDS_MAP = {
  en: ["hello twin", "hi twin", "hey twin", "halo twin", "hey twins", "hello twins", "hi, twins", "twins"],
  zh: ["小双同学", "你好小双", "嗨小双", "嘿小双", "你好 twin", "twins", "twin", "hi twin", "hello twin", "hey twin"],
  ms: ["hi twins", "hello twins", "hey twins", "twins", "hi twin", "hello twin", "hey twin", "halo twin", "hi, twins"],
  ta: ["hello twin", "hi twin", "hey twin", "halo twin", "hey twins", "hello twins", "twins", "ஹலோ ட்வின்", "ஹலோ ட்வின்ஸ்", "ட்வின்", "ட்வின்ஸ்"],
};

// Wake word phrases to detect in continuous listening
const WAKE_PHRASES = Object.values(WAKE_WORDS_MAP).flat();

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [heyTwinOpen, setHeyTwinOpen] = useState(false);
  const [twinLang, setTwinLang] = useState(() => localStorage.getItem("twin_lang"));
  const wakeRecogRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      if (user) {
        api.bindSimulator(user.uid)
          .then(() => console.log("Backend bound to UID:", user.uid))
          .catch(err => console.error("Binding error:", err));

        // Fetch user's preferred language from Firestore
        getDoc(doc(db, "users", user.uid)).then((docSnap) => {
          if (docSnap.exists() && docSnap.data().twin_lang) {
            const lang = docSnap.data().twin_lang;
            localStorage.setItem("twin_lang", lang);
            setTwinLang(lang);
            window.dispatchEvent(new Event("twin_lang_changed"));
          }
        });
      }
      setLoading(false);
    });

    // Force browser to load TTS voices early in the background
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
    }

    return () => unsubscribe();
  }, []);

  // ── Global Ctrl+K shortcut ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setHeyTwinOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleLangChange = () => setTwinLang(localStorage.getItem("twin_lang"));
    window.addEventListener("twin_lang_changed", handleLangChange);
    return () => window.removeEventListener("twin_lang_changed", handleLangChange);
  }, []);

  // ── Continuous wake word detection (background listening) ──
  // Pauses automatically while HeyTwinDialog is open to avoid mic conflicts.
  useEffect(() => {
    if (!isAuthenticated || heyTwinOpen) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    let stopped = false;
    let restartTimer = null;

    const startWakeListener = () => {
      if (stopped) return;
      try {
        const recog = new SpeechRecognition();
        const savedLang = twinLang;
        const localeMap = { en: "en-US", zh: "zh-CN", ms: "ms-MY", ta: "ta-IN" };
        recog.lang = (savedLang && localeMap[savedLang]) ? localeMap[savedLang] : (navigator.language || "en-US");
        recog.continuous = true;
        recog.interimResults = true;

        let triggered = false;

        recog.onresult = (event) => {
          if (triggered) return;
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0]?.transcript?.toLowerCase().trim();
            if (transcript) {
              const activeLang = twinLang || "en";
              const triggers = WAKE_WORDS_MAP[activeLang] || WAKE_WORDS_MAP.en;
              if (triggers.some(t => transcript.includes(t))) {
                triggered = true;
                setHeyTwinOpen(true);
                try { recog.stop(); } catch {}
                return;
              }
            }
          }
        };

        recog.onerror = (e) => {
          if (!stopped && !triggered && e.error !== "not-allowed") {
            restartTimer = setTimeout(startWakeListener, 2000);
          }
        };

        recog.onend = () => {
          // Only auto-restart if we didn't trigger the dialog
          if (!stopped && !triggered) {
            restartTimer = setTimeout(startWakeListener, 1000);
          }
        };

        recog.start();
        wakeRecogRef.current = recog;
      } catch {
        // Browser blocked or not supported
      }
    };

    // Small delay on mount
    restartTimer = setTimeout(startWakeListener, 2000);

    return () => {
      stopped = true;
      if (restartTimer) clearTimeout(restartTimer);
      try {
        if (wakeRecogRef.current) {
          wakeRecogRef.current.onend = null;
          wakeRecogRef.current.stop();
        }
      } catch {}
    };
  }, [isAuthenticated, heyTwinOpen, twinLang]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const openHeyTwin = useCallback(() => setHeyTwinOpen(true), []);

  if (loading) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        backgroundColor: '#050a07',
        color: 'white',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ animation: 'spin 1s linear infinite' }}>↻</div>
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route 
          path="/login" 
          element={
            isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
          } 
        />
        
        <Route
          element={
            isAuthenticated ? (
              <AlertsProvider>
                <Layout onLogout={handleLogout} />
              </AlertsProvider>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route path="/" element={<OverviewPage />} />
          <Route path="/sensors" element={<SensorsPage />} />
          <Route path="/greenhouse" element={<GreenhousePage />} />
          <Route path="/control" element={<ControlPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/assistant" element={<AssistantPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {isAuthenticated && location.pathname !== "/assistant" && <AiAssistant onOpenHeyTwin={openHeyTwin} />}
      {isAuthenticated && (
        <HeyTwinDialog
          isOpen={heyTwinOpen}
          onClose={() => setHeyTwinOpen(false)}
        />
      )}
    </>
  );
}
