import { useEffect, useMemo, useState } from "react";

import { useMachines } from "../hooks/useMachines";

import type {
  Machine,
  RiskLevel,
  AIConditionResult,
} from "../services/api";

// ============================================================
// Helpers
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

  return (value * 100).toFixed(2);
}

function healthPercentage(
  value: number | null | undefined
) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(value)
  ) {
    return "—";
  }

  return Number(value).toFixed(1);
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
  level: RiskLevel | string
) {
  switch (level) {
    case "CRITICAL":
      return "text-[#DC2626]";

    case "HIGH":
      return "text-[#EA580C]";

    case "MEDIUM":
      return "text-[#CA8A04]";

    case "LOW":
      return "text-[#16A34A]";

    default:
      return "text-[#64736A]";
  }
}

function riskBackground(
  level: RiskLevel | string
) {
  switch (level) {
    case "CRITICAL":
      return "bg-[#FEF2F2] border-[#FECACA]";

    case "HIGH":
      return "bg-[#FFF7ED] border-[#FED7AA]";

    case "MEDIUM":
      return "bg-[#FEFCE8] border-[#FEF08A]";

    case "LOW":
      return "bg-[#ECFDF5] border-[#A7F3D0]";

    default:
      return "bg-[#F7FAF8] border-[#DDE7E1]";
  }
}

function riskPriority(
  level: RiskLevel | string
) {
  switch (level) {
    case "CRITICAL":
      return 0;

    case "HIGH":
      return 1;

    case "MEDIUM":
      return 2;

    case "LOW":
      return 3;

    default:
      return 4;
  }
}

function conditionColor(
  condition: string | undefined
) {
  switch (condition) {
    case "CRITICAL":
      return "text-[#DC2626]";

    case "DEGRADED":
      return "text-[#EA580C]";

    case "PERSISTENT_DEVIATION":
      return "text-[#EA580C]";

    case "EARLY_DEVIATION":
      return "text-[#CA8A04]";

    case "NORMAL":
      return "text-[#16A34A]";

    default:
      return "text-[#64736A]";
  }
}


  function riskBarColor(
    level: RiskLevel | string
  ) {
    switch (level) {
      case "CRITICAL":
        return "bg-[#DC2626]";

      case "HIGH":
        return "bg-[#EA580C]";

      case "MEDIUM":
        return "bg-[#CA8A04]";

      case "LOW":
        return "bg-[#16A34A]";

      default:
        return "bg-[#94A39A]";
    }
  }

// ============================================================
// Component
// ============================================================

export default function AIControlCenter() {
  const {
    machines,
    aiConditions,
    loading,
    error,
  } = useMachines();

  /*
   * Shared machine selection
   * -------------------------
   * Digital Twins and AI Control Center communicate through a small
   * browser-level selection channel. This keeps the existing page
   * architecture intact and avoids introducing another dependency.
   */
  const MACHINE_SELECTION_KEY =
    "carbontwin:selectedMachineId";

  const [selectedMachineId, setSelectedMachineId] =
    useState<string | null>(() => {
      try {
        return window.localStorage.getItem(
          MACHINE_SELECTION_KEY
        );
      } catch {
        return null;
      }
    });

  const selectMachine = (machineId: string) => {
    setSelectedMachineId(machineId);

    try {
      window.localStorage.setItem(
        MACHINE_SELECTION_KEY,
        machineId
      );

      window.dispatchEvent(
        new CustomEvent(
          "carbontwin-machine-selection",
          {
            detail: machineId,
          }
        )
      );
    } catch {
      // Selection still works through local React state.
    }
  };

  useEffect(() => {
    const handleSelection = (
      event: Event
    ) => {
      const customEvent =
        event as CustomEvent<string>;

      if (
        typeof customEvent.detail ===
        "string"
      ) {
        setSelectedMachineId(
          customEvent.detail
        );
      }
    };

    const handleStorage = (
      event: StorageEvent
    ) => {
      if (
        event.key ===
        MACHINE_SELECTION_KEY
      ) {
        setSelectedMachineId(
          event.newValue
        );
      }
    };

    window.addEventListener(
      "carbontwin-machine-selection",
      handleSelection
    );

    window.addEventListener(
      "storage",
      handleStorage
    );

    return () => {
      window.removeEventListener(
        "carbontwin-machine-selection",
        handleSelection
      );

      window.removeEventListener(
        "storage",
        handleStorage
      );
    };
  }, []);

  const [riskFilter, setRiskFilter] =
    useState<"ALL" | RiskLevel | "UNKNOWN">(
      "ALL"
    );

  // ============================================================
  // Risk statistics
  // ============================================================

  const riskStats = useMemo(() => {
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let unknown = 0;

    for (const machine of machines) {
      const condition =
        aiConditions[machine.id];

      const level =
        condition
          ?.predictive_failure
          ?.risk_level ??
        machine.ai_prediction?.risk_level ??
        "UNKNOWN";

      switch (level) {
        case "CRITICAL":
          critical++;
          break;

        case "HIGH":
          high++;
          break;

        case "MEDIUM":
          medium++;
          break;

        case "LOW":
          low++;
          break;

        default:
          unknown++;
          break;
      }
    }

    return {
      critical,
      high,
      medium,
      low,
      unknown,
    };
  }, [
    machines,
    aiConditions,
  ]);

  // ============================================================
  // Factory AI Health
  // ============================================================

  const factoryAIHealth = useMemo(() => {
    const scores = machines
      .map(
        (machine) =>
          aiConditions[machine.id]
            ?.ai_health_score
      )
      .filter(
        (score): score is number =>
          typeof score === "number" &&
          Number.isFinite(score)
      );

    if (scores.length === 0) {
      return null;
    }

    return (
      scores.reduce(
        (sum, score) =>
          sum + score,
        0
      ) / scores.length
    );
  }, [
    machines,
    aiConditions,
  ]);

  // ============================================================
  // Predictive Coverage
  // ============================================================

  const predictiveCoverage = useMemo(() => {
    return machines.filter((machine) => {
      const condition =
        aiConditions[machine.id];

      return Boolean(
        condition?.predictive_failure?.available ??
        machine.ai_prediction?.available
      );
    }).length;
  }, [
    machines,
    aiConditions,
  ]);

  // ============================================================
  // Sorted machines
  // ============================================================

  const sortedMachines = useMemo(() => {
    return [...machines].sort(
      (a, b) => {
        const aLevel =
          aiConditions[a.id]
            ?.predictive_failure
            ?.risk_level ??
          a.ai_prediction?.risk_level ??
          "UNKNOWN";

        const bLevel =
          aiConditions[b.id]
            ?.predictive_failure
            ?.risk_level ??
          b.ai_prediction?.risk_level ??
          "UNKNOWN";

        const priorityDifference =
          riskPriority(aLevel) -
          riskPriority(bLevel);

        if (
          priorityDifference !== 0
        ) {
          return priorityDifference;
        }

        const aRisk =
          aiConditions[a.id]
            ?.predictive_failure
            ?.risk_score ??
          a.ai_prediction?.risk_score ??
          -1;

        const bRisk =
          aiConditions[b.id]
            ?.predictive_failure
            ?.risk_score ??
          b.ai_prediction?.risk_score ??
          -1;

        return bRisk - aRisk;
      }
    );
  }, [
    machines,
    aiConditions,
  ]);

  useEffect(() => {
    if (
      selectedMachineId ||
      sortedMachines.length === 0
    ) {
      return;
    }

    selectMachine(
      sortedMachines[0].id
    );
  }, [
    selectedMachineId,
    sortedMachines,
  ]);

  // ============================================================
  // Filtered machines
  // ============================================================

  const filteredMachines = useMemo(() => {
    if (riskFilter === "ALL") {
      return sortedMachines;
    }

    return sortedMachines.filter(
      (machine) => {
        const level =
          aiConditions[machine.id]
            ?.predictive_failure
            ?.risk_level ??
          machine.ai_prediction?.risk_level ??
          "UNKNOWN";

        return level === riskFilter;
      }
    );
  }, [
    sortedMachines,
    aiConditions,
    riskFilter,
  ]);

  // ============================================================
  // Selected machine
  // ============================================================

  const selectedMachine = useMemo(() => {
    if (selectedMachineId) {
      const machine =
        machines.find(
          (item) =>
            item.id ===
            selectedMachineId
        );

      if (machine) {
        return machine;
      }
    }

    return sortedMachines[0] ?? null;
  }, [
    machines,
    selectedMachineId,
    sortedMachines,
  ]);

  const selectedCondition:
    | AIConditionResult
    | undefined =
    selectedMachine
      ? aiConditions[
          selectedMachine.id
        ]
      : undefined;

  // ============================================================
  // Loading
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7FAF8] p-4 text-[#15211B] sm:p-6">
        <div className="mx-auto w-full max-w-[1700px]">

          <div className="mb-6">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute h-full w-full animate-ping rounded-full bg-[#16A34A]/30" />
                <span className="relative h-2 w-2 rounded-full bg-[#16A34A]" />
              </span>

              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#16A34A]">
                Predictive Intelligence
              </span>
            </div>

            <h1 className="mt-2 text-[30px] font-extrabold tracking-[-0.025em] sm:text-[34px]">
              AI Control Center
            </h1>

            <p className="mt-1 text-sm text-[#64736A]">
              Loading live factory intelligence...
            </p>
          </div>

          <div className="rounded-[16px] border border-[#DDE7E1] bg-white p-6 shadow-[0_2px_10px_rgba(15,23,42,0.025)]">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute h-full w-full animate-ping rounded-full bg-[#16A34A]/30" />
                <span className="relative h-2.5 w-2.5 rounded-full bg-[#16A34A]" />
              </span>

              <p className="text-sm font-medium text-[#64736A]">
                Connecting to CarbonTwin AI...
              </p>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ============================================================
  // Error
  // ============================================================

  if (error) {
    return (
      <div className="min-h-screen bg-[#F7FAF8] p-4 text-[#15211B] sm:p-6">
        <div className="mx-auto w-full max-w-[1700px]">

          <div className="mb-6">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />

              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#16A34A]">
                Predictive Intelligence
              </p>
            </div>

            <h1 className="mt-2 text-[30px] font-extrabold tracking-[-0.025em] sm:text-[34px]">
              AI Control Center
            </h1>

            <p className="mt-1 text-sm text-[#64736A]">
              Predictive intelligence and machine risk analysis
            </p>
          </div>

          <div className="rounded-[16px] border border-[#FECACA] bg-white p-6 shadow-[0_2px_10px_rgba(15,23,42,0.025)]">
            <p className="text-sm font-bold text-[#DC2626]">
              AI service unavailable
            </p>

            <p className="mt-2 text-sm text-[#64736A]">
              {error}
            </p>
          </div>

        </div>
      </div>
    );
  }

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="min-h-screen bg-[#F7FAF8] p-4 text-[#15211B] sm:p-6">

      <div className="mx-auto w-full max-w-[1700px]">

        {/* ================================================== */}
        {/* Header */}
        {/* ================================================== */}

        <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

          <div>
            <div className="flex items-center gap-2">

              <span className="relative flex h-2 w-2">
                <span className="absolute h-full w-full animate-ping rounded-full bg-[#16A34A]/30" />
                <span className="relative h-2 w-2 rounded-full bg-[#16A34A]" />
              </span>

              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#16A34A]">
                Live Predictive Intelligence
              </span>

            </div>

            <h1 className="mt-2 text-[30px] font-extrabold tracking-[-0.025em] sm:text-[34px] lg:text-[38px]">
              AI Control Center
            </h1>

            <p className="mt-1 max-w-[760px] text-sm leading-5 text-[#64736A]">
              Operational decision support for machine health,
              predictive failure risk, degradation evidence and
              remaining useful life.
            </p>
          </div>

          <div className="flex w-fit items-center gap-2 rounded-full border border-[#A7F3D0] bg-white px-3 py-2">

            <span className="relative flex h-2 w-2">
              <span className="absolute h-full w-full animate-ping rounded-full bg-[#16A34A]/30" />
              <span className="relative h-2 w-2 rounded-full bg-[#16A34A]" />
            </span>

            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#047857]">
              AI Engine Online
            </span>

          </div>

        </div>

        {/* ================================================== */}
        {/* AI Engine Status */}
        {/* ================================================== */}

        <div className="mb-6 flex flex-col gap-4 overflow-hidden rounded-[16px] border border-[#DDE7E1] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)] md:flex-row md:items-center md:justify-between">

          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#16A34A]">
              AI Engine
            </p>

            <h2 className="mt-1 text-xl font-bold text-[#15211B]">
              CarbonTwin Predictive Maintenance AI
            </h2>

            <p className="mt-1 text-sm text-[#64736A]">
              Live telemetry + predictive failure + degradation + RUL
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">

            <div className="rounded-full border border-[#DDE7E1] bg-[#F7FAF8] px-3 py-2 text-[10px] font-semibold text-[#64736A]">
              {machines.length} assets
            </div>

            <div className="flex items-center gap-2 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-2 text-[#047857]">

              <span className="h-2 w-2 rounded-full bg-[#16A34A]" />

              <span className="text-xs font-bold">
                Online
              </span>

            </div>

          </div>

        </div>

        {/* ================================================== */}
        {/* Executive Summary */}
        {/* ================================================== */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">

          {/* Factory AI Health */}

          <div className="rounded-[14px] border border-[#A7F3D0] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)]">

            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64736A]">
              Factory AI Health
            </p>

            <p
              className={`mt-2 text-3xl font-bold ${
                factoryAIHealth !== null
                  ? healthColor(
                      factoryAIHealth
                    )
                  : "text-[#94A39A]"
              }`}
            >
              {factoryAIHealth !== null
                ? `${factoryAIHealth.toFixed(1)}%`
                : "—"}
            </p>

            <p className="mt-1 text-[10px] text-[#94A39A]">
              Average available AI health
            </p>

          </div>

          {/* Machines */}

          <div className="rounded-[14px] border border-[#DDE7E1] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)]">

            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64736A]">
              Machines
            </p>

            <p className="mt-2 text-3xl font-bold text-[#15211B]">
              {machines.length}
            </p>

            <p className="mt-1 text-[10px] text-[#94A39A]">
              Live factory assets
            </p>

          </div>

          {/* Critical */}

          <button
            type="button"
            onClick={() =>
              setRiskFilter("CRITICAL")
            }
            className={`rounded-[14px] border bg-white p-5 text-left shadow-[0_2px_10px_rgba(15,23,42,0.025)] transition hover:-translate-y-0.5 ${
              riskFilter === "CRITICAL"
                ? "border-[#DC2626] ring-2 ring-[#FECACA]"
                : "border-red-200"
            }`}
          >

            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64736A]">
              Critical
            </p>

            <p className="mt-2 text-3xl font-bold text-[#DC2626]">
              {riskStats.critical}
            </p>

            <p className="mt-1 text-[10px] text-[#94A39A]">
              Immediate review
            </p>

          </button>

          {/* High */}

          <button
            type="button"
            onClick={() =>
              setRiskFilter("HIGH")
            }
            className={`rounded-[14px] border bg-white p-5 text-left shadow-[0_2px_10px_rgba(15,23,42,0.025)] transition hover:-translate-y-0.5 ${
              riskFilter === "HIGH"
                ? "border-[#EA580C] ring-2 ring-[#FED7AA]"
                : "border-orange-200"
            }`}
          >

            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64736A]">
              High Risk
            </p>

            <p className="mt-2 text-3xl font-bold text-[#EA580C]">
              {riskStats.high}
            </p>

            <p className="mt-1 text-[10px] text-[#94A39A]">
              Predictive concern
            </p>

          </button>

          {/* Medium */}

          <button
            type="button"
            onClick={() =>
              setRiskFilter("MEDIUM")
            }
            className={`rounded-[14px] border bg-white p-5 text-left shadow-[0_2px_10px_rgba(15,23,42,0.025)] transition hover:-translate-y-0.5 ${
              riskFilter === "MEDIUM"
                ? "border-[#CA8A04] ring-2 ring-[#FEF08A]"
                : "border-yellow-200"
            }`}
          >

            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64736A]">
              Medium
            </p>

            <p className="mt-2 text-3xl font-bold text-[#CA8A04]">
              {riskStats.medium}
            </p>

            <p className="mt-1 text-[10px] text-[#94A39A]">
              Monitor closely
            </p>

          </button>

          {/* AI Coverage */}

          <div className="rounded-[14px] border border-[#DDD6FE] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)]">

            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64736A]">
              AI Coverage
            </p>

            <p className="mt-2 text-3xl font-bold text-[#7C3AED]">
              {predictiveCoverage}/{machines.length}
            </p>

            <p className="mt-1 text-[10px] text-[#94A39A]">
              Predictive results available
            </p>

          </div>

        </div>

        {/* ================================================== */}
        {/* Risk Filter */}
        {/* ================================================== */}

        <div className="mt-7 flex flex-col gap-3 rounded-[14px] border border-[#DDE7E1] bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.025)] sm:flex-row sm:items-center sm:justify-between">

          <div>

            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64736A]">
              Fleet Risk Filter
            </p>

            <p className="mt-1 text-xs text-[#94A39A]">
              Prioritize machines by predictive risk.
            </p>

          </div>

          <div className="flex flex-wrap gap-2">

            {(
              [
                ["ALL", "All Assets"],
                ["CRITICAL", "Critical"],
                ["HIGH", "High"],
                ["MEDIUM", "Medium"],
                ["LOW", "Low"],
                ["UNKNOWN", "Collecting"],
              ] as const
            ).map(
              ([value, label]) => (

                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setRiskFilter(value)
                  }
                  className={`rounded-full border px-3 py-1.5 text-[10px] font-bold transition ${
                    riskFilter === value
                      ? "border-[#16A34A] bg-[#ECFDF5] text-[#047857]"
                      : "border-[#DDE7E1] bg-white text-[#64736A] hover:border-[#A7F3D0]"
                  }`}
                >
                  {label}
                </button>

              )
            )}

          </div>

        </div>

        {/* ================================================== */}
        {/* Selected Machine Command View */}
        {/* ================================================== */}

        {selectedMachine && (

          <div className="mt-7 rounded-[16px] border border-[#DDE7E1] bg-white shadow-[0_3px_14px_rgba(15,23,42,0.035)]">

            <div className="border-b border-[#E8EFEB] p-5 sm:p-6">

              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

                <div>

                  <div className="flex flex-wrap items-center gap-2">

                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7C3AED]">
                      Priority Machine
                    </span>

                    <span className="h-1 w-1 rounded-full bg-[#C8D4CD]" />

                    <span className="text-[10px] font-semibold text-[#94A39A]">
                      Live AI Decision View
                    </span>

                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-3">

                    <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-[#15211B]">
                      {selectedMachine.name}
                    </h2>

                    <span className="rounded-full border border-[#DDE7E1] bg-[#F7FAF8] px-2.5 py-1 text-[10px] font-semibold text-[#64736A]">
                      {selectedMachine.id}
                    </span>

                    <span className="rounded-full border border-[#DDE7E1] bg-white px-2.5 py-1 text-[10px] font-semibold text-[#64736A]">
                      {selectedMachine.type}
                    </span>

                  </div>

                  <p className="mt-1 text-sm text-[#64736A]">
                    {selectedMachine.department}
                  </p>

                </div>

                <div className="flex flex-wrap items-center gap-2">

                  {(() => {
                    const level =
                      selectedCondition
                        ?.predictive_failure
                        ?.risk_level ??
                      selectedMachine
                        .ai_prediction
                        ?.risk_level ??
                      "UNKNOWN";

                    return (
                      <div
                        className={`rounded-full border px-4 py-2 text-xs font-extrabold ${riskBackground(
                          level
                        )} ${riskColor(
                          level
                        )}`}
                      >
                        {level === "UNKNOWN"
                          ? "PREDICTION PENDING"
                          : `${level} RISK`}
                      </div>
                    );
                  })()}

                </div>

              </div>

            </div>

            <div className="grid grid-cols-1 gap-5 p-5 sm:p-6 xl:grid-cols-[1.4fr_0.9fr]">

              {/* ================================================== */}
              {/* Left - Predictive intelligence */}
              {/* ================================================== */}

              <div>

                <div className="mb-4 flex items-center justify-between">

                  <div>

                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#16A34A]">
                      Predictive Intelligence
                    </p>

                    <h3 className="mt-1 text-lg font-bold text-[#15211B]">
                      Failure Risk Horizon
                    </h3>

                  </div>

                  <span className="rounded-full border border-[#DDE7E1] bg-[#F7FAF8] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#64736A]">
                    30m · 60m · 120m
                  </span>

                </div>

                {selectedCondition?.predictive_failure
                  ?.available ? (

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

                    {(
                      [
                        ["30m", "Next 30 minutes"],
                        ["60m", "Next 60 minutes"],
                        ["120m", "Next 120 minutes"],
                      ] as const
                    ).map(
                      ([key, label]) => {

                        const value =
                          selectedCondition
                            .predictive_failure
                            ?.probability?.[
                            key
                          ];

                        return (
                          <div
                            key={key}
                            className="rounded-[12px] border border-[#DDE7E1] bg-[#FBFDFC] p-4"
                          >

                            <p className="text-[10px] font-semibold text-[#94A39A]">
                              {label}
                            </p>

                            <p
                              className={`mt-2 text-3xl font-extrabold ${
                                key === "120m"
                                  ? riskColor(
                                      selectedCondition
                                        .predictive_failure
                                        ?.risk_level ??
                                        "UNKNOWN"
                                    )
                                  : "text-[#15211B]"
                              }`}
                            >
                              {percentage(
                                value
                              )}
                              {value !== null &&
                                value !==
                                  undefined &&
                                "%"}
                            </p>

                            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E8EFEB]">

                              <div
                                className={`h-full rounded-full ${riskBarColor(
                                  selectedCondition
                                    .predictive_failure
                                    ?.risk_level ??
                                    "UNKNOWN"
                                )} transition-all duration-700`}
                                style={{
                                  width: `${
                                    value === null ||
                                    value === undefined
                                      ? 0
                                      : Math.min(
                                          Number(
                                            value
                                          ) * 100,
                                          100
                                        )
                                  }%`,
                                }}
                              />

                            </div>

                          </div>
                        );
                      }
                    )}

                  </div>

                ) : (

                  <div className="rounded-[12px] border border-[#DDE7E1] bg-[#F7FAF8] p-5">

                    <div className="flex items-center gap-2">

                      <span className="relative flex h-2 w-2">
                        <span className="absolute h-full w-full animate-ping rounded-full bg-[#94A39A]/30" />
                        <span className="relative h-2 w-2 rounded-full bg-[#94A39A]" />
                      </span>

                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#64736A]">
                        Collecting Predictive Evidence
                      </p>

                    </div>

                    <p className="mt-2 text-sm leading-5 text-[#64736A]">
                      {selectedCondition
                        ?.predictive_failure
                        ?.reason ??
                        "The predictive model is waiting for sufficient live telemetry history."}
                    </p>

                  </div>

                )}

                {/* Risk score + RUL */}

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">

                  <div className="rounded-[12px] border border-[#DDE7E1] bg-white p-4">

                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#64736A]">
                      Overall Risk
                    </p>

                    <p
                      className={`mt-2 text-2xl font-extrabold ${riskColor(
                        selectedCondition
                          ?.predictive_failure
                          ?.risk_level ??
                          "UNKNOWN"
                      )}`}
                    >
                      {percentage(
                        selectedCondition
                          ?.predictive_failure
                          ?.risk_score ??
                          null
                      )}
                      {selectedCondition
                        ?.predictive_failure
                        ?.risk_score !==
                        null &&
                        selectedCondition
                          ?.predictive_failure
                          ?.risk_score !==
                          undefined &&
                        "%"}
                    </p>

                  </div>

                  <div className="rounded-[12px] border border-[#DDE7E1] bg-white p-4">

                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#64736A]">
                      RUL
                    </p>

                    <p className="mt-2 text-2xl font-extrabold text-[#15211B]">

                      {selectedCondition?.rul
                        ?.available
                        ? Number(
                            selectedCondition
                              .rul
                              .remaining_useful_life_hours
                          ).toFixed(1)
                        : "—"}

                    </p>

                    <p className="mt-0.5 text-[10px] text-[#94A39A]">
                      remaining hours
                    </p>

                  </div>

                  <div className="rounded-[12px] border border-[#DDE7E1] bg-white p-4">

                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#64736A]">
                      RUL Confidence
                    </p>

                    <p className="mt-2 text-2xl font-extrabold text-[#7C3AED]">

                      {selectedCondition?.rul
                        ? `${(
                            Number(
                              selectedCondition
                                .rul
                                .confidence ??
                                0
                            ) * 100
                          ).toFixed(0)}%`
                        : "—"}

                    </p>

                  </div>

                </div>

                {/* Recommended action */}

                <div className="mt-4 rounded-[12px] border border-[#A7F3D0] bg-[#ECFDF5] p-4">

                  <div className="flex items-center gap-2">

                    <span className="h-2 w-2 rounded-full bg-[#16A34A]" />

                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#047857]">
                      Recommended Action
                    </p>

                  </div>

                  <p className="mt-2 text-sm font-bold leading-5 text-[#15211B]">

                    {selectedCondition
                      ?.predictive_failure
                      ?.recommended_action ??
                      selectedCondition
                        ?.rul
                        ?.reason ??
                      "Continue Digital Twin monitoring."}

                  </p>

                  {selectedCondition
                    ?.predictive_failure
                    ?.reason && (

                    <p className="mt-2 text-xs leading-5 text-[#64736A]">
                      {
                        selectedCondition
                          .predictive_failure
                          .reason
                      }
                    </p>

                  )}

                </div>

              </div>

              {/* ================================================== */}
              {/* Right - machine state */}
              {/* ================================================== */}

              <div>

                <div className="mb-4">

                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7C3AED]">
                    Operational State
                  </p>

                  <h3 className="mt-1 text-lg font-bold text-[#15211B]">
                    Machine Evidence
                  </h3>

                </div>

                {/* Health */}

                <div className="rounded-[12px] border border-[#DDE7E1] bg-[#FBFDFC] p-4">

                  <div className="flex items-center justify-between">

                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#64736A]">
                      Digital Twin Health
                    </p>

                    <p
                      className={`text-2xl font-extrabold ${healthColor(
                        selectedMachine.health_score
                      )}`}
                    >
                      {healthPercentage(
                        selectedMachine.health_score
                      )}
                      %
                    </p>

                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E8EFEB]">

                    <div
                      className="h-full rounded-full bg-[#16A34A] transition-all duration-700"
                      style={{
                        width: `${Math.min(
                          Math.max(
                            Number(
                              selectedMachine.health_score ??
                                0
                            ),
                            0
                          ),
                          100
                        )}%`,
                      }}
                    />

                  </div>

                  <div className="mt-3 flex items-center justify-between text-[10px]">

                    <span className="text-[#94A39A]">
                      Maintenance
                    </span>

                    <span className="font-bold text-[#15211B]">
                      {
                        selectedMachine.maintenance_status
                      }
                    </span>

                  </div>

                </div>

                {/* AI health */}

                <div className="mt-3 rounded-[12px] border border-[#DDD6FE] bg-[#F5F3FF] p-4">

                  <div className="flex items-center justify-between">

                    <div>

                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#7C3AED]">
                        AI Health
                      </p>

                      <p className="mt-1 text-xs text-[#94A39A]">
                        Evidence-based condition score
                      </p>

                    </div>

                    <p
                      className={`text-2xl font-extrabold ${healthColor(
                        selectedCondition
                          ?.ai_health_score
                      )}`}
                    >
                      {healthPercentage(
                        selectedCondition
                          ?.ai_health_score
                      )}
                      {selectedCondition
                        ?.ai_health_score !==
                        null &&
                        selectedCondition
                          ?.ai_health_score !==
                          undefined &&
                        "%"}
                    </p>

                  </div>

                </div>

                {/* Degradation */}

                <div className="mt-3 rounded-[12px] border border-[#DDE7E1] bg-white p-4">

                  <div className="flex items-center justify-between gap-3">

                    <div>

                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#64736A]">
                        Degradation
                      </p>

                      <p
                        className={`mt-1 text-sm font-bold ${
                          conditionColor(
                            selectedCondition
                              ?.degradation
                              ?.condition
                          )
                        }`}
                      >
                        {selectedCondition
                          ?.degradation
                          ?.condition ??
                          "UNKNOWN"}
                      </p>

                    </div>

                    <span className="rounded-full border border-[#DDE7E1] bg-[#F7FAF8] px-2.5 py-1 text-[9px] font-semibold text-[#64736A]">

                      {selectedCondition
                        ?.degradation
                        ? `${selectedCondition.degradation.available_signal_count}/${selectedCondition.degradation.total_signal_count} signals`
                        : "No evidence"}

                    </span>

                  </div>

                  <p className="mt-3 text-xs leading-5 text-[#64736A]">

                    {selectedCondition
                      ?.degradation
                      ?.explanation ??
                      "Degradation evidence is currently unavailable."}

                  </p>

                </div>

                {/* Telemetry */}

                {selectedCondition?.telemetry && (

                  <div className="mt-3">

                    <div className="mb-2 flex items-center justify-between">

                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#64736A]">
                        Live Telemetry
                      </p>

                      <span className="flex items-center gap-1 text-[9px] font-bold text-[#047857]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
                        LIVE
                      </span>

                    </div>

                    <div className="grid grid-cols-2 gap-2">

                      {Object.entries(
                        selectedCondition.telemetry
                      ).map(
                        ([key, value]) => (

                          <div
                            key={key}
                            className="rounded-[10px] border border-[#DDE7E1] bg-white p-3"
                          >

                            <p className="text-[9px] font-medium capitalize text-[#94A39A]">
                              {key.replace(
                                /_/g,
                                " "
                              )}
                            </p>

                            <p className="mt-1 text-base font-extrabold text-[#15211B]">
                              {Number(
                                value
                              ).toFixed(2)}
                            </p>

                          </div>

                        )
                      )}

                    </div>

                  </div>

                )}

              </div>

            </div>

          </div>

        )}

        {/* ================================================== */}
        {/* Machine Fleet */}
        {/* ================================================== */}

        <div className="mt-7 rounded-[16px] border border-[#DDE7E1] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)] sm:p-6">

          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">

            <div>

              <div className="flex items-center gap-2">

                <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />

                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#16A34A]">
                  Fleet Intelligence
                </p>

              </div>

              <h2 className="mt-1 text-xl font-bold text-[#15211B]">
                Machine Risk Queue
              </h2>

              <p className="mt-1 text-sm text-[#64736A]">
                Highest-priority assets appear first.
              </p>

            </div>

            <span className="w-fit rounded-full border border-[#DDE7E1] bg-[#F7FAF8] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#64736A]">
              {filteredMachines.length} displayed
            </span>

          </div>

          {filteredMachines.length === 0 ? (

            <div className="rounded-[12px] border border-[#DDE7E1] bg-[#F7FAF8] p-6 text-center">

              <p className="text-sm font-semibold text-[#64736A]">
                No machines match this risk filter.
              </p>

              <button
                type="button"
                onClick={() =>
                  setRiskFilter("ALL")
                }
                className="mt-3 rounded-full border border-[#A7F3D0] bg-white px-3 py-1.5 text-[10px] font-bold text-[#047857]"
              >
                Show all assets
              </button>

            </div>

          ) : (

            <div className="space-y-3">

              {filteredMachines.map(
                (
                  machine: Machine,
                  index
                ) => {

                  const condition:
                    | AIConditionResult
                    | undefined =
                    aiConditions[
                      machine.id
                    ];

                  const predictive =
                    condition
                      ?.predictive_failure;

                  const riskLevel =
                    predictive
                      ?.risk_level ??
                    machine.ai_prediction
                      ?.risk_level ??
                    "UNKNOWN";

                  const riskScore =
                    predictive
                      ?.risk_score ??
                    machine.ai_prediction
                      ?.risk_score ??
                    null;

                  const rul =
                    condition?.rul;

                  const isSelected =
                    selectedMachine?.id ===
                    machine.id;

                  return (
                    <button
                      type="button"
                      key={machine.id}
                      onClick={() =>
                        selectMachine(
                          machine.id
                        )
                      }
                      className={`w-full rounded-[12px] border p-4 text-left transition ${
                        isSelected
                          ? "border-[#16A34A] bg-[#FBFDFC] ring-2 ring-[#A7F3D0]"
                          : "border-[#DDE7E1] bg-white hover:border-[#A7F3D0] hover:bg-[#FBFDFC]"
                      }`}
                    >

                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">

                        {/* Priority */}

                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[#F7FAF8] text-[10px] font-extrabold text-[#64736A]">
                          {String(
                            index + 1
                          ).padStart(2, "0")}
                        </div>

                        {/* Machine */}

                        <div className="min-w-0 flex-1">

                          <div className="flex flex-wrap items-center gap-2">

                            <p className="font-bold text-[#15211B]">
                              {machine.name}
                            </p>

                            <span className="rounded-full border border-[#DDE7E1] bg-[#F7FAF8] px-2 py-0.5 text-[9px] font-medium text-[#64736A]">
                              {machine.id}
                            </span>

                            <span
                              className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${riskBackground(
                                riskLevel
                              )} ${riskColor(
                                riskLevel
                              )}`}
                            >
                              {riskLevel}
                            </span>

                          </div>

                          <p className="mt-1 text-[10px] text-[#94A39A]">
                            {machine.type}
                            {" · "}
                            {machine.department}
                          </p>

                        </div>

                        {/* Risk */}

                        <div className="min-w-[110px]">

                          <p className="text-[9px] font-bold uppercase tracking-wider text-[#94A39A]">
                            Risk
                          </p>

                          <p
                            className={`mt-1 text-lg font-extrabold ${riskColor(
                              riskLevel
                            )}`}
                          >
                            {percentage(
                              riskScore
                            )}
                            {riskScore !==
                              null &&
                              riskScore !==
                                undefined &&
                              "%"}
                          </p>

                        </div>

                        {/* Health */}

                        <div className="min-w-[100px]">

                          <p className="text-[9px] font-bold uppercase tracking-wider text-[#94A39A]">
                            Health
                          </p>

                          <p
                            className={`mt-1 text-lg font-extrabold ${healthColor(
                              machine.health_score
                            )}`}
                          >
                            {healthPercentage(
                              machine.health_score
                            )}
                            %
                          </p>

                        </div>

                        {/* RUL */}

                        <div className="min-w-[100px]">

                          <p className="text-[9px] font-bold uppercase tracking-wider text-[#94A39A]">
                            RUL
                          </p>

                          <p className="mt-1 text-lg font-extrabold text-[#15211B]">

                            {rul?.available
                              ? Number(
                                  rul.remaining_useful_life_hours
                                ).toFixed(1)
                              : "—"}

                          </p>

                        </div>

                        {/* Action */}

                        <div className="hidden max-w-[270px] xl:block">

                          <p className="text-[9px] font-bold uppercase tracking-wider text-[#94A39A]">
                            Action
                          </p>

                          <p className="mt-1 truncate text-xs font-semibold text-[#15211B]">
                            {predictive
                              ?.recommended_action ??
                              "Continue monitoring"}
                          </p>

                        </div>

                        <div className="text-[#94A39A]">
                          →
                        </div>

                      </div>

                    </button>
                  );
                }
              )}

            </div>

          )}

        </div>

        {/* ================================================== */}
        {/* Decision Framework */}
        {/* ================================================== */}

        <div className="mt-7 grid grid-cols-1 gap-4 lg:grid-cols-3">

          <div className="rounded-[14px] border border-red-200 bg-white p-5">

            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#DC2626]">
              Critical
            </p>

            <p className="mt-2 text-sm font-bold text-[#15211B]">
              Immediate inspection
            </p>

            <p className="mt-1 text-xs leading-5 text-[#64736A]">
              Investigate the asset immediately and follow
              applicable plant safety and shutdown procedures.
            </p>

          </div>

          <div className="rounded-[14px] border border-orange-200 bg-white p-5">

            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#EA580C]">
              High
            </p>

            <p className="mt-2 text-sm font-bold text-[#15211B]">
              Schedule maintenance
            </p>

            <p className="mt-1 text-xs leading-5 text-[#64736A]">
              Review the asset condition and schedule intervention
              before the predicted risk escalates.
            </p>

          </div>

          <div className="rounded-[14px] border border-[#A7F3D0] bg-white p-5">

            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#16A34A]">
              Normal / Collecting
            </p>

            <p className="mt-2 text-sm font-bold text-[#15211B]">
              Continue monitoring
            </p>

            <p className="mt-1 text-xs leading-5 text-[#64736A]">
              Maintain live telemetry collection and allow the
              predictive system to build sufficient evidence.
            </p>

          </div>

        </div>

        {/* ================================================== */}
        {/* Method Note */}
        {/* ================================================== */}

        <div className="mt-6 rounded-[16px] border border-[#DDE7E1] bg-white p-5">

          <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-4">

            <div>
              <p className="font-bold uppercase tracking-[0.12em] text-[#94A39A]">
                Prediction Model
              </p>

              <p className="mt-1 font-semibold text-[#15211B]">
                XGBoost
              </p>
            </div>

            <div>
              <p className="font-bold uppercase tracking-[0.12em] text-[#94A39A]">
                Risk Horizons
              </p>

              <p className="mt-1 font-semibold text-[#15211B]">
                30m · 60m · 120m
              </p>
            </div>

            <div>
              <p className="font-bold uppercase tracking-[0.12em] text-[#94A39A]">
                RUL Method
              </p>

              <p className="mt-1 font-semibold text-[#15211B]">
                Explainable estimator
              </p>
            </div>

            <div>
              <p className="font-bold uppercase tracking-[0.12em] text-[#94A39A]">
                Decision Basis
              </p>

              <p className="mt-1 font-semibold text-[#15211B]">
                Live telemetry + AI evidence
              </p>
            </div>

          </div>

        </div>

        {/* ================================================== */}
        {/* Footer */}
        {/* ================================================== */}

        <div className="mt-6 rounded-[16px] border border-[#DDD6FE] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)]">

          <div className="flex items-start gap-3">

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#F5F3FF] text-xs font-bold text-[#7C3AED]">
              AI
            </div>

            <div>

              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7C3AED]">
                Decision Support
              </p>

              <h2 className="mt-1 text-lg font-bold text-[#15211B]">
                Evidence before intervention
              </h2>

              <p className="mt-2 text-sm leading-6 text-[#64736A]">
                CarbonTwin combines live telemetry, predictive
                failure probability, degradation evidence and
                remaining useful life to prioritize maintenance.
                When evidence is insufficient, the platform
                explicitly reports that state instead of inventing
                a prediction.
              </p>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}