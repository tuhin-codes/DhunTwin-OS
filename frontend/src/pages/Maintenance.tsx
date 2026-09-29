import { useEffect, useMemo, useRef, useState } from "react";

import {
  useMachineSelection,
} from "../context/MachineSelectionContext";

import {
  assignMaintenanceEngineer,
  getMachines,
  getMaintenanceRecommendations,
  type EngineerRecommendation,
  type Machine,
  type MaintenanceRecommendation,
} from "../services/api";

// ============================================================
// FAST CLIENT CACHE
// ============================================================

const MAINTENANCE_MACHINE_CACHE_KEY =
  "carbontwin:maintenance-machines:v4";

const MAINTENANCE_MACHINE_CACHE_MAX_AGE_MS =
  60_000;

interface CachedMachineSnapshot {
  timestamp: number;
  machines: Machine[];
}

function readCachedMachines(): Machine[] {
  try {
    const raw =
      window.sessionStorage.getItem(
        MAINTENANCE_MACHINE_CACHE_KEY
      );

    if (!raw) {
      return [];
    }

    const parsed =
      JSON.parse(raw) as CachedMachineSnapshot;

    if (
      !parsed ||
      !Array.isArray(parsed.machines) ||
      !Number.isFinite(parsed.timestamp)
    ) {
      return [];
    }

    if (
      Date.now() - parsed.timestamp >
      MAINTENANCE_MACHINE_CACHE_MAX_AGE_MS
    ) {
      return [];
    }

    return parsed.machines;
  } catch {
    return [];
  }
}

function writeCachedMachines(
  machines: Machine[]
) {
  try {
    window.sessionStorage.setItem(
      MAINTENANCE_MACHINE_CACHE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        machines,
      })
    );
  } catch {
    // Live API remains the source of truth.
  }
}

// ============================================================
// HELPERS
// ============================================================

function percentage(
  value: number | null | undefined
) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(value)
  ) {
    return "—";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function healthColor(
  value: number | null | undefined
) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(value)
  ) {
    return "text-[#94A39A]";
  }

  if (value >= 80) {
    return "text-[#16A34A]";
  }

  if (value >= 60) {
    return "text-[#CA8A04]";
  }

  if (value >= 40) {
    return "text-[#EA580C]";
  }

  return "text-[#DC2626]";
}

function riskColor(
  probability: number | null | undefined
) {
  if (
    probability === null ||
    probability === undefined ||
    Number.isNaN(probability)
  ) {
    return "text-[#94A39A]";
  }

  if (probability >= 0.7) {
    return "text-[#DC2626]";
  }

  if (probability >= 0.4) {
    return "text-[#EA580C]";
  }

  if (probability >= 0.2) {
    return "text-[#CA8A04]";
  }

  return "text-[#16A34A]";
}

function riskBadge(
  probability: number | null | undefined
) {
  if (
    probability === null ||
    probability === undefined ||
    Number.isNaN(probability)
  ) {
    return {
      label: "UNKNOWN",
      className:
        "border-[#DDE7E1] bg-[#F7FAF8] text-[#64736A]",
    };
  }

  if (probability >= 0.7) {
    return {
      label: "CRITICAL",
      className:
        "border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]",
    };
  }

  if (probability >= 0.4) {
    return {
      label: "HIGH",
      className:
        "border-[#FED7AA] bg-[#FFF7ED] text-[#EA580C]",
    };
  }

  if (probability >= 0.2) {
    return {
      label: "MEDIUM",
      className:
        "border-[#FEF08A] bg-[#FEFCE8] text-[#CA8A04]",
    };
  }

  return {
    label: "LOW",
    className:
      "border-[#A7F3D0] bg-[#ECFDF5] text-[#16A34A]",
  };
}

function maintenanceStatusClass(
  status: string | undefined
) {
  const normalized =
    String(status ?? "").toLowerCase();

  if (
    normalized.includes("critical") ||
    normalized.includes("urgent")
  ) {
    return "border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]";
  }

  if (
    normalized.includes("attention") ||
    normalized.includes("maintenance") ||
    normalized.includes("due")
  ) {
    return "border-[#FED7AA] bg-[#FFF7ED] text-[#EA580C]";
  }

  if (
    normalized.includes("scheduled") ||
    normalized.includes("planned")
  ) {
    return "border-[#DDD6FE] bg-[#F5F3FF] text-[#7C3AED]";
  }

  return "border-[#A7F3D0] bg-[#ECFDF5] text-[#16A34A]";
}

// ============================================================
// ROLE INFORMATION
// ============================================================

function getRoleInfo(
  recommendation:
    | MaintenanceRecommendation
    | undefined
) {
  const raw = recommendation as any;

  const requiredRole = String(
    raw?.required_role ??
      raw?.recommended_role ??
      raw?.workforce?.required_role ??
      "NONE"
  ).toUpperCase();

  const engineerRequired = Boolean(
    raw?.engineer_required ??
      (
        requiredRole === "ENGINEER" ||
        requiredRole ===
          "ENGINEER_AND_TECHNICIAN"
      )
  );

  const technicianRequired = Boolean(
    raw?.technician_required ??
      (
        requiredRole === "TECHNICIAN" ||
        requiredRole ===
          "ENGINEER_AND_TECHNICIAN"
      )
  );

  if (
    requiredRole ===
    "TECHNICIAN"
  ) {
    return {
      requiredRole,
      engineerRequired,
      technicianRequired,
      workerLabel: "Technician",
      workerPlural: "Technicians",
      title: "Technician Assignment",
      subtitle:
        "Select a qualified technician for hands-on maintenance execution.",
      actionVerb: "Assign Technician",
    };
  }

  if (
    requiredRole ===
    "ENGINEER"
  ) {
    return {
      requiredRole,
      engineerRequired,
      technicianRequired,
      workerLabel: "Engineer",
      workerPlural: "Engineers",
      title: "Engineer Review",
      subtitle:
        "Select a qualified engineer for engineering diagnosis and review.",
      actionVerb: "Assign Engineer",
    };
  }

  if (
    requiredRole ===
    "ENGINEER_AND_TECHNICIAN"
  ) {
    return {
      requiredRole,
      engineerRequired,
      technicianRequired,
      workerLabel:
        "Engineer + Technician",
      workerPlural:
        "Engineers + Technicians",
      title:
        "Engineer + Technician",
      subtitle:
        "Engineering review and qualified technician execution are required.",
      actionVerb:
        "Confirm Workforce Assignment",
    };
  }

  return {
    requiredRole: "NONE",
    engineerRequired: false,
    technicianRequired: false,
    workerLabel: "Workforce",
    workerPlural: "Workforce",
    title: "No Workforce Assignment",
    subtitle:
      "No engineer or technician intervention is currently required.",
    actionVerb:
      "No Assignment Required",
  };
}

// ============================================================
// WORKER LABEL HELPERS
// ============================================================

function getWorkerPluralLabel(
  recommendation:
    | MaintenanceRecommendation
    | undefined
) {
  const role =
    getRoleInfo(recommendation);

  return role.workerPlural;
}

// ============================================================
// RISK HELPERS
// ============================================================

function riskPriority(
  probability: number | null | undefined
) {
  if (
    probability === null ||
    probability === undefined ||
    Number.isNaN(probability)
  ) {
    return 4;
  }

  if (probability >= 0.7) {
    return 0;
  }

  if (probability >= 0.4) {
    return 1;
  }

  if (probability >= 0.2) {
    return 2;
  }

  return 3;
}

function riskLabel(
  probability: number | null | undefined
) {
  if (
    probability === null ||
    probability === undefined ||
    Number.isNaN(probability)
  ) {
    return "UNKNOWN";
  }

  if (probability >= 0.7) {
    return "CRITICAL";
  }

  if (probability >= 0.4) {
    return "HIGH";
  }

  if (probability >= 0.2) {
    return "MEDIUM";
  }

  return "LOW";
}

function get120MinuteRisk(
  machine: Machine
): number | null {
  const aiProbability =
    machine.ai_prediction
      ?.failure_probability;

  if (
    aiProbability &&
    typeof aiProbability ===
      "object" &&
    typeof aiProbability["120m"] ===
      "number"
  ) {
    return aiProbability["120m"];
  }

  if (
    typeof machine.failure_probability ===
    "number"
  ) {
    return machine.failure_probability;
  }

  return null;
}

function getFailureProbabilities(
  machine: Machine
) {
  const aiProbability =
    machine.ai_prediction
      ?.failure_probability;

  if (
    aiProbability &&
    typeof aiProbability ===
      "object"
  ) {
    return aiProbability;
  }

  return null;
}

// ============================================================
// COMPONENT
// ============================================================

export default function Maintenance() {
  const {
    selectedMachineId,
    selectMachine,
  } = useMachineSelection();

  const initialCachedMachines =
    readCachedMachines();

  const [machines, setMachines] =
    useState<Machine[]>(
      initialCachedMachines
    );

  const [
    recommendations,
    setRecommendations,
  ] = useState<
    Record<
      string,
      MaintenanceRecommendation
    >
  >({});

  const [loading, setLoading] =
    useState(
      initialCachedMachines.length === 0
    );

  const [, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [
    recommendationLoadingByMachine,
    setRecommendationLoadingByMachine,
  ] = useState<
    Record<string, boolean>
  >({});

  const [
    recommendationErrors,
    setRecommendationErrors,
  ] = useState<
    Record<string, string>
  >({});

  const [
    expandedMachineId,
    setExpandedMachineId,
  ] = useState<string | null>(null);

  const [
    assigningMachineId,
    setAssigningMachineId,
  ] = useState<string | null>(null);

  const [
    assignmentMessages,
    setAssignmentMessage,
  ] = useState<Record<string, string>>(
    {}
  );

  const [
    selectedEngineerByMachine,
    setSelectedEngineerByMachine,
  ] = useState<
    Record<string, string>
  >({});

  const [
    showOnlyAttention,
    setShowOnlyAttention,
  ] = useState(false);

  const refreshInFlightRef =
    useRef(false);

  const recommendationRequestRef =
    useRef<Record<string, number>>({});

  // ============================================================
  // LOAD MACHINE SNAPSHOT
  // ============================================================

  async function loadMaintenanceData(
    isInitialLoad = false
  ) {
    if (refreshInFlightRef.current) {
      return;
    }

    refreshInFlightRef.current =
      true;

    try {
      if (
        isInitialLoad &&
        machines.length === 0
      ) {
        setLoading(true);
      }

      if (!isInitialLoad) {
        setRefreshing(true);
      }

      const machineData =
        await getMachines(true);

      setMachines(machineData);

      writeCachedMachines(
        machineData
      );

      setError(null);
    } catch (err) {
      if (
        isInitialLoad &&
        machines.length === 0
      ) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load maintenance data."
        );
      }
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }

      if (!isInitialLoad) {
        setRefreshing(false);
      }

      refreshInFlightRef.current =
        false;
    }
  }

  // ============================================================
  // LOAD ONE MAINTENANCE DECISION
  // ============================================================

  async function loadRecommendation(
    machineId: string,
    force = false
  ) {
    if (
      !force &&
      recommendations[machineId]
    ) {
      return;
    }

    if (
      recommendationLoadingByMachine[
        machineId
      ]
    ) {
      return;
    }

    const requestNumber =
      (
        recommendationRequestRef.current[
          machineId
        ] ?? 0
      ) + 1;

    recommendationRequestRef.current[
      machineId
    ] = requestNumber;

    setRecommendationLoadingByMachine(
      (previous) => ({
        ...previous,
        [machineId]: true,
      })
    );

    setRecommendationErrors(
      (previous) => {
        const next = {
          ...previous,
        };

        delete next[machineId];

        return next;
      }
    );

    try {
      const result =
        await getMaintenanceRecommendations(
          machineId,
          true
        );

      if (
        recommendationRequestRef.current[
          machineId
        ] !== requestNumber
      ) {
        return;
      }

      setRecommendations(
        (previous) => ({
          ...previous,
          [machineId]: result,
        })
      );
    } catch (err) {
      if (
        recommendationRequestRef.current[
          machineId
        ] !== requestNumber
      ) {
        return;
      }

      setRecommendationErrors(
        (previous) => ({
          ...previous,
          [machineId]:
            err instanceof Error
              ? err.message
              : "Unable to load the maintenance decision.",
        })
      );
    } finally {
      if (
        recommendationRequestRef.current[
          machineId
        ] === requestNumber
      ) {
        setRecommendationLoadingByMachine(
          (previous) => ({
            ...previous,
            [machineId]: false,
          })
        );
      }
    }
  }

  // ============================================================
  // INITIAL LOAD + LIVE TELEMETRY REFRESH
  // ============================================================

  useEffect(() => {
    let mounted = true;

    const hasCachedMachines =
      initialCachedMachines.length > 0;

    void loadMaintenanceData(
      !hasCachedMachines
    );

    const interval =
      window.setInterval(
        () => {
          if (!mounted) {
            return;
          }

          void loadMaintenanceData(
            false
          );
        },
        5000
      );

    return () => {
      mounted = false;

      window.clearInterval(
        interval
      );
    };
  }, []);

  // ============================================================
  // LOAD DECISION WHEN OPERATOR OPENS MACHINE
  // ============================================================

  useEffect(() => {
    if (!expandedMachineId) {
      return;
    }

    void loadRecommendation(
      expandedMachineId
    );
  }, [expandedMachineId]);

  // ============================================================
  // FLEET STATISTICS
  // ============================================================

  const fleetStats = useMemo(() => {
    let stable = 0;
    let attention = 0;
    let critical = 0;

    for (const machine of machines) {
      const risk =
        get120MinuteRisk(machine);

      if (
        risk !== null &&
        risk >= 0.7
      ) {
        critical++;
      } else if (
        risk !== null &&
        risk >= 0.2
      ) {
        attention++;
      } else {
        stable++;
      }
    }

    return {
      total: machines.length,
      stable,
      attention,
      critical,
    };
  }, [machines]);

  const predictiveCoverage =
    useMemo(() => {
      return machines.filter(
        (machine) =>
          Boolean(
            machine.ai_prediction
              ?.available
          )
      ).length;
    }, [machines]);

  // ============================================================
  // HIGHEST PRIORITY MACHINE
  // ============================================================

  const priorityMachine =
    useMemo(() => {
      return [...machines].sort(
        (a, b) => {
          const aRisk =
            get120MinuteRisk(a);

          const bRisk =
            get120MinuteRisk(b);

          return (
            riskPriority(aRisk) -
            riskPriority(bRisk)
          ) || (
            (bRisk ?? -1) -
            (aRisk ?? -1)
          );
        }
      )[0];
    }, [machines]);

  const selectedMachine =
    selectedMachineId
      ? machines.find(
          (machine) =>
            machine.id ===
            selectedMachineId
        ) ?? null
      : null;

  const decisionMachine =
    selectedMachine ??
    priorityMachine ??
    null;

  const decisionRisk =
    decisionMachine
      ? get120MinuteRisk(
          decisionMachine
        )
      : null;

  // ============================================================
  // SORTED MACHINES
  // ============================================================

  const sortedMachines =
    useMemo(() => {
      const result = [
        ...machines,
      ];

      result.sort(
        (a, b) => {
          const aRisk =
            get120MinuteRisk(a);

          const bRisk =
            get120MinuteRisk(b);

          return (
            riskPriority(aRisk) -
            riskPriority(bRisk)
          ) || (
            (bRisk ?? -1) -
            (aRisk ?? -1)
          );
        }
      );

      if (
        !showOnlyAttention
      ) {
        return result;
      }

      return result.filter(
        (machine) => {
          const risk =
            get120MinuteRisk(
              machine
            ) ?? 0;

          return risk >= 0.2;
        }
      );
    }, [
      machines,
      showOnlyAttention,
    ]);

  // ============================================================
  // SHARED MACHINE SELECTION
  // ============================================================

  useEffect(() => {
    if (!selectedMachineId) {
      return;
    }

    const selectedMachine =
      machines.find(
        (machine) =>
          machine.id ===
          selectedMachineId
      );

    if (!selectedMachine) {
      return;
    }

    if (showOnlyAttention) {
      const risk =
        get120MinuteRisk(
          selectedMachine
        ) ?? 0;

      if (risk < 0.2) {
        setShowOnlyAttention(
          false
        );
      }
    }
  }, [
    selectedMachineId,
    machines,
    showOnlyAttention,
  ]);

  // ============================================================
  // WORKER SELECTION
  // ============================================================

  function handleWorkerSelection(
    machineId: string,
    workerId: string
  ) {
    setSelectedEngineerByMachine(
      (previous) => ({
        ...previous,
        [machineId]: workerId,
      })
    );

    setAssignmentMessage(
      (previous) => ({
        ...previous,
        [machineId]:
          "Worker selected. Review the selection and confirm the assignment.",
      })
    );
  }

  // ============================================================
  // WORKER ASSIGNMENT
  // ============================================================

  async function handleAssignment(
    machine: Machine,
    worker: EngineerRecommendation
  ) {
    const recommendation =
      recommendations[
        machine.id
      ];

    const role =
      getRoleInfo(
        recommendation
      );

    try {
      setAssigningMachineId(
        machine.id
      );

      setAssignmentMessage(
        (previous) => ({
          ...previous,
          [machine.id]:
            `Assigning ${role.workerLabel.toLowerCase()}...`,
        })
      );

      await assignMaintenanceEngineer(
        machine.id,
        worker.technician_id
      );

      setAssignmentMessage(
        (previous) => ({
          ...previous,
          [machine.id]:
            `Assigned ${worker.technician} successfully.`,
        })
      );

      await Promise.all([
        loadMaintenanceData(
          false
        ),
        loadRecommendation(
          machine.id,
          true
        ),
      ]);
    } catch (err) {
      setAssignmentMessage(
        (previous) => ({
          ...previous,
          [machine.id]:
            err instanceof Error
              ? err.message
              : `${role.workerLabel} assignment failed.`,
        })
      );
    } finally {
      setAssigningMachineId(
        null
      );
    }
  }

  // ============================================================
  // INITIAL LOADING SCREEN
  // ============================================================

  if (loading) {
    return (
      <main
        style={{
          overflowAnchor:
            "none",
        }}
        className="min-h-screen bg-[#F7FAF8] px-4 py-5 text-[#15211B] sm:px-6 lg:px-8"
      >
        <div className="mx-auto w-full max-w-[1700px]">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute h-full w-full animate-ping rounded-full bg-[#16A34A]/30" />
              <span className="relative h-2 w-2 rounded-full bg-[#16A34A]" />
            </span>

            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#16A34A]">
              Maintenance Intelligence
            </span>
          </div>

          <h1 className="mt-2 text-[30px] font-extrabold tracking-[-0.025em] sm:text-[34px]">
            Maintenance
          </h1>

          <p className="mt-1 text-sm text-[#64736A]">
            Loading predictive maintenance intelligence...
          </p>

          <div className="mt-6 rounded-[16px] border border-[#DDE7E1] bg-white p-6 shadow-[0_2px_10px_rgba(15,23,42,0.025)]">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute h-full w-full animate-ping rounded-full bg-[#16A34A]/30" />
                <span className="relative h-2.5 w-2.5 rounded-full bg-[#16A34A]" />
              </span>

              <span className="text-sm text-[#64736A]">
                Connecting to maintenance services...
              </span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ============================================================
  // INITIAL ERROR
  // ============================================================

  if (error) {
    return (
      <main className="min-h-screen bg-[#F7FAF8] px-4 py-5 text-[#15211B] sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[1700px]">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />

            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#16A34A]">
              Maintenance Intelligence
            </span>
          </div>

          <h1 className="mt-2 text-[30px] font-extrabold tracking-[-0.025em] sm:text-[34px]">
            Maintenance
          </h1>

          <div className="mt-6 rounded-[16px] border border-[#FECACA] bg-white p-6">
            <p className="text-sm font-bold text-[#DC2626]">
              Maintenance service unavailable
            </p>

            <p className="mt-2 text-sm text-[#64736A]">
              {error}
            </p>
          </div>
        </div>
      </main>
    );
  }

  // ============================================================
  // MAIN PAGE
  // ============================================================

  return (
    <main className="min-h-screen bg-[#F7FAF8] px-4 py-5 text-[#15211B] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1700px]">

        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute h-full w-full animate-ping rounded-full bg-[#16A34A]/30" />
                <span className="relative h-2 w-2 rounded-full bg-[#16A34A]" />
              </span>

              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#16A34A]">
                Predictive Maintenance Intelligence
              </span>
            </div>

            <h1 className="mt-2 text-[30px] font-extrabold tracking-[-0.025em] sm:text-[34px] lg:text-[38px]">
              Maintenance
            </h1>

            <p className="mt-1 max-w-[720px] text-sm leading-5 text-[#64736A]">
              Turn predictive AI signals into maintenance decisions,
              qualified workforce recommendations and operator-controlled actions.
            </p>
          </div>

          <div className="flex w-fit items-center gap-2 rounded-full border border-[#A7F3D0] bg-white px-3 py-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute h-full w-full animate-ping rounded-full bg-[#16A34A]/30" />
              <span className="relative h-2 w-2 rounded-full bg-[#16A34A]" />
            </span>

            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#047857]">
              Live Maintenance Data
            </span>
          </div>
        </header>

        {/* ================================================== */}
        {/* EXECUTIVE METRICS */}
        {/* ================================================== */}

        <section className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total Assets"
            value={fleetStats.total}
            description="Machines under monitoring"
            valueClass="text-[#15211B]"
          />

          <MetricCard
            label="Stable"
            value={fleetStats.stable}
            description="No immediate intervention"
            valueClass="text-[#16A34A]"
            borderClass="border-[#A7F3D0]"
          />

          <MetricCard
            label="Attention"
            value={fleetStats.attention}
            description="Predictive review recommended"
            valueClass="text-[#EA580C]"
            borderClass="border-orange-200"
          />

          <MetricCard
            label="Critical"
            value={fleetStats.critical}
            description="Immediate maintenance review"
            valueClass="text-[#DC2626]"
            borderClass="border-red-200"
          />

          <MetricCard
            label="AI Coverage"
            value={`${predictiveCoverage}/${machines.length}`}
            description="Assets with predictive results"
            valueClass="text-[#7C3AED]"
            borderClass="border-[#DDD6FE]"
          />
        </section>

        {/* ================================================== */}
        {/* MAINTENANCE DECISION VIEW */}
        {/* ================================================== */}

        <section className="mt-6 rounded-[16px] border border-[#DDE7E1] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)] sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-[900px]">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#7C3AED]" />

                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7C3AED]">
                  Maintenance Decision View
                </p>
              </div>

              <h2 className="mt-2 text-xl font-bold text-[#15211B]">
                {decisionMachine
                  ? selectedMachine
                    ? `${decisionMachine.name} is the active maintenance context`
                    : decisionRisk !== null &&
                      decisionRisk >= 0.7
                      ? `${decisionMachine.name} is the highest-priority maintenance asset`
                      : "Fleet is within monitored maintenance bands"
                  : "Waiting for machine telemetry"}
              </h2>

              <p className="mt-2 text-sm leading-5 text-[#64736A]">
                {decisionMachine &&
                decisionRisk !== null
                  ? `${decisionMachine.name} is currently classified as ${riskLabel(
                      decisionRisk
                    )} at the 120-minute failure horizon. ${
                      selectedMachine
                        ? "This is the active machine context shared across CarbonTwin OS."
                        : "Review the highest-risk asset first."
                    } Use the AI recommendation and workforce matching workflow below.`
                  : "CarbonTwin will prioritize assets automatically as predictive evidence becomes available."}
              </p>
            </div>

            <div className="shrink-0 rounded-[14px] border border-[#DDD6FE] bg-[#F5F3FF] px-5 py-4 text-center">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#7C3AED]">
                Predictive Coverage
              </p>

              <p className="mt-1 text-2xl font-extrabold text-[#6D28D9]">
                {predictiveCoverage}/{machines.length}
              </p>

              <p className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-[#8B5CF6]">
                AI results available
              </p>
            </div>
          </div>
        </section>

        {/* ================================================== */}
        {/* CRITICAL ALERT */}
        {/* ================================================== */}

        {fleetStats.critical > 0 && (
          <section className="mt-6 overflow-hidden rounded-[16px] border border-[#FECACA] bg-white shadow-[0_2px_10px_rgba(15,23,42,0.025)]">
            <div className="border-l-4 border-[#DC2626] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#DC2626]" />

                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#DC2626]">
                      Critical Maintenance Alert
                    </p>
                  </div>

                  <h2 className="mt-2 text-lg font-bold text-[#15211B]">
                    {fleetStats.critical} machine
                    {fleetStats.critical !== 1
                      ? "s"
                      : ""}{" "}
                    require immediate review
                  </h2>

                  <p className="mt-1 text-sm text-[#64736A]">
                    CarbonTwin has identified elevated predicted
                    failure probability within the 120-minute horizon.
                  </p>
                </div>

                <button
                  onClick={() =>
                    setShowOnlyAttention(
                      true
                    )
                  }
                  className="w-fit rounded-[9px] bg-[#DC2626] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#B91C1C]"
                >
                  View Priority Assets
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ================================================== */}
        {/* MAINTENANCE QUEUE */}
        {/* ================================================== */}

        <section className="mt-7 rounded-[16px] border border-[#DDE7E1] bg-white shadow-[0_2px_10px_rgba(15,23,42,0.025)]">
          <div className="flex flex-col gap-4 border-b border-[#E8EFEB] p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />

                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#16A34A]">
                  Maintenance Queue
                </p>
              </div>

              <h2 className="mt-1 text-xl font-bold text-[#15211B]">
                Machine Maintenance Status
              </h2>

              <p className="mt-1 text-sm text-[#64736A]">
                Assets ranked by predictive failure probability.
              </p>
            </div>

            <button
              onClick={() =>
                setShowOnlyAttention(
                  (previous) =>
                    !previous
                )
              }
              className={`rounded-[9px] border px-3 py-2 text-xs font-bold transition ${
                showOnlyAttention
                  ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]"
                  : "border-[#DDE7E1] bg-white text-[#64736A] hover:bg-[#F7FAF8]"
              }`}
            >
              {showOnlyAttention
                ? "Showing Priority Assets"
                : "Show Priority Assets"}
            </button>
          </div>

          <div className="divide-y divide-[#E8EFEB]">
            {sortedMachines.length ===
            0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-semibold text-[#15211B]">
                  No priority maintenance assets found.
                </p>

                <p className="mt-1 text-xs text-[#94A39A]">
                  All monitored machines are currently below the attention threshold.
                </p>
              </div>
            ) : (
              sortedMachines.map(
                (machine) => {
                  const probability =
                    get120MinuteRisk(
                      machine
                    );

                  const badge =
                    riskBadge(
                      probability
                    );

                  const recommendation =
                    recommendations[
                      machine.id
                    ];

                  const role =
                    getRoleInfo(
                      recommendation
                    );

                  const selectedEngineerId =
                    selectedEngineerByMachine[
                      machine.id
                    ];

                  /*
                   * FIX:
                   *
                   * Never access recommendation.recommended_engineer
                   * unless recommendation exists AND the nested object
                   * exists.
                   *
                   * The backend may legitimately return:
                   *
                   * {
                   *   recommendations: [...]
                   * }
                   *
                   * without:
                   *
                   * recommended_engineer
                   */
                  const selectedEngineer =
                    recommendation?.recommendations?.find(
                      (worker) =>
                        worker.technician_id ===
                        selectedEngineerId
                    ) ??
                    (
                      recommendation?.recommended_engineer &&
                      recommendation.recommended_engineer.technician_id ===
                        selectedEngineerId
                        ? recommendation.recommended_engineer
                        : null
                    );

                  const recommendationLoading =
                    Boolean(
                      recommendationLoadingByMachine[
                        machine.id
                      ]
                    );

                  const recommendationError =
                    recommendationErrors[
                      machine.id
                    ];

                  const isExpanded =
                    expandedMachineId ===
                    machine.id;

                  /*
                   * Current operational assignment
                   * and current AI recommendation are
                   * intentionally different concepts.
                   */
                  const assignedWorker =
                    machine.current_technician ??
                    null;

                  const aiRecommendedWorker =
                    recommendation?.recommended_engineer
                      ?.technician ??
                    null;

                  const displayWorker =
                    aiRecommendedWorker ??
                    assignedWorker ??
                    "Unassigned";

                  const displayWorkerLabel =
                    aiRecommendedWorker
                      ? `AI ${role.workerLabel}`
                      : role.workerLabel;

                  return (
                    <div
                      key={machine.id}
                      className={`p-5 transition sm:p-6 ${
                        selectedMachineId ===
                        machine.id
                          ? "bg-[#F6FCF8]"
                          : ""
                      }`}
                    >

                      {/* ================================================== */}
                      {/* MACHINE HEADER */}
                      {/* ================================================== */}

                      <div
                        className="flex cursor-pointer flex-col gap-5 rounded-[10px] transition hover:bg-[#FBFDFC] xl:flex-row xl:items-center xl:justify-between"
                        onClick={() =>
                          selectMachine(
                            machine.id
                          )
                        }
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-bold text-[#15211B]">
                              {machine.name}
                            </p>

                            <span
                              className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${badge.className}`}
                            >
                              {badge.label}
                            </span>

                            <span
                              className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${maintenanceStatusClass(
                                machine.maintenance_status
                              )}`}
                            >
                              {machine.maintenance_status}
                            </span>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <p className="text-xs text-[#94A39A]">
                              {machine.id}
                              {" · "}
                              {machine.type}
                              {" · "}
                              {machine.location}
                            </p>

                            {selectedMachineId ===
                              machine.id && (
                              <span className="rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#047857]">
                                Active Context
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[560px]">
                          <SmallMetric
                            label="Health"
                            value={
                              machine.health_score !==
                              null
                                ? `${Number(
                                    machine.health_score
                                  ).toFixed(1)}%`
                                : "—"
                            }
                            valueClass={healthColor(
                              machine.health_score
                            )}
                          />

                          <SmallMetric
                            label="120m Failure"
                            value={percentage(
                              probability
                            )}
                            valueClass={riskColor(
                              probability
                            )}
                          />

                          <SmallMetric
                            label="RUL"
                            value={
                              machine.remaining_useful_life !==
                              null
                                ? `${Number(
                                    machine.remaining_useful_life
                                  ).toFixed(1)}`
                                : "—"
                            }
                            description="remaining life"
                          />

                          <SmallMetric
                            label={
                              aiRecommendedWorker
                                ? displayWorkerLabel
                                : "Assigned Worker"
                            }
                            value={
                              displayWorker
                            }
                            description={
                              aiRecommendedWorker
                                ? "current AI recommendation"
                                : "current assignment"
                            }
                          />
                        </div>

                        <button
                          type="button"
                          onClick={(
                            event
                          ) => {
                            event.stopPropagation();

                            selectMachine(
                              machine.id
                            );

                            setExpandedMachineId(
                              isExpanded
                                ? null
                                : machine.id
                            );
                          }}
                          className="w-fit rounded-[9px] border border-[#DDE7E1] bg-white px-3 py-2 text-xs font-bold text-[#64736A] transition hover:bg-[#F7FAF8] hover:text-[#15211B]"
                        >
                          {isExpanded
                            ? "Hide AI Decision"
                            : recommendationLoading
                              ? "Loading AI Decision..."
                              : "View AI Decision"}
                        </button>
                      </div>

                      {/* ================================================== */}
                      {/* COLLAPSED RECOMMENDATION */}
                      {/* ================================================== */}

                      {!isExpanded && (
                        <div className="mt-4 flex flex-col gap-3 rounded-[10px] border border-[#E8EFEB] bg-[#FBFDFC] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#94A39A]">
                              Recommended Next Step
                            </p>

                            <p className="mt-1 truncate text-xs font-semibold text-[#15211B]">
                              {recommendation?.recommended_engineer
                                ? `AI recommends ${recommendation.recommended_engineer.technician} for ${role.workerLabel.toLowerCase()} assignment.`
                                : probability !== null &&
                                  probability >=
                                    0.2
                                  ? "Open the AI decision panel for maintenance evidence and workforce matching."
                                  : "Continue predictive monitoring."}
                            </p>
                          </div>

                          <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-[#7C3AED]">
                            {badge.label}
                          </span>
                        </div>
                      )}

                      {/* ================================================== */}
                      {/* EXPANDED CONTENT */}
                      {/* ================================================== */}

                      {isExpanded && (
                        <div className="mt-5 rounded-[14px] border border-[#DDE7E1] bg-[#FBFDFC] p-5">
                          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">

                            {/* ================================================== */}
                            {/* AI SIDE */}
                            {/* ================================================== */}

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#7C3AED]" />

                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7C3AED]">
                                  AI Maintenance Decision
                                </p>
                              </div>

                              <h3 className="mt-2 text-lg font-bold text-[#15211B]">
                                {machine.name}
                              </h3>

                              <p className="mt-1 text-sm text-[#64736A]">
                                Predictive evidence used to prioritize this asset.
                              </p>

                              <div className="mt-3 rounded-[9px] border border-[#E8E2FF] bg-[#F9F7FF] px-3 py-2 text-[10px] leading-4 text-[#64736A]">
                                <span className="font-bold text-[#7C3AED]">
                                  Decision basis:
                                </span>{" "}
                                live machine condition, predictive failure probability,
                                remaining useful life and maintenance intelligence.
                              </div>

                              {/* ================================================== */}
                              {/* AI SUMMARY */}
                              {/* ================================================== */}

                              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                                <AISummaryCard
                                  label="Failure Risk"
                                  value={percentage(
                                    probability
                                  )}
                                  valueClass={riskColor(
                                    probability
                                  )}
                                  description="120-minute horizon"
                                />

                                <AISummaryCard
                                  label="Health"
                                  value={
                                    machine.health_score !==
                                    null
                                      ? `${Number(
                                          machine.health_score
                                        ).toFixed(1)}%`
                                      : "—"
                                  }
                                  valueClass={healthColor(
                                    machine.health_score
                                  )}
                                  description="Digital twin state"
                                />

                                <AISummaryCard
                                  label="RUL"
                                  value={
                                    machine.remaining_useful_life !==
                                    null
                                      ? Number(
                                          machine.remaining_useful_life
                                        ).toFixed(1)
                                      : "—"
                                  }
                                  description="Remaining useful life"
                                />

                                <AISummaryCard
                                  label="Ticket"
                                  value={
                                    machine.current_ticket ??
                                    "None"
                                  }
                                  description="Current maintenance"
                                />
                              </div>

                              {/* ================================================== */}
                              {/* FAILURE FORECAST */}
                              {/* ================================================== */}

                              {getFailureProbabilities(
                                machine
                              ) && (
                                <div className="mt-4 rounded-[10px] border border-[#DDE7E1] bg-white p-4">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64736A]">
                                    Failure Forecast
                                  </p>

                                  <div className="mt-3 grid grid-cols-3 gap-3">
                                    {(
                                      [
                                        "30m",
                                        "60m",
                                        "120m",
                                      ] as const
                                    ).map(
                                      (
                                        horizon
                                      ) => {
                                        const values =
                                          getFailureProbabilities(
                                            machine
                                          );

                                        const value =
                                          values?.[
                                            horizon
                                          ];

                                        return (
                                          <div
                                            key={
                                              horizon
                                            }
                                            className="rounded-[9px] bg-[#F7FAF8] p-3"
                                          >
                                            <p className="text-[9px] font-medium text-[#94A39A]">
                                              {horizon}
                                            </p>

                                            <p
                                              className={`mt-1 text-lg font-bold ${riskColor(
                                                value
                                              )}`}
                                            >
                                              {percentage(
                                                value
                                              )}
                                            </p>
                                          </div>
                                        );
                                      }
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* ================================================== */}
                              {/* PREDICTIVE AI RECOMMENDATION */}
                              {/* ================================================== */}

                              {machine.ai_prediction && (
                                <div className="mt-4 rounded-[10px] border border-[#A7F3D0] bg-[#ECFDF5] p-4">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#047857]">
                                    Predictive AI Recommendation
                                  </p>

                                  <p className="mt-2 text-sm font-semibold leading-5 text-[#15211B]">
                                    {
                                      machine
                                        .ai_prediction
                                        .recommended_action
                                    }
                                  </p>

                                  <p className="mt-2 text-xs leading-5 text-[#64736A]">
                                    {
                                      machine
                                        .ai_prediction
                                        .reason
                                    }
                                  </p>
                                </div>
                              )}

                              {/* ================================================== */}
                              {/* MAINTENANCE PROBLEM */}
                              {/* ================================================== */}

                              {recommendation && (
                                <div className="mt-4 rounded-[10px] border border-[#DDD6FE] bg-[#F5F3FF] p-4">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7C3AED]">
                                      Maintenance Problem
                                    </p>

                                    <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-bold uppercase text-[#7C3AED]">
                                      {
                                        recommendation
                                          .maintenance_problem
                                          .severity
                                      }
                                    </span>
                                  </div>

                                  {recommendation
                                    .maintenance_problem
                                    .problems
                                    .length >
                                    0 && (
                                    <div className="mt-3 space-y-2">
                                      {recommendation
                                        .maintenance_problem
                                        .problems
                                        .map(
                                          (
                                            problem
                                          ) => (
                                            <div
                                              key={
                                                problem
                                              }
                                              className="flex items-start gap-2 text-xs text-[#64736A]"
                                            >
                                              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7C3AED]" />

                                              <span>
                                                {
                                                  problem
                                                }
                                              </span>
                                            </div>
                                          )
                                        )}
                                    </div>
                                  )}

                                  {recommendation.required_skills.length >
                                    0 && (
                                    <div className="mt-4">
                                      <p className="text-[9px] font-bold uppercase tracking-wider text-[#94A39A]">
                                        Required Skills
                                      </p>

                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {recommendation.required_skills.map(
                                          (
                                            skill
                                          ) => (
                                            <span
                                              key={
                                                skill
                                              }
                                              className="rounded-full border border-[#DDD6FE] bg-white px-2.5 py-1 text-[9px] font-semibold text-[#7C3AED]"
                                            >
                                              {
                                                skill
                                              }
                                            </span>
                                          )
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* ================================================== */}
                            {/* WORKFORCE SIDE */}
                            {/* ================================================== */}

                            <div className="rounded-[12px] border border-[#DDE7E1] bg-white p-5">
                              <div className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />

                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#16A34A]">
                                  {role.title}
                                </p>
                              </div>

                              <p className="mt-1 text-xs leading-5 text-[#64736A]">
                                {role.subtitle}
                              </p>

                              {/* ================================================== */}
                              {/* REQUIRED ROLE */}
                              {/* ================================================== */}

                              {recommendation && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <span className="rounded-full border border-[#DDD6FE] bg-[#F5F3FF] px-2.5 py-1 text-[9px] font-bold text-[#7C3AED]">
                                    Required role:{" "}
                                    {
                                      role.requiredRole
                                    }
                                  </span>

                                  {role.engineerRequired && (
                                    <span className="rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-1 text-[9px] font-bold text-[#2563EB]">
                                      Engineer required
                                    </span>
                                  )}

                                  {role.technicianRequired && (
                                    <span className="rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-1 text-[9px] font-bold text-[#047857]">
                                      Technician required
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* ================================================== */}
                              {/* LOADING */}
                              {/* ================================================== */}

                              {recommendationLoading ? (
                                <div className="mt-4 rounded-[10px] border border-[#DDD6FE] bg-[#F9F7FF] p-4">
                                  <div className="flex items-center gap-3">
                                    <span className="relative flex h-2.5 w-2.5">
                                      <span className="absolute h-full w-full animate-ping rounded-full bg-[#7C3AED]/30" />

                                      <span className="relative h-2.5 w-2.5 rounded-full bg-[#7C3AED]" />
                                    </span>

                                    <div>
                                      <p className="text-sm font-semibold text-[#15211B]">
                                        Building maintenance decision
                                      </p>

                                      <p className="mt-1 text-xs text-[#94A39A]">
                                        Matching qualified workforce by role, skills, availability and historical experience...
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ) : recommendationError ? (
                                <div className="mt-4 rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] p-4">
                                  <p className="text-sm font-semibold text-[#DC2626]">
                                    Workforce matching unavailable
                                  </p>

                                  <p className="mt-1 text-xs leading-5 text-[#64736A]">
                                    {
                                      recommendationError
                                    }
                                  </p>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      void loadRecommendation(
                                        machine.id,
                                        true
                                      )
                                    }
                                    className="mt-3 rounded-[8px] border border-[#FECACA] bg-white px-3 py-2 text-[10px] font-bold text-[#DC2626] transition hover:bg-[#FEF2F2]"
                                  >
                                    Retry
                                  </button>
                                </div>
                              ) : recommendation ? (
                                <>
                                  {/* ================================================== */}
                                  {/* AI RECOMMENDED WORKER */}
                                  {/* ================================================== */}

                                  {recommendation.recommended_engineer ? (
                                    <div className="mt-4 rounded-[10px] border border-[#A7F3D0] bg-[#ECFDF5] p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <p className="text-[9px] font-bold uppercase tracking-wider text-[#047857]">
                                            AI Recommended{" "}
                                            {
                                              role.workerLabel
                                            }
                                          </p>

                                          <p className="mt-2 text-lg font-bold text-[#15211B]">
                                            {
                                              recommendation
                                                .recommended_engineer
                                                .technician
                                            }
                                          </p>

                                          <p className="mt-1 text-xs text-[#64736A]">
                                            {
                                              recommendation
                                                .recommended_engineer
                                                .specialization
                                            }
                                            {" · "}
                                            {
                                              recommendation
                                                .recommended_engineer
                                                .availability
                                            }
                                          </p>

                                          <div className="mt-3 flex flex-wrap gap-2">
                                            <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-semibold text-[#047857]">
                                              {
                                                recommendation
                                                  .recommended_engineer
                                                  .relevance
                                              }
                                            </span>

                                            <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-semibold text-[#64736A]">
                                              {
                                                recommendation
                                                  .recommended_engineer
                                                  .department
                                              }
                                            </span>

                                            <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-semibold text-[#64736A]">
                                              {
                                                recommendation
                                                  .recommended_engineer
                                                  .experience_years
                                              }{" "}
                                              yrs
                                            </span>

                                            {recommendation
                                              .recommended_engineer
                                              .historical_experience && (
                                              <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-semibold text-[#64736A]">
                                                {
                                                  recommendation
                                                    .recommended_engineer
                                                    .historical_experience
                                                    .similar_cases
                                                }{" "}
                                                similar cases
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleWorkerSelection(
                                              machine.id,
                                              recommendation
                                                .recommended_engineer!
                                                .technician_id
                                            )
                                          }
                                          className={`shrink-0 rounded-[8px] px-3 py-2 text-[9px] font-bold transition ${
                                            selectedEngineerId ===
                                            recommendation
                                              .recommended_engineer
                                              .technician_id
                                              ? "border border-[#16A34A] bg-white text-[#047857]"
                                              : "bg-[#087443] text-white hover:bg-[#06663A]"
                                          }`}
                                        >
                                          {selectedEngineerId ===
                                          recommendation
                                            .recommended_engineer
                                            .technician_id
                                            ? "Selected"
                                            : "Select"}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="mt-4 rounded-[10px] border border-[#FED7AA] bg-[#FFF7ED] p-4">
                                      <p className="text-sm font-semibold text-[#9A3412]">
                                        No AI recommended{" "}
                                        {
                                          role.workerLabel
                                        }
                                      </p>

                                      <p className="mt-1 text-xs leading-5 text-[#64736A]">
                                        The current maintenance evidence did not produce a top-ranked{" "}
                                        {
                                          role.workerLabel.toLowerCase()
                                        }
                                        . Available qualified matches remain operator-selectable.
                                      </p>
                                    </div>
                                  )}

                                  {/* ================================================== */}
                                  {/* AVAILABLE WORKFORCE */}
                                  {/* ================================================== */}

                                  {recommendation
                                    .recommendations
                                    .length >
                                  0 ? (
                                    <div className="mt-5">
                                      <div className="flex items-center justify-between gap-3">
                                        <div>
                                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64736A]">
                                            Available{" "}
                                            {
                                              getWorkerPluralLabel(
                                                recommendation
                                              )
                                            }
                                          </p>

                                          <p className="mt-1 text-[9px] text-[#94A39A]">
                                            Ranked by technical suitability, availability, role and historical evidence.
                                          </p>
                                        </div>

                                        <span className="rounded-full border border-[#DDE7E1] bg-white px-2.5 py-1 text-[9px] font-bold text-[#64736A]">
                                          Operator choice
                                        </span>
                                      </div>

                                      <div className="mt-2 space-y-2">
                                        {recommendation.recommendations
                                          .slice(
                                            0,
                                            6
                                          )
                                          .map(
                                            (
                                              worker
                                            ) => {
                                              const isSelected =
                                                selectedEngineerId ===
                                                worker.technician_id;

                                              const isAIRecommended =
                                                Boolean(
                                                  recommendation
                                                    .recommended_engineer
                                                ) &&
                                                recommendation
                                                  .recommended_engineer
                                                  ?.technician_id ===
                                                  worker.technician_id;

                                              return (
                                                <button
                                                  type="button"
                                                  key={
                                                    worker.technician_id
                                                  }
                                                  onClick={() =>
                                                    handleWorkerSelection(
                                                      machine.id,
                                                      worker.technician_id
                                                    )
                                                  }
                                                  className={`w-full rounded-[10px] border p-3 text-left transition ${
                                                    isSelected
                                                      ? "border-[#16A34A] bg-[#ECFDF5] ring-2 ring-[#A7F3D0]"
                                                      : "border-[#E8EFEB] bg-[#FBFDFC] hover:border-[#A7F3D0] hover:bg-[#F7FAF8]"
                                                  }`}
                                                >
                                                  <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                      <div className="flex flex-wrap items-center gap-2">
                                                        <p className="truncate text-sm font-semibold text-[#15211B]">
                                                          {
                                                            worker.technician
                                                          }
                                                        </p>

                                                        {isAIRecommended && (
                                                          <span className="rounded-full bg-[#F5F3FF] px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#7C3AED]">
                                                            AI Recommended
                                                          </span>
                                                        )}

                                                        {isSelected && (
                                                          <span className="rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#047857]">
                                                            Selected
                                                          </span>
                                                        )}

                                                        {(worker as any).role_type && (
                                                          <span className="rounded-full border border-[#DDE7E1] bg-white px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#64736A]">
                                                            {
                                                              (
                                                                worker as any
                                                              )
                                                                .role_type
                                                            }
                                                          </span>
                                                        )}
                                                      </div>

                                                      <p className="mt-0.5 text-[9px] text-[#94A39A]">
                                                        {
                                                          worker.specialization
                                                        }
                                                      </p>
                                                    </div>

                                                    <span className="shrink-0 rounded-full bg-[#F5F3FF] px-2 py-1 text-[9px] font-bold text-[#7C3AED]">
                                                      {
                                                        worker.relevance
                                                      }
                                                    </span>
                                                  </div>

                                                  <div className="mt-2 flex flex-wrap gap-2">
                                                    <span className="text-[9px] text-[#64736A]">
                                                      {
                                                        worker.department
                                                      }
                                                    </span>

                                                    <span className="text-[9px] text-[#94A39A]">
                                                      •
                                                    </span>

                                                    <span className="text-[9px] text-[#64736A]">
                                                      {
                                                        worker.availability
                                                      }
                                                    </span>

                                                    <span className="text-[9px] text-[#94A39A]">
                                                      •
                                                    </span>

                                                    <span className="text-[9px] text-[#64736A]">
                                                      {
                                                        worker.experience_years
                                                      }{" "}
                                                      yrs
                                                    </span>

                                                    {worker.historical_experience && (
                                                      <>
                                                        <span className="text-[9px] text-[#94A39A]">
                                                          •
                                                        </span>

                                                        <span className="text-[9px] text-[#64736A]">
                                                          {
                                                            worker
                                                              .historical_experience
                                                              .similar_cases
                                                          }{" "}
                                                          similar cases
                                                        </span>
                                                      </>
                                                    )}
                                                  </div>
                                                </button>
                                              );
                                            }
                                          )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="mt-5 rounded-[10px] border border-[#DDE7E1] bg-[#F7FAF8] p-4">
                                      <p className="text-sm font-semibold text-[#15211B]">
                                        No alternative workforce matches
                                      </p>

                                      <p className="mt-1 text-xs leading-5 text-[#94A39A]">
                                        CarbonTwin did not return a suitable workforce candidate for the current maintenance requirement.
                                      </p>
                                    </div>
                                  )}

                                  {/* ================================================== */}
                                  {/* SELECTED WORKER */}
                                  {/* ================================================== */}

                                  {selectedEngineer ? (
                                    <div className="mt-5 rounded-[12px] border border-[#DDE7E1] bg-white p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#94A39A]">
                                            Selected by operator
                                          </p>

                                          <p className="mt-1 text-sm font-bold text-[#15211B]">
                                            {
                                              selectedEngineer.technician
                                            }
                                          </p>

                                          <p className="mt-0.5 text-[9px] text-[#64736A]">
                                            {
                                              selectedEngineer.specialization
                                            }
                                            {" · "}
                                            {
                                              selectedEngineer.availability
                                            }
                                          </p>
                                        </div>

                                        {selectedEngineerId &&
                                          recommendation.recommended_engineer &&
                                          selectedEngineerId ===
                                            recommendation
                                              .recommended_engineer
                                              .technician_id && (
                                          <span className="rounded-full bg-[#ECFDF5] px-2.5 py-1 text-[9px] font-bold text-[#047857]">
                                            AI recommendation accepted
                                          </span>
                                        )}
                                      </div>

                                      <button
                                        type="button"
                                        disabled={
                                          assigningMachineId ===
                                          machine.id
                                        }
                                        onClick={() =>
                                          handleAssignment(
                                            machine,
                                            selectedEngineer
                                          )
                                        }
                                        className="mt-3 w-full rounded-[9px] bg-[#087443] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#06663A] disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {assigningMachineId ===
                                        machine.id
                                          ? `Assigning ${role.workerLabel}...`
                                          : `Confirm Operator Assignment · ${selectedEngineer.technician}`}
                                      </button>

                                      <p className="mt-2 text-center text-[9px] text-[#94A39A]">
                                        No assignment is made until the operator explicitly confirms the selected worker.
                                      </p>

                                      {assignmentMessages[
                                        machine.id
                                      ] && (
                                        <div className="mt-3 rounded-[8px] border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-2">
                                          <p className="text-center text-[9px] font-semibold text-[#047857]">
                                            {
                                              assignmentMessages[
                                                machine.id
                                              ]
                                            }
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="mt-5 rounded-[10px] border border-[#DDD6FE] bg-[#F9F7FF] p-3">
                                      <p className="text-[10px] font-semibold text-[#6D28D9]">
                                        Operator action required
                                      </p>

                                      <p className="mt-1 text-[9px] leading-4 text-[#64736A]">
                                        Review the ranked workforce candidates above and select one before confirming the maintenance action.
                                      </p>
                                    </div>
                                  )}

                                  {/* ================================================== */}
                                  {/* SCORING NOTE */}
                                  {/* ================================================== */}

                                  {recommendation.scoring_note && (
                                    <p className="mt-4 text-[9px] leading-4 text-[#94A39A]">
                                      {
                                        recommendation.scoring_note
                                      }
                                    </p>
                                  )}
                                </>
                              ) : (
                                <div className="mt-4 rounded-[10px] border border-[#DDE7E1] bg-[#F7FAF8] p-4">
                                  <p className="text-sm font-semibold text-[#15211B]">
                                    No maintenance recommendation available.
                                  </p>

                                  <p className="mt-1 text-xs leading-5 text-[#94A39A]">
                                    This asset may not currently have enough evidence for a workforce recommendation.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
              )
            )}
          </div>
        </section>

        {/* ================================================== */}
        {/* WORKFLOW */}
        {/* ================================================== */}

        <section className="mt-6 rounded-[16px] border border-[#DDD6FE] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)] sm:p-6">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7C3AED]" />

            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7C3AED]">
              CarbonTwin Maintenance Workflow
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <WorkflowStep
              number="01"
              title="Predict"
              description="AI estimates future failure probability."
            />

            <WorkflowStep
              number="02"
              title="Diagnose"
              description="Maintenance intelligence identifies the intervention need."
            />

            <WorkflowStep
              number="03"
              title="Recommend"
              description="The system ranks qualified workforce candidates by required role, technical suitability, availability and historical evidence."
            />

            <WorkflowStep
              number="04"
              title="Act"
              description="The operator reviews and explicitly confirms the preferred workforce action."
            />
          </div>
        </section>

        {/* ================================================== */}
        {/* FOOTER */}
        {/* ================================================== */}

        <footer className="mt-8 border-t border-[#DCE8E1] py-5">
          <div className="flex flex-col gap-1.5 text-[10px] text-[#94A39A] sm:flex-row sm:items-center sm:justify-between">
            <span>
              CarbonTwin OS · Predictive Maintenance Intelligence
            </span>

            <span>
              Predict → Diagnose → Recommend → Operator Act
            </span>
          </div>
        </footer>
      </div>
    </main>
  );
}

// ============================================================
// METRIC CARD
// ============================================================

interface MetricCardProps {
  label: string;
  value: number | string;
  description: string;
  valueClass: string;
  borderClass?: string;
}

function MetricCard({
  label,
  value,
  description,
  valueClass,
  borderClass =
    "border-[#DDE7E1]",
}: MetricCardProps) {
  return (
    <div
      className={`rounded-[14px] border ${borderClass} bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)]`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64736A]">
        {label}
      </p>

      <p
        className={`mt-2 text-3xl font-bold ${valueClass}`}
      >
        {value}
      </p>

      <p className="mt-1 text-[10px] text-[#94A39A]">
        {description}
      </p>
    </div>
  );
}

// ============================================================
// SMALL METRIC
// ============================================================

interface SmallMetricProps {
  label: string;
  value: string;
  valueClass?: string;
  description?: string;
}

function SmallMetric({
  label,
  value,
  valueClass =
    "text-[#15211B]",
  description,
}: SmallMetricProps) {
  return (
    <div className="min-w-0 rounded-[10px] border border-[#DDE7E1] bg-[#FBFDFC] p-3">
      <p className="text-[9px] font-bold uppercase tracking-wider text-[#94A39A]">
        {label}
      </p>

      <p
        className={`mt-1 truncate text-lg font-bold ${valueClass}`}
      >
        {value}
      </p>

      {description && (
        <p className="mt-0.5 text-[9px] text-[#94A39A]">
          {description}
        </p>
      )}
    </div>
  );
}

// ============================================================
// AI SUMMARY CARD
// ============================================================

interface AISummaryCardProps {
  label: string;
  value: string;
  description: string;
  valueClass?: string;
}

function AISummaryCard({
  label,
  value,
  description,
  valueClass =
    "text-[#15211B]",
}: AISummaryCardProps) {
  return (
    <div className="rounded-[10px] border border-[#DDE7E1] bg-white p-3">
      <p className="text-[9px] font-bold uppercase tracking-wider text-[#64736A]">
        {label}
      </p>

      <p
        className={`mt-1 truncate text-xl font-bold ${valueClass}`}
      >
        {value}
      </p>

      <p className="mt-1 text-[9px] text-[#94A39A]">
        {description}
      </p>
    </div>
  );
}

// ============================================================
// WORKFLOW STEP
// ============================================================

interface WorkflowStepProps {
  number: string;
  title: string;
  description: string;
}

function WorkflowStep({
  number,
  title,
  description,
}: WorkflowStepProps) {
  return (
    <div className="rounded-[10px] border border-[#E8E2FF] bg-[#F9F7FF] p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#7C3AED] text-[8px] font-bold text-white">
          {number}
        </span>

        <p className="text-sm font-bold text-[#15211B]">
          {title}
        </p>
      </div>

      <p className="mt-2 text-[10px] leading-4 text-[#64736A]">
        {description}
      </p>
    </div>
  );
}