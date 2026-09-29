import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Cpu,
  ShieldAlert,
  UserRound,
  Wrench,
} from "lucide-react";

import { useMemo } from "react";

import { useMachines } from "../../../hooks/useMachines";

export default function MaintenancePanel() {
  const {
    machines,
    loading,
    error,
  } = useMachines();

  // ============================================================
  // CLASSIFY LIVE MACHINES
  // ============================================================

  const groups = useMemo(() => {
    const operational = [];
    const attention = [];
    const critical = [];

    for (const machine of machines) {
      const health = Number(
        machine.health_score ?? 0
      );

      const status =
        String(
          machine.maintenance_status ?? ""
        ).toLowerCase();

      if (
        status.includes("critical") ||
        status.includes("emergency") ||
        health < 50
      ) {
        critical.push(machine);
        continue;
      }

      if (
        status.includes("attention") ||
        status.includes("maintenance") ||
        status.includes("stopped") ||
        health < 75
      ) {
        attention.push(machine);
        continue;
      }

      operational.push(machine);
    }

    return {
      operational,
      attention,
      critical,
    };
  }, [machines]);

  // ============================================================
  // PRIORITY MACHINES
  // ============================================================

  const priorityMachines = useMemo(() => {
    return [...machines]
      .sort((a, b) => {
        const healthA = Number(
          a.health_score ?? 0
        );

        const healthB = Number(
          b.health_score ?? 0
        );

        return healthA - healthB;
      })
      .slice(0, 5);
  }, [machines]);

  // ============================================================
  // AVERAGE HEALTH
  // ============================================================

  const averageHealth = useMemo(() => {
    if (machines.length === 0) {
      return 0;
    }

    const total = machines.reduce(
      (sum, machine) =>
        sum +
        Number(
          machine.health_score ?? 0
        ),
      0
    );

    return total / machines.length;
  }, [machines]);

  // ============================================================
  // LOADING
  // ============================================================

  if (
    loading &&
    machines.length === 0
  ) {
    return <MaintenanceSkeleton />;
  }

  // ============================================================
  // ERROR
  // ============================================================

  if (
    error &&
    machines.length === 0
  ) {
    return (
      <section className="rounded-[18px] border border-[#DDE7E1] bg-white p-6 shadow-[0_4px_18px_rgba(15,23,42,0.03)]">

        <div className="flex items-center gap-3">

          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <AlertCircle size={18} />
          </div>

          <div>

            <h3 className="text-sm font-extrab800 text-[#15211B]">
              Maintenance Intelligence
            </h3>

            <p className="mt-1 text-[10px] text-red-500">
              Unable to load maintenance telemetry.
            </p>

          </div>

        </div>

        <div className="mt-4 rounded-xl border border-red-100 bg-red-50/50 p-3 text-[10px] text-red-600">
          {error}
        </div>

      </section>
    );
  }

  // ============================================================
  // MAIN
  // ============================================================

  return (
    <section className="overflow-hidden rounded-[20px] border border-[#DDE7E1] bg-white shadow-[0_4px_20px_rgba(15,23,42,0.035)]">

      {/* ========================================================
          HEADER
      ======================================================== */}

      <div className="border-b border-[#E5ECE8] px-5 py-5 md:px-7">

        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-[#EAF8F0] text-[#15803D]">
              <Wrench size={19} />
            </div>

            <div>

              <div className="flex items-center gap-2">

                <h2 className="text-[16px] font-extrab800 tracking-[-0.02em] text-[#15211B]">
                  Asset Reliability
                </h2>

                <span className="flex items-center gap-1.5 rounded-full border border-[#BCE7CE] bg-[#F0FBF4] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-[#15803D]">

                  <span className="relative flex h-1.5 w-1.5">

                    <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />

                    <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />

                  </span>

                  Live

                </span>

              </div>

              <p className="mt-1 text-[10px] text-[#7B8981]">
                Predictive maintenance status and intervention priorities
              </p>

            </div>

          </div>

          {/* SYSTEM HEALTH */}

          <div className="flex items-center gap-3 rounded-[12px] border border-[#E1E9E4] bg-[#F8FAF9] px-4 py-2.5">

            <div>

              <p className="text-[7px] font-bold uppercase tracking-[0.15em] text-[#94A19A]">
                Fleet Health
              </p>

              <p className="mt-0.5 text-[16px] font-extrab800 text-[#15211B]">
                {averageHealth.toFixed(1)}%
              </p>

            </div>

            <div className="h-8 w-px bg-[#DDE7E1]" />

            <div>

              <p className="text-[7px] font-bold uppercase tracking-[0.15em] text-[#94A19A]">
                Monitored
              </p>

              <p className="mt-0.5 text-[16px] font-extrab800 text-[#15211B]">
                {machines.length}
              </p>

            </div>

          </div>

        </div>

      </div>

      {/* ========================================================
          STATUS SUMMARY
      ======================================================== */}

      <div className="border-b border-[#E8EEE9] bg-[#FBFCFB] px-5 py-5 md:px-7">

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

          <StatusSummary
            label="Operational"
            count={groups.operational.length}
            description="Running within normal conditions"
            type="operational"
            icon={CheckCircle2}
          />

          <StatusSummary
            label="Needs Attention"
            count={groups.attention.length}
            description="Maintenance review recommended"
            type="attention"
            icon={AlertTriangle}
          />

          <StatusSummary
            label="Critical"
            count={groups.critical.length}
            description="Immediate intervention required"
            type="critical"
            icon={ShieldAlert}
          />

        </div>

      </div>

      {/* ========================================================
          MACHINE PRIORITIES
      ======================================================== */}

      <div className="bg-[#F7FAF8] px-5 py-6 md:px-7">

        <div className="mb-5 flex items-end justify-between">

          <div>

            <div className="flex items-center gap-2">

              <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />

              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#15803D]">
                Maintenance Priorities
              </p>

            </div>

            <p className="mt-1 text-[11px] text-[#718078]">
              Machines ranked by current health condition
            </p>

          </div>

          <span className="rounded-full border border-[#E0E8E3] bg-white px-3 py-1.5 text-[8px] font-bold text-[#718078]">
            {machines.length} monitored
          </span>

        </div>

        {priorityMachines.length === 0 ? (

          <div className="rounded-[15px] border border-dashed border-[#DCE6E0] bg-white p-8 text-center">

            <Cpu
              size={24}
              className="mx-auto text-[#C5D0C9]"
            />

            <p className="mt-3 text-xs font-bold text-[#526159]">
              No machine telemetry
            </p>

            <p className="mt-1 text-[10px] text-[#98A49D]">
              Maintenance intelligence is waiting for live assets.
            </p>

          </div>

        ) : (

          <div className="space-y-2.5">

            {priorityMachines.map(
              (machine, index) => {

                const health =
                  Number(
                    machine.health_score ?? 0
                  );

                const failureProbability =
                  Number(
                    machine.failure_probability ?? 0
                  );

                const rul =
                  Number(
                    machine.remaining_useful_life ?? 0
                  );

                const state =
                  getMachineState(
                    machine.maintenance_status,
                    health
                  );

                const StateIcon =
                  state.icon;

                return (

                  <div
                    key={machine.id}
                    className="group rounded-[15px] border border-[#E0E8E3] bg-white p-4 transition hover:border-[#BCE7CE] hover:shadow-[0_5px_18px_rgba(15,23,42,0.04)]"
                  >

                    {/* TOP */}

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                      <div className="flex min-w-0 items-center gap-3">

                        {/* PRIORITY */}

                        <div
                          className={`
                            flex h-8 w-8 shrink-0
                            items-center justify-center
                            rounded-lg text-[9px] font-extrab800
                            ${
                              index === 0 &&
                              state.type !== "operational"
                                ? "bg-red-50 text-red-600"
                                : "bg-[#F1F6F3] text-[#75837B]"
                            }
                          `}
                        >
                          #{index + 1}
                        </div>

                        {/* MACHINE */}

                        <div className="min-w-0">

                          <div className="flex items-center gap-2">

                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${state.dot}`}
                            />

                            <p className="truncate text-[12px] font-extrab800 text-[#26332C]">
                              {machine.name}
                            </p>

                          </div>

                          <p className="mt-1 truncate text-[8px] text-[#97A39C]">
                            {machine.id}
                            {" · "}
                            {machine.type}
                            {" · "}
                            {machine.department}
                          </p>

                        </div>

                      </div>

                      {/* STATUS */}

                      <div className="flex items-center gap-3">

                        <span
                          className={`
                            flex items-center gap-1.5
                            rounded-full border
                            px-2.5 py-1.5
                            text-[7px] font-bold
                            ${state.bg}
                            ${state.border}
                            ${state.text}
                          `}
                        >

                          <StateIcon size={9} />

                          {state.label}

                        </span>

                        <span className="text-[12px] font-extrab800 text-[#26332C]">
                          {health.toFixed(1)}%
                        </span>

                      </div>

                    </div>

                    {/* HEALTH BAR */}

                    <div className="mt-3">

                      <div className="h-1.5 overflow-hidden rounded-full bg-[#EDF2EF]">

                        <div
                          className={`h-full rounded-full transition-all duration-500 ${state.bar}`}
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(
                                0,
                                health
                              )
                            )}%`,
                          }}
                        />

                      </div>

                    </div>

                    {/* METRICS */}

                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">

                      <MiniMetric
                        label="Failure Risk"
                        value={`${failureProbability.toFixed(
                          1
                        )}%`}
                        tone={
                          failureProbability >= 50
                            ? "danger"
                            : failureProbability >= 20
                              ? "warning"
                              : "normal"
                        }
                      />

                      <MiniMetric
                        label="Remaining Life"
                        value={`${rul.toLocaleString()} cycles`}
                      />

                      <MiniMetric
                        label="Technician"
                        value={
                          machine.current_technician ||
                          "Unassigned"
                        }
                        icon={UserRound}
                      />

                      <MiniMetric
                        label="Ticket"
                        value={
                          machine.current_ticket ||
                          "No active ticket"
                        }
                        icon={Wrench}
                      />

                    </div>

                    {/* ATTENTION STRIP */}

                    {state.type !==
                      "operational" && (

                      <div
                        className={`
                          mt-3 flex items-center justify-between gap-3
                          rounded-[10px] border px-3 py-2
                          ${
                            state.type ===
                            "critical"
                              ? "border-red-100 bg-red-50/60"
                              : "border-amber-100 bg-amber-50/60"
                          }
                        `}
                      >

                        <div className="flex min-w-0 items-center gap-2">

                          <StateIcon
                            size={12}
                            className={
                              state.type ===
                              "critical"
                                ? "text-red-500"
                                : "text-amber-500"
                            }
                          />

                          <p
                            className={`
                              truncate text-[8px] font-semibold
                              ${
                                state.type ===
                                "critical"
                                  ? "text-red-700"
                                  : "text-amber-700"
                              }
                            `}
                          >
                            {state.type ===
                            "critical"
                              ? "Immediate inspection recommended"
                              : "Maintenance review recommended"}
                          </p>

                        </div>

                        <ArrowUpRight
                          size={12}
                          className={
                            state.type ===
                            "critical"
                              ? "text-red-400"
                              : "text-amber-400"
                          }
                        />

                      </div>

                    )}

                  </div>

                );
              }
            )}

          </div>

        )}

      </div>

      {/* ========================================================
          ACTIVE WORK
      ======================================================== */}

      {(machines.some(
        (machine) =>
          machine.current_technician ||
          machine.current_ticket
      )) && (

        <div className="border-t border-[#E5ECE8] bg-white px-5 py-5 md:px-7">

          <div className="flex items-center gap-2">

            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF7F1] text-[#15803D]">
              <Wrench size={14} />
            </div>

            <div>

              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#15803D]">
                Active Maintenance Work
              </p>

              <p className="mt-1 text-[10px] text-[#8A9790]">
                Current technician and service assignments
              </p>

            </div>

          </div>

          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">

            {machines
              .filter(
                (machine) =>
                  machine.current_technician ||
                  machine.current_ticket
              )
              .map(
                (machine) => (

                  <div
                    key={machine.id}
                    className="rounded-xl border border-[#E2E9E4] bg-[#F8FAF9] p-3"
                  >

                    <div className="flex items-center justify-between gap-2">

                      <p className="truncate text-[10px] font-bold text-[#526159]">
                        {machine.name}
                      </p>

                      <Clock3
                        size={11}
                        className="shrink-0 text-[#98A59E]"
                      />

                    </div>

                    <div className="mt-2 space-y-1">

                      {machine.current_technician && (

                        <p className="flex items-center gap-1.5 text-[8px] text-[#7B8981]">

                          <UserRound size={9} />

                          {machine.current_technician}

                        </p>

                      )}

                      {machine.current_ticket && (

                        <p className="flex items-center gap-1.5 text-[8px] text-[#7B8981]">

                          <Wrench size={9} />

                          {machine.current_ticket}

                        </p>

                      )}

                    </div>

                  </div>

                )
              )}

          </div>

        </div>

      )}

    </section>
  );
}

// ============================================================
// STATUS SUMMARY
// ============================================================

function StatusSummary({
  label,
  count,
  description,
  type,
  icon: Icon,
}: {
  label: string;
  count: number;
  description: string;
  type:
    | "operational"
    | "attention"
    | "critical";
  icon: typeof CheckCircle2;
}) {

  const styles = {
    operational: {
      wrapper:
        "border-emerald-100 bg-emerald-50/40",
      icon:
        "bg-emerald-100 text-emerald-600",
      count:
        "text-emerald-600",
      dot:
        "bg-emerald-500",
    },

    attention: {
      wrapper:
        "border-amber-100 bg-amber-50/40",
      icon:
        "bg-amber-100 text-amber-600",
      count:
        "text-amber-600",
      dot:
        "bg-amber-500",
    },

    critical: {
      wrapper:
        "border-red-100 bg-red-50/40",
      icon:
        "bg-red-100 text-red-600",
      count:
        "text-red-600",
      dot:
        "bg-red-500",
    },
  }[type];

  return (
    <div
      className={`rounded-[14px] border p-4 ${styles.wrapper}`}
    >

      <div className="flex items-center justify-between">

        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${styles.icon}`}
        >
          <Icon size={15} />
        </div>

        <span
          className={`h-1.5 w-1.5 rounded-full ${styles.dot}`}
        />

      </div>

      <p className="mt-4 text-[8px] font-bold uppercase tracking-[0.14em] text-[#7B8981]">
        {label}
      </p>

      <p
        className={`mt-1 text-[25px] font-extrab800 ${styles.count}`}
      >
        {count}
      </p>

      <p className="mt-1 text-[8px] leading-4 text-[#89958E]">
        {description}
      </p>

    </div>
  );
}

// ============================================================
// MINI METRIC
// ============================================================

function MiniMetric({
  label,
  value,
  tone = "normal",
  icon: Icon,
}: {
  label: string;
  value: string;
  tone?:
    | "normal"
    | "warning"
    | "danger";
  icon?: typeof UserRound;
}) {

  const valueClass =
    tone === "danger"
      ? "text-red-600"
      : tone === "warning"
        ? "text-amber-600"
        : "text-[#526159]";

  return (
    <div className="rounded-lg bg-[#F7FAF8] px-2.5 py-2">

      <p className="flex items-center gap-1 text-[6px] font-bold uppercase tracking-[0.12em] text-[#9AA69F]">

        {Icon && (
          <Icon size={8} />
        )}

        {label}

      </p>

      <p
        className={`mt-1 truncate text-[9px] font-bold ${valueClass}`}
        title={value}
      >
        {value}
      </p>

    </div>
  );
}

// ============================================================
// MACHINE STATE
// ============================================================

function getMachineState(
  status: string,
  health: number
) {

  const normalized =
    String(status)
      .toLowerCase()
      .trim();

  if (
    normalized.includes("critical") ||
    normalized.includes("emergency") ||
    health < 50
  ) {
    return {
      type: "critical" as const,
      label: "Critical",
      icon: ShieldAlert,
      dot: "bg-red-500",
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-700",
      bar: "bg-red-500",
    };
  }

  if (
    normalized.includes("attention") ||
    normalized.includes("maintenance") ||
    normalized.includes("stopped") ||
    health < 75
  ) {
    return {
      type: "attention" as const,
      label: "Needs Attention",
      icon: AlertTriangle,
      dot: "bg-amber-500",
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
      bar: "bg-amber-500",
    };
  }

  return {
    type: "operational" as const,
    label: "Operational",
    icon: CheckCircle2,
    dot: "bg-emerald-500",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    bar: "bg-emerald-500",
  };
}

// ============================================================
// SKELETON
// ============================================================

function MaintenanceSkeleton() {
  return (
    <section className="overflow-hidden rounded-[20px] border border-[#DDE7E1] bg-white">

      <div className="border-b border-[#E5ECE8] px-5 py-5 md:px-7">

        <div className="animate-pulse">

          <div className="h-5 w-44 rounded bg-[#EEF3F0]" />

          <div className="mt-2 h-2.5 w-72 rounded bg-[#F1F5F3]" />

        </div>

      </div>

      <div className="grid grid-cols-1 gap-3 bg-[#F7FAF8] p-5 sm:grid-cols-3 md:p-7">

        {[1, 2, 3].map(
          (item) => (

            <div
              key={item}
              className="h-32 animate-pulse rounded-[14px] bg-[#EEF3F0]"
            />

          )
        )}

      </div>

      <div className="space-y-3 bg-[#F7FAF8] px-5 pb-6 md:px-7">

        {[1, 2, 3].map(
          (item) => (

            <div
              key={item}
              className="h-36 animate-pulse rounded-[15px] bg-[#EEF3F0]"
            />

          )
        )}

      </div>

    </section>
  );
}