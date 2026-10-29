/* ============================================================
   DHUN DIGITAL TWIN — LIVE LAYER TYPES
   One frame is the state of every instrumented asset at a
   moment in time. The model produces frames now; a field
   gateway will produce them later.
   ============================================================ */

import type {
  PhaseId,
  TwinSummary,
} from "../types";

export type TwinNodeKind =
  | "solar"
  | "grid"
  | "building"
  | "water"
  | "stp"
  | "organic"
  | "compute"
  | "weather";

export type TwinStatus =
  | "online"
  | "watch"
  | "alarm"
  | "offline";

export type MetricStatus =
  | "normal"
  | "watch"
  | "alarm";

export interface TwinMetric {
  key: string;
  label: string;
  unit: string;
  decimals: number;
  value: number;
  status: MetricStatus;
  normal: [number, number];
  alarm: [number, number];
  history: number[];
  /* True only while a valid gateway packet is inside its
     30-second life. The rest of the series is model output. */
  live: boolean;
  /* True when a packet was previously received but is now older than TTL */
  stale?: boolean;
  /* Explicit 7-tier provenance tag */
  provenance?: "measured" | "reported" | "document" | "calculated" | "estimated" | "assumption" | "simulated";
}

export interface TwinControl {
  key: string;
  label: string;
  options: string[];
  default: string;
  note: string;
}

export interface TwinNode {
  id: string;
  name: string;
  short: string;
  kind: TwinNodeKind;
  x: number;
  y: number;

  status: TwinStatus;
  available: boolean;
  availabilityNote?: string;
  plannedChannels: number;

  deviceId: string;
  protocol: string;
  gateway: string;
  description: string;

  primaryKey: string;
  metrics: TwinMetric[];
  controls: TwinControl[];
}

export interface TwinFrame {
  phase: PhaseId;
  at: Date;
  summary: TwinSummary;
  nodes: TwinNode[];

  online: number;
  planned: number;
  sensors: number;
  alarms: number;
  watches: number;
}

export interface TelemetryPacket {
  nodeId: string;
  metric: string;
  value: number;
  at?: number;
}

export interface TwinEvent {
  id: string;
  level: "alarm" | "watch";
  nodeId: string;
  nodeName: string;
  message: string;
  at: Date;
}

export interface TwinAction {
  id: string;
  icon: "compute" | "pump" | "water";
  title: string;
  detail: string;
  metric: string;
  tone: "good" | "warn";
  href: string;
  cta: string;
}

export const TWIN_STATUS: Record<
  TwinStatus,
  { label: string; color: string }
> = {
  online: { label: "Online", color: "#64A882" },
  watch: { label: "Watch", color: "#D9A03A" },
  alarm: { label: "Alarm", color: "#D8624F" },
  offline: { label: "Not commissioned", color: "#868279" },
};

export const METRIC_STATUS: Record<
  MetricStatus,
  { label: string; color: string }
> = {
  normal: { label: "Normal", color: "#64A882" },
  watch: { label: "Watch", color: "#D9A03A" },
  alarm: { label: "Alarm", color: "#D8624F" },
};

export type FeedStatus =
  | "simulated"
  | "connecting"
  | "live"
  | "stale"
  | "offline";
