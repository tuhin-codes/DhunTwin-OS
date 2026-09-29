import {
  aiEvents,
  kpiCards,
  machineStatus,
  sustainability,
  maintenance,
} from "../data/mockDashboard";

export const dashboardService = {
  getKPIs: () => kpiCards,
  getMachines: () => machineStatus,
  getAIEvents: () => aiEvents,
  getSustainability: () => sustainability,
  getMaintenance: () => maintenance,
};