import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Brain,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Activity,
  Gauge,
  Thermometer,
  Zap,
  Clock,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  Sparkles,
  Info,
  X,
  Check,
  Database,
  Search,
  History
} from "lucide-react";

import { useMachines } from "../hooks/useMachines";
import { useMachineSelection } from "../context/MachineSelectionContext";
import {
  fetchMemoryStatus,
  fetchIncidents,
  fetchIncident,
  fetchIncidentRecall,
  ingestMachineIncident,
  logIncidentAttempt,
  resolveIncident,
  fetchObservabilityData,
  type HindsightStatus,
  type FixTraceIncident,
  type HindsightRecallSummary,
  type ObservabilityData
} from "../services/fixtraceApi";

export default function FixTraceWorkbench() {
  const { machines, loading: machinesLoading } = useMachines();
  const { selectedMachineId, selectMachine } = useMachineSelection();

  // Navigation tab: Workbench vs Observability
  const [activeTab, setActiveTab] = useState<"workbench" | "observability">("workbench");

  // Local state - Workbench
  const [hindsightStatus, setHindsightStatus] = useState<HindsightStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [activeIncident, setActiveIncident] = useState<FixTraceIncident | null>(null);
  const [recallSummary, setRecallSummary] = useState<HindsightRecallSummary | null>(null);
  const [recalling, setRecalling] = useState(false);
  const [incidentsList, setIncidentsList] = useState<FixTraceIncident[]>([]);
  const [loadingIncidents, setLoadingIncidents] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showRawMemories, setShowRawMemories] = useState(false);

  // New attempt form state
  const [attemptAction, setAttemptAction] = useState("");
  const [attemptResult, setAttemptResult] = useState<"FAILED" | "SUCCESSFUL">("FAILED");
  const [attemptNotes, setAttemptNotes] = useState("");
  const [attemptTech, setAttemptTech] = useState("Field Diagnostic Specialist");
  const [attemptTelemetryBefore, setAttemptTelemetryBefore] = useState("");
  const [attemptTelemetryAfter, setAttemptTelemetryAfter] = useState("");
  const [submittingAttempt, setSubmittingAttempt] = useState(false);

  // Resolution modal state
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveRootCause, setResolveRootCause] = useState("");
  const [resolveSummary, setResolveSummary] = useState("");
  const [resolveLesson, setResolveLesson] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolveSuccessBanner, setResolveSuccessBanner] = useState<string | null>(null);

  // Observability & Evidence Layer state
  const [observabilityData, setObservabilityData] = useState<ObservabilityData | null>(null);
  const [loadingObservability, setLoadingObservability] = useState(false);
  const [observabilityError, setObservabilityError] = useState<string | null>(null);

  // Current selected machine
  const currentMachine = useMemo(() => {
    if (!machines || machines.length === 0) return null;
    if (selectedMachineId) {
      const match = machines.find((m) => m.id === selectedMachineId);
      if (match) return match;
    }
    return machines[0];
  }, [machines, selectedMachineId]);

  // Load Hindsight memory status
  const loadHindsightStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const status = await fetchMemoryStatus();
      setHindsightStatus(status);
    } catch {
      setHindsightStatus({
        configured: false,
        api_url: "http://127.0.0.1:8001/api",
        bank_id: "unknown",
        reachable: false,
        latency_ms: null,
        error: "FixTrace backend is currently unreachable on port 8001.",
      });
    } finally {
      setStatusLoading(false);
    }
  }, []);

  // Load Observability data
  const loadObservability = useCallback(async () => {
    setLoadingObservability(true);
    setObservabilityError(null);
    try {
      const data = await fetchObservabilityData();
      setObservabilityData(data);
    } catch (err: any) {
      setObservabilityError(err.message || "Failed to load Hindsight observability audit trail.");
    } finally {
      setLoadingObservability(false);
    }
  }, []);

  // Load incidents for current machine
  const loadMachineIncidents = useCallback(async (machineId: string) => {
    setLoadingIncidents(true);
    try {
      const list = await fetchIncidents(machineId);
      setIncidentsList(list);
      if (list && list.length > 0) {
        const openOne = list.find((i) => i.status !== "RESOLVED") || list[0];
        setActiveIncident(openOne);
        try {
          const recall = await fetchIncidentRecall(openOne.id);
          setRecallSummary(recall);
        } catch {
          // recall endpoint fallback
        }
      } else {
        setActiveIncident(null);
        setRecallSummary(null);
      }
    } catch {
      setIncidentsList([]);
      setActiveIncident(null);
      setRecallSummary(null);
    } finally {
      setLoadingIncidents(false);
    }
  }, []);

  useEffect(() => {
    loadHindsightStatus();
    loadObservability();
  }, [loadHindsightStatus, loadObservability]);

  useEffect(() => {
    if (currentMachine) {
      loadMachineIncidents(currentMachine.id);
    }
  }, [currentMachine, loadMachineIncidents]);

  // Refresh recall on demand
  const handleRefreshRecall = async () => {
    if (!activeIncident) return;
    setRecalling(true);
    try {
      const recall = await fetchIncidentRecall(activeIncident.id);
      setRecallSummary(recall);
    } catch (err: any) {
      console.warn("Failed to refresh recall:", err);
    } finally {
      setRecalling(false);
    }
  };

  // Helper to construct live telemetry snapshot string
  const getLiveTelemetrySnapshot = useCallback(() => {
    if (!currentMachine) return "";
    return `RPM: ${currentMachine.rpm ?? 1785}, Temp: ${currentMachine.temperature?.toFixed(1) ?? '68.5'}°C, Vib: ${currentMachine.vibration?.toFixed(2) ?? '3.42'} mm/s, Power: ${currentMachine.power?.toFixed(1) ?? '291.2'} kW`;
  }, [currentMachine]);

  // Handle Ingest from live CarbonTwin Machine
  const handleIngestMachine = async () => {
    if (!currentMachine) return;
    setActionLoading(true);
    setActionError(null);
    setResolveSuccessBanner(null);
    try {
      const symptoms = currentMachine.vibration && currentMachine.vibration > 1.5
        ? `Elevated mechanical vibration at ${currentMachine.vibration.toFixed(2)} mm/s RMS with thermal excursion`
        : `Anomalous operating excursion flagged by digital twin prognostics for ${currentMachine.id}`;

      const operatingConditions = `RPM: ${currentMachine.rpm || 1780}, Temp: ${currentMachine.temperature?.toFixed(1) || 68.0}°C, Vib: ${currentMachine.vibration?.toFixed(2) || 1.8} mm/s, State: ${currentMachine.maintenance_status || "OPERATIONAL"}`;

      const res = await ingestMachineIncident({
        id: currentMachine.id,
        name: currentMachine.name,
        type: currentMachine.type || "Industrial Asset",
        location: currentMachine.location || "Production Floor",
        department: currentMachine.department || "Manufacturing",
        temperature: currentMachine.temperature,
        vibration: currentMachine.vibration,
        pressure: currentMachine.pressure,
        rpm: currentMachine.rpm,
        power: currentMachine.power,
        operating_state: currentMachine.maintenance_status || "OPERATIONAL",
        symptoms: symptoms,
        operating_conditions: operatingConditions,
        severity: currentMachine.vibration && currentMachine.vibration >= 2.0 ? "HIGH" : "MEDIUM",
        technician_name: "Field Diagnostic Specialist",
      });

      setActiveIncident(res.incident);
      setRecallSummary(res.hindsight_recall);
      await loadMachineIncidents(currentMachine.id);
      await loadObservability();
    } catch (err: any) {
      setActionError(err.message || "Failed to ingest incident into FixTrace.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle logging a new attempt
  const handleLogAttempt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIncident || !attemptAction.trim()) return;

    setSubmittingAttempt(true);
    setActionError(null);
    try {
      await logIncidentAttempt(activeIncident.id, {
        action_taken: attemptAction.trim(),
        result: attemptResult,
        observed_notes: attemptNotes.trim() || "Action completed by technician.",
        performed_by: attemptTech.trim() || "Field Diagnostic Specialist",
        telemetry_before: attemptTelemetryBefore.trim() || undefined,
        telemetry_after: attemptTelemetryAfter.trim() || undefined,
      });

      // Clear form
      setAttemptAction("");
      setAttemptNotes("");
      setAttemptTelemetryBefore("");
      setAttemptTelemetryAfter("");

      // Refresh incident
      const updated = await fetchIncident(activeIncident.id);
      setActiveIncident(updated);
      await loadMachineIncidents(currentMachine?.id || activeIncident.machine_id);
      await loadObservability();
    } catch (err: any) {
      setActionError(err.message || "Failed to record troubleshooting attempt.");
    } finally {
      setSubmittingAttempt(false);
    }
  };

  // Open resolution modal with pre-fill options
  const handleOpenResolveModal = () => {
    setResolveError(null);
    if (activeIncident?.attempts && activeIncident.attempts.length > 0) {
      const successfulAttempt = [...activeIncident.attempts].reverse().find((a) => a.result === "SUCCESSFUL");
      if (successfulAttempt) {
        setResolveSummary(successfulAttempt.action_taken + (successfulAttempt.observed_notes ? ` — ${successfulAttempt.observed_notes}` : ""));
        setResolveRootCause("");
        setResolveLesson("");
      } else {
        setResolveSummary("");
        setResolveRootCause("");
        setResolveLesson("");
      }
    } else {
      setResolveSummary("");
      setResolveRootCause("");
      setResolveLesson("");
    }
    setShowResolveModal(true);
  };

  // Submit resolution to backend and trigger Hindsight retain()
  const handleSubmitResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIncident) return;
    if (!resolveRootCause.trim() || !resolveSummary.trim() || !resolveLesson.trim()) {
      setResolveError("All three resolution fields are required to commit to Hindsight.");
      return;
    }

    setResolving(true);
    setResolveError(null);
    try {
      const resolved = await resolveIncident(activeIncident.id, {
        root_cause: resolveRootCause.trim(),
        resolution_summary: resolveSummary.trim(),
        lesson_learned: resolveLesson.trim(),
      });

      setActiveIncident(resolved);
      setShowResolveModal(false);
      setResolveSuccessBanner(
        `Incident ${resolved.id} successfully resolved and committed to Hindsight bank '${hindsightStatus?.bank_id || "fixtrace-demo-01"}'. Retained ID: ${resolved.hindsight_retained_id || "bank-retained"}`
      );

      // Re-fetch recall immediately to show newly retained memory in the Guidance card!
      await handleRefreshRecall();
      if (currentMachine) {
        await loadMachineIncidents(currentMachine.id);
      }
      await loadObservability();
    } catch (err: any) {
      setResolveError(err.message || "Failed to resolve incident.");
    } finally {
      setResolving(false);
    }
  };

  // Guidance extraction
  const guidance = recallSummary?.guidance;
  const priorExperienceFound = recallSummary?.prior_experience_found ?? false;

  return (
    <div className="min-h-full w-full bg-[#F7FAF8] text-[#15211B]">
      <div className="mx-auto w-full max-w-[1700px] px-4 py-5 sm:px-6 lg:px-8 lg:py-6">

        {/* =====================================================
            HEADER & LIVE HINDSIGHT CLOUD STATUS
        ===================================================== */}
        <section className="overflow-hidden rounded-[16px] border border-[#DDE7E1] bg-white p-6 shadow-[0_2px_10px_rgba(15,23,42,0.025)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-[#16A34A]">
                  <Brain className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#16A34A]">
                  Autonomous Decision Memory Agent
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#15211B] sm:text-3xl">
                FixTrace Workbench
              </h1>
              <p className="mt-1 text-xs text-[#64736A] sm:text-sm">
                Remember the failure. Remember the fix. Real-time experiential memory powered by Hindsight Vectorize.
              </p>
            </div>

            {/* Hindsight Status Bar */}
            <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-[#E2EBE5] bg-[#F8FAF9] p-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  {hindsightStatus?.reachable && (
                    <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span
                    className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                      hindsightStatus?.reachable
                        ? "bg-[#16A34A]"
                        : hindsightStatus?.configured
                        ? "bg-amber-500"
                        : "bg-rose-500"
                    }`}
                  />
                </span>
                <span className="font-semibold text-[#15211B]">
                  {hindsightStatus?.reachable
                    ? "Hindsight: CONNECTED"
                    : hindsightStatus?.configured
                    ? "Hindsight: UNREACHABLE"
                    : "Hindsight: UNCONFIGURED"}
                </span>
              </div>

              <div className="h-4 w-px bg-[#DDE7E1]" />

              <div className="flex items-center gap-1.5 font-mono text-[#475569]">
                <Layers className="h-3.5 w-3.5 text-[#16A34A]" />
                <span>Bank:</span>
                <span className="font-semibold text-[#15211B]">
                  {hindsightStatus?.bank_id || "fixtrace-demo-01"}
                </span>
              </div>

              {hindsightStatus?.latency_ms !== null && hindsightStatus?.latency_ms !== undefined && (
                <>
                  <div className="h-4 w-px bg-[#DDE7E1]" />
                  <div className="flex items-center gap-1 text-[#64736A]">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{hindsightStatus.latency_ms} ms</span>
                  </div>
                </>
              )}

              <button
                onClick={() => {
                  loadHindsightStatus();
                  loadObservability();
                }}
                disabled={statusLoading}
                title="Refresh Hindsight status and audit logs"
                className="ml-1 flex h-6 w-6 items-center justify-center rounded-lg hover:bg-white text-[#64736A] hover:text-[#15211B] transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${statusLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </section>

        {/* Global Resolution Success Banner */}
        {resolveSuccessBanner && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs text-emerald-900 shadow-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
              <span className="font-semibold">{resolveSuccessBanner}</span>
            </div>
            <button
              onClick={() => setResolveSuccessBanner(null)}
              className="text-emerald-700 hover:text-emerald-950"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* =====================================================
            VIEW NAVIGATION TABS (WORKBENCH vs OBSERVABILITY)
        ===================================================== */}
        <div className="mt-5 flex items-center justify-between border-b border-[#E2EBE5] pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("workbench")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                activeTab === "workbench"
                  ? "bg-[#16A34A] text-white shadow-xs"
                  : "bg-white text-[#475569] hover:bg-[#F0F5F2] hover:text-[#15211B] border border-[#DDE7E1]"
              }`}
            >
              <Cpu className="h-4 w-4" />
              <span>Diagnostic Workbench</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("observability");
                loadObservability();
              }}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                activeTab === "observability"
                  ? "bg-[#15211B] text-white shadow-xs"
                  : "bg-white text-[#475569] hover:bg-[#F0F5F2] hover:text-[#15211B] border border-[#DDE7E1]"
              }`}
            >
              <Database className="h-4 w-4 text-[#16A34A]" />
              <span>Hindsight Observability & Evidence</span>
              {observabilityData && (
                <span className="ml-1 rounded-full bg-emerald-950/20 px-1.5 py-0.2 text-[10px] font-mono text-emerald-400">
                  {observabilityData.experiential_memory.total_retain_events} retains
                </span>
              )}
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-[#64736A]">
            <span>Bank:</span>
            <span className="font-bold text-[#15211B]">{hindsightStatus?.bank_id || "fixtrace-demo-01"}</span>
          </div>
        </div>

        {/* =====================================================
            TAB 1: WORKBENCH VIEW
        ===================================================== */}
        {activeTab === "workbench" && (
          <>
            {/* MACHINE SELECTOR & LIVE TELEMETRY SUMMARY */}
            <section className="mt-5 rounded-[16px] border border-[#DDE7E1] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                {/* Machine Selector Dropdown */}
                <div className="flex flex-wrap items-center gap-3">
                  <label htmlFor="machine-select" className="text-xs font-bold uppercase tracking-wider text-[#64736A]">
                    Asset Context:
                  </label>
                  <div className="relative">
                    <select
                      id="machine-select"
                      value={currentMachine?.id || ""}
                      onChange={(e) => selectMachine(e.target.value)}
                      disabled={machinesLoading}
                      className="rounded-lg border border-[#CCDCD2] bg-[#F8FAF9] py-1.5 pl-3 pr-8 text-sm font-semibold text-[#15211B] focus:border-[#16A34A] focus:outline-none"
                    >
                      {machines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.id} — {m.name} ({m.type || "Asset"})
                        </option>
                      ))}
                    </select>
                  </div>

                  {currentMachine && (
                    <div className="flex items-center gap-2 text-xs text-[#64736A]">
                      <span className="rounded-full bg-[#E8F1EC] px-2 py-0.5 font-medium text-[#16A34A]">
                        {currentMachine.location || "Plant Floor"}
                      </span>
                      <span>•</span>
                      <span>{currentMachine.department || "Operations"}</span>
                      <span>•</span>
                      <span
                        className={`font-semibold ${
                          currentMachine.maintenance_status === "Normal"
                            ? "text-emerald-600"
                            : "text-amber-600"
                        }`}
                      >
                        {currentMachine.maintenance_status || "OPERATIONAL"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Ingest Action Button */}
                <div className="flex items-center gap-3">
                  {actionError && (
                    <span className="text-xs text-rose-600">{actionError}</span>
                  )}
                  <button
                    onClick={handleIngestMachine}
                    disabled={actionLoading || !currentMachine}
                    className="flex items-center gap-2 rounded-lg bg-[#16A34A] px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#15803D] disabled:opacity-50"
                  >
                    {actionLoading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldAlert className="h-4 w-4" />
                    )}
                    <span>Flag Anomaly & Query Hindsight</span>
                  </button>
                </div>
              </div>

              {/* Live Telemetry Sensor Bar */}
              {currentMachine && (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5 border-t border-[#EEF3F0] pt-4">
                  <div className="rounded-xl border border-[#E6EDE8] bg-[#F9FBFA] p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#64736A]">
                      <Gauge className="h-3.5 w-3.5 text-blue-500" />
                      <span>Velocity / Speed</span>
                    </div>
                    <div className="mt-1 text-base font-bold text-[#15211B]">
                      {currentMachine.rpm ?? 1785} <span className="text-xs font-normal text-[#64736A]">RPM</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#E6EDE8] bg-[#F9FBFA] p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#64736A]">
                      <Thermometer className="h-3.5 w-3.5 text-rose-500" />
                      <span>Housing Temp</span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-1 text-base font-bold text-[#15211B]">
                      {currentMachine.temperature?.toFixed(1) ?? "68.5"}
                      <span className="text-xs font-normal text-[#64736A]">°C</span>
                      {(currentMachine.temperature ?? 0) > 75 && (
                        <span className="ml-1 rounded bg-rose-100 px-1 py-0.2 text-[9px] font-bold text-rose-700">
                          HIGH
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#E6EDE8] bg-[#F9FBFA] p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#64736A]">
                      <Activity className="h-3.5 w-3.5 text-amber-500" />
                      <span>Vibration RMS</span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-1 text-base font-bold text-[#15211B]">
                      {currentMachine.vibration?.toFixed(2) ?? "3.42"}
                      <span className="text-xs font-normal text-[#64736A]">mm/s</span>
                      {(currentMachine.vibration ?? 0) > 1.5 && (
                        <span className="ml-1 rounded bg-amber-100 px-1 py-0.2 text-[9px] font-bold text-amber-800">
                          120Hz SPIKE
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#E6EDE8] bg-[#F9FBFA] p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#64736A]">
                      <Zap className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Power Load</span>
                    </div>
                    <div className="mt-1 text-base font-bold text-[#15211B]">
                      {currentMachine.power?.toFixed(1) ?? "291.2"} <span className="text-xs font-normal text-[#64736A]">kW</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#E6EDE8] bg-[#F9FBFA] p-3 col-span-2 sm:col-span-4 lg:col-span-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#64736A]">
                      <Cpu className="h-3.5 w-3.5 text-purple-500" />
                      <span>Health State</span>
                    </div>
                    <div className="mt-1 text-base font-bold text-[#15211B]">
                      {currentMachine.health_score ? `${currentMachine.health_score}%` : "Monitored"}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* MAIN WORKBENCH SPLIT: PRIOR EXPERIENCE & TIMELINE */}
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">

              {/* LEFT COLUMN: HINDSIGHT PRIOR EXPERIENCE (7 Cols) */}
              <div className="lg:col-span-7 flex flex-col gap-6">

                {/* CRITICAL HINDSIGHT UX CARD */}
                <div className="rounded-[16px] border border-[#DDE7E1] bg-white p-6 shadow-[0_2px_10px_rgba(15,23,42,0.025)]">
                  <div className="flex items-center justify-between border-b border-[#EEF3F0] pb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-[#16A34A]" />
                      <h2 className="text-base font-bold text-[#15211B]">
                        Hindsight Memory Guidance
                      </h2>
                    </div>
                    <div className="flex items-center gap-2">
                      {recallSummary && (
                        <span className="text-[11px] font-mono text-[#64736A]">
                          {recallSummary.count} memories returned
                        </span>
                      )}
                      {activeIncident && (
                        <button
                          onClick={handleRefreshRecall}
                          disabled={recalling}
                          title="Re-query Hindsight recall for active incident"
                          className="flex items-center gap-1 rounded bg-[#F0F5F2] px-2 py-1 text-[11px] font-semibold text-[#475569] hover:bg-[#E2EBE5] transition"
                        >
                          <RefreshCw className={`h-3 w-3 ${recalling ? "animate-spin" : ""}`} />
                          <span>Re-query</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-5">
                    {/* 1. EMPTY STATE: NO PRIOR EXPERIENCE */}
                    {!priorExperienceFound && (
                      <div className="rounded-xl border border-[#E2EBE5] bg-[#F8FAF9] p-6 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EBF3EE] text-[#475569]">
                          <Info className="h-6 w-6 text-[#16A34A]" />
                        </div>
                        <div className="mt-3 text-sm font-bold uppercase tracking-wider text-[#15211B]">
                          NO PRIOR EXPERIENCE
                        </div>
                        <div className="mt-1 text-xs font-semibold text-[#16A34A]">
                          FixTrace has not seen this failure pattern before.
                        </div>
                        <p className="mx-auto mt-2 max-w-[480px] text-xs leading-relaxed text-[#64736A]">
                          This incident represents a first-encounter anomaly in bank{" "}
                          <code className="rounded bg-[#EAEFEA] px-1 py-0.5 font-mono text-[11px] text-[#15211B]">
                            {hindsightStatus?.bank_id || "fixtrace-demo-01"}
                          </code>
                          . As diagnostic steps are recorded and resolved, FixTrace will commit the root cause and operational lesson learned to Hindsight persistent memory.
                        </p>
                      </div>
                    )}

                    {/* 2. RECALLED STATE: PRIOR EXPERIENCE FOUND */}
                    {priorExperienceFound && guidance && (
                      <div className="flex flex-col gap-4">
                        {/* Header Banner */}
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                          <div>
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                              <CheckCircle2 className="h-3 w-3" />
                              PRIOR EXPERIENCE FOUND
                            </span>
                            <div className="mt-1 text-xs font-medium text-emerald-950">
                              {guidance.summary || "Retrieved operational maintenance experience from Hindsight memory bank."}
                            </div>
                          </div>

                          {guidance.best_match_score !== null && guidance.best_match_score !== undefined && (
                            <div className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-right shadow-xs">
                              <div className="text-[10px] uppercase font-bold tracking-wider text-[#64736A]">
                                Hindsight relevance
                              </div>
                              <div className="text-sm font-extrabold text-emerald-700">
                                {guidance.best_match_score.toFixed(4)}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Section 1: Known Failed Actions to Avoid */}
                        {guidance.failed_actions && guidance.failed_actions.length > 0 && (
                          <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-800">
                              <XCircle className="h-4 w-4 text-rose-600" />
                              <span>Known Failed Actions (Avoid Repeat Mistakes)</span>
                            </div>
                            <ul className="mt-2.5 space-y-2 text-xs text-rose-950">
                              {guidance.failed_actions.map((act, idx) => (
                                <li key={idx} className="flex items-start gap-2 rounded-lg bg-white/80 p-2.5 border border-rose-100">
                                  <span className="mt-0.5 rounded bg-rose-100 px-1.5 py-0.2 font-mono text-[10px] font-bold text-rose-700">
                                    FAILED
                                  </span>
                                  <span className="leading-snug">{act}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Section 2: Verified Resolution Path */}
                        {guidance.successful_action && (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              <span>Verified Resolution Path</span>
                            </div>
                            <div className="mt-2.5 rounded-lg border border-emerald-100 bg-white p-3 text-xs leading-relaxed text-[#15211B]">
                              {guidance.successful_action}
                            </div>
                          </div>
                        )}

                        {/* Section 3: Confirmed Root Cause */}
                        {guidance.root_cause && (
                          <div className="rounded-xl border border-[#DDE7E1] bg-[#F8FAF9] p-4">
                            <div className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                              Confirmed Root Cause
                            </div>
                            <div className="mt-1 text-xs leading-relaxed text-[#15211B]">
                              {guidance.root_cause}
                            </div>
                          </div>
                        )}

                        {/* Section 4: Operational Lesson Learned */}
                        {guidance.lesson_learned && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4">
                            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-800">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                              <span>Operational Lesson Learned</span>
                            </div>
                            <div className="mt-1 text-xs leading-relaxed text-amber-950 font-medium">
                              {guidance.lesson_learned}
                            </div>
                          </div>
                        )}

                        {/* Raw Memory Units Accordion */}
                        {recallSummary.memories && recallSummary.memories.length > 0 && (
                          <div className="border-t border-[#EEF3F0] pt-3">
                            <button
                              onClick={() => setShowRawMemories(!showRawMemories)}
                              className="flex items-center justify-between w-full text-xs font-semibold text-[#64736A] hover:text-[#15211B]"
                            >
                              <span>Inspect Raw Hindsight Memory Units ({recallSummary.memories.length})</span>
                              {showRawMemories ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>

                            {showRawMemories && (
                              <div className="mt-3 space-y-2 max-h-64 overflow-y-auto pr-1">
                                {recallSummary.memories.map((m, idx) => (
                                  <div key={m.id || idx} className="rounded-lg border border-[#E2EBE5] bg-[#F9FBFA] p-3 text-[11px]">
                                    <div className="flex items-center justify-between font-mono text-[10px] text-[#64736A]">
                                      <span>ID: {m.id || `unit-${idx}`}</span>
                                      <span className="uppercase font-bold text-emerald-700">{m.type || "world"}</span>
                                    </div>
                                    <p className="mt-1 text-[#15211B] leading-snug">{m.text}</p>
                                    {m.scores && (
                                      <div className="mt-1.5 flex gap-2 font-mono text-[9px] text-[#475569]">
                                        <span>final: {typeof m.scores === "object" ? (m.scores as any).final?.toFixed(4) : "—"}</span>
                                        <span>reranker: {typeof m.scores === "object" ? (m.scores as any).reranker?.toFixed(4) : "—"}</span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Active Incident Header Card */}
                {activeIncident && (
                  <div className="rounded-[16px] border border-[#DDE7E1] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)]">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EEF3F0] pb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#15211B]">{activeIncident.id}</span>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                            activeIncident.status === "RESOLVED"
                              ? "bg-emerald-100 text-emerald-800"
                              : activeIncident.status === "IN_PROGRESS"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {activeIncident.status}
                        </span>
                        <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-800">
                          {activeIncident.severity}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {loadingIncidents && (
                          <RefreshCw className="h-3 w-3 animate-spin text-[#64736A]" />
                        )}
                        {incidentsList.length > 1 && (
                          <select
                            value={activeIncident.id}
                            onChange={(e) => {
                              const chosen = incidentsList.find((i) => i.id === e.target.value);
                              if (chosen) {
                                setActiveIncident(chosen);
                                fetchIncidentRecall(chosen.id).then(setRecallSummary).catch(() => {});
                              }
                            }}
                            className="rounded border border-[#CCDCD2] bg-[#F8FAF9] px-2 py-0.5 text-[11px] font-semibold text-[#15211B]"
                          >
                            {incidentsList.map((inc) => (
                              <option key={inc.id} value={inc.id}>
                                {inc.id} ({inc.status})
                              </option>
                            ))}
                          </select>
                        )}
                        <span className="text-[11px] text-[#64736A]">
                          Created: {new Date(activeIncident.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 text-xs leading-relaxed text-[#15211B]">
                      <span className="font-semibold text-[#475569]">Symptoms: </span>
                      {activeIncident.symptoms}
                    </div>
                    <div className="mt-1 text-xs text-[#64736A]">
                      <span className="font-semibold text-[#475569]">Conditions: </span>
                      {activeIncident.operating_conditions}
                    </div>

                    {/* RESOLVED STATE BANNER */}
                    {activeIncident.status === "RESOLVED" && (
                      <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50/60 p-4">
                        <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-emerald-800">
                          <ShieldCheck className="h-4 w-4 text-emerald-600" />
                          <span>Incident Resolved & Retained to Hindsight</span>
                        </div>

                        <div className="mt-2.5 space-y-2 text-xs">
                          <div>
                            <span className="font-semibold text-emerald-950">Confirmed Root Cause: </span>
                            <span className="text-emerald-900">{activeIncident.root_cause || "Specified at resolution"}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-emerald-950">Resolution Summary: </span>
                            <span className="text-emerald-900">{activeIncident.resolution_summary || "Specified at resolution"}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-emerald-950">Operational Lesson Learned: </span>
                            <span className="text-emerald-900">{activeIncident.lesson_learned || "Specified at resolution"}</span>
                          </div>
                          {activeIncident.hindsight_retained_id && (
                            <div className="pt-1 font-mono text-[10px] text-emerald-700">
                              Hindsight Memory Op ID: {activeIncident.hindsight_retained_id}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* RESOLVE ACTION BUTTON */}
                    {activeIncident.status !== "RESOLVED" && (
                      <div className="mt-4 pt-3 border-t border-[#EEF3F0] flex justify-end">
                        <button
                          onClick={handleOpenResolveModal}
                          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
                        >
                          <Check className="h-4 w-4" />
                          <span>Resolve Incident & Commit to Hindsight</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: TROUBLESHOOTING TIMELINE & LOG ATTEMPT (5 Cols) */}
              <div className="lg:col-span-5 flex flex-col gap-6">

                {/* TIMELINE CARD */}
                <div className="rounded-[16px] border border-[#DDE7E1] bg-white p-6 shadow-[0_2px_10px_rgba(15,23,42,0.025)]">
                  <div className="flex items-center justify-between border-b border-[#EEF3F0] pb-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-[#16A34A]" />
                      <h3 className="text-base font-bold text-[#15211B]">
                        Troubleshooting Timeline
                      </h3>
                    </div>
                    <span className="rounded-full bg-[#EBF3EE] px-2 py-0.5 font-mono text-[11px] font-bold text-[#16A34A]">
                      {activeIncident?.attempts?.length || 0} Attempts
                    </span>
                  </div>

                  {/* Attempt List */}
                  <div className="mt-4 space-y-3">
                    {(!activeIncident || !activeIncident.attempts || activeIncident.attempts.length === 0) && (
                      <div className="rounded-xl border border-dashed border-[#DDE7E1] p-6 text-center text-xs text-[#64736A]">
                        No troubleshooting attempts recorded yet.
                        {activeIncident && <div className="mt-1 font-semibold text-[#15211B]">Log diagnostic actions below to build this incident trajectory.</div>}
                      </div>
                    )}

                    {activeIncident?.attempts?.map((att) => (
                      <div
                        key={att.id}
                        className={`rounded-xl border p-3.5 text-xs transition-colors ${
                          att.result === "SUCCESSFUL"
                            ? "border-emerald-200 bg-emerald-50/40"
                            : "border-[#E2EBE5] bg-[#F9FBFA]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E2EBE5] font-mono text-[10px] font-bold text-[#15211B]">
                              #{att.attempt_number}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.2 font-bold uppercase text-[9px] ${
                                att.result === "SUCCESSFUL"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {att.result}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#64736A]">
                            {new Date(att.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        <div className="mt-2 font-semibold text-[#15211B] leading-snug">
                          {att.action_taken}
                        </div>

                        <div className="mt-1 text-[#64736A] leading-relaxed">
                          {att.observed_notes}
                        </div>

                        {(att.telemetry_before || att.telemetry_after) && (
                          <div className="mt-2 flex flex-wrap gap-2 rounded bg-white p-2 border border-[#E6EDE8] text-[10px] font-mono">
                            {att.telemetry_before && (
                              <div>
                                <span className="text-[#64736A]">Before: </span>
                                <span className="text-[#15211B]">{att.telemetry_before}</span>
                              </div>
                            )}
                            {att.telemetry_after && (
                              <div>
                                <span className="text-[#64736A]">After: </span>
                                <span className="font-semibold text-emerald-700">{att.telemetry_after}</span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="mt-2 text-[10px] text-[#94A3B8]">
                          Logged by {att.performed_by}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* LOG ATTEMPT FORM CARD */}
                {activeIncident && activeIncident.status !== "RESOLVED" && (
                  <div className="rounded-[16px] border border-[#DDE7E1] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)]">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                        Log Troubleshooting Attempt
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          const snap = getLiveTelemetrySnapshot();
                          if (!attemptTelemetryBefore) setAttemptTelemetryBefore(snap);
                          else setAttemptTelemetryAfter(snap);
                        }}
                        className="flex items-center gap-1 rounded bg-[#EBF3EE] px-2 py-0.5 text-[10px] font-semibold text-[#16A34A] hover:bg-[#D7E8DC] transition"
                      >
                        <Activity className="h-3 w-3" />
                        <span>Capture Live Telemetry</span>
                      </button>
                    </div>

                    <form onSubmit={handleLogAttempt} className="mt-3 space-y-3">
                      <div>
                        <label className="text-[11px] font-semibold text-[#64736A]">Action Taken</label>
                        <input
                          type="text"
                          required
                          value={attemptAction}
                          onChange={(e) => setAttemptAction(e.target.value)}
                          placeholder="e.g. Replaced coupling spider, re-greased bearing, realigned drive shaft..."
                          className="mt-1 w-full rounded-lg border border-[#CCDCD2] bg-[#F8FAF9] p-2 text-xs text-[#15211B] focus:border-[#16A34A] focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-semibold text-[#64736A]">Outcome</label>
                          <select
                            value={attemptResult}
                            onChange={(e) => setAttemptResult(e.target.value as any)}
                            className={`mt-1 w-full rounded-lg border p-2 text-xs font-bold focus:outline-none ${
                              attemptResult === "SUCCESSFUL"
                                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                : "border-rose-300 bg-rose-50 text-rose-800"
                            }`}
                          >
                            <option value="FAILED">FAILED</option>
                            <option value="SUCCESSFUL">SUCCESSFUL</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-[#64736A]">Technician</label>
                          <input
                            type="text"
                            value={attemptTech}
                            onChange={(e) => setAttemptTech(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-[#CCDCD2] bg-[#F8FAF9] p-2 text-xs text-[#15211B] focus:border-[#16A34A] focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-[#64736A]">Observed Notes</label>
                        <textarea
                          rows={2}
                          value={attemptNotes}
                          onChange={(e) => setAttemptNotes(e.target.value)}
                          placeholder="Specific physical condition or telemetry changes observed after the action..."
                          className="mt-1 w-full rounded-lg border border-[#CCDCD2] bg-[#F8FAF9] p-2 text-xs text-[#15211B] focus:border-[#16A34A] focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-semibold text-[#64736A]">Telemetry Before</label>
                          <input
                            type="text"
                            value={attemptTelemetryBefore}
                            onChange={(e) => setAttemptTelemetryBefore(e.target.value)}
                            placeholder="vib: 3.42 mm/s, temp: 85°C"
                            className="mt-1 w-full rounded-lg border border-[#CCDCD2] bg-[#F8FAF9] p-2 text-xs font-mono text-[#15211B] focus:border-[#16A34A] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-[#64736A]">Telemetry After</label>
                          <input
                            type="text"
                            value={attemptTelemetryAfter}
                            onChange={(e) => setAttemptTelemetryAfter(e.target.value)}
                            placeholder="vib: 0.82 mm/s, temp: 42°C"
                            className="mt-1 w-full rounded-lg border border-[#CCDCD2] bg-[#F8FAF9] p-2 text-xs font-mono text-[#15211B] focus:border-[#16A34A] focus:outline-none"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={submittingAttempt || !attemptAction.trim()}
                        className="w-full rounded-lg bg-[#15211B] py-2 text-xs font-bold text-white transition-colors hover:bg-[#25392F] disabled:opacity-50"
                      >
                        {submittingAttempt ? "Recording Attempt..." : "Record Attempt on Incident"}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* =====================================================
            TAB 2: HINDSIGHT OBSERVABILITY & EVIDENCE VIEW
        ===================================================== */}
        {activeTab === "observability" && (
          <div className="mt-6 flex flex-col gap-6">
            {observabilityError && (
              <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-xs text-rose-800">
                {observabilityError}
              </div>
            )}

            {/* OBSERVABILITY EXECUTIVE HEADER STATS */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* SQLite Operational Stats */}
              <div className="rounded-2xl border border-[#DDE7E1] bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#64736A]">
                    Operational SQLite
                  </span>
                  <Database className="h-4 w-4 text-blue-500" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-[#15211B]">
                    {observabilityData?.operational_sqlite.total_incidents ?? 0}
                  </span>
                  <span className="text-xs text-[#64736A]">incidents</span>
                </div>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-[#64736A] font-medium border-t border-[#EEF3F0] pt-2">
                  <span>{observabilityData?.operational_sqlite.machines_registered ?? 0} machines</span>
                  <span>•</span>
                  <span>{observabilityData?.operational_sqlite.total_attempts ?? 0} attempts</span>
                </div>
              </div>

              {/* Hindsight Experiential Memory Stats */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    Hindsight Cloud Memory
                  </span>
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-emerald-950">
                    {observabilityData?.experiential_memory.total_retain_events ?? 0}
                  </span>
                  <span className="text-xs text-emerald-700">retains committed</span>
                </div>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-emerald-800 font-mono border-t border-emerald-200/60 pt-2">
                  <span>Bank: {observabilityData?.experiential_memory.active_bank_id || "fixtrace-demo-01"}</span>
                </div>
              </div>

              {/* Recall Queries Executed */}
              <div className="rounded-2xl border border-[#DDE7E1] bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#64736A]">
                    Hindsight Recalls
                  </span>
                  <Search className="h-4 w-4 text-purple-500" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-[#15211B]">
                    {observabilityData?.experiential_memory.total_recall_events ?? 0}
                  </span>
                  <span className="text-xs text-[#64736A]">semantic queries</span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-[#64736A] border-t border-[#EEF3F0] pt-2">
                  <span className="font-semibold text-emerald-600">Zero-shot & Prior Match</span>
                </div>
              </div>

              {/* System State & Reachability */}
              <div className="rounded-2xl border border-[#DDE7E1] bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#64736A]">
                    Memory Layer State
                  </span>
                  <Activity className="h-4 w-4 text-[#16A34A]" />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      hindsightStatus?.reachable ? "bg-[#16A34A]" : "bg-rose-500"
                    }`}
                  />
                  <span className="text-base font-bold text-[#15211B]">
                    {hindsightStatus?.reachable ? "Online & Synchronized" : "Unreachable"}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-[#64736A] font-mono border-t border-[#EEF3F0] pt-2">
                  <span>Latency: {hindsightStatus?.latency_ms ?? 0} ms</span>
                  <button
                    onClick={loadObservability}
                    disabled={loadingObservability}
                    className="flex items-center gap-1 font-sans text-xs text-[#16A34A] hover:underline"
                  >
                    <RefreshCw className={`h-3 w-3 ${loadingObservability ? "animate-spin" : ""}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>
            </div>

            {/* VISUAL LEARNING LIFECYCLE PIPELINE */}
            <div className="rounded-[16px] border border-[#DDE7E1] bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-[#EEF3F0] pb-3">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#15211B]">
                    The FixTrace Autonomous Experiential Learning Lifecycle
                  </h3>
                  <p className="mt-0.5 text-xs text-[#64736A]">
                    How FixTrace and Hindsight turn machine failures into permanent, self-improving organizational memory.
                  </p>
                </div>
                <span className="rounded bg-[#EBF3EE] px-2.5 py-1 font-mono text-[10px] font-bold text-[#16A34A]">
                  Autonomous Closed Loop
                </span>
              </div>

              {/* Pipeline Flow Diagram */}
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {/* Stage 1 */}
                <div className="flex flex-col rounded-xl border border-[#DDE7E1] bg-[#F8FAF9] p-3 text-center">
                  <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 font-mono text-xs font-bold text-rose-700">
                    1
                  </div>
                  <div className="mt-2 text-xs font-bold text-[#15211B]">INCIDENT</div>
                  <div className="mt-1 text-[10px] text-[#64736A] leading-tight">
                    CarbonTwin telemetry excursion flagged & ingested
                  </div>
                </div>

                {/* Stage 2 */}
                <div className="flex flex-col rounded-xl border border-[#DDE7E1] bg-[#F8FAF9] p-3 text-center">
                  <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 font-mono text-xs font-bold text-purple-700">
                    2
                  </div>
                  <div className="mt-2 text-xs font-bold text-[#15211B]">RECALL</div>
                  <div className="mt-1 text-[10px] text-[#64736A] leading-tight">
                    Hindsight queries bank: returns prior fix or honest zero-shot
                  </div>
                </div>

                {/* Stage 3 */}
                <div className="flex flex-col rounded-xl border border-[#DDE7E1] bg-[#F8FAF9] p-3 text-center">
                  <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 font-mono text-xs font-bold text-amber-700">
                    3
                  </div>
                  <div className="mt-2 text-xs font-bold text-[#15211B]">ATTEMPTS</div>
                  <div className="mt-1 text-[10px] text-[#64736A] leading-tight">
                    Technician logs FAILED and SUCCESSFUL diagnostic trials
                  </div>
                </div>

                {/* Stage 4 */}
                <div className="flex flex-col rounded-xl border border-[#DDE7E1] bg-[#F8FAF9] p-3 text-center">
                  <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 font-mono text-xs font-bold text-blue-700">
                    4
                  </div>
                  <div className="mt-2 text-xs font-bold text-[#15211B]">RESOLUTION</div>
                  <div className="mt-1 text-[10px] text-[#64736A] leading-tight">
                    Root cause, verified fix & operational lesson confirmed
                  </div>
                </div>

                {/* Stage 5 */}
                <div className="flex flex-col rounded-xl border border-emerald-300 bg-emerald-50/70 p-3 text-center">
                  <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 font-mono text-xs font-bold text-white">
                    5
                  </div>
                  <div className="mt-2 text-xs font-bold text-emerald-950">RETAIN</div>
                  <div className="mt-1 text-[10px] text-emerald-800 leading-tight">
                    Full trajectory committed to Hindsight Vectorize cloud
                  </div>
                </div>

                {/* Stage 6 */}
                <div className="flex flex-col rounded-xl border border-emerald-300 bg-emerald-50/70 p-3 text-center">
                  <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 font-mono text-xs font-bold text-white">
                    6
                  </div>
                  <div className="mt-2 text-xs font-bold text-emerald-950">FUTURE RECALL</div>
                  <div className="mt-1 text-[10px] text-emerald-800 leading-tight">
                    Next encounter immediately retrieves fix + avoids failed trials
                  </div>
                </div>
              </div>
            </div>

            {/* TWO-COLUMN EVIDENCE AUDIT TRAIL: RETAINS vs RECALLS */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

              {/* LEFT COLUMN: RECENT RETAINS (Permanent Experiential Commits) */}
              <div className="rounded-[16px] border border-[#DDE7E1] bg-white p-6 shadow-xs flex flex-col">
                <div className="flex items-center justify-between border-b border-[#EEF3F0] pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    <div>
                      <h3 className="text-sm font-bold text-[#15211B]">
                        Recent Hindsight Retain Operations
                      </h3>
                      <p className="text-[11px] text-[#64736A]">
                        Verified resolution trajectories committed to persistent cloud memory.
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    {observabilityData?.experiential_memory.recent_retains.length ?? 0} logged
                  </span>
                </div>

                <div className="mt-4 space-y-3.5 flex-1">
                  {(!observabilityData?.experiential_memory.recent_retains ||
                    observabilityData.experiential_memory.recent_retains.length === 0) && (
                    <div className="rounded-xl border border-dashed border-[#DDE7E1] p-8 text-center text-xs text-[#64736A]">
                      No retain operations recorded yet in active session.
                      <div className="mt-1 text-[11px] text-[#15211B] font-semibold">
                        Resolve an active incident in the Diagnostic Workbench to trigger a live Hindsight retain().
                      </div>
                    </div>
                  )}

                  {observabilityData?.experiential_memory.recent_retains.map((ret) => (
                    <div
                      key={ret.id}
                      className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 text-xs shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#15211B]">{ret.incident_id}</span>
                          <span className="rounded bg-emerald-600 px-1.5 py-0.2 font-mono text-[9px] font-bold text-white uppercase">
                            {ret.machine_id}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#64736A] font-mono">
                          {ret.timestamp ? new Date(ret.timestamp).toLocaleTimeString() : "—"}
                        </span>
                      </div>

                      <div className="mt-2.5 space-y-1.5">
                        <div>
                          <span className="font-bold text-emerald-950">Verified Fix: </span>
                          <span className="text-emerald-900 leading-snug">{ret.successful_action}</span>
                        </div>
                        <div>
                          <span className="font-bold text-[#475569]">Root Cause: </span>
                          <span className="text-[#15211B]">{ret.root_cause}</span>
                        </div>
                        <div>
                          <span className="font-bold text-amber-900">Lesson Learned: </span>
                          <span className="text-amber-950">{ret.lesson_learned}</span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-emerald-200/50 pt-2 font-mono text-[10px] text-[#64736A]">
                        <span>Hindsight Bank: {ret.bank_id}</span>
                        <span className="text-emerald-700 font-bold">{ret.retained_id}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* RIGHT COLUMN: RECENT RECALLS (Experiential Retrievals) */}
              <div className="rounded-[16px] border border-[#DDE7E1] bg-white p-6 shadow-xs flex flex-col">
                <div className="flex items-center justify-between border-b border-[#EEF3F0] pb-3">
                  <div className="flex items-center gap-2">
                    <Search className="h-5 w-5 text-purple-600" />
                    <div>
                      <h3 className="text-sm font-bold text-[#15211B]">
                        Recent Hindsight Recall Queries
                      </h3>
                      <p className="text-[11px] text-[#64736A]">
                        Semantic memory lookups triggered during anomaly ingestion or on-demand diagnostic.
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                    {observabilityData?.experiential_memory.recent_recalls.length ?? 0} logged
                  </span>
                </div>

                <div className="mt-4 space-y-3.5 flex-1">
                  {(!observabilityData?.experiential_memory.recent_recalls ||
                    observabilityData.experiential_memory.recent_recalls.length === 0) && (
                    <div className="rounded-xl border border-dashed border-[#DDE7E1] p-8 text-center text-xs text-[#64736A]">
                      No recall queries recorded yet in active session.
                      <div className="mt-1 text-[11px] text-[#15211B] font-semibold">
                        Flag an anomaly or click "Re-query" in the Workbench to trigger Hindsight recall().
                      </div>
                    </div>
                  )}

                  {observabilityData?.experiential_memory.recent_recalls.map((rec) => (
                    <div
                      key={rec.id}
                      className={`rounded-xl border p-4 text-xs shadow-2xs ${
                        rec.prior_experience_found
                          ? "border-emerald-200 bg-emerald-50/20"
                          : "border-[#E2EBE5] bg-[#F9FBFA]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase ${
                              rec.prior_experience_found
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {rec.prior_experience_found ? "PRIOR EXPERIENCE FOUND" : "NO PRIOR EXPERIENCE"}
                          </span>
                          {rec.machine_id && (
                            <span className="font-mono font-bold text-[#15211B]">{rec.machine_id}</span>
                          )}
                        </div>

                        {rec.best_match_score !== null && rec.best_match_score !== undefined && (
                          <span className="font-mono text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                            Relevance: {rec.best_match_score.toFixed(4)}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 text-[11px] font-mono text-[#475569] bg-white p-2 rounded border border-[#E6EDE8] leading-tight">
                        <span className="text-[#64736A] font-sans">Query: </span>
                        {rec.query}
                      </div>

                      {rec.successful_action && (
                        <div className="mt-2 text-[11px] text-emerald-950 font-medium">
                          <span className="font-bold text-emerald-700">Retrieved Fix: </span>
                          {rec.successful_action}
                        </div>
                      )}

                      {rec.failed_actions && rec.failed_actions.length > 0 && (
                        <div className="mt-1 text-[11px] text-rose-800">
                          <span className="font-bold">Avoided Mistakes: </span>
                          {rec.failed_actions.join("; ")}
                        </div>
                      )}

                      <div className="mt-3 flex items-center justify-between border-t border-[#EEF3F0] pt-2 font-mono text-[10px] text-[#64736A]">
                        <span>Memories count: {rec.memories_count}</span>
                        <span>{rec.timestamp ? new Date(rec.timestamp).toLocaleTimeString() : "—"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* LIFECYCLE PROGRESSION TABLE */}
            <div className="rounded-[16px] border border-[#DDE7E1] bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-[#EEF3F0] pb-3">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-[#16A34A]" />
                  <h3 className="text-sm font-bold text-[#15211B]">
                    Incident Learning Trajectory Ledger
                  </h3>
                </div>
                <span className="text-[11px] text-[#64736A]">
                  Tracked across SQLite transactional store and Hindsight memory bank
                </span>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#EEF3F0] bg-[#F8FAF9] text-[10px] font-bold uppercase tracking-wider text-[#64736A]">
                    <tr>
                      <th className="py-2.5 px-3">Incident</th>
                      <th className="py-2.5 px-3">Asset</th>
                      <th className="py-2.5 px-3">Severity</th>
                      <th className="py-2.5 px-3">Attempts</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Hindsight Retain</th>
                      <th className="py-2.5 px-3">Confirmed Root Cause</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF3F0]">
                    {(!observabilityData?.lifecycle_events || observabilityData.lifecycle_events.length === 0) && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-xs text-[#64736A]">
                          No incident trajectories logged yet.
                        </td>
                      </tr>
                    )}
                    {observabilityData?.lifecycle_events.map((ev) => (
                      <tr key={ev.incident_id} className="hover:bg-[#F9FBFA]">
                        <td className="py-3 px-3 font-mono font-bold text-[#15211B]">{ev.incident_id}</td>
                        <td className="py-3 px-3 font-semibold">{ev.machine_id}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                              ev.severity === "HIGH"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {ev.severity}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono">{ev.attempts_count}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                              ev.status === "RESOLVED"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {ev.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px]">
                          {ev.has_retained ? (
                            <span className="font-semibold text-emerald-700">
                              ✓ {ev.hindsight_retained_id || "retained"}
                            </span>
                          ) : (
                            <span className="text-[#94A3B8]">Pending</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[#64736A] max-w-xs truncate">
                          {ev.root_cause || "In diagnostic troubleshooting"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* =====================================================
            RESOLUTION MODAL (COMMIT TO HINDSIGHT)
        ===================================================== */}
        {showResolveModal && activeIncident && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-2xl border border-[#DDE7E1] bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#EEF3F0] pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  <h3 className="text-base font-bold text-[#15211B]">
                    Resolve Incident & Retain Experience
                  </h3>
                </div>
                <button
                  onClick={() => setShowResolveModal(false)}
                  className="rounded-lg p-1 text-[#64736A] hover:bg-[#F0F5F2] hover:text-[#15211B]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="mt-2 text-xs text-[#64736A] leading-relaxed">
                Recording this resolution marks the incident as permanently fixed and writes the confirmed root cause, verified fix, and operational lesson learned to the Hindsight persistent memory bank (<code className="font-mono text-[#16A34A]">{hindsightStatus?.bank_id || "fixtrace-demo-01"}</code>).
              </p>

              {resolveError && (
                <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                  {resolveError}
                </div>
              )}

              <form onSubmit={handleSubmitResolve} className="mt-4 space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-[#15211B]">
                    Confirmed Root Cause *
                  </label>
                  <input
                    type="text"
                    required
                    value={resolveRootCause}
                    onChange={(e) => setResolveRootCause(e.target.value)}
                    placeholder="e.g. Sub-surface fatigue spalling on bearing inner raceway"
                    className="mt-1 w-full rounded-lg border border-[#CCDCD2] bg-[#F8FAF9] p-2 text-xs text-[#15211B] focus:border-[#16A34A] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#15211B]">
                    Resolution Summary / Verified Fix *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={resolveSummary}
                    onChange={(e) => setResolveSummary(e.target.value)}
                    placeholder="e.g. Complete bearing replacement with SKF Explorer and laser realignment..."
                    className="mt-1 w-full rounded-lg border border-[#CCDCD2] bg-[#F8FAF9] p-2 text-xs text-[#15211B] focus:border-[#16A34A] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#15211B]">
                    Operational Lesson Learned *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={resolveLesson}
                    onChange={(e) => setResolveLesson(e.target.value)}
                    placeholder="e.g. Do not rely on routine grease replenishment for 120Hz vibration spikes; always run high-frequency demodulation analysis..."
                    className="mt-1 w-full rounded-lg border border-[#CCDCD2] bg-[#F8FAF9] p-2 text-xs text-[#15211B] focus:border-[#16A34A] focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EEF3F0]">
                  <button
                    type="button"
                    onClick={() => setShowResolveModal(false)}
                    className="rounded-lg border border-[#CCDCD2] px-4 py-2 text-xs font-semibold text-[#64736A] hover:bg-[#F8FAF9]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resolving || !resolveRootCause.trim() || !resolveSummary.trim() || !resolveLesson.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {resolving ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Committing to Hindsight...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        <span>Commit to Hindsight & Resolve</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
