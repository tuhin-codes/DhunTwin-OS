import {
  Activity,
  Factory,
  Gauge,
  MapPin,
  Thermometer,
  Wind,
  Zap,
} from "lucide-react";

import { useMachines } from "../../../hooks/useMachines";
import type { Machine } from "../../../services/api";

/* ============================================================
   TYPES
============================================================ */

type MachineStatusLevel =
  | "healthy"
  | "warning"
  | "critical";

interface MachineStatus {
  level: MachineStatusLevel;
  line: string;
  dot: string;
  iconBackground: string;
  iconText: string;
  pulse: boolean;
}

/* ============================================================
   FACTORY MAP
============================================================ */

interface FactoryMapProps {
  selectedMachineId?: string | null;
  onMachineSelect?: (
    machine: Machine
  ) => void;
}

export default function FactoryMap({
  selectedMachineId,
  onMachineSelect,
}: FactoryMapProps) {
  const {
    machines,
    loading,
    error,
    live,
  } = useMachines();

  const departments =
    groupByDepartment(
      machines
    );

  /* ==========================================================
     LOADING
  ========================================================== */

  if (
    loading &&
    machines.length === 0
  ) {
    return (
      <div className="overflow-hidden rounded-[16px] border border-[#DDE7E1] bg-white">

        <MapHeader
          total={0}
          live={false}
        />

        <MapLoading />

      </div>
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
      <div className="overflow-hidden rounded-[16px] border border-[#F3C2C2] bg-white">

        <MapHeader
          total={0}
          live={false}
        />

        <div className="flex min-h-[260px] items-center justify-center p-6">

          <div className="text-center">

            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-[11px] bg-[#FEF2F2] text-[#DC2626]">

              <Factory
                size={20}
              />

            </div>

            <p className="mt-3 text-[11px] font-bold text-[#526159]">
              Factory map unavailable
            </p>

            <p className="mt-1 max-w-[320px] text-[8px] leading-4 text-[#B91C1C]">
              {error}
            </p>

          </div>

        </div>

      </div>
    );
  }

  /* ==========================================================
     EMPTY
  ========================================================== */

  if (
    machines.length === 0
  ) {
    return (
      <div className="overflow-hidden rounded-[16px] border border-[#DDE7E1] bg-white">

        <MapHeader
          total={0}
          live={live}
        />

        <div className="flex min-h-[280px] items-center justify-center bg-[#F8FAF9] p-8">

          <div className="text-center">

            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[13px] bg-[#EAF8F0] text-[#15803D]">

              <Factory
                size={23}
              />

            </div>

            <p className="mt-3 text-[11px] font-bold text-[#526159]">
              No factory assets
            </p>

            <p className="mt-1 max-w-[300px] text-[8px] leading-4 text-[#94A39A]">
              Add machines to the backend dataset to populate the factory map automatically.
            </p>

          </div>

        </div>

      </div>
    );
  }

  /* ==========================================================
     MAIN MAP
  ========================================================== */

  return (
    <div className="overflow-hidden rounded-[16px] border border-[#DDE7E1] bg-white shadow-[0_3px_14px_rgba(15,23,42,0.025)]">

      <MapHeader
        total={machines.length}
        live={live}
      />

      <div className="relative overflow-hidden bg-[#F7FAF8] p-4 sm:p-5">

        {/* Background grid */}

        <div
          className="
            pointer-events-none
            absolute inset-0
            opacity-40
            [background-image:linear-gradient(to_right,#DDE7E1_1px,transparent_1px),linear-gradient(to_bottom,#DDE7E1_1px,transparent_1px)]
            [background-size:28px_28px]
          "
        />

        {/* Factory border */}

        <div className="relative overflow-hidden rounded-[14px] border border-[#CFDDD4] bg-[#FBFDFC]">

          {/* Factory top strip */}

          <div className="flex flex-col gap-3 border-b border-[#E0E9E3] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-center gap-2">

              <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[#EAF8F0] text-[#15803D]">

                <Factory
                  size={14}
                />

              </div>

              <div>

                <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-[#526159]">
                  Factory Floor
                </p>

                <p className="mt-0.5 text-[7px] text-[#94A39A]">
                  Live digital twin topology
                </p>

              </div>

            </div>

            <div className="flex flex-wrap items-center gap-2">

              <Legend
                dot="bg-[#16A34A]"
                label="Healthy"
              />

              <Legend
                dot="bg-[#F59E0B]"
                label="Attention"
              />

              <Legend
                dot="bg-[#EF4444]"
                label="Critical"
              />

            </div>

          </div>

          {/* Department zones */}

          <div className="relative grid grid-cols-1 gap-3 p-3 sm:p-4 lg:grid-cols-2">

            {departments.map(
              (department) => (
                <DepartmentZone
                  key={
                    department.name
                  }
                  name={
                    department.name
                  }
                  machines={
                    department.machines
                  }
                  selectedMachineId={
                    selectedMachineId
                  }
                  onMachineSelect={
                    onMachineSelect
                  }
                />
              )
            )}

          </div>

        </div>

      </div>

    </div>
  );
}

/* ============================================================
   HEADER
============================================================ */

function MapHeader({
  total,
  live,
}: {
  total: number;
  live: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-[#E3EBE6] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

      <div className="flex items-center gap-3">

        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#EAF8F0] text-[#15803D]">

          <MapPin
            size={17}
            strokeWidth={1.8}
          />

        </div>

        <div>

          <div className="flex items-center gap-2">

            <h3 className="text-[13px] font-extrab800 text-[#26332C]">
              Factory Map
            </h3>

            <span className="rounded-full border border-[#BCE7CE] bg-[#F0FBF4] px-2 py-0.5 text-[6px] font-bold uppercase tracking-[0.08em] text-[#15803D]">
              Digital Twin
            </span>

          </div>

          <p className="mt-0.5 text-[8px] text-[#94A39A]">
            Real-time factory asset visualization
          </p>

        </div>

      </div>

      <div className="flex items-center gap-2">

        <div className="rounded-[9px] border border-[#E1E9E4] bg-[#F8FAF9] px-3 py-1.5">

          <p className="text-[6px] font-bold uppercase tracking-[0.1em] text-[#94A39A]">
            Assets
          </p>

          <p className="mt-0.5 text-[11px] font-extrab800 text-[#26332C]">
            {total}
          </p>

        </div>

        <div
          className={[
            "flex items-center gap-1.5 rounded-[9px] border px-3 py-2",
            live
              ? "border-[#BCE7CE] bg-[#F0FBF4]"
              : "border-[#E1E9E4] bg-[#F8FAF9]",
          ].join(" ")}
        >

          <span
            className={[
              "h-1.5 w-1.5 rounded-full",
              live
                ? "animate-pulse bg-[#16A34A]"
                : "bg-[#94A39A]",
            ].join(" ")}
          />

          <span
            className={[
              "text-[7px] font-bold uppercase tracking-[0.08em]",
              live
                ? "text-[#15803D]"
                : "text-[#64736A]",
            ].join(" ")}
          >
            {live
              ? "Live"
              : "Offline"}
          </span>

        </div>

      </div>

    </div>
  );
}

/* ============================================================
   DEPARTMENT ZONE
============================================================ */

function DepartmentZone({
  name,
  machines,
  selectedMachineId,
  onMachineSelect,
}: {
  name: string;
  machines: Machine[];
  selectedMachineId?: string | null;
  onMachineSelect?: (
    machine: Machine
  ) => void;
}) {
  const departmentHealth =
    getDepartmentHealth(
      machines
    );

  const statuses =
    machines.map(
      (machine) =>
        getMachineStatus(
          machine
        )
    );

  const critical =
    statuses.filter(
      (status) =>
        status.level ===
        "critical"
    ).length;

  const warning =
    statuses.filter(
      (status) =>
        status.level ===
        "warning"
    ).length;

  return (
    <section className="overflow-hidden rounded-[12px] border border-[#DCE7E0] bg-white">

      {/* Department header */}

      <div className="border-b border-[#E6ECE8] bg-[#FBFDFC] px-3.5 py-3">

        <div className="flex items-start justify-between gap-3">

          <div className="flex min-w-0 items-center gap-2.5">

            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[#EAF8F0] text-[#15803D]">

              <Factory
                size={15}
                strokeWidth={1.7}
              />

            </div>

            <div className="min-w-0">

              <p className="truncate text-[9px] font-extrab800 text-[#526159]">
                {name}
              </p>

              <p className="mt-0.5 text-[6px] uppercase tracking-[0.09em] text-[#A0ABA4]">
                {machines.length}{" "}
                {machines.length ===
                1
                  ? "asset"
                  : "assets"}
              </p>

            </div>

          </div>

          <span
            className={[
              "shrink-0 rounded-full border px-2 py-1 text-[6px] font-bold uppercase tracking-[0.07em]",
              critical > 0
                ? "border-[#F3C2C2] bg-[#FEF2F2] text-[#DC2626]"
                : warning > 0
                  ? "border-[#F3D49A] bg-[#FFF7E6] text-[#D97706]"
                  : "border-[#BCE7CE] bg-[#F0FBF4] text-[#15803D]",
            ].join(" ")}
          >
            {critical > 0
              ? "Critical"
              : warning > 0
                ? "Attention"
                : "Healthy"}
          </span>

        </div>

        {/* Health */}

        <div className="mt-2.5">

          <div className="flex items-center justify-between">

            <span className="text-[6px] font-bold uppercase tracking-[0.08em] text-[#A0ABA4]">
              Department health
            </span>

            <span
              className={[
                "text-[7px] font-extrab800",
                departmentHealth <
                60
                  ? "text-[#DC2626]"
                  : departmentHealth <
                      80
                    ? "text-[#D97706]"
                    : "text-[#15803D]",
              ].join(" ")}
            >
              {departmentHealth.toFixed(
                1
              )}
              %
            </span>

          </div>

          <div className="mt-1 h-[4px] overflow-hidden rounded-full bg-[#E8EFEA]">

            <div
              className={[
                "h-full rounded-full transition-all duration-500",
                departmentHealth <
                60
                  ? "bg-[#EF4444]"
                  : departmentHealth <
                      80
                    ? "bg-[#F59E0B]"
                    : "bg-[#16A34A]",
              ].join(" ")}
              style={{
                width: `${departmentHealth}%`,
              }}
            />

          </div>

        </div>

      </div>

      {/* Machine floor */}

      <div className="relative p-3">

        <div
          className="
            pointer-events-none
            absolute inset-0
            opacity-50
            [background-image:linear-gradient(to_right,#EEF3EF_1px,transparent_1px),linear-gradient(to_bottom,#EEF3EF_1px,transparent_1px)]
            [background-size:24px_24px]
          "
        />

        <div className="relative grid grid-cols-2 gap-2">

          {machines.map(
            (machine) => (
              <FactoryMachine
                key={
                  machine.id
                }
                machine={
                  machine
                }
                selected={
                  selectedMachineId ===
                  machine.id
                }
                onSelect={
                  onMachineSelect
                }
              />
            )
          )}

        </div>

      </div>

    </section>
  );
}

/* ============================================================
   MACHINE
============================================================ */

function FactoryMachine({
  machine,
  selected,
  onSelect,
}: {
  machine: Machine;
  selected: boolean;
  onSelect?: (
    machine: Machine
  ) => void;
}) {
  const status =
    getMachineStatus(
      machine
    );

  return (
    <button
      type="button"
      onClick={() =>
        onSelect?.(
          machine
        )
      }
      className={[
        "group relative min-w-0 overflow-hidden rounded-[10px] border p-2.5 text-left",
        "transition-all duration-200",
        selected
          ? "border-[#16A34A] bg-[#F0FBF4] shadow-[0_0_0_2px_rgba(22,163,74,0.08)]"
          : "border-[#E1E9E4] bg-white hover:-translate-y-[1px] hover:border-[#BBD5C5] hover:shadow-[0_4px_12px_rgba(15,23,42,0.045)]",
      ].join(" ")}
    >

      {/* Status strip */}

      <div
        className={[
          "absolute left-0 top-0 h-full w-[3px]",
          status.line,
        ].join(" ")}
      />

      <div className="flex items-center gap-2">

        {/* Machine icon */}

        <div
          className={[
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]",
            status.iconBackground,
            status.iconText,
          ].join(" ")}
        >
          {getMachineIcon(
            machine.type
          )}
        </div>

        {/* Machine name */}

        <div className="min-w-0 flex-1">

          <div className="flex items-center justify-between gap-2">

            <p className="truncate text-[8px] font-bold text-[#526159]">
              {machine.name}
            </p>

            <span
              className={[
                "h-1.5 w-1.5 shrink-0 rounded-full",
                status.dot,
                status.pulse
                  ? "animate-pulse"
                  : "",
              ].join(" ")}
            />

          </div>

          <p className="mt-0.5 truncate text-[6px] text-[#A0ABA4]">
            {machine.id}
          </p>

        </div>

      </div>

      {/* Telemetry */}

      <div className="mt-2.5 grid grid-cols-2 gap-x-2 gap-y-1.5">

        <MiniMetric
          label="Health"
          value={`${formatNumber(
            machine.health_score
          )}%`}
        />

        <MiniMetric
          label="Power"
          value={`${formatNumber(
            machine.power
          )} kW`}
        />

        <MiniMetric
          label="Energy"
          value={`${formatNumber(
            machine.energy
          )} kWh`}
        />

        <MiniMetric
          label="Carbon"
          value={`${formatNumber(
            machine.carbon
          )} kg`}
        />

      </div>

      {/* Machine status */}

      <div className="mt-2 flex items-center justify-between border-t border-[#EEF2EF] pt-2">

        <span className="truncate text-[6px] font-semibold text-[#94A39A]">
          {machine.maintenance_status ||
            "Unknown"}
        </span>

        <span className="truncate text-[6px] font-bold text-[#64736A]">
          {machine.type}
        </span>

      </div>

    </button>
  );
}

/* ============================================================
   MINI METRIC
============================================================ */

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">

      <p className="text-[5px] font-bold uppercase tracking-[0.08em] text-[#A0ABA4]">
        {label}
      </p>

      <p className="mt-0.5 truncate text-[7px] font-extrab800 text-[#526159]">
        {value}
      </p>

    </div>
  );
}

/* ============================================================
   LEGEND
============================================================ */

function Legend({
  dot,
  label,
}: {
  dot: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1">

      <span
        className={`h-1.5 w-1.5 rounded-full ${dot}`}
      />

      <span className="text-[6px] font-semibold text-[#7B8981]">
        {label}
      </span>

    </span>
  );
}

/* ============================================================
   GROUPING
============================================================ */

function groupByDepartment(
  machines: Machine[]
) {
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
  )
    .sort(
      ([a], [b]) =>
        a.localeCompare(b)
    )
    .map(
      ([
        name,
        departmentMachines,
      ]) => ({
        name,
        machines:
          departmentMachines,
      })
    );
}

/* ============================================================
   DEPARTMENT HEALTH
============================================================ */

function getDepartmentHealth(
  machines: Machine[]
) {
  if (
    machines.length === 0
  ) {
    return 0;
  }

  const total =
    machines.reduce(
      (
        sum,
        machine
      ) =>
        sum +
        clamp(
          Number(
            machine.health_score ??
              0
          ),
          0,
          100
        ),
      0
    );

  return (
    total /
    machines.length
  );
}

/* ============================================================
   MACHINE STATUS
============================================================ */

function getMachineStatus(
  machine: Machine
): MachineStatus {
  const health =
    clamp(
      Number(
        machine.health_score ??
          0
      ),
      0,
      100
    );

  const maintenance =
    String(
      machine.maintenance_status ??
        ""
    ).toLowerCase();

  /* ----------------------------------------------------------
     CRITICAL
  ---------------------------------------------------------- */

  if (
    maintenance.includes(
      "emergency"
    ) ||
    maintenance.includes(
      "offline"
    ) ||
    health < 50
  ) {
    return {
      level: "critical",
      line: "bg-[#EF4444]",
      dot: "bg-[#EF4444]",
      iconBackground:
        "bg-[#FEF2F2]",
      iconText:
        "text-[#DC2626]",
      pulse: false,
    };
  }

  /* ----------------------------------------------------------
     WARNING
  ---------------------------------------------------------- */

  if (
    maintenance.includes(
      "maintenance"
    ) ||
    maintenance.includes(
      "warning"
    ) ||
    maintenance.includes(
      "attention"
    ) ||
    maintenance.includes(
      "stop"
    ) ||
    health < 75
  ) {
    return {
      level: "warning",
      line: "bg-[#F59E0B]",
      dot: "bg-[#F59E0B]",
      iconBackground:
        "bg-[#FFF7E6]",
      iconText:
        "text-[#D97706]",
      pulse: false,
    };
  }

  /* ----------------------------------------------------------
     HEALTHY
  ---------------------------------------------------------- */

  return {
    level: "healthy",
    line: "bg-[#16A34A]",
    dot: "bg-[#16A34A]",
    iconBackground:
      "bg-[#EAF8F0]",
    iconText:
      "text-[#15803D]",
    pulse: true,
  };
}

/* ============================================================
   MACHINE TYPE ICON
============================================================ */

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
        size={15}
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
        size={15}
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
        size={15}
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
        size={15}
        strokeWidth={1.7}
      />
    );
  }

  return (
    <Zap
      size={15}
      strokeWidth={1.7}
    />
  );
}

/* ============================================================
   NUMBER FORMAT
============================================================ */

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

/* ============================================================
   CLAMP
============================================================ */

function clamp(
  value: number,
  min: number,
  max: number
) {
  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );
}

/* ============================================================
   LOADING MAP
============================================================ */

function MapLoading() {
  return (
    <div className="animate-pulse bg-[#F8FAF9] p-4">

      <div className="rounded-[14px] border border-[#E2E9E4] bg-white p-4">

        <div className="h-4 w-32 rounded bg-[#E7EEE9]" />

        <div className="mt-2 h-2 w-56 rounded bg-[#F0F4F1]" />

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">

          {[1, 2, 3, 4].map(
            (item) => (
              <div
                key={item}
                className="h-32 rounded-[11px] bg-[#F1F5F2]"
              />
            )
          )}

        </div>

      </div>

    </div>
  );
}