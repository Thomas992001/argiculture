import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import OverviewPage from "./pages/OverviewPage";
import SensorsPage from "./pages/SensorsPage";
import ControlPage from "./pages/ControlPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import GreenhousePage from "./pages/GreenhousePage";
import AssistantPage from "./pages/AssistantPage";
import AiAssistant from "./components/AiAssistant";

export default function App() {
  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/sensors" element={<SensorsPage />} />
          <Route path="/greenhouse" element={<GreenhousePage />} />
          <Route path="/control" element={<ControlPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/assistant" element={<AssistantPage />} />
        </Route>
      </Routes>
      <AiAssistant />
    </>
  );
}
