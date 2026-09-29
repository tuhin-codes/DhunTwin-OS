export interface KPICard {
  id: string;
  title: string;
  value: string | number;
  unit?: string;
  change?: number;
  trend?: "up" | "down" | "stable";
  status?: "success" | "warning" | "danger" | "info";
}

export interface MachineStatus {
  id: string;
  name: string;
  department: string;
  health: number;
  status: "Healthy" | "Warning" | "Critical";
}

export interface AIEvent {
  id: string;
  title: string;
  description: string;
  severity: "Low" | "Medium" | "High";
  time: string;
}

export interface SustainabilityMetric {
  id: string;
  title: string;
  value: string;
  unit: string;
}

export interface MaintenanceTicket {
  id: string;
  machine: string;
  technician: string;
  priority: "Low" | "Medium" | "High";
  status: "Open" | "Assigned" | "In Progress" | "Completed";
}