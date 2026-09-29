import {
  useMemo,
  useState,
} from "react";

import {
  Activity,
  Factory,
  Gauge,
  MapPin,
  ShieldCheck,
  Thermometer,
  UserRound,
  Wind,
  Wrench,
  Zap,
} from "lucide-react";

import { useMachines } from "../../../hooks/useMachines";
import type { Machine } from "../../../services/api";

import DepartmentCard from "./DepartmentCard";

/* ============================================================
   MAIN DIGITAL TWIN PANEL
============================================================ */

export default function DigitalTwinPanel() {
  const {
    machines,
    loading,
    error,
    live,
  } = useMachines();

  const [
    selectedMachineId,
    setSelectedMachineId,
  ] = useState<string | null>(null);

  /* ==========================================================
     SELECTED MACHINE
  ========================================================== */

  const selectedMachine =
    useMemo(() => {
      if (selectedMachineId) {
        const selected =
          machines.find(
            (machine) =>
              machine.id ===
              selectedMachineId
          );

        if (selected) {
          return selected;
        }
      }

      return machines[0] ?? null;
    }, [
      machines,
      selectedMachineId,
    ]);

  /* ==========================================================
     DYNAMIC DEPARTMENT GROUPING
     
     Nothing is hard-coded here.

     Backend:
       machine.department

     Example:
       Boiler House
       Production
       Compressed Air

     Any number of machines will automatically
     appear inside the correct department.
  ========================================================== */

  const departments =
    useMemo(() => {
      const groups =
        new Map<
          string,
          Machine[]
        >();

      for (const machine of machines) {
        const department =
          machine.department?.trim() ||
          "Factory Assets";

        const existing =
          groups.get(
            department
          ) ?? [];

        existing.push(
          machine
        );

        groups.set(
          department,
          existing
        );
      }

      return Array.from(
        groups.entries()
      ).map(
        ([
          name,
          departmentMachines,
        ]) => ({
          id: name
            .toLowerCase()
            .replace(
              /[^a-z0-9]+/g,
              "-"
            )
            .replace(
              /^-|-$/g,
              "" 
            ),

          name,

          machines:
            departmentMachines,
        })
      );
    }, [machines]);

  /* ==========================================================
     MACHINE SUMMARY
  ========================================================== */

  const machineSummary =
    useMemo(() => {
      let healthy = 0;
      let warning = 0;
      let critical = 0;
      let offline = 0;

      for (const machine of machines) {
        const health =
          Number(
            machine.health_score ??
              0
          );

        const status =
          String(
            machine.maintenance_status ??
              ""
          ).toLowerCase();

        if (
          status.includes(
            "emergency"
          ) ||
          status.includes(
            "offline"
          ) ||
          health < 50
        ) {
          critical += 1;
        } else if (
          status.includes(
            "maintenance"
          ) ||
          status.includes(
            "stop"
          ) ||
          status.includes(
            "warning"
          ) ||
          health < 75
        ) {
          warning += 1;
        } else {
          healthy += 1;
        }
      }

      offline =
        machines.filter(
          (machine) =>
            String(
              machine.maintenance_status ??
                ""
            )
              .toLowerCase()
              .includes(
                "offline"
              )
        ).length;

      return {
        total:
          machines.length,

        healthy,

        warning,

        critical,

        offline,
      };
    }, [machines]);

  /* ==========================================================
     LOADING
  ========================================================== */

  if (
    loading &&
    machines.length === 0
  ) {
    return (
      <section className="overflow-hidden rounded-[18px] border border-[#DDE7E1] bg-white shadow-[0_4px_18px_rgba(15,23,42,0.035)]">
        <LoadingState />
      </section>
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
      <section className="overflow-hidden rounded-[18px] border border-[#F3C2C2] bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.035)] sm:p-6">

        <div className="flex items-start gap-3">

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#FEF2F2] text-[#DC2626]">

            <Factory
              size={18}
              strokeWidth={1.7}
            />

          </div>

          <div className="min-w-0">

            <p className="text-[14px] font-extrab800 text-[#26332C]">
              Digital Twin unavailable
            </p>

            <p className="mt-1 text-[9px] leading-5 text-[#B91C1C]">
              {error}
            </p>

          </div>

        </div>

      </section>
    );
  }

  /* ==========================================================
     EMPTY FACTORY
  ========================================================== */

  if (
    machines.length === 0
  ) {
    return (
      <section className="overflow-hidden rounded-[18px] border border-[#DDE7E1] bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.035)] sm:p-6">

        <TwinHeader
          live={live}
          total={0}
        />

        <EmptyFactory />

      </section>
    );
  }

  /* ==========================================================
     MAIN
  ========================================================== */

  return (
    <section className="overflow-hidden rounded-[18px] border border-[#DDE7E1] bg-white shadow-[0_4px_18px_rgba(15,23,42,0.035)]">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="border-b border-[#E5ECE8] px-5 py-5 sm:px-6">

        <TwinHeader
          live={live}
          total={
            machineSummary.total
          }
        />

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">

          <SummaryItem
            label="Assets"
            value={
              machineSummary.total
            }
            tone="slate"
          />

          <SummaryItem
            label="Healthy"
            value={
              machineSummary.healthy
            }
            tone="green"
          />

          <SummaryItem
            label="Attention"
            value={
              machineSummary.warning
            }
            tone="amber"
          />

          <SummaryItem
            label="Critical"
            value={
              machineSummary.critical
            }
            tone="red"
          />

        </div>

      </div>

      {/* ======================================================
          BODY
      ====================================================== */}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">

        {/* ====================================================
            FACTORY MAP
        ==================================================== */}

        <div className="min-w-0 border-b border-[#E5ECE8] p-4 sm:p-5 lg:border-b-0 lg:border-r">

          <div className="mb-4 flex items-end justify-between gap-3">

            <div>

              <div className="flex items-center gap-2">

                <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />

                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#16A34A]">
                  Factory Map
                </p>

              </div>

              <p className="mt-1 text-[9px] text-[#94A39A]">
                Live asset topology grouped by department
              </p>

            </div>

            <div className="hidden items-center gap-1.5 rounded-full border border-[#E1E9E4] bg-[#F8FAF9] px-2.5 py-1.5 text-[8px] font-semibold text-[#64736A] sm:flex">

              <MapPin
                size={11}
              />

              Live asset topology

            </div>

          </div>

          {/* ==================================================
              DYNAMIC DEPARTMENTS
          ================================================== */}

          <div className="space-y-3">

            {departments.map(
              (department) => (
                <DepartmentCard
                  key={
                    department.id
                  }

                  department={
                    department
                  }

                  machines={
                    department.machines
                  }

                  selectedMachineId={
                    selectedMachine?.id
                  }

                  onMachineSelect={(
                    machine
                  ) => {
                    setSelectedMachineId(
                      machine.id
                    );
                  }}
                />
              )
            )}

          </div>

        </div>

        {/* ====================================================
            SELECTED MACHINE INSPECTOR
        ==================================================== */}

        <MachineInspector
          machine={
            selectedMachine
          }
          live={live}
        />

      </div>

    </section>
  );
}

/* ================================================================
   HEADER
================================================================ */

function TwinHeader({
  live,
  total,
}: {
  live: boolean;
  total: number;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

      <div className="flex min-w-0 items-center gap-3">

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-[#EAF8F0] text-[#15803D]">

          <Factory
            size={19}
            strokeWidth={1.7}
          />

        </div>

        <div className="min-w-0">

          <div className="flex flex-wrap items-center gap-2">

            <h3 className="text-[17px] font-extrab800 tracking-[-0.02em] text-[#26332C] sm:text-[18px]">
              Digital Twin
            </h3>

            <span className="rounded-full border border-[#BCE7CE] bg-[#F0FBF4] px-2 py-0.5 text-[7px] font-bold uppercase tracking-[0.1em] text-[#15803D]">
              Live Data
            </span>

          </div>

          <p className="mt-1 text-[9px] text-[#7B8981]">
            Live digital representation of factory assets
          </p>

        </div>

      </div>

      <div className="flex shrink-0 items-center gap-2">

        <div className="rounded-[9px] border border-[#E2E8E4] bg-[#F8FBF9] px-3 py-2">

          <p className="text-[7px] font-bold uppercase tracking-[0.12em] text-[#94A39A]">
            Connected Assets
          </p>

          <p className="mt-0.5 text-[12px] font-extrab800 text-[#26332C]">
            {total}
          </p>

        </div>

        <div
          className={[
            "rounded-[9px] border px-3 py-2",
            live
              ? "border-[#BCE7CE] bg-[#F0FBF4]"
              : "border-[#E2E8E4] bg-[#F8FAF9]",
          ].join(" ")}
        >

          <div className="flex items-center gap-1.5">

            <span className="relative flex h-1.5 w-1.5">

              {live && (
                <span className="absolute h-full w-full animate-ping rounded-full bg-[#16A34A]/30" />
              )}

              <span
                className={[
                  "relative h-1.5 w-1.5 rounded-full",
                  live
                    ? "bg-[#16A34A]"
                    : "bg-[#94A39A]",
                ].join(" ")}
              />

            </span>

            <span
              className={[
                "text-[7px] font-bold uppercase tracking-[0.1em]",
                live
                  ? "text-[#15803D]"
                  : "text-[#64736A]",
              ].join(" ")}
            >
              {live
                ? "Connected"
                : "Offline"}
            </span>

          </div>

        </div>

      </div>

    </div>
  );
}

/* ================================================================
   SUMMARY ITEM
================================================================ */

function SummaryItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone:
    | "slate"
    | "green"
    | "amber"
    | "red";
}) {
  const styles = {
    slate: {
      box:
        "border-[#E1E9E4] bg-[#F8FAF9]",
      text:
        "text-[#526159]",
    },

    green: {
      box:
        "border-[#BCE7CE] bg-[#F0FBF4]",
      text:
        "text-[#15803D]",
    },

    amber: {
      box:
        "border-[#F3D49A] bg-[#FFF7E6]",
      text:
        "text-[#D97706]",
    },

    red: {
      box:
        "border-[#F3C2C2] bg-[#FEF2F2]",
      text:
        "text-[#DC2626]",
    },
  };

  const style =
    styles[tone];

  return (
    <div
      className={[
        "rounded-[10px] border p-3",
        style.box,
      ].join(" ")}
    >

      <p className="text-[7px] font-bold uppercase tracking-[0.12em] text-[#8B9790]">
        {label}
      </p>

      <p
        className={[
          "mt-1 text-[16px] font-extrab800",
          style.text,
        ].join(" ")}
      >
        {value}
      </p>

    </div>
  );
}

/* ================================================================
   MACHINE INSPECTOR
================================================================ */

function MachineInspector({
  machine,
  live,
}: {
  machine: Machine | null;
  live: boolean;
}) {
  if (!machine) {
    return (
      <aside className="flex min-h-[350px] items-center justify-center p-5">

        <div className="text-center">

          <Factory
            size={26}
            className="mx-auto text-[#A0ABA4]"
          />

          <p className="mt-3 text-[10px] font-bold text-[#526159]">
            Select a machine
          </p>

          <p className="mt-1 max-w-[230px] text-[8px] leading-4 text-[#A0ABA4]">
            Select an asset from the factory map to inspect its live digital twin.
          </p>

        </div>

      </aside>
    );
  }

  const risk =
    getHealthState(
      machine
    );

  return (
    <aside className="min-w-0 bg-white p-4 sm:p-5">

      {/* ======================================================
          MACHINE HEADER
      ====================================================== */}

      <div className="flex items-start justify-between gap-3">

        <div className="flex min-w-0 items-center gap-3">

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#EAF8F0] text-[#15803D]">

            {getMachineIcon(
              machine.type
            )}

          </div>

          <div className="min-w-0">

            <p className="truncate text-[14px] font-extrab800 text-[#26332C]">
              {machine.name}
            </p>

            <p className="mt-0.5 truncate text-[8px] text-[#94A39A]">
              {machine.id} ·{" "}
              {machine.type}
            </p>

          </div>

        </div>

        <span
          className={[
            "shrink-0 rounded-full border px-2 py-1 text-[7px] font-bold uppercase tracking-[0.08em]",
            risk.badge,
          ].join(" ")}
        >
          {risk.label}
        </span>

      </div>

      {/* ======================================================
          LIVE STATUS
      ====================================================== */}

      <div className="mt-4 flex items-center justify-between rounded-[10px] border border-[#E1E9E4] bg-[#F8FAF9] px-3 py-2.5">

        <div>

          <p className="text-[7px] font-bold uppercase tracking-[0.12em] text-[#94A39A]">
            Digital Twin Status
          </p>

          <p className="mt-0.5 text-[9px] font-semibold text-[#526159]">
            {machine.maintenance_status ||
              "Unknown"}
          </p>

        </div>

        <div className="flex items-center gap-1.5">

          <span
            className={[
              "h-1.5 w-1.5 rounded-full",
              live
                ? "animate-pulse bg-[#16A34A]"
                : "bg-[#94A39A]",
            ].join(" ")}
          />

          <span className="text-[7px] font-bold uppercase tracking-[0.1em] text-[#64736A]">
            {live
              ? "Live"
              : "Snapshot"}
          </span>

        </div>

      </div>

      {/* ======================================================
          HEALTH
      ====================================================== */}

      <div className="mt-3 rounded-[12px] border border-[#E1E9E4] bg-white p-3.5">

        <div className="flex items-end justify-between">

          <div>

            <p className="text-[7px] font-bold uppercase tracking-[0.12em] text-[#94A39A]">
              Machine Health
            </p>

            <p className="mt-1 text-[24px] font-extrab800 tracking-[-0.03em] text-[#26332C]">

              {formatNumber(
                machine.health_score
              )}

              <span className="ml-1 text-[10px] font-semibold text-[#94A39A]">
                %
              </span>

            </p>

          </div>

          <ShieldCheck
            size={22}
            strokeWidth={1.7}
            className={
              risk.icon
            }
          />

        </div>

        <div className="mt-2 h-[6px] overflow-hidden rounded-full bg-[#EEF3EF]">

          <div
            className={[
              "h-full rounded-full transition-all duration-500",
              risk.bar,
            ].join(" ")}
            style={{
              width: `${Math.min(
                Math.max(
                  Number(
                    machine.health_score ??
                      0
                  ),
                  0
                ),
                100
              )}%`,
            }}
          />

        </div>

      </div>

      {/* ======================================================
          LIVE TELEMETRY
      ====================================================== */}

      <div className="mt-3">

        <div className="mb-2 flex items-center justify-between">

          <p className="text-[8px] font-bold uppercase tracking-[0.13em] text-[#64736A]">
            Live Telemetry
          </p>

          <span className="text-[7px] text-[#A0ABA4]">
            Current values
          </span>

        </div>

        <div className="grid grid-cols-2 gap-2">

          <TelemetryCard
            icon={
              <Thermometer
                size={13}
              />
            }
            label="Temperature"
            value={
              machine.temperature
            }
            unit="°C"
          />

          <TelemetryCard
            icon={
              <Gauge
                size={13}
              />
            }
            label="Pressure"
            value={
              machine.pressure
            }
            unit="bar"
          />

          <TelemetryCard
            icon={
              <Activity
                size={13}
              />
            }
            label="Vibration"
            value={
              machine.vibration
            }
            unit="mm/s"
          />

          <TelemetryCard
            icon={
              <Zap
                size={13}
              />
            }
            label="Power"
            value={
              machine.power
            }
            unit="kW"
          />

          <TelemetryCard
            icon={
              <Gauge
                size={13}
              />
            }
            label="RPM"
            value={
              machine.rpm
            }
            unit="rpm"
          />

          <TelemetryCard
            icon={
              <Zap
                size={13}
              />
            }
            label="Energy"
            value={
              machine.energy
            }
            unit="kWh"
          />

        </div>

      </div>

      {/* ======================================================
          RELIABILITY
      ====================================================== */}

      <div className="mt-3 grid grid-cols-2 gap-2">

        <ReliabilityCard
          label="Failure Probability"
          value={`${formatNumber(
            machine.failure_probability
          )}%`}
        />

        <ReliabilityCard
          label="Remaining Useful Life"
          value={formatNumber(
            machine.remaining_useful_life
          )}
          suffix="cycles"
        />

      </div>

      {/* ======================================================
          MAINTENANCE
      ====================================================== */}

      <div className="mt-3 rounded-[11px] border border-[#E1E9E4] bg-[#F8FAF9] p-3">

        <div className="flex items-center gap-2">

          <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-white text-[#64736A]">

            <Wrench
              size={13}
            />

          </div>

          <div>

            <p className="text-[7px] font-bold uppercase tracking-[0.12em] text-[#94A39A]">
              Maintenance
            </p>

            <p className="text-[9px] font-semibold text-[#526159]">
              Technician assignment
            </p>

          </div>

        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">

          <div className="min-w-0">

            <p className="text-[7px] text-[#A0ABA4]">
              Technician
            </p>

            <div className="mt-1 flex items-center gap-1.5">

              <UserRound
                size={11}
                className="shrink-0 text-[#64736A]"
              />

              <p className="truncate text-[8px] font-semibold text-[#526159]">
                {machine.current_technician ??
                  "Not assigned"}
              </p>

            </div>

          </div>

          <div className="min-w-0">

            <p className="text-[7px] text-[#A0ABA4]">
              Work Ticket
            </p>

            <p className="mt-1 truncate text-[8px] font-semibold text-[#526159]">
              {machine.current_ticket ??
                "No active ticket"}
            </p>

          </div>

        </div>

      </div>

      {/* ======================================================
          LOCATION
      ====================================================== */}

      {machine.location && (
        <div className="mt-2 flex items-center gap-1.5 px-1 text-[7px] text-[#94A39A]">

          <MapPin
            size={10}
          />

          {machine.location}

        </div>
      )}

    </aside>
  );
}

/* ================================================================
   TELEMETRY CARD
================================================================ */

function TelemetryCard({
  icon,
  label,
  value,
  unit,
}: {
  icon: React.ReactNode;
  label: string;
  value:
    | number
    | undefined;
  unit: string;
}) {
  return (
    <div className="rounded-[10px] border border-[#E2E9E4] bg-[#FAFCFB] p-2.5">

      <div className="flex items-center gap-1.5 text-[#64736A]">

        {icon}

        <span className="truncate text-[7px] font-bold uppercase tracking-[0.08em]">
          {label}
        </span>

      </div>

      <p className="mt-1.5 text-[12px] font-extrab800 text-[#26332C]">

        {value ===
        undefined
          ? "—"
          : formatNumber(
              value
            )}

        <span className="ml-1 text-[7px] font-semibold text-[#94A39A]">
          {unit}
        </span>

      </p>

    </div>
  );
}

/* ================================================================
   RELIABILITY CARD
================================================================ */

function ReliabilityCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-[10px] border border-[#E1E9E4] bg-white p-3">

      <p className="text-[7px] font-bold uppercase tracking-[0.1em] text-[#94A39A]">
        {label}
      </p>

      <p className="mt-1.5 text-[13px] font-extrab800 text-[#26332C]">

        {value}

        {suffix && (
          <span className="ml-1 text-[7px] font-semibold text-[#94A39A]">
            {suffix}
          </span>
        )}

      </p>

    </div>
  );
}

/* ================================================================
   HEALTH STATE
================================================================ */

function getHealthState(
  machine: Machine
) {
  const health =
    Number(
      machine.health_score ??
        0
    );

  const status =
    String(
      machine.maintenance_status ??
        ""
    ).toLowerCase();

  if (
    status.includes(
      "emergency"
    ) ||
    status.includes(
      "offline"
    ) ||
    health < 50
  ) {
    return {
      label: "Critical",
      dot: "bg-[#EF4444]",
      bar: "bg-[#EF4444]",
      text: "text-[#DC2626]",
      badge:
        "border-[#F3C2C2] bg-[#FEF2F2] text-[#DC2626]",
      icon:
        "text-[#DC2626]",
    };
  }

  if (
    status.includes(
      "maintenance"
    ) ||
    status.includes(
      "stop"
    ) ||
    status.includes(
      "warning"
    ) ||
    status.includes(
      "attention"
    ) ||
    health < 75
  ) {
    return {
      label: "Attention",
      dot: "bg-[#F59E0B]",
      bar: "bg-[#F59E0B]",
      text: "text-[#D97706]",
      badge:
        "border-[#F3D49A] bg-[#FFF7E6] text-[#D97706]",
      icon:
        "text-[#D97706]",
    };
  }

  return {
    label: "Healthy",
    dot: "bg-[#16A34A]",
    bar: "bg-[#16A34A]",
    text: "text-[#15803D]",
    badge:
      "border-[#BCE7CE] bg-[#F0FBF4] text-[#15803D]",
    icon:
      "text-[#15803D]",
  };
}

/* ================================================================
   MACHINE ICON
================================================================ */

function getMachineIcon(
  type: string
) {
  const normalized =
    String(
      type ?? ""
    ).toLowerCase();

  if (
    normalized.includes(
      "boiler"
    )
  ) {
    return (
      <Thermometer
        size={17}
        strokeWidth={1.7}
      />
    );
  }

  if (
    normalized.includes(
      "compressor"
    )
  ) {
    return (
      <Wind
        size={17}
        strokeWidth={1.7}
      />
    );
  }

  if (
    normalized.includes(
      "pump"
    )
  ) {
    return (
      <Activity
        size={17}
        strokeWidth={1.7}
      />
    );
  }

  if (
    normalized.includes(
      "motor"
    )
  ) {
    return (
      <Gauge
        size={17}
        strokeWidth={1.7}
      />
    );
  }

  return (
    <Factory
      size={17}
      strokeWidth={1.7}
    />
  );
}

/* ================================================================
   EMPTY FACTORY
================================================================ */

function EmptyFactory() {
  return (
    <div className="mt-5 rounded-[14px] border border-dashed border-[#CBD8D0] bg-[#F8FAF9] p-8 text-center">

      <Factory
        size={28}
        className="mx-auto text-[#94A39A]"
      />

      <p className="mt-3 text-[11px] font-bold text-[#526159]">
        No factory assets available
      </p>

      <p className="mx-auto mt-1 max-w-[320px] text-[9px] leading-4 text-[#94A39A]">
        Upload or configure a factory dataset to populate the digital twin.
      </p>

    </div>
  );
}

/* ================================================================
   LOADING
================================================================ */

function LoadingState() {
  return (
    <div className="animate-pulse p-5 sm:p-6">

      <div className="flex items-center gap-3">

        <div className="h-10 w-10 rounded-[11px] bg-[#E8EFEB]" />

        <div>

          <div className="h-4 w-32 rounded bg-[#E8EFEB]" />

          <div className="mt-2 h-2.5 w-56 rounded bg-[#F0F4F1]" />

        </div>

      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">

        {[1, 2, 3, 4].map(
          (item) => (
            <div
              key={item}
              className="h-16 rounded-[10px] bg-[#F1F5F2]"
            />
          )
        )}

      </div>

      <div className="mt-5 h-[300px] rounded-[14px] bg-[#F4F8F5]" />

    </div>
  );
}

/* ================================================================
   FORMATTER
================================================================ */

function formatNumber(
  value:
    | number
    | undefined
) {
  if (
    value === undefined ||
    !Number.isFinite(
      Number(value)
    )
  ) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-IN",
    {
      maximumFractionDigits: 1,
    }
  ).format(
    Number(value)
  );
}