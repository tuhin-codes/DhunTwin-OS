import { Routes, Route } from "react-router-dom";

import FactoryOverview from "../pages/FactoryOverview";
import DigitalTwins from "../pages/DigitalTwins";
import AIControlCenter from "../pages/AIControlCenter";
import AICopilot from "../pages/AICopilot";
import Maintenance from "../pages/Maintenance";
import Sustainability from "../pages/Sustainability";
import Reports from "../pages/Reports";
import Settings from "../pages/Settings";
import FixTraceWorkbench from "../pages/FixTraceWorkbench";

export default function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={<FactoryOverview />}
      />

      <Route
        path="/digital-twins"
        element={<DigitalTwins />}
      />

      <Route
        path="/ai-control-center"
        element={<AIControlCenter />}
      />

      <Route
        path="/maintenance"
        element={<Maintenance />}
      />

      <Route
        path="/fixtrace"
        element={<FixTraceWorkbench />}
      />

      <Route
        path="/sustainability"
        element={<Sustainability />}
      />

      <Route
        path="/reports"
        element={<Reports />}
      />

      <Route
        path="/ai-copilot"
        element={<AICopilot />}
      />

      <Route
        path="/settings"
        element={<Settings />}
      />
    </Routes>
  );
}