import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Gauge,
  MapPin,
  Search,
  Settings2,
  Thermometer,
  UserRound,
  Waves,
  Zap,
} from "lucide-react";

import { useMachines } from "../hooks/useMachines";
import {
  getAICondition,
  getMaintenanceRecommendations,
  assignMaintenanceEngineer,
  clearApiCache,
} from "../services/api";

import type {
  Machine,
  AICondition,
  MaintenanceRecommendation,
} from "../services/api";

import {
  useMachineSelection,
} from "../context/MachineSelectionContext";

import TelemetryHistoryChart from "../features/digitalTwin/components/TelemetryHistoryChart";
import MachineControlPanel from "../features/digitalTwin/components/MachineControlPanel";


/* ============================================================
   TYPES
============================================================ */

type AIConditionResponse = AICondition & {
  telemetry?: {
    Temperature?: number;
    Pressure?: number;
    Vibration?: number;
    Power?: number;
  };

  ai_health_score?: number | null;

  digital_twin_health_score?: number | null;

  degradation?: {
    machine_id?: string;
    timestamp?: string;
    machine_type?: string;
    normalized_machine_type?: string;
    condition?: string;
    baseline_available?: boolean;
    available_signal_count?: number;
    total_signal_count?: number;
    current_deviation?: number;
    maximum_deviation?: number;
    deviation_trend?: number;
    attention_signal_count?: number;
    degraded_signal_count?: number;
    critical_signal_count?: number;
    anomaly_available?: boolean;
    anomaly_persistence?: number | null;
    dominant_signals?: Array<{
      signal: string;
      deviation: number;
      signed_deviation?: number;
      position?: string;
    }>;
    history_points?: number;
    explanation?: string;
  };

  predictive_failure?: {
    available?: boolean;

    probability?: {
      "30m"?: number;
      "60m"?: number;
      "120m"?: number;
    } | null;

    risk_level?: string;

    risk_score?: number | null;

    ai_failure_probability?: number | null;

    reason?: string;

    recommended_action?: string;
  };

  rul?: {
    available?: boolean;

    remaining_useful_life_hours?: number | null;

    confidence?: number;

    status?: string;

    reason?: string;

    factors?: {
      condition?: number;
      predictive?: number;
      degradation?: number;
      anomaly?: number;
    };

    method?: string;

    baseline_rul_hours?: number;
  };
};


/* ============================================================
   HELPERS
============================================================ */

function clamp(
  value: number,
  min = 0,
  max = 100
) {
  return Math.min(
    Math.max(value, min),
    max
  );
}


function getHealthColor(
  health: number
) {
  if (health >= 80) {
    return "text-emerald-600";
  }

  if (health >= 60) {
    return "text-amber-500";
  }

  return "text-red-500";
}


function getHealthBar(
  health: number
) {
  if (health >= 80) {
    return "bg-emerald-500";
  }

  if (health >= 60) {
    return "bg-amber-400";
  }

  return "bg-red-500";
}


function getRiskColor(
  level?: string
) {
  switch (level) {

    case "CRITICAL":
      return "text-red-600 bg-red-50 border-red-200";

    case "HIGH":
      return "text-orange-600 bg-orange-50 border-orange-200";

    case "MEDIUM":
      return "text-amber-600 bg-amber-50 border-amber-200";

    case "LOW":
      return "text-emerald-600 bg-emerald-50 border-emerald-200";

    default:
      return "text-slate-500 bg-slate-50 border-slate-200";
  }
}


function getConditionColor(
  condition?: string
) {
  switch (
    String(condition || "").toUpperCase()
  ) {

    case "CRITICAL":
      return "text-red-600 bg-red-50 border-red-200";

    case "DEGRADED":
      return "text-orange-600 bg-orange-50 border-orange-200";

    case "ATTENTION":
      return "text-orange-600 bg-orange-50 border-orange-200";

    case "EARLY_DEVIATION":
      return "text-amber-600 bg-amber-50 border-amber-200";

    case "NORMAL":
      return "text-emerald-600 bg-emerald-50 border-emerald-200";

    default:
      return "text-slate-500 bg-slate-50 border-slate-200";
  }
}


/*
 * Existing machine health.
 *
 * This represents the Digital Twin's current
 * machine health state.
 */
function getDisplayedHealth(
  machine: Machine
) {
  const value = Number(
    machine.health_score
  );

  if (
    Number.isFinite(value)
  ) {
    return clamp(value);
  }

  return 0;
}


/*
 * AI health score.
 *
 * Priority:
 *
 * 1. /ai-condition ai_health_score
 * 2. /ai-condition digital_twin_health_score
 * 3. machine.health_score
 *
 * This prevents inventing an AI score.
 */
function getAIHealthScore(
  aiCondition: AIConditionResponse | null,
  machine: Machine
) {
  const aiValue =
    Number(
      aiCondition?.ai_health_score
    );

  if (
    Number.isFinite(aiValue)
  ) {
    return clamp(aiValue);
  }

  const digitalTwinValue =
    Number(
      aiCondition?.digital_twin_health_score
    );

  if (
    Number.isFinite(digitalTwinValue)
  ) {
    return clamp(
      digitalTwinValue
    );
  }

  return getDisplayedHealth(
    machine
  );
}


/* ============================================================
   SENSOR CARD
============================================================ */

function SensorCard({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="rounded-xl border border-[#DCE8E1] bg-white p-4">

      <div className="flex items-center gap-2">

        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F0F7F3] text-emerald-600">
          <Icon size={14} />
        </div>

        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
          {label}
        </p>

      </div>

      <div className="mt-3 flex items-baseline gap-1">

        <p className="text-lg font-extrabold text-[#15211B]">
          {value}
        </p>

        {unit && (
          <span className="text-[9px] font-medium text-slate-400">
            {unit}
          </span>
        )}

      </div>

    </div>
  );
}


/* ============================================================
   HEALTH CARD
============================================================ */

function HealthCard({
  title,
  subtitle,
  value,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  value: number;
  icon: typeof Gauge;
}) {

  const safeValue =
    clamp(
      Number.isFinite(value)
        ? value
        : 0
    );

  return (
    <div className="rounded-xl border border-[#DCE8E1] bg-[#FAFCFB] p-4">

      <div className="flex items-start justify-between">

        <div>

          <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">
            {title}
          </p>

          <p
            className={`mt-2 text-2xl font-extrabold ${getHealthColor(
              safeValue
            )}`}
          >
            {safeValue.toFixed(1)}%
          </p>

          <p className="mt-1 text-[8px] text-slate-400">
            {subtitle}
          </p>

        </div>

        <Icon
          size={18}
          className={getHealthColor(
            safeValue
          )}
        />

      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">

        <div
          className={`h-full rounded-full ${getHealthBar(
            safeValue
          )}`}
          style={{
            width: `${safeValue}%`,
          }}
        />

      </div>

    </div>
  );
}


/* ============================================================
   MACHINE CARD
============================================================ */

function MachineCard({
  machine,
  selected,
  onSelect,
}: {
  machine: Machine;
  selected: boolean;
  onSelect: () => void;
}) {

  const health =
    getDisplayedHealth(
      machine
    );

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-4 text-left transition-all ${
        selected
          ? "border-emerald-400 bg-emerald-50/60 shadow-sm"
          : "border-[#DCE8E1] bg-white hover:border-emerald-300 hover:shadow-sm"
      }`}
    >

      <div className="flex items-start justify-between gap-3">

        <div className="min-w-0">

          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
            {machine.type}
          </p>

          <p className="mt-1 truncate text-sm font-bold text-[#15211B]">
            {machine.name}
          </p>

          <p className="mt-1 text-[9px] text-slate-400">
            {machine.id}
          </p>

        </div>

        <span
          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
            health >= 80
              ? "bg-emerald-500"
              : health >= 60
                ? "bg-amber-400"
                : "bg-red-500"
          }`}
        />

      </div>


      <div className="mt-4">

        <div className="flex items-center justify-between">

          <span className="text-[8px] font-semibold text-slate-400">
            Health
          </span>

          <span
            className={`text-[10px] font-extrabold ${getHealthColor(
              health
            )}`}
          >
            {health.toFixed(1)}%
          </span>

        </div>


        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">

          <div
            className={`h-full rounded-full ${getHealthBar(
              health
            )}`}
            style={{
              width: `${clamp(
                health
              )}%`,
            }}
          />

        </div>

      </div>

    </button>
  );
}


/* ============================================================
   MAIN PAGE
============================================================ */

export default function DigitalTwins() {

  const {
    machines,
    loading,
    error,
    live,
    refresh,
  } = useMachines();


  /* ==========================================================
     SHARED MACHINE SELECTION
  ========================================================== */

  const {
    selectedMachineId,
    selectMachine,
  } = useMachineSelection();


  const [
    search,
    setSearch,
  ] = useState("");


  const [
    department,
    setDepartment,
  ] = useState("All");


  const [
    machineControlOpen,
    setMachineControlOpen,
  ] = useState(false);


  const [
    aiCondition,
    setAiCondition,
  ] = useState<AIConditionResponse | null>(
    null
  );


  const [
    aiConditionLoading,
    setAiConditionLoading,
  ] = useState(false);


  const [
    aiConditionError,
    setAiConditionError,
  ] = useState<string | null>(
    null
  );


  const [
    maintenanceRecommendation,
    setMaintenanceRecommendation,
  ] = useState<MaintenanceRecommendation | null>(
    null
  );


  const [
    maintenanceRecommendationLoading,
    setMaintenanceRecommendationLoading,
  ] = useState(false);


  const [
    maintenanceRecommendationError,
    setMaintenanceRecommendationError,
  ] = useState<string | null>(
    null
  );


  const [
    assignmentLoading,
    setAssignmentLoading,
  ] = useState(false);


  const [
    assignmentError,
    setAssignmentError,
  ] = useState<string | null>(
    null
  );


  const [
    assignmentMessage,
    setAssignmentMessage,
  ] = useState<string | null>(
    null
  );


  /* ==========================================================
     SELECT MACHINE
  ========================================================== */

  useEffect(() => {

    if (
      machines.length === 0
    ) {
      return;
    }

    const stillExists =
      machines.some(
        (machine) =>
          machine.id ===
          selectedMachineId
      );

    if (!stillExists) {

      selectMachine(
        machines[0].id
      );

    }

  }, [
    machines,
    selectedMachineId,
    selectMachine,
  ]);


  /* ==========================================================
     DEPARTMENTS
  ========================================================== */

  const departments =
    useMemo(() => {

      return [
        "All",

        ...Array.from(
          new Set(
            machines.map(
              (machine) =>
                machine.department
            )
          )
        ),
      ];

    }, [
      machines,
    ]);


  /* ==========================================================
     FILTER MACHINES
  ========================================================== */

  const filteredMachines =
    useMemo(() => {

      const query =
        search
          .trim()
          .toLowerCase();

      return machines.filter(
        (machine) => {

          const matchesSearch =
            !query ||
            machine.name
              .toLowerCase()
              .includes(query) ||
            machine.id
              .toLowerCase()
              .includes(query) ||
            machine.type
              .toLowerCase()
              .includes(query);

          const matchesDepartment =
            department ===
              "All" ||
            machine.department ===
              department;

          return (
            matchesSearch &&
            matchesDepartment
          );
        }
      );

    }, [
      machines,
      search,
      department,
    ]);


  /* ==========================================================
     FLEET SUMMARY
  ========================================================== */

  const fleetSummary =
    useMemo(() => {

      const total =
        machines.length;

      const healthy =
        machines.filter(
          (machine) =>
            getDisplayedHealth(
              machine
            ) >= 80
        ).length;

      const attention =
        machines.filter(
          (machine) => {
            const machineHealth =
              getDisplayedHealth(
                machine
              );

            return (
              machineHealth >= 60 &&
              machineHealth < 80
            );
          }
        ).length;

      const critical =
        machines.filter(
          (machine) =>
            getDisplayedHealth(
              machine
            ) < 60
        ).length;

      const averageHealth =
        total > 0
          ? machines.reduce(
              (
                sum,
                machine
              ) =>
                sum +
                getDisplayedHealth(
                  machine
                ),
              0
            ) / total
          : 0;

      return {
        total,
        healthy,
        attention,
        critical,
        averageHealth,
      };

    }, [
      machines,
    ]);


  /* ==========================================================
     SELECTED MACHINE
  ========================================================== */

  const selectedMachine =
    machines.find(
      (machine) =>
        machine.id ===
        selectedMachineId
    ) || machines[0];


  /* ==========================================================
     FETCH MAINTENANCE RECOMMENDATIONS
  ========================================================== */

  useEffect(() => {

    if (
      !selectedMachine?.id
    ) {
      return;
    }

    let cancelled = false;

    const loadMaintenanceRecommendation =
      async () => {

        try {

          setMaintenanceRecommendationLoading(
            true
          );

          setMaintenanceRecommendationError(
            null
          );

          const result =
            await getMaintenanceRecommendations(
              selectedMachine.id,
              true
            );

          if (
            !cancelled
          ) {

            setMaintenanceRecommendation(
              result
            );

          }

        } catch (
          requestError
        ) {

          if (
            !cancelled
          ) {

            setMaintenanceRecommendationError(
              requestError instanceof Error
                ? requestError.message
                : "Unable to load maintenance recommendations."
            );

            setMaintenanceRecommendation(
              null
            );

          }

        } finally {

          if (
            !cancelled
          ) {

            setMaintenanceRecommendationLoading(
              false
            );

          }

        }

      };


    void loadMaintenanceRecommendation();


    const interval =
      window.setInterval(
        () => {
          void loadMaintenanceRecommendation();
        },
        10000
      );


    return () => {

      cancelled = true;

      window.clearInterval(
        interval
      );

    };

  }, [
    selectedMachine?.id,
  ]);


  /* ==========================================================
     FETCH AI CONDITION
  ========================================================== */

  useEffect(() => {

    if (
      !selectedMachine?.id
    ) {
      return;
    }

    let cancelled = false;

    const loadAICondition =
      async () => {

        try {

          setAiConditionLoading(
            true
          );

          setAiConditionError(
            null
          );

          const result =
            await getAICondition(
              selectedMachine.id
            );

          if (
            cancelled
          ) {
            return;
          }

          setAiCondition(
            result as AIConditionResponse
          );

        } catch (
          requestError
        ) {

          if (
            !cancelled
          ) {

            setAiConditionError(
              requestError instanceof Error
                ? requestError.message
                : "Unable to load AI condition."
            );

          }

        } finally {

          if (
            !cancelled
          ) {

            setAiConditionLoading(
              false
            );

          }

        }

      };


    void loadAICondition();


    const interval =
      window.setInterval(
        () => {
          void loadAICondition();
        },
        3000
      );


    return () => {

      cancelled = true;

      window.clearInterval(
        interval
      );

    };

  }, [
    selectedMachine?.id,
  ]);


  /* ==========================================================
     LOADING
  ========================================================== */

  if (loading) {

    return (
      <main className="min-h-full bg-[#F7FAF8] p-5 md:p-7">

        <div className="flex min-h-[60vh] items-center justify-center">

          <div className="text-center">

            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-emerald-100 border-t-emerald-500" />

            <p className="mt-4 text-sm font-semibold text-[#15211B]">
              Loading Digital Twins
            </p>

            <p className="mt-1 text-[10px] text-slate-400">
              Connecting to live factory telemetry...
            </p>

          </div>

        </div>

      </main>
    );
  }


  /* ==========================================================
     ERROR
  ========================================================== */

  if (
    error &&
    machines.length === 0
  ) {

    return (
      <main className="min-h-full bg-[#F7FAF8] p-5 md:p-7">

        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">

          <div className="flex items-center gap-3">

            <AlertTriangle
              size={20}
              className="text-red-500"
            />

            <div>

              <p className="text-sm font-bold text-red-700">
                Digital Twin unavailable
              </p>

              <p className="mt-1 text-xs text-red-600">
                {error}
              </p>

            </div>

          </div>

          <button
            type="button"
            onClick={() =>
              void refresh()
            }
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white"
          >
            Retry Connection
          </button>

        </div>

      </main>
    );
  }


  /* ==========================================================
     NO MACHINE
  ========================================================== */

  if (
    !selectedMachine
  ) {

    return (
      <main className="min-h-full bg-[#F7FAF8] p-5 md:p-7">

        <div className="rounded-2xl border border-[#DCE8E1] bg-white p-8 text-center">

          <p className="text-sm font-semibold text-slate-500">
            No machines available.
          </p>

        </div>

      </main>
    );
  }


  /* ==========================================================
     MACHINE HEALTH
  ========================================================== */

  const health =
    getDisplayedHealth(
      selectedMachine
    );


  const aiHealth =
    getAIHealthScore(
      aiCondition,
      selectedMachine
    );


  /* ==========================================================
     AI DATA
  ========================================================== */

  const degradation =
    aiCondition?.degradation;


  const predictive =
    aiCondition?.predictive_failure;


  const rul =
    aiCondition?.rul;


  const riskLevel =
    String(
      predictive?.risk_level ||
      "UNKNOWN"
    ).toUpperCase();


  const riskScore =
    predictive?.risk_score != null
      ? Number(
          predictive.risk_score
        )
      : 0;


  const riskPercentage =
    clamp(
      riskScore * 100
    );


  const probability30 =
    Number(
      predictive?.probability?.[
        "30m"
      ] ?? 0
    ) * 100;


  const probability60 =
    Number(
      predictive?.probability?.[
        "60m"
      ] ?? 0
    ) * 100;


  const probability120 =
    Number(
      predictive?.probability?.[
        "120m"
      ] ?? 0
    ) * 100;


  /* ==========================================================
     LIVE TELEMETRY
  ========================================================== */

  const temperature =
    aiCondition?.telemetry?.Temperature ??
    selectedMachine.temperature;


  const pressure =
    aiCondition?.telemetry?.Pressure ??
    selectedMachine.pressure;


  const vibration =
    aiCondition?.telemetry?.Vibration ??
    selectedMachine.vibration;


  const power =
    aiCondition?.telemetry?.Power ??
    selectedMachine.power;


  /* ==========================================================
     RUL
  ========================================================== */

  const aiRul =
    rul?.available &&
    rul.remaining_useful_life_hours != null
      ? Number(
          rul.remaining_useful_life_hours
        )
      : null;


  const machineRul =
    Number(
      selectedMachine.remaining_useful_life
    );

  const displayedRul =
    aiRul ??
    (
      Number.isFinite(
        machineRul
      )
        ? machineRul
        : null
    );


  const rulUnit =
    aiRul != null
      ? "hours"
      : "cycles";


  const aiConditionStatus =
    String(
      degradation?.condition ||
      "UNKNOWN"
    ).toUpperCase();


  /* ==========================================================
     PAGE
  ========================================================== */

  return (
    <main className="min-h-full bg-[#F7FAF8] p-4 md:p-6 lg:p-7">

      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

        <div>

          <div className="flex items-center gap-2">

            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <Activity size={16} />
            </div>

            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-700">
              Digital Twin
            </p>

            <span
              className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[7px] font-bold uppercase tracking-wider ${
                live
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >

              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  live
                    ? "bg-emerald-500"
                    : "bg-amber-400"
                }`}
              />

              {live
                ? "Live"
                : "Fallback"}

            </span>

          </div>


          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#15211B] md:text-3xl">
            Digital Twins
          </h1>


          <p className="mt-1 text-[11px] text-slate-400">
            Live digital representation of CarbonTwin factory assets
          </p>

        </div>


        <div className="flex items-center gap-2">

          <div className="flex items-center gap-2 rounded-lg border border-[#DCE8E1] bg-white px-3 py-2">

            <Clock3
              size={12}
              className="text-slate-400"
            />

            <span className="text-[8px] font-semibold text-slate-500">
              Live telemetry
            </span>

          </div>


          <button
            type="button"
            onClick={() =>
              void refresh()
            }
            className="rounded-lg border border-[#DCE8E1] bg-white px-3 py-2 text-[8px] font-bold text-slate-500 transition hover:border-emerald-300 hover:text-emerald-700"
          >
            Refresh
          </button>

        </div>

      </div>


      {/* ======================================================
          MACHINE FILTER BAR
      ====================================================== */}

      <section className="mb-5 rounded-xl border border-[#DCE8E1] bg-white p-3">

        <div className="flex flex-col gap-3 lg:flex-row">

          <div className="relative min-w-0 flex-1">

            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search machines..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-[10px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white"
            />

          </div>


          <div className="flex flex-wrap gap-1.5">

            {departments.map(
              (item) => (

                <button
                  key={item}
                  type="button"
                  onClick={() =>
                    setDepartment(
                      item
                    )
                  }
                  className={`rounded-lg px-3 py-2 text-[8px] font-bold transition ${
                    department === item
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-50 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"
                  }`}
                >
                  {item}
                </button>

              )
            )}

          </div>

        </div>

      </section>


      {/* ======================================================
          FLEET SNAPSHOT
      ====================================================== */}

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">

        <div className="rounded-xl border border-[#DCE8E1] bg-white p-4">

          <div className="flex items-center justify-between">

            <p className="text-[8px] font-bold uppercase tracking-[0.13em] text-slate-400">
              Fleet Health
            </p>

            <Gauge
              size={14}
              className="text-emerald-600"
            />

          </div>

          <p
            className={`mt-2 text-xl font-extrabold ${getHealthColor(
              fleetSummary.averageHealth
            )}`}
          >
            {fleetSummary.averageHealth.toFixed(1)}%
          </p>

          <p className="mt-1 text-[8px] text-slate-400">
            Average twin health
          </p>

        </div>


        <div className="rounded-xl border border-emerald-100 bg-white p-4">

          <div className="flex items-center justify-between">

            <p className="text-[8px] font-bold uppercase tracking-[0.13em] text-slate-400">
              Healthy
            </p>

            <CheckCircle2
              size={14}
              className="text-emerald-600"
            />

          </div>

          <p className="mt-2 text-xl font-extrabold text-emerald-600">
            {fleetSummary.healthy}
          </p>

          <p className="mt-1 text-[8px] text-slate-400">
            ≥ 80% twin health
          </p>

        </div>


        <div className="rounded-xl border border-amber-100 bg-white p-4">

          <div className="flex items-center justify-between">

            <p className="text-[8px] font-bold uppercase tracking-[0.13em] text-slate-400">
              Attention
            </p>

            <AlertTriangle
              size={14}
              className="text-amber-500"
            />

          </div>

          <p className="mt-2 text-xl font-extrabold text-amber-600">
            {fleetSummary.attention}
          </p>

          <p className="mt-1 text-[8px] text-slate-400">
            60–79.9% twin health
          </p>

        </div>


        <div className="rounded-xl border border-red-100 bg-white p-4">

          <div className="flex items-center justify-between">

            <p className="text-[8px] font-bold uppercase tracking-[0.13em] text-slate-400">
              Critical
            </p>

            <AlertTriangle
              size={14}
              className="text-red-500"
            />

          </div>

          <p className="mt-2 text-xl font-extrabold text-red-600">
            {fleetSummary.critical}
          </p>

          <p className="mt-1 text-[8px] text-slate-400">
            &lt; 60% twin health
          </p>

        </div>

      </section>


      {/* ======================================================
          MACHINE LIST
      ====================================================== */}

      <section className="mb-5">

        <div className="mb-3 flex items-center justify-between">

          <div>

            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Factory Assets
            </p>

            <p className="mt-1 text-sm font-extrabold text-[#15211B]">
              {filteredMachines.length} machines
            </p>

          </div>


          <span className="text-[8px] text-slate-400">
            Source: CarbonTwin dataset
          </span>

        </div>


        {filteredMachines.length === 0 ? (

          <div className="rounded-xl border border-dashed border-[#DCE8E1] bg-white p-8 text-center">

            <p className="text-xs font-semibold text-slate-500">
              No matching machines
            </p>

          </div>

        ) : (

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">

            {filteredMachines.map(
              (machine) => (

                <MachineCard
                  key={machine.id}
                  machine={machine}
                  selected={
                    machine.id ===
                    selectedMachine.id
                  }
                  onSelect={() =>
                    selectMachine(
                      machine.id
                    )
                  }
                />

              )
            )}

          </div>

        )}

      </section>


      {/* ======================================================
          SELECTED DIGITAL TWIN
      ====================================================== */}

      <section className="rounded-2xl border border-[#DCE8E1] bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.025)] md:p-5">

        {/* ====================================================
            MACHINE HEADER
        ==================================================== */}

        <div className="flex flex-col gap-4 border-b border-[#E7EEE9] pb-5 lg:flex-row lg:items-start lg:justify-between">

          <div>

            <div className="flex items-center gap-2">

              <span className="rounded-md bg-emerald-50 px-2 py-1 text-[7px] font-bold uppercase tracking-wider text-emerald-700">
                Digital Twin Active
              </span>

              <span className="text-[8px] text-slate-400">
                {selectedMachine.type}
              </span>

            </div>


            <h2 className="mt-2 text-xl font-extrabold text-[#15211B]">
              {selectedMachine.name}
            </h2>


            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-slate-400">

              <span>
                {selectedMachine.id}
              </span>

              <span className="flex items-center gap-1">

                <MapPin size={9} />

                {selectedMachine.location}

              </span>

              <span>
                {selectedMachine.department}
              </span>

            </div>

          </div>


          <div className="flex flex-wrap items-center gap-2">

            <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[8px] font-bold text-emerald-700">

              <CheckCircle2 size={11} />

              Online

            </span>


            <span
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[8px] font-bold ${
                predictive?.available
                  ? "border-violet-200 bg-violet-50 text-violet-700"
                  : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
            >

              <BrainCircuit size={11} />

              {predictive?.available
                ? "AI Predictive Ready"
                : "AI Predictive Pending"}

            </span>


            <span
              className={`rounded-full border px-2.5 py-1.5 text-[8px] font-bold ${
                selectedMachine.maintenance_status ===
                "Needs Attention"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
            >
              {selectedMachine.maintenance_status}
            </span>


            <button
              type="button"
              onClick={() =>
                setMachineControlOpen(
                  true
                )
              }
              className="flex items-center gap-1.5 rounded-lg bg-[#15211B] px-3 py-2 text-[8px] font-bold text-white transition hover:bg-emerald-700"
            >

              <Settings2 size={11} />

              Open Machine Control

            </button>

          </div>

        </div>


        {/* ====================================================
            HEALTH OVERVIEW
        ==================================================== */}

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">

          <HealthCard
            title="Digital Twin Health"
            subtitle="Current machine state"
            value={health}
            icon={Gauge}
          />


          <HealthCard
            title="AI Health Score"
            subtitle={
              aiCondition
                ? "AI condition assessment"
                : "Waiting for AI analysis"
            }
            value={aiHealth}
            icon={BrainCircuit}
          />


          <div className="rounded-xl border border-[#DCE8E1] bg-[#FAFCFB] p-4">

            <div className="flex items-start justify-between">

              <div>

                <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Remaining Useful Life
                </p>


                <p className="mt-2 text-2xl font-extrabold text-[#15211B]">

                  {displayedRul != null
                    ? displayedRul.toLocaleString(
                        undefined,
                        {
                          maximumFractionDigits: 1,
                        }
                      )
                    : "—"}

                </p>


                <p className="mt-0.5 text-[8px] text-slate-400">
                  {rulUnit}
                </p>

              </div>


              <Clock3
                size={18}
                className="text-slate-400"
              />

            </div>

          </div>

        </div>


        {/* ====================================================
            HEALTH SCORE EXPLANATION
        ==================================================== */}

        <div className="mt-3 rounded-lg border border-violet-100 bg-violet-50/40 px-4 py-3">

          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-violet-600">
                Health Interpretation
              </p>

              <p className="mt-1 text-[9px] leading-5 text-slate-600">

                Digital Twin Health reflects the current machine
                state, while AI Health Score incorporates the AI
                condition and predictive analysis.

              </p>

            </div>

            {aiConditionLoading && (
              <span className="shrink-0 text-[8px] font-semibold text-violet-500">
                AI updating...
              </span>
            )}

          </div>

        </div>


        {/* ====================================================
            TWIN INTERPRETATION
        ==================================================== */}

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">

          <div className="rounded-lg border border-slate-200 bg-white p-3">

            <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Twin State
            </p>

            <p className="mt-1 text-sm font-extrabold text-[#15211B]">
              {health >= 80
                ? "Stable"
                : health >= 60
                  ? "Watch"
                  : "Intervention Required"}
            </p>

            <p className="mt-1 text-[8px] leading-4 text-slate-400">
              Based on the current Digital Twin health score.
            </p>

          </div>


          <div className="rounded-lg border border-slate-200 bg-white p-3">

            <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Predictive State
            </p>

            <p className="mt-1 text-sm font-extrabold text-[#15211B]">
              {predictive?.available
                ? `${riskLevel} risk`
                : "Awaiting history"}
            </p>

            <p className="mt-1 text-[8px] leading-4 text-slate-400">
              {predictive?.available
                ? "Derived from the multi-horizon failure prediction."
                : "The predictive model needs sufficient live telemetry."}
            </p>

          </div>


          <div className="rounded-lg border border-slate-200 bg-white p-3">

            <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Degradation State
            </p>

            <p className="mt-1 text-sm font-extrabold text-[#15211B]">
              {aiConditionStatus}
            </p>

            <p className="mt-1 text-[8px] leading-4 text-slate-400">
              {degradation?.explanation ||
                "AI degradation analysis will appear when available."}
            </p>

          </div>

        </div>


        {/* ====================================================
            LIVE SENSORS
        ==================================================== */}

        <div className="mt-6">

          <div className="mb-3 flex items-center justify-between">

            <div>

              <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-slate-400">
                Live Telemetry
              </p>

              <h3 className="mt-1 text-sm font-extrabold text-[#15211B]">
                Machine Sensor Data
              </h3>

            </div>


            <span className="flex items-center gap-1 text-[8px] text-emerald-600">

              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

              Updating live

            </span>

          </div>


          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">

            <SensorCard
              icon={Thermometer}
              label="Temperature"
              value={Number(
                temperature
              ).toFixed(1)}
              unit="°C"
            />


            <SensorCard
              icon={Gauge}
              label="Pressure"
              value={Number(
                pressure
              ).toFixed(2)}
              unit="bar"
            />


            <SensorCard
              icon={Waves}
              label="Vibration"
              value={Number(
                vibration
              ).toFixed(2)}
              unit="mm/s"
            />


            <SensorCard
              icon={Activity}
              label="RPM"
              value={Number(
                selectedMachine.rpm
              ).toLocaleString()}
            />


            <SensorCard
              icon={Gauge}
              label="Torque"
              value={Number(
                selectedMachine.torque
              ).toFixed(1)}
              unit="Nm"
            />


            <SensorCard
              icon={Zap}
              label="Power"
              value={Number(
                power
              ).toFixed(1)}
              unit="kW"
            />

          </div>

        </div>


        {/* ====================================================
            RESOURCE FOOTPRINT
        ==================================================== */}

        <div className="mt-6">

          <div className="mb-3">

            <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-slate-400">
              Sustainability
            </p>

            <h3 className="mt-1 text-sm font-extrabold text-[#15211B]">
              Resource Footprint
            </h3>

          </div>


          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

            <SensorCard
              icon={Zap}
              label="Energy"
              value={Number(
                selectedMachine.energy
              ).toFixed(1)}
              unit="kWh"
            />


            <SensorCard
              icon={Activity}
              label="Carbon"
              value={Number(
                selectedMachine.carbon
              ).toFixed(1)}
              unit="kg CO₂e"
            />


            <SensorCard
              icon={Waves}
              label="Water"
              value={Number(
                selectedMachine.water
              ).toFixed(1)}
              unit="L"
            />


            <SensorCard
              icon={Zap}
              label="Efficiency"
              value={Number(
                selectedMachine.efficiency
              ).toFixed(1)}
              unit="%"
            />

          </div>

        </div>


        {/* ====================================================
            AI CONDITION STATUS
        ==================================================== */}

        <div className="mt-6 rounded-xl border border-[#DCE8E1] bg-[#FAFCFB] p-4">

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

            <div className="flex items-start gap-3">

              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <BrainCircuit size={17} />
              </div>


              <div>

                <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-slate-400">
                  AI Condition Analysis
                </p>

                <h3 className="mt-1 text-sm font-extrabold text-[#15211B]">
                  Machine Condition
                </h3>

              </div>

            </div>


            <div className="flex flex-wrap items-center gap-2">

              <span
                className={`rounded-full border px-2.5 py-1 text-[8px] font-bold ${getConditionColor(
                  aiConditionStatus
                )}`}
              >
                {aiConditionStatus}
              </span>


              {aiConditionLoading && (
                <span className="text-[8px] text-slate-400">
                  Updating...
                </span>
              )}

            </div>

          </div>


          {aiConditionError ? (

            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">

              <p className="text-[9px] font-semibold text-amber-700">
                AI condition temporarily unavailable
              </p>

              <p className="mt-1 text-[9px] text-amber-600">
                {aiConditionError}
              </p>

            </div>

          ) : aiCondition ? (

            <>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">

                <div className="rounded-lg border border-violet-100 bg-violet-50/50 p-3">

                  <p className="text-[8px] text-violet-500">
                    AI Health Score
                  </p>

                  <p
                    className={`mt-1 text-xl font-extrabold ${getHealthColor(
                      aiHealth
                    )}`}
                  >
                    {aiHealth.toFixed(1)}%
                  </p>

                </div>


                <div className="rounded-lg border border-slate-200 bg-white p-3">

                  <p className="text-[8px] text-slate-400">
                    Condition
                  </p>

                  <p className="mt-1 text-lg font-extrabold text-[#15211B]">
                    {aiConditionStatus}
                  </p>

                </div>


                <div className="rounded-lg border border-slate-200 bg-white p-3">

                  <p className="text-[8px] text-slate-400">
                    History Points
                  </p>

                  <p className="mt-1 text-lg font-extrabold text-[#15211B]">

                    {Number(
                      degradation?.history_points ??
                      0
                    )}

                  </p>

                </div>

              </div>


              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">

                <div className="rounded-lg border border-slate-200 bg-white p-3">

                  <p className="text-[8px] text-slate-400">
                    Current Deviation
                  </p>

                  <p className="mt-1 text-lg font-extrabold text-[#15211B]">

                    {Number(
                      degradation?.current_deviation ??
                      0
                    ).toFixed(2)}

                  </p>

                </div>


                <div className="rounded-lg border border-slate-200 bg-white p-3">

                  <p className="text-[8px] text-slate-400">
                    Maximum Deviation
                  </p>

                  <p className="mt-1 text-lg font-extrabold text-[#15211B]">

                    {Number(
                      degradation?.maximum_deviation ??
                      0
                    ).toFixed(2)}

                  </p>

                </div>


                <div className="rounded-lg border border-slate-200 bg-white p-3">

                  <p className="text-[8px] text-slate-400">
                    Deviation Trend
                  </p>

                  <p className="mt-1 text-lg font-extrabold text-[#15211B]">

                    {Number(
                      degradation?.deviation_trend ??
                      0
                    ).toFixed(3)}

                  </p>

                </div>


                <div className="rounded-lg border border-slate-200 bg-white p-3">

                  <p className="text-[8px] text-slate-400">
                    Signals Requiring Attention
                  </p>

                  <p className="mt-1 text-lg font-extrabold text-[#15211B]">

                    {Number(
                      degradation?.attention_signal_count ??
                      0
                    )}

                  </p>

                </div>

              </div>


              <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4">

                <div className="flex items-center gap-2">

                  <BrainCircuit
                    size={13}
                    className="text-violet-500"
                  />

                  <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    AI Assessment
                  </p>

                </div>


                <p className="mt-2 text-[10px] leading-5 text-slate-600">

                  {degradation?.explanation ||
                    predictive?.reason ||
                    "The AI condition service has completed its analysis."}

                </p>

              </div>


              {degradation?.dominant_signals &&
                degradation.dominant_signals.length >
                  0 && (

                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4">

                  <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    Dominant Signals
                  </p>


                  <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">

                    {degradation.dominant_signals
                      .slice(0, 4)
                      .map(
                        (signal) => (

                          <div
                            key={signal.signal}
                            className="rounded-lg bg-[#FAFCFB] p-3"
                          >

                            <p className="text-[8px] font-bold text-slate-500">
                              {signal.signal}
                            </p>

                            <p className="mt-1 text-sm font-extrabold text-[#15211B]">

                              {Number(
                                signal.deviation
                              ).toFixed(2)}

                            </p>

                            <p className="mt-0.5 text-[8px] text-slate-400">

                              {signal.position ||
                                "deviation"}

                            </p>

                          </div>

                        )
                      )}

                  </div>

                </div>

              )}

            </>

          ) : (

            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">

              <p className="text-[10px] font-semibold text-slate-500">
                Loading AI condition analysis...
              </p>

            </div>

          )}

        </div>


        {/* ====================================================
            AI PREDICTION
        ==================================================== */}

        <div className="mt-6 rounded-xl border border-[#DCE8E1] bg-[#FAFCFB] p-4">

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

            <div className="flex items-start gap-3">

              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <BrainCircuit size={17} />
              </div>


              <div>

                <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-slate-400">
                  AI Predictive Analysis
                </p>

                <h3 className="mt-1 text-sm font-extrabold text-[#15211B]">
                  Failure Prediction
                </h3>

              </div>

            </div>


            <span
              className={`rounded-full border px-2.5 py-1 text-[8px] font-bold ${getRiskColor(
                riskLevel
              )}`}
            >
              {riskLevel}
            </span>

          </div>


          {!predictive ? (

            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">

              <p className="text-[10px] font-semibold text-slate-600">
                Predictive analysis unavailable
              </p>

              <p className="mt-1 text-[9px] leading-4 text-slate-400">
                Waiting for the AI condition service.
              </p>

            </div>

          ) : predictive.available === false ? (

            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">

              <p className="text-[10px] font-semibold text-slate-600">
                Predictive analysis collecting telemetry
              </p>

              <p className="mt-1 text-[9px] leading-4 text-slate-400">
                {predictive.reason ||
                  "Historical telemetry is required for predictive analysis."}
              </p>

            </div>

          ) : (

            <>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">

                <div className="rounded-lg border border-slate-200 bg-white p-3">

                  <p className="text-[8px] text-slate-400">
                    Overall Risk
                  </p>

                  <p className="mt-1 text-xl font-extrabold text-[#15211B]">
                    {riskPercentage.toFixed(1)}%
                  </p>


                  <div className="mt-2 h-1.5 rounded-full bg-slate-100">

                    <div
                      className={`h-full rounded-full ${
                        riskLevel ===
                        "CRITICAL"
                          ? "bg-red-500"
                          : riskLevel ===
                              "HIGH"
                            ? "bg-orange-400"
                            : riskLevel ===
                                "MEDIUM"
                              ? "bg-amber-400"
                              : "bg-emerald-500"
                      }`}
                      style={{
                        width: `${riskPercentage}%`,
                      }}
                    />

                  </div>

                </div>


                <div className="rounded-lg border border-slate-200 bg-white p-3">

                  <p className="text-[8px] text-slate-400">
                    Next 30m
                  </p>

                  <p className="mt-1 text-lg font-extrabold text-[#15211B]">
                    {probability30.toFixed(1)}%
                  </p>

                </div>


                <div className="rounded-lg border border-slate-200 bg-white p-3">

                  <p className="text-[8px] text-slate-400">
                    Next 60m
                  </p>

                  <p className="mt-1 text-lg font-extrabold text-[#15211B]">
                    {probability60.toFixed(1)}%
                  </p>

                </div>


                <div className="rounded-lg border border-slate-200 bg-white p-3">

                  <p className="text-[8px] text-slate-400">
                    Next 120m
                  </p>

                  <p className="mt-1 text-lg font-extrabold text-[#15211B]">
                    {probability120.toFixed(1)}%
                  </p>

                </div>

              </div>


              <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4">

                <div className="flex items-center gap-2">

                  <BrainCircuit
                    size={13}
                    className="text-violet-500"
                  />

                  <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    AI Assessment
                  </p>

                </div>


                <p className="mt-2 text-[10px] leading-5 text-slate-600">

                  {predictive.reason ||
                    "The predictive model has completed its analysis."}

                </p>

              </div>


              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">

                <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                  Recommended Action
                </p>

                <p className="mt-2 text-[10px] leading-5 text-slate-600">

                  {predictive.recommended_action ||
                    "Continue monitoring machine condition."}

                </p>

              </div>

            </>

          )}

        </div>


        {/* ====================================================
            RUL DETAILS
        ==================================================== */}

        {rul && (

          <div className="mt-6 rounded-xl border border-[#DCE8E1] bg-white p-4">

            <div className="flex items-center gap-3">

              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Clock3 size={16} />
              </div>

              <div>

                <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-slate-400">
                  Explainable AI
                </p>

                <p className="mt-1 text-sm font-extrabold text-[#15211B]">
                  Remaining Useful Life
                </p>

              </div>

            </div>


            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">

              <div className="rounded-lg bg-[#FAFCFB] p-3">

                <p className="text-[8px] text-slate-400">
                  Estimated Life
                </p>

                <p className="mt-1 text-xl font-extrabold text-[#15211B]">

                  {aiRul != null
                    ? aiRul.toFixed(1)
                    : "—"}

                </p>

                <p className="mt-0.5 text-[8px] text-slate-400">
                  hours
                </p>

              </div>


              <div className="rounded-lg bg-[#FAFCFB] p-3">

                <p className="text-[8px] text-slate-400">
                  Confidence
                </p>

                <p className="mt-1 text-xl font-extrabold text-[#15211B]">

                  {(
                    Number(
                      rul.confidence ??
                      0
                    ) * 100
                  ).toFixed(1)}

                  %

                </p>

              </div>


              <div className="rounded-lg bg-[#FAFCFB] p-3">

                <p className="text-[8px] text-slate-400">
                  Status
                </p>

                <p className="mt-1 text-xl font-extrabold text-[#15211B]">

                  {rul.status ||
                    "UNKNOWN"}

                </p>

              </div>

            </div>


            {rul.reason && (

              <div className="mt-3 rounded-lg border border-slate-200 bg-[#FAFCFB] p-3">

                <p className="text-[9px] leading-5 text-slate-500">
                  {rul.reason}
                </p>

              </div>

            )}

          </div>

        )}


        {/* ====================================================
            AI MAINTENANCE RECOMMENDATION
        ==================================================== */}

        <div className="mt-6 rounded-xl border border-[#DCE8E1] bg-[#FAFCFB] p-4">

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

            <div className="flex items-start gap-3">

              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <BrainCircuit size={17} />
              </div>

              <div>

                <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-slate-400">
                  AI Maintenance Intelligence
                </p>

                <h3 className="mt-1 text-sm font-extrabold text-[#15211B]">
                  Maintenance Recommendation
                </h3>

              </div>

            </div>


            {maintenanceRecommendation?.maintenance_problem?.severity && (

              <span
                className={`rounded-full border px-2.5 py-1 text-[8px] font-bold ${
                  String(
                    maintenanceRecommendation
                      .maintenance_problem
                      .severity
                  ).toLowerCase() ===
                  "critical"

                    ? "border-red-200 bg-red-50 text-red-700"

                    : String(
                        maintenanceRecommendation
                          .maintenance_problem
                          .severity
                      ).toLowerCase() ===
                      "high"

                      ? "border-orange-200 bg-orange-50 text-orange-700"

                      : String(
                          maintenanceRecommendation
                            .maintenance_problem
                            .severity
                        ).toLowerCase() ===
                        "medium"

                        ? "border-amber-200 bg-amber-50 text-amber-700"

                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {
                  maintenanceRecommendation
                    .maintenance_problem
                    .severity
                }
              </span>

            )}

          </div>


          {maintenanceRecommendationLoading && (

            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">

              <p className="text-[10px] text-slate-500">
                Loading maintenance recommendation...
              </p>

            </div>

          )}


          {maintenanceRecommendationError &&
            !maintenanceRecommendationLoading && (

              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">

                <p className="text-[9px] font-semibold text-amber-700">
                  Maintenance recommendation temporarily unavailable
                </p>

                <p className="mt-1 text-[9px] text-amber-600">
                  {maintenanceRecommendationError}
                </p>

              </div>

            )}


          {maintenanceRecommendation &&
            !maintenanceRecommendationLoading && (

              <>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">

                  <div className="rounded-lg border border-slate-200 bg-white p-3 md:col-span-2">

                    <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Maintenance Problem
                    </p>

                    <div className="mt-2 space-y-1">

                      {maintenanceRecommendation
                        .maintenance_problem
                        .problems
                        .map(
                          (
                            problem,
                            index
                          ) => (

                            <p
                              key={`${problem}-${index}`}
                              className="text-[10px] leading-5 text-slate-600"
                            >
                              • {problem}
                            </p>

                          )
                        )}

                    </div>

                  </div>


                  <div className="rounded-lg border border-slate-200 bg-white p-3">

                    <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Required Skills
                    </p>

                    <div className="mt-2 flex flex-wrap gap-1.5">

                      {(
                        maintenanceRecommendation
                          ?.required_skills ??
                        []
                      ).map(
                        (skill) => (

                          <span
                            key={skill}
                            className="rounded-md bg-emerald-50 px-2 py-1 text-[8px] font-semibold text-emerald-700"
                          >
                            {skill}
                          </span>

                        )
                      )}

                    </div>

                  </div>

                </div>


                <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">

                  <div className="flex items-center justify-between gap-3">

                    <div>

                      <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                        Recommended Engineer
                      </p>

                      <p className="mt-1 text-sm font-extrabold text-[#15211B]">

                        {
                          maintenanceRecommendation
                            .recommended_engineer
                            ?.technician ||
                          "No engineer recommended"
                        }

                      </p>

                    </div>


                    {maintenanceRecommendation
                      .recommended_engineer && (

                      <span className="rounded-full bg-white px-2.5 py-1 text-[8px] font-bold text-emerald-700">

                        {
                          maintenanceRecommendation
                            .recommended_engineer
                            .relevance
                        }

                      </span>

                    )}

                  </div>


                  {maintenanceRecommendation
                    .recommended_engineer && (

                    <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">

                      <div className="rounded-lg bg-white p-2.5">

                        <p className="text-[7px] text-slate-400">
                          Department
                        </p>

                        <p className="mt-1 text-[9px] font-bold text-slate-700">
                          {
                            maintenanceRecommendation
                              .recommended_engineer
                              .department
                          }
                        </p>

                      </div>


                      <div className="rounded-lg bg-white p-2.5">

                        <p className="text-[7px] text-slate-400">
                          Specialization
                        </p>

                        <p className="mt-1 text-[9px] font-bold text-slate-700">
                          {
                            maintenanceRecommendation
                              .recommended_engineer
                              .specialization
                          }
                        </p>

                      </div>


                      <div className="rounded-lg bg-white p-2.5">

                        <p className="text-[7px] text-slate-400">
                          Workload
                        </p>

                        <p className="mt-1 text-[9px] font-bold text-slate-700">

                          {
                            maintenanceRecommendation
                              .recommended_engineer
                              .current_workload
                          }
                          /
                          {
                            maintenanceRecommendation
                              .recommended_engineer
                              .max_workload
                          }

                        </p>

                      </div>


                      <div className="rounded-lg bg-white p-2.5">

                        <p className="text-[7px] text-slate-400">
                          Experience
                        </p>

                        <p className="mt-1 text-[9px] font-bold text-slate-700">

                          {
                            maintenanceRecommendation
                              .recommended_engineer
                              .experience_years
                          }

                          {" "}years

                        </p>

                      </div>

                    </div>

                  )}


                  {maintenanceRecommendation
                    .recommended_engineer
                    ?.evidence
                    ?.length ? (

                    <div className="mt-3">

                      {maintenanceRecommendation
                        .recommended_engineer
                        .evidence
                        .slice(0, 3)
                        .map(
                          (
                            item,
                            index
                          ) => (

                            <p
                              key={`${item}-${index}`}
                              className="text-[9px] leading-5 text-slate-600"
                            >
                              • {item}
                            </p>

                          )
                        )}

                    </div>

                  ) : null}

                </div>


                {maintenanceRecommendation
                  .recommendations
                  .length > 1 && (

                  <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4">

                    <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Alternative Engineers
                    </p>


                    <div className="mt-3 space-y-2">

                      {maintenanceRecommendation
                        .recommendations
                        .slice(1, 4)
                        .map(
                          (
                            engineer
                          ) => (

                            <div
                              key={
                                engineer.technician_id
                              }
                              className="flex flex-col gap-2 rounded-lg bg-[#FAFCFB] p-3 sm:flex-row sm:items-center sm:justify-between"
                            >

                              <div>

                                <p className="text-[9px] font-bold text-[#15211B]">
                                  {
                                    engineer.technician
                                  }
                                </p>

                                <p className="mt-0.5 text-[8px] text-slate-400">

                                  {
                                    engineer.specialization
                                  }

                                  {" • "}

                                  {
                                    engineer.department
                                  }

                                </p>

                              </div>

                              <span className="text-[8px] font-semibold text-emerald-700">
                                {
                                  engineer.relevance
                                }
                              </span>

                            </div>

                          )
                        )}

                    </div>

                  </div>

                )}


                {maintenanceRecommendation
                  .scoring_note && (

                  <p className="mt-3 text-[8px] leading-4 text-slate-400">
                    {
                      maintenanceRecommendation
                        .scoring_note
                    }
                  </p>

                )}

              </>

            )}

        </div>


        {/* ====================================================
            MAINTENANCE / ASSIGNMENT
        ==================================================== */}

        <div className="mt-6 rounded-xl border border-[#DCE8E1] bg-white p-4">

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-center gap-3">

              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <UserRound size={16} />
              </div>

              <div>

                <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-slate-400">
                  Maintenance
                </p>

                <p className="mt-1 text-sm font-extrabold text-[#15211B]">
                  Current Work Assignment
                </p>

              </div>

            </div>


            <div className="flex items-center gap-2">

              {maintenanceRecommendation?.recommended_engineer && (

                <button
                  type="button"
                  disabled={
                    assignmentLoading
                  }
                  onClick={async () => {

                    const engineer =
                      maintenanceRecommendation
                        .recommended_engineer;

                    if (!engineer) {
                      return;
                    }

                    try {

                      setAssignmentLoading(
                        true
                      );

                      setAssignmentError(
                        null
                      );

                      setAssignmentMessage(
                        null
                      );


                      const result =
                        await assignMaintenanceEngineer(
                          selectedMachine.id,
                          engineer.technician_id
                        );


                      setAssignmentMessage(
                        result.success
                          ? `Maintenance assigned to ${
                              result.technician
                                ?.name ||
                              engineer.technician
                            }. Ticket ${
                              result.ticket?.id ||
                              "created"
                            } is now assigned.`
                          : `Unable to assign maintenance to ${engineer.technician}.`
                      );


                      clearApiCache();


                      await refresh();


                      const refreshedRecommendation =
                        await getMaintenanceRecommendations(
                          selectedMachine.id,
                          true
                        );


                      setMaintenanceRecommendation(
                        refreshedRecommendation
                      );

                    } catch (
                      requestError
                    ) {

                      setAssignmentError(
                        requestError instanceof Error
                          ? requestError.message
                          : "Unable to assign maintenance engineer."
                      );

                    } finally {

                      setAssignmentLoading(
                        false
                      );

                    }

                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[8px] font-bold transition ${
                    assignmentLoading
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                  }`}
                >

                  <UserRound size={11} />

                  {assignmentLoading
                    ? "Assigning..."
                    : selectedMachine.current_technician
                      ? "Reassign Engineer"
                      : "Assign Engineer"}

                </button>

              )}


              <button
                type="button"
                onClick={() =>
                  setMachineControlOpen(
                    true
                  )
                }
                className="flex items-center justify-center gap-1.5 rounded-lg border border-[#DCE8E1] bg-[#FAFCFB] px-3 py-2 text-[8px] font-bold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
              >

                <Settings2 size={11} />

                Machine Control

              </button>

            </div>

          </div>


          {assignmentMessage && (

            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">

              <p className="text-[9px] font-semibold text-emerald-700">
                {assignmentMessage}
              </p>

            </div>

          )}


          {assignmentError && (

            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">

              <p className="text-[9px] font-semibold text-red-700">
                {assignmentError}
              </p>

            </div>

          )}


          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">

            <div className="rounded-lg bg-[#FAFCFB] p-3">

              <p className="text-[8px] text-slate-400">
                Technician
              </p>

              <p className="mt-1 text-[10px] font-bold text-[#15211B]">
                {
                  selectedMachine.current_technician ||
                  "Not assigned"
                }
              </p>

            </div>


            <div className="rounded-lg bg-[#FAFCFB] p-3">

              <p className="text-[8px] text-slate-400">
                Ticket
              </p>

              <p className="mt-1 text-[10px] font-bold text-[#15211B]">
                {
                  selectedMachine.current_ticket ||
                  "No active ticket"
                }
              </p>

            </div>


            <div className="rounded-lg bg-[#FAFCFB] p-3">

              <p className="text-[8px] text-slate-400">
                Status
              </p>

              <p
                className={`mt-1 text-[10px] font-bold ${
                  selectedMachine.maintenance_status ===
                  "Operational"
                    ? "text-emerald-600"
                    : selectedMachine.maintenance_status ===
                        "Emergency Stop"
                      ? "text-red-600"
                      : "text-amber-600"
                }`}
              >
                {
                  selectedMachine
                    .maintenance_status ||
                  "Unknown"
                }
              </p>

            </div>

          </div>


          {maintenanceRecommendation
            ?.recommended_engineer && (

            <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/40 p-4">

              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                <div>

                  <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-emerald-600">
                    AI Recommended Engineer
                  </p>

                  <p className="mt-1 text-sm font-extrabold text-[#15211B]">
                    {
                      maintenanceRecommendation
                        .recommended_engineer
                        .technician
                    }
                  </p>

                  <p className="mt-0.5 text-[9px] text-slate-500">
                    {
                      maintenanceRecommendation
                        .recommended_engineer
                        .specialization
                    }
                  </p>

                </div>


                <div className="flex flex-wrap gap-1.5">

                  <span className="rounded-full bg-white px-2 py-1 text-[8px] font-bold text-emerald-700">
                    {
                      maintenanceRecommendation
                        .recommended_engineer
                        .relevance
                    }
                  </span>

                  <span className="rounded-full bg-white px-2 py-1 text-[8px] font-bold text-slate-600">
                    {
                      maintenanceRecommendation
                        .recommended_engineer
                        .availability
                    }
                  </span>

                </div>

              </div>


              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">

                <div className="rounded-md bg-white p-2">

                  <p className="text-[7px] text-slate-400">
                    Department
                  </p>

                  <p className="mt-0.5 text-[8px] font-bold text-slate-700">
                    {
                      maintenanceRecommendation
                        .recommended_engineer
                        .department
                    }
                  </p>

                </div>


                <div className="rounded-md bg-white p-2">

                  <p className="text-[7px] text-slate-400">
                    Experience
                  </p>

                  <p className="mt-0.5 text-[8px] font-bold text-slate-700">

                    {
                      maintenanceRecommendation
                        .recommended_engineer
                        .experience_years
                    }

                    {" "}years

                  </p>

                </div>


                <div className="rounded-md bg-white p-2">

                  <p className="text-[7px] text-slate-400">
                    Workload
                  </p>

                  <p className="mt-0.5 text-[8px] font-bold text-slate-700">

                    {
                      maintenanceRecommendation
                        .recommended_engineer
                        .current_workload
                    }

                    /

                    {
                      maintenanceRecommendation
                        .recommended_engineer
                        .max_workload
                    }

                  </p>

                </div>


                <div className="rounded-md bg-white p-2">

                  <p className="text-[7px] text-slate-400">
                    Department Match
                  </p>

                  <p className="mt-0.5 text-[8px] font-bold text-slate-700">

                    {
                      maintenanceRecommendation
                        .recommended_engineer
                        .same_department
                        ? "Yes"
                        : "No"
                    }

                  </p>

                </div>

              </div>


              {
                maintenanceRecommendation
                  .recommended_engineer
                  .evidence
                  ?.length > 0 && (

                <div className="mt-3">

                  <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">
                    Recommendation Evidence
                  </p>

                  <div className="mt-1">

                    {
                      maintenanceRecommendation
                        .recommended_engineer
                        .evidence
                        .slice(0, 4)
                        .map(
                          (
                            item,
                            index
                          ) => (

                            <p
                              key={`${item}-${index}`}
                              className="text-[8px] leading-5 text-slate-600"
                            >
                              • {item}
                            </p>

                          )
                        )
                    }

                  </div>

                </div>

              )}

            </div>

          )}


          {(maintenanceRecommendation
            ?.required_skills ??
            []).length > 0 && (

            <div className="mt-3">

              <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Required Skills
              </p>

              <div className="mt-2 flex flex-wrap gap-1.5">

                {(
                  maintenanceRecommendation
                    ?.required_skills ??
                  []
                ).map(
                  (skill) => (

                    <span
                      key={skill}
                      className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[8px] font-semibold text-slate-600"
                    >
                      {skill}
                    </span>

                  )
                )}

              </div>

            </div>

          )}


          <div className="mt-3 rounded-lg border border-[#DCE8E1] bg-[#FAFCFB] p-3">

            <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">
              AI Recommendation
            </p>

            <p className="mt-1 text-[9px] leading-5 text-slate-600">

              {
                maintenanceRecommendation
                  ?.maintenance_problem
                  ?.problems?.[0] ||
                predictive?.recommended_action ||
                "Continue monitoring."
              }

            </p>

          </div>

        </div>


        {/* ====================================================
            DIGITAL TWIN INTELLIGENCE NOTE
        ==================================================== */}

        <div className="mt-6 rounded-xl border border-violet-100 bg-violet-50/40 p-4">

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

            <div className="flex items-start gap-3">

              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-violet-600">
                <BrainCircuit size={15} />
              </div>

              <div>

                <p className="text-[8px] font-bold uppercase tracking-[0.13em] text-violet-600">
                  CarbonTwin Intelligence Layer
                </p>

                <p className="mt-1 text-[10px] leading-5 text-slate-600">
                  This twin combines live telemetry, current condition,
                  degradation evidence, multi-horizon failure prediction
                  and remaining useful life when the required history is available.
                </p>

              </div>

            </div>


            <div className="grid shrink-0 grid-cols-2 gap-2 text-center">

              <div className="rounded-md bg-white px-3 py-2">

                <p className="text-[7px] font-bold uppercase tracking-[0.1em] text-slate-400">
                  Horizons
                </p>

                <p className="mt-0.5 text-[9px] font-extrabold text-[#15211B]">
                  30m · 60m · 120m
                </p>

              </div>


              <div className="rounded-md bg-white px-3 py-2">

                <p className="text-[7px] font-bold uppercase tracking-[0.1em] text-slate-400">
                  Status
                </p>

                <p className="mt-0.5 text-[9px] font-extrabold text-emerald-700">
                  {live
                    ? "Live"
                    : "Fallback"}
                </p>

              </div>

            </div>

          </div>

        </div>


        {/* ====================================================
            HISTORICAL TELEMETRY
        ==================================================== */}

        <TelemetryHistoryChart
          machine={
            selectedMachine
          }
        />

      </section>


      {/* ======================================================
          MACHINE CONTROL MODAL
      ====================================================== */}

      {machineControlOpen && (

        <MachineControlPanel
          machine={
            selectedMachine
          }
          onClose={() =>
            setMachineControlOpen(
              false
            )
          }
        />

      )}

    </main>
  );
}