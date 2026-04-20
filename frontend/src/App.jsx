import { useState, useEffect, useCallback, useRef } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
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

// Wake word phrases to detect in continuous listening
const WAKE_PHRASES = ["hey twin", "hello twin", "hi twin", "halo twin"];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [heyTwinOpen, setHeyTwinOpen] = useState(false);
  const wakeRecogRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      if (user) {
        api.bindSimulator(user.uid)
          .then(() => console.log("Backend bound to UID:", user.uid))
          .catch(err => console.error("Binding error:", err));
      }
      setLoading(false);
    });
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
        recog.lang = "en-US";
        recog.continuous = true;
        recog.interimResults = true;

        let triggered = false;

        recog.onresult = (event) => {
          if (triggered) return;
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0]?.transcript?.toLowerCase().trim();
            if (transcript && WAKE_PHRASES.some((w) => transcript.includes(w))) {
              triggered = true;
              setHeyTwinOpen(true);
              try { recog.stop(); } catch {}
              return;
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
      clearTimeout(restartTimer);
      try { wakeRecogRef.current?.abort(); } catch {}
      wakeRecogRef.current = null;
    };
  }, [isAuthenticated, heyTwinOpen]);

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
      {isAuthenticated && <AiAssistant onOpenHeyTwin={openHeyTwin} />}
      {isAuthenticated && (
        <HeyTwinDialog
          isOpen={heyTwinOpen}
          onClose={() => setHeyTwinOpen(false)}
        />
      )}
    </>
  );
}
