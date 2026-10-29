import { Route, Routes } from "react-router-dom";

import DigitalTwin from "../pages/DigitalTwin";
import Campus from "../pages/Campus";
import Ledger from "../pages/Ledger";
import Scenarios from "../pages/Scenarios";
import Compute from "../pages/Compute";
import EnergyEvidence from "../pages/EnergyEvidence";
import NotFound from "../pages/NotFound";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/twin" element={<DigitalTwin />} />
      <Route path="/" element={<Campus />} />
      <Route path="/ledger" element={<Ledger />} />
      <Route
        path="/scenarios"
        element={<Scenarios />}
      />
      <Route path="/compute" element={<Compute />} />
      <Route path="/energy" element={<EnergyEvidence />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
