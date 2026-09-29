export const FIXTRACE_API_BASE = "http://127.0.0.1:8001/api";

export interface HindsightStatus {
  configured: boolean;
  api_url: string;
  bank_id: string;
  reachable: boolean;
  latency_ms: number | null;
  error?: string | null;
}

export interface StructuredGuidance {
  prior_experience_found: boolean;
  summary?: string | null;
  failed_actions: string[];
  successful_action?: string | null;
  root_cause?: string | null;
  lesson_learned?: string | null;
  best_match_score?: number | null;
}

export interface HindsightMemoryItem {
  id?: string;
  text: string;
  type?: string;
  tags?: string[];
  context?: string;
  scores?: Record<string, number> | null;
}

export interface HindsightRecallSummary {
  status: "connected" | "unconfigured" | "error";
  configured: boolean;
  message?: string;
  query: string;
  prior_experience_found: boolean;
  count: number;
  guidance?: StructuredGuidance | null;
  memories: HindsightMemoryItem[];
}

export interface IncidentAttempt {
  id: string;
  incident_id: string;
  attempt_number: number;
  action_taken: string;
  result: "FAILED" | "SUCCESSFUL";
  observed_notes: string;
  performed_by: string;
  telemetry_before?: string | null;
  telemetry_after?: string | null;
  timestamp: string;
}

export interface FixTraceIncident {
  id: string;
  machine_id: string;
  symptoms: string;
  operating_conditions: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  technician_name: string;
  root_cause?: string | null;
  resolution_summary?: string | null;
  lesson_learned?: string | null;
  hindsight_retained_id?: string | null;
  created_at: string;
  resolved_at?: string | null;
  attempts: IncidentAttempt[];
}

export interface IngestResponse {
  incident: FixTraceIncident;
  hindsight_recall: HindsightRecallSummary;
  machine_registered: boolean;
}

export interface AttemptCreatePayload {
  action_taken: string;
  result: "FAILED" | "SUCCESSFUL";
  observed_notes: string;
  performed_by: string;
  telemetry_before?: string | null;
  telemetry_after?: string | null;
}

export interface CarbonTwinIngestPayload {
  id?: string;
  machine_id?: string;
  name?: string;
  type?: string;
  location?: string;
  department?: string;
  temperature?: number | null;
  pressure?: number | null;
  vibration?: number | null;
  rpm?: number | null;
  power?: number | null;
  torque?: number | null;
  operating_state?: string | null;
  symptoms?: string | null;
  operating_conditions?: string | null;
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
  technician_name?: string | null;
  current_technician?: string | null;
  ai_prediction?: any;
}

// ============================================================
// API CLIENT
// ============================================================

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${FIXTRACE_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    let errorDetail = `FixTrace API request failed (${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson?.detail) {
        errorDetail = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export async function fetchMemoryStatus(): Promise<HindsightStatus> {
  return apiRequest<HindsightStatus>("/memory/status");
}

export async function ingestMachineIncident(payload: CarbonTwinIngestPayload): Promise<IngestResponse> {
  return apiRequest<IngestResponse>("/incidents/ingest-carbontwin", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchIncidents(machineId?: string, status?: string): Promise<FixTraceIncident[]> {
  const params = new URLSearchParams();
  if (machineId) params.append("machine_id", machineId);
  if (status) params.append("status", status);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<FixTraceIncident[]>(`/incidents${qs}`);
}

export async function fetchIncident(incidentId: string): Promise<FixTraceIncident> {
  return apiRequest<FixTraceIncident>(`/incidents/${encodeURIComponent(incidentId)}`);
}

export async function fetchIncidentRecall(incidentId: string): Promise<HindsightRecallSummary> {
  return apiRequest<HindsightRecallSummary>(`/incidents/${encodeURIComponent(incidentId)}/recall`);
}

export interface ResolveIncidentPayload {
  root_cause: string;
  resolution_summary: string;
  lesson_learned: string;
}

export async function logIncidentAttempt(
  incidentId: string,
  payload: AttemptCreatePayload
): Promise<IncidentAttempt> {
  return apiRequest<IncidentAttempt>(`/incidents/${encodeURIComponent(incidentId)}/attempts`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function resolveIncident(
  incidentId: string,
  payload: ResolveIncidentPayload
): Promise<FixTraceIncident> {
  return apiRequest<FixTraceIncident>(`/incidents/${encodeURIComponent(incidentId)}/resolve`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface ObservabilityRetain {
  id: number;
  incident_id: string;
  machine_id: string;
  bank_id: string;
  retained_id: string;
  successful_action: string;
  root_cause: string;
  lesson_learned: string;
  content_snippet?: string | null;
  timestamp: string | null;
}

export interface ObservabilityRecall {
  id: number;
  incident_id?: string | null;
  machine_id?: string | null;
  bank_id: string;
  query: string;
  prior_experience_found: boolean;
  memories_count: number;
  best_match_score?: number | null;
  failed_actions: string[];
  successful_action?: string | null;
  root_cause?: string | null;
  lesson_learned?: string | null;
  timestamp: string | null;
}

export interface LifecycleEvent {
  incident_id: string;
  machine_id: string;
  severity: string;
  status: string;
  symptoms: string;
  operating_conditions: string;
  attempts_count: number;
  has_retained: boolean;
  hindsight_retained_id?: string | null;
  root_cause?: string | null;
  resolution_summary?: string | null;
  lesson_learned?: string | null;
  created_at: string | null;
  resolved_at?: string | null;
}

export interface ObservabilityData {
  hindsight_status: HindsightStatus;
  operational_sqlite: {
    machines_registered: number;
    total_incidents: number;
    total_attempts: number;
    resolved_incidents: number;
  };
  experiential_memory: {
    active_bank_id: string;
    total_retain_events: number;
    total_recall_events: number;
    recent_retains: ObservabilityRetain[];
    recent_recalls: ObservabilityRecall[];
  };
  lifecycle_events: LifecycleEvent[];
}

export async function fetchObservabilityData(): Promise<ObservabilityData> {
  return apiRequest<ObservabilityData>("/memory/observability");
}


