import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../../backend/firebaseConfig";
import Layout from "./components/Layout";
import OverviewPage from "./pages/OverviewPage";
import SensorsPage from "./pages/SensorsPage";
import ControlPage from "./pages/ControlPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import GreenhousePage from "./pages/GreenhousePage";
import AssistantPage from "./pages/AssistantPage";
import LoginPage from "./pages/LoginPage";
import AiAssistant from "./components/AiAssistant";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

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
        
        <Route element={isAuthenticated ? <Layout onLogout={handleLogout} /> : <Navigate to="/login" replace />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/sensors" element={<SensorsPage />} />
          <Route path="/greenhouse" element={<GreenhousePage />} />
          <Route path="/control" element={<ControlPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/assistant" element={<AssistantPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {isAuthenticated && <AiAssistant />}
    </>
  );
}
