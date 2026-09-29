import type {
  KPICard,
  MachineStatus,
  AIEvent,
  SustainabilityMetric,
  MaintenanceTicket,
} from "../types/dashboard";

export const kpiCards: KPICard[] = [
  {
    id: "1",
    title: "Total Machines",
    value: 24,
    status: "info",
  },
  {
    id: "2",
    title: "Healthy Machines",
    value: 21,
    status: "success",
  },
  {
    id: "3",
    title: "Active Alerts",
    value: 3,
    status: "warning",
  },
  {
    id: "4",
    title: "Open Tickets",
    value: 2,
    status: "danger",
  },
];

export const machineStatus: MachineStatus[] = [];

export const aiEvents: AIEvent[] = [];

export const sustainability: SustainabilityMetric[] = [];

export const maintenance: MaintenanceTicket[] = [];