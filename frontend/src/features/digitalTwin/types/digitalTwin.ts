import type { Machine as ApiMachine } from "../../../services/api";

export type Machine = ApiMachine;

export type MachineHealth =
  | "Healthy"
  | "Warning"
  | "Critical";

export type MachineStatus =
  | "Operational"
  | "Needs Attention"
  | "Maintenance"
  | "Stopped"
  | "Emergency Stop"
  | "Unknown";

export interface SensorData {
  temperature: number;
  pressure: number;
  vibration: number;
  rpm: number;
  torque: number;
  power: number;
  energy: number;
  carbon: number;
  water: number;
}

export interface Department {
  id: string;
  name: string;
  machines: Machine[];
}

export interface Factory {
  id: string;
  name: string;
  departments: Department[];
}

export interface MachineNodeProps {
  machine: Machine;
  selected?: boolean;
  onSelect?: (machine: Machine) => void;
}