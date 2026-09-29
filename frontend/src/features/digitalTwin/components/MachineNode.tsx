import type { MachineNodeProps } from "../types/digitalTwin";

type Machine =
  MachineNodeProps["machine"];

type HealthStatus =
  | "Healthy"
  | "Warning"
  | "Critical";

function getHealth(
  machine: Machine
): number {
  return Math.max(
    0,
    Math.min(
      100,
      Number(
        machine.health_score ?? 0
      )
    )
  );
}

function getFailureProbability(
  machine: Machine
): number {
  return Math.max(
    0,
    Math.min(
      100,
      Number(
        machine.failure_probability ??
          0
      )
    )
  );
}

/* ============================================================
   HEALTH / MACHINE CONDITION
============================================================ */

function getHealthStatus(
  machine: Machine
): HealthStatus {
  const health =
    getHealth(machine);

  const failureProbability =
    getFailureProbability(
      machine
    );

  const status =
    String(
      machine.maintenance_status ??
        ""
    )
      .trim()
      .toLowerCase();

  if (
    status.includes(
      "emergency"
    ) ||
    status.includes(
      "failure"
    ) ||
    status.includes(
      "stopped"
    ) ||
    health < 60 ||
    failureProbability >= 70
  ) {
    return "Critical";
  }

  if (
    status.includes(
      "maintenance"
    ) ||
    status.includes(
      "attention"
    ) ||
    status.includes(
      "warning"
    ) ||
    health < 80 ||
    failureProbability >= 35
  ) {
    return "Warning";
  }

  return "Healthy";
}

/* ============================================================
   STATUS STYLES
============================================================ */

function getStatusStyles(
  status: HealthStatus
) {
  switch (status) {
    case "Critical":
      return {
        dot: "bg-[#EF4444]",
        text: "text-[#DC2626]",
        bar: "bg-[#EF4444]",
        soft: "bg-[#FEF2F2]",
        border: "border-[#F3C2C2]",
        icon: "text-[#DC2626]",
      };

    case "Warning":
      return {
        dot: "bg-[#F59E0B]",
        text: "text-[#D97706]",
        bar: "bg-[#F59E0B]",
        soft: "bg-[#FFF8E8]",
        border: "border-[#F3D49A]",
        icon: "text-[#D97706]",
      };

    default:
      return {
        dot: "bg-[#16A34A]",
        text: "text-[#15803D]",
        bar: "bg-[#16A34A]",
        soft: "bg-[#F0FBF4]",
        border: "border-[#BCE7CE]",
        icon: "text-[#15803D]",
      };
  }
}

/* ============================================================
   MACHINE TYPE ICON
============================================================ */

function MachineTypeIcon({
  type,
}: {
  type: string;
}) {
  const normalized =
    String(type ?? "")
      .toLowerCase();

  if (
    normalized.includes(
      "boiler"
    )
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      >
        <rect
          x="6"
          y="5"
          width="12"
          height="14"
          rx="3"
        />
        <circle
          cx="12"
          cy="12"
          r="3"
        />
        <path d="M9 3h6" />
        <path d="M9 21h6" />
      </svg>
    );
  }

  if (
    normalized.includes(
      "pump"
    )
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      >
        <circle
          cx="12"
          cy="11"
          r="6"
        />
        <path d="M3 11h3" />
        <path d="M18 11h3" />
        <path d="M9 19h6" />
        <path d="M12 5V2" />
      </svg>
    );
  }

  if (
    normalized.includes(
      "motor"
    )
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      >
        <rect
          x="4"
          y="6"
          width="14"
          height="12"
          rx="3"
        />
        <circle
          cx="11"
          cy="12"
          r="3"
        />
        <path d="M18 10h3v4h-3" />
        <path d="M7 4v2" />
        <path d="M15 4v2" />
      </svg>
    );
  }

  if (
    normalized.includes(
      "compressor"
    )
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      >
        <rect
          x="3"
          y="9"
          width="18"
          height="8"
          rx="4"
        />
        <rect
          x="8"
          y="4"
          width="8"
          height="7"
          rx="2"
        />
        <path d="M6 17v3" />
        <path d="M18 17v3" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="3"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
      />
    </svg>
  );
}

/* ============================================================
   TELEMETRY VALUE
============================================================ */

function TelemetryValue({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | undefined;
  unit: string;
}) {
  const numeric =
    Number(value);

  return (
    <div className="min-w-0">

      <p className="text-[6px] font-bold uppercase tracking-[0.08em] text-[#A0ABA4]">
        {label}
      </p>

      <p className="mt-0.5 truncate text-[8px] font-bold text-[#526159]">

        {Number.isFinite(
          numeric
        )
          ? numeric.toFixed(1)
          : "—"}

        {Number.isFinite(
          numeric
        ) && (
          <span className="ml-0.5 text-[6px] font-medium text-[#94A39A]">
            {unit}
          </span>
        )}

      </p>

    </div>
  );
}

/* ============================================================
   MACHINE NODE
============================================================ */

export default function MachineNode({
  machine,
  selected = false,
  onSelect,
}: MachineNodeProps) {
  const health =
    getHealth(machine);

  const healthStatus =
    getHealthStatus(
      machine
    );

  const colors =
    getStatusStyles(
      healthStatus
    );

  const failureProbability =
    getFailureProbability(
      machine
    );

  const maintenanceStatus =
    String(
      machine.maintenance_status ??
        "Unknown"
    );

  const department =
    String(
      machine.department ??
        "Factory"
    );

  const machineType =
    String(
      machine.type ??
        "Machine"
    );

  return (
    <button
      type="button"
      onClick={() =>
        onSelect?.(machine)
      }
      className={[
        "group w-full rounded-[13px] border bg-white p-3.5 text-left",
        "transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20",
        selected
          ? "border-[#16A34A] shadow-[0_0_0_2px_rgba(22,163,74,0.08),0_6px_18px_rgba(15,23,42,0.05)]"
          : "border-[#DDE7E1] shadow-[0_2px_8px_rgba(15,23,42,0.025)] hover:-translate-y-[1px] hover:border-[#BFD8C8] hover:shadow-[0_6px_18px_rgba(15,23,42,0.05)]",
      ].join(" ")}
    >

      {/* ======================================================
          TOP
      ====================================================== */}

      <div className="flex items-start justify-between gap-3">

        <div className="flex min-w-0 items-center gap-2.5">

          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] ${colors.soft} ${colors.icon}`}
          >
            <MachineTypeIcon
              type={
                machineType
              }
            />
          </div>

          <div className="min-w-0">

            <h3 className="truncate text-[10px] font-extrab800 text-[#26332C]">
              {machine.name}
            </h3>

            <p className="mt-0.5 truncate text-[7px] text-[#94A39A]">
              {machine.id}
              {" · "}
              {machineType}
            </p>

          </div>

        </div>

        <div className="flex shrink-0 items-center gap-1.5">

          <span
            className={`h-1.5 w-1.5 rounded-full ${colors.dot} ${
              healthStatus ===
              "Critical"
                ? "animate-pulse"
                : ""
            }`}
          />

          <span
            className={`text-[7px] font-bold uppercase tracking-[0.07em] ${colors.text}`}
          >
            {healthStatus}
          </span>

        </div>

      </div>

      {/* ======================================================
          HEALTH
      ====================================================== */}

      <div className="mt-4">

        <div className="flex items-center justify-between">

          <span className="text-[7px] font-bold uppercase tracking-[0.1em] text-[#94A39A]">
            Asset Health
          </span>

          <span
            className={`text-[10px] font-extrab800 ${colors.text}`}
          >
            {health.toFixed(1)}%
          </span>

        </div>

        <div className="mt-1.5 h-[6px] overflow-hidden rounded-full bg-[#E7EEE9]">

          <div
            className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
            style={{
              width: `${health}%`,
            }}
          />

        </div>

      </div>

      {/* ======================================================
          TELEMETRY
      ====================================================== */}

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 rounded-[9px] bg-[#FAFCFB] px-2.5 py-2.5">

        <TelemetryValue
          label="Temperature"
          value={
            machine.temperature
          }
          unit="°C"
        />

        <TelemetryValue
          label="Power"
          value={
            machine.power
          }
          unit="kW"
        />

        <TelemetryValue
          label="Vibration"
          value={
            machine.vibration
          }
          unit="mm/s"
        />

        <TelemetryValue
          label="Failure Risk"
          value={
            failureProbability
          }
          unit="%"
        />

      </div>

      {/* ======================================================
          FOOTER
      ====================================================== */}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#E7EEE9] pt-2.5">

        <span
          className={`truncate rounded-full border px-2 py-1 text-[6px] font-bold uppercase tracking-[0.06em] ${colors.soft} ${colors.border} ${colors.text}`}
        >
          {maintenanceStatus}
        </span>

        <span className="truncate text-[7px] text-[#94A39A]">
          {department}
        </span>

      </div>

      {/* ======================================================
          SELECTED INDICATOR
      ====================================================== */}

      {selected && (
        <div className="mt-2 flex items-center gap-1.5 text-[6px] font-bold uppercase tracking-[0.1em] text-[#16A34A]">

          <span className="h-1 w-1 rounded-full bg-[#16A34A]" />

          Selected Asset

        </div>
      )}

    </button>
  );
}