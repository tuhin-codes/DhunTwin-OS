const API_BASE = "http://127.0.0.1:8000";

// ============================================================
// CACHE
// ============================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<
  string,
  CacheEntry<unknown>
>();

const inFlightRequests = new Map<
  string,
  Promise<unknown>
>();

const CACHE_TTL = 5000;

// ============================================================
// GENERIC REQUEST
// ============================================================

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {

  const response = await fetch(
    `${API_BASE}${path}`,
    {
      ...options,

      headers: {
        Accept:
          "application/json",

        ...(options?.headers || {}),
      },
    }
  );

  if (!response.ok) {

    let message =
      `API request failed: ${response.status} ${response.statusText}`;

    try {

      const errorData =
        await response.json();

      if (
        typeof errorData?.detail ===
        "string"
      ) {

        message =
          errorData.detail;
      }

    } catch {
      // Keep default message.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

// ============================================================
// CACHED REQUEST
// ============================================================

async function cachedRequest<T>(
  path: string,
  ttl = CACHE_TTL
): Promise<T> {

  const now = Date.now();

  const cached =
    cache.get(path);

  if (
    cached &&
    now - cached.timestamp < ttl
  ) {

    return cached.data as T;
  }

  const existing =
    inFlightRequests.get(path);

  if (existing) {

    return existing as Promise<T>;
  }

  const promise =
    request<T>(path)
      .then((data) => {

        cache.set(
          path,
          {
            data,
            timestamp:
              Date.now(),
          }
        );

        return data;
      })
      .finally(() => {

        inFlightRequests.delete(
          path
        );
      });

  inFlightRequests.set(
    path,
    promise as Promise<unknown>
  );

  return promise;
}

// ============================================================
// CACHE CONTROLS
// ============================================================

export function clearApiCache(): void {
  cache.clear();
}

export function clearMachinesCache(): void {
  cache.delete(
    "/machines/"
  );
}

// ============================================================
// FAILURE PROBABILITIES
// ============================================================

export interface FailureProbabilities {
  "30m": number;
  "60m": number;
  "120m": number;
}

// ============================================================
// RISK LEVEL
// ============================================================

export type RiskLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL"
  | "UNKNOWN";

// ============================================================
// PREDICTIVE MAINTENANCE
// ============================================================

export interface PredictiveMaintenance {

  available: boolean;

  model: string;

  machine_id: string;

  timestamp:
    | string
    | null;

  machine_type: string;

  risk:
    | FailureProbabilities
    | null;

  risk_level: RiskLevel;

  risk_score:
    | number
    | null;

  failure_probability:
    | FailureProbabilities
    | null;

  ai_failure_probability?:
    | number
    | null;

  reason: string;

  recommended_action: string;

  live_observations?:
    | number;

  status: string;
}

// ============================================================
// ANOMALY
// ============================================================

export interface AnomalyResult {

  prediction: number;

  score: number;

  model: string;
}

// ============================================================
// DEGRADATION
// ============================================================

export interface DominantSignal {

  signal: string;

  deviation: number;

  signed_deviation?:
    | number
    | null;

  position?:
    | string
    | null;
}

export interface DegradationResult {

  machine_id: string;

  timestamp: string;

  machine_type: string;

  normalized_machine_type?:
    | string
    | null;

  condition: string;

  baseline_available?:
    boolean;

  available_signal_count?:
    number;

  total_signal_count?:
    number;

  current_deviation:
    | number
    | null;

  maximum_deviation?:
    | number
    | null;

  deviation_trend:
    | number
    | null;

  attention_signal_count?:
    | number
    | null;

  degraded_signal_count?:
    | number
    | null;

  critical_signal_count?:
    number
    | null;

  anomaly_available?:
    boolean;

  anomaly_persistence:
    | number
    | null;

  dominant_signals:
    DominantSignal[];

  history_points: number;

  explanation?:
    string;
}

// ============================================================
// BASELINE SIGNAL
// ============================================================

export interface BaselineSignal {

  available: boolean;

  deviation:
    | number
    | null;

  signed_deviation?:
    | number
    | null;

  position?:
    | string
    | null;

  baseline?: {

    median: number;

    mean: number;

    std: number;
  };

  reason?: string;
}

// ============================================================
// BASELINE RESULT
// ============================================================

export interface BaselineResult {

  machine_type: string;

  normalized_machine_type?:
    | string
    | null;

  signals: Record<
    string,
    BaselineSignal
  >;

  available?:
    boolean;

  available_signal_count?:
    number;

  total_signal_count?:
    number;
}

// ============================================================
// AI CONDITION TELEMETRY
// ============================================================

export interface AIConditionTelemetry {

  Temperature: number;

  Pressure: number;

  Vibration: number;

  Power: number;
}

// ============================================================
// AI CONDITION PREDICTIVE FAILURE
// ============================================================

export interface AIConditionPredictiveFailure {

  available: boolean;

  probability:
    | FailureProbabilities
    | null;

  risk_level: RiskLevel;

  risk_score:
    | number
    | null;

  ai_failure_probability?:
    | number
    | null;

  reason: string;

  recommended_action: string;

  operational_condition?:
    | string;

  degradation_condition?:
    | string;

  model_risk_level?:
    | string;
}

// ============================================================
// AI CONDITION RUL
// ============================================================

export interface AIConditionRUL {

  available: boolean;

  remaining_useful_life_hours:
    | number
    | null;

  confidence: number;

  status: string;

  reason: string;

  factors?: {

    condition: number;

    predictive: number;

    degradation: number;

    anomaly: number;
  };

  method?: string;

  baseline_rul_hours?:
    number;
}

// ============================================================
// AI CONDITION
// ============================================================

export interface AICondition {

  available: boolean;

  machine_id: string;

  timestamp:
    | string
    | null;

  machine_type: string;

  digital_twin_health_score?:
    | number
    | null;

  ai_health_score:
    | number
    | null;

  telemetry:
    AIConditionTelemetry;

  degradation:
    DegradationResult;

  baseline:
    BaselineResult;

  predictive_failure:
    AIConditionPredictiveFailure;

  rul:
    AIConditionRUL;

  operational_condition?: {

    level: string;

    action: string;

    degradation_condition?: string;

    model_risk_level?: string;
  };

  status: string;
}

// ============================================================
// COMPATIBILITY ALIAS
// ============================================================

export type AIConditionResult =
  AICondition;

// ============================================================
// MACHINE
// ============================================================

export interface Machine {

  id: string;

  name: string;

  type: string;

  department: string;

  location: string;

  temperature: number;

  pressure: number;

  vibration: number;

  rpm: number;

  torque: number;

  power: number;

  energy: number;

  carbon: number;

  water: number;

  efficiency: number;

  health_score: number;

  failure_probability: number;

  remaining_useful_life: number;

  maintenance_status: string;

  current_technician:
    | string
    | null;

  current_ticket:
    | string
    | null;

  machine_type?:
    | string
    | null;

  ai_prediction?:
    PredictiveMaintenance;
}

// ============================================================
// SUSTAINABILITY
// ============================================================

export interface SustainabilityRecommendation {
  priority: string;
  machine: string;
  title: string;
  reason: string;
  expected_impact: string;
}

export interface SustainabilityData {
  summary: {
    machines: number;
    power: number;
    carbon: number;
    energy: number;
    water: number;
  };

  top_emitters: Array<{
    name: string;
    carbon: number;
  }>;

  recommendations: SustainabilityRecommendation[];

  carbon_risk?: string;
}

// ============================================================
// CARBON OPTIMIZATION
// ============================================================

export interface OptimizationMachine {
  machine_id: string;
  machine_name: string;
  operating_state: string;
  utilization_percent: number;
  idle: boolean;
  production_critical: boolean;

  current: {
    rpm: number;
    power_kw: number;
    carbon_kg: number;
    energy_kwh: number;
    efficiency: number;
    health_score?: number;
  };

  recommended: {
    rpm: number;
    power_kw: number;
    carbon_kg: number;
    energy_kwh: number;
    efficiency: number;
  };

  impact: {
    rpm_reduction_percent: number;
    power_reduction_kw: number;
    carbon_reduction_kg: number;
    energy_reduction_kwh: number;
  };

  action: string;
}

export interface OptimizationResult {
  status: string;
  target_classification: string;
  current_carbon: number;
  target_carbon: number;
  projected_carbon: number;
  reduction: number;
  required_reduction: number;
  realistic_reduction_potential: number;
  realistic_reduction_potential_percent: number;
  realistic_target_carbon: number;
  remaining_reduction: number;
  machines: OptimizationMachine[];
}

// ============================================================
// FACTORY
// ============================================================

export interface Factory {
  [key: string]: unknown;
}

// ============================================================
// MAINTENANCE ENGINEER
// ============================================================

export interface MaintenanceEngineerRecommendation {

  technician_id: string;

  technician: string;

  role: string;

  specialization: string;

  department: string;

  skills: string[];

  matched_skills: string[];

  certifications: string[];

  matched_certifications:
    string[];

  availability: string;

  current_workload: number;

  max_workload: number;

  experience_years: number;

  shift: {

    name?: string;

    start?: string;

    end?: string;
  };

  plant_area: string;

  relevance: string;

  specialization_match: boolean;

  same_department: boolean;

  same_area: boolean;

  is_fallback?: boolean;

  historical_experience?:
    HistoricalExperience;

  evidence: string[];
}

// ============================================================
// COMPATIBILITY ALIAS
// ============================================================

export type EngineerRecommendation =
  MaintenanceEngineerRecommendation;

// ============================================================
// HISTORICAL EXPERIENCE
// ============================================================

export interface HistoricalExperience {

  similar_cases: number;

  successful_cases: number;

  repeat_failures: number;

  success_rate: number;

  records?:
    Record<string, unknown>[];
}

// ============================================================
// MAINTENANCE PROBLEM
// ============================================================

export interface MaintenanceProblem {

  severity: string;

  problems: string[];

  degradation_condition?:
    string;

  model_risk_level?:
    string;
}

// ============================================================
// MAINTENANCE DECISION
// ============================================================

export interface MaintenanceDecision {

  status: string;

  action: string;

  reason: string;

  operator_assignment_required:
    boolean;

  ai_recommendation_available:
    boolean;

  automatic_assignment:
    boolean;

  message: string;
}

// ============================================================
// MAINTENANCE PREDICTION
// ============================================================

export interface MaintenancePrediction {

  available: boolean;

  probability:
    | FailureProbabilities
    | Record<string, number>;

  risk_score:
    | number
    | null;

  risk_level: RiskLevel;
}

// ============================================================
// MAINTENANCE RECOMMENDATION
// ============================================================

export interface MaintenanceRecommendation {

  available?: boolean;

  machine: {

    id: string;

    name: string;

    type: string;

    department: string;

    health_score:
      | number
      | null;

    ai_health_score?:
      | number
      | null;

    risk_level?:
      RiskLevel;

    risk_score?:
      | number
      | null;

    ai_failure_probability?:
      | number
      | null;

    failure_probability:
      | number
      | null;

    rul_hours?:
      | number
      | null;

    rul_confidence?:
      | number
      | null;

    maintenance_status?:
      string;
  };

  maintenance_problem:
    MaintenanceProblem;

  decision:
    MaintenanceDecision;

  prediction:
    MaintenancePrediction;

  required_skills:
    string[];

  recommended_engineer:
    MaintenanceEngineerRecommendation
    | null;

  recommendations:
    MaintenanceEngineerRecommendation[];

  excluded_engineers:
    | Record<string, unknown>[]
    | Record<string, unknown>;

  scoring_note: string;
}

// ============================================================
// MAINTENANCE ASSIGNMENT
// ============================================================

export interface MaintenanceAssignment {

  success: boolean;

  machine: Machine;

  technician: {

    id: string;

    name: string;

    specialization: string;

    skills: string[];

    department: string;

    experience_years: number;

    availability: string;

    current_workload: number;

    max_workload: number;

    assigned_machine:
      | string
      | null;

    current_ticket:
      | string
      | null;
  };

  ticket: {

    id: string;

    machine_id: string;

    technician_id: string;

    technician_name: string;

    status: string;
  };
}

// ============================================================
// GET SUSTAINABILITY
// ============================================================

export async function getSustainability(
  forceFresh = true
): Promise<SustainabilityData> {
  return cachedRequest<SustainabilityData>(
    "/sustainability/",
    forceFresh ? 0 : 5000
  );
}

// ============================================================
// PREVIEW CARBON OPTIMIZATION
// ============================================================

export async function previewCarbonOptimization(
  targetCarbon: number
): Promise<OptimizationResult> {
  return request<OptimizationResult>(
    "/optimization/preview",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target_carbon: targetCarbon,
      }),
    }
  );
}

// ============================================================
// GET MACHINES
// ============================================================

export async function getMachines(
  forceFresh = false
): Promise<Machine[]> {

  return cachedRequest<Machine[]>(
    "/machines/",
    forceFresh
      ? 0
      : 5000
  );
}

// ============================================================
// GET FACTORY
// ============================================================

export async function getFactory():
  Promise<Factory> {

  return cachedRequest<Factory>(
    "/factory/",
    5000
  );
}

// ============================================================
// GET HEALTH
// ============================================================

export async function getHealth():
  Promise<unknown> {

  return cachedRequest<unknown>(
    "/health",
    5000
  );
}

// ============================================================
// GET PREDICTIVE MAINTENANCE
// ============================================================

export async function getPredictiveMaintenance(
  machineId: string,
  forceFresh = true
): Promise<PredictiveMaintenance> {

  return cachedRequest<PredictiveMaintenance>(
    `/machines/${encodeURIComponent(
      machineId
    )}/predictive-maintenance`,
    forceFresh
      ? 0
      : 5000
  );
}

// ============================================================
// GET MAINTENANCE RECOMMENDATIONS
// ============================================================

export async function getMaintenanceRecommendations(
  machineId: string,
  forceFresh = true
): Promise<MaintenanceRecommendation> {

  return cachedRequest<MaintenanceRecommendation>(
    `/machines/${encodeURIComponent(
      machineId
    )}/maintenance-recommendations`,
    forceFresh
      ? 0
      : 5000
  );
}

// ============================================================
// GET AI CONDITION
// ============================================================

export async function getAICondition(
  machineId: string,
  forceFresh = true
): Promise<AICondition> {

  return cachedRequest<AICondition>(
    `/machines/${encodeURIComponent(
      machineId
    )}/ai-condition`,
    forceFresh
      ? 0
      : 5000
  );
}

// ============================================================
// MACHINE CONTROL
// ============================================================

export type MachineControlAction =
  | "start"
  | "maintenance"
  | "stop"
  | "emergency";

export async function controlMachine(
  machineId: string,
  action: MachineControlAction
): Promise<{

  success: boolean;

  message: string;

  machine: Machine;

}> {

  const result =
    await request<{
      success: boolean;

      message: string;

      machine: Machine;
    }>(
      `/machines/${encodeURIComponent(
        machineId
      )}/control`,
      {

        method: "POST",

        headers: {

          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          action,
        }),
      }
    );

  clearMachinesCache();

  clearApiCache();

  return result;
}

// ============================================================
// ASSIGN MAINTENANCE ENGINEER
// ============================================================

export async function assignMaintenanceEngineer(
  machineId: string,
  technicianId: string
): Promise<MaintenanceAssignment> {

  const result =
    await request<MaintenanceAssignment>(
      `/machines/${encodeURIComponent(
        machineId
      )}/maintenance/assign`,
      {

        method: "POST",

        headers: {

          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({

          technician_id:
            technicianId,
        }),
      }
    );

  clearMachinesCache();

  clearApiCache();

  return result;
}

// ============================================================
// AI COPILOT
// ============================================================

export interface CopilotHistoryMessage {

  role:
    | "user"
    | "assistant";

  content: string;
}

export interface CopilotResponse {

  success: boolean;

  model: string;

  message: string;

  answer: string;

  scope: string;

  machine_id:
    | string
    | null;
}

export async function sendCopilotMessage(
  message: string,
  history:
    CopilotHistoryMessage[] = [],
  machineId:
    | string
    | null = null
): Promise<CopilotResponse> {

  return request<CopilotResponse>(
    "/ai/copilot",
    {

      method: "POST",

      headers: {

        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({

        message,

        history,

        machine_id:
          machineId,
      }),
    }
  );
}