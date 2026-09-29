import type { Machine } from "../types/digitalTwin";

interface SensorGridProps {
  machine: Machine | null;
}

interface SensorCardProps {
  label: string;
  value: number | undefined;
  unit: string;
  description: string;
  icon: React.ReactNode;
  status?: "normal" | "warning" | "critical";
}

type SensorStatus =
  | "normal"
  | "warning"
  | "critical";

/* ============================================================
   NUMBER
============================================================ */

function safeNumber(
  value: number | undefined
): number | null {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return number;
}

/* ============================================================
   SENSOR STATUS
============================================================ */

function getTemperatureStatus(
  value: number | undefined
): SensorStatus {
  const number = safeNumber(value);

  if (number === null) {
    return "normal";
  }

  if (number >= 210) {
    return "critical";
  }

  if (number >= 195) {
    return "warning";
  }

  return "normal";
}

function getPressureStatus(
  value: number | undefined
): SensorStatus {
  const number = safeNumber(value);

  if (number === null) {
    return "normal";
  }

  if (number >= 9.5) {
    return "critical";
  }

  if (number >= 8.5) {
    return "warning";
  }

  return "normal";
}

function getVibrationStatus(
  value: number | undefined
): SensorStatus {
  const number = safeNumber(value);

  if (number === null) {
    return "normal";
  }

  if (number >= 2.2) {
    return "critical";
  }

  if (number >= 1.8) {
    return "warning";
  }

  return "normal";
}

function getPowerStatus(
  value: number | undefined
): SensorStatus {
  const number = safeNumber(value);

  if (number === null) {
    return "normal";
  }

  if (number >= 1000) {
    return "critical";
  }

  if (number >= 800) {
    return "warning";
  }

  return "normal";
}

/* ============================================================
   STATUS STYLES
============================================================ */

function getStatusStyles(
  status: SensorStatus
) {
  switch (status) {
    case "critical":
      return {
        border:
          "border-[#F3C2C2]",
        background:
          "bg-[#FEF7F7]",
        icon:
          "bg-[#FDE8E8] text-[#DC2626]",
        value:
          "text-[#DC2626]",
        dot:
          "bg-[#EF4444]",
        label:
          "Critical",
      };

    case "warning":
      return {
        border:
          "border-[#F3D49A]",
        background:
          "bg-[#FFFCF5]",
        icon:
          "bg-[#FFF3D7] text-[#D97706]",
        value:
          "text-[#D97706]",
        dot:
          "bg-[#F59E0B]",
        label:
          "Attention",
      };

    default:
      return {
        border:
          "border-[#DDE7E1]",
        background:
          "bg-white",
        icon:
          "bg-[#ECFDF5] text-[#15803D]",
        value:
          "text-[#26332C]",
        dot:
          "bg-[#16A34A]",
        label:
          "Normal",
      };
  }
}

/* ============================================================
   SENSOR ICONS
============================================================ */

function TemperatureIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[17px] w-[17px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path
        d="M14 14.5V5a2 2 0 0 0-4 0v9.5a4 4 0 1 0 4 0Z"
      />
      <path d="M12 11V6" />
    </svg>
  );
}

function PressureIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[17px] w-[17px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <circle
        cx="12"
        cy="12"
        r="8"
      />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

function VibrationIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[17px] w-[17px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M4 12h2" />
      <path d="M8 8v8" />
      <path d="M12 5v14" />
      <path d="M16 8v8" />
      <path d="M20 12h-2" />
    </svg>
  );
}

function PowerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[17px] w-[17px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M13 2 5 13h6l-1 9 8-11h-6l1-9Z" />
    </svg>
  );
}

/* ============================================================
   SENSOR CARD
============================================================ */

function SensorCard({
  label,
  value,
  unit,
  description,
  icon,
  status = "normal",
}: SensorCardProps) {
  const styles =
    getStatusStyles(status);

  const numeric =
    safeNumber(value);

  return (
    <div
      className={[
        "group rounded-[13px] border p-4",
        "transition-all duration-200",
        "hover:-translate-y-[1px]",
        "hover:shadow-[0_6px_18px_rgba(15,23,42,0.05)]",
        styles.border,
        styles.background,
      ].join(" ")}
    >

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="flex items-start justify-between gap-3">

        <div className="flex min-w-0 items-center gap-2.5">

          <div
            className={[
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px]",
              styles.icon,
            ].join(" ")}
          >
            {icon}
          </div>

          <div className="min-w-0">

            <p className="truncate text-[8px] font-bold uppercase tracking-[0.12em] text-[#7B8981]">
              {label}
            </p>

            <p className="mt-0.5 truncate text-[7px] text-[#A0ABA4]">
              {description}
            </p>

          </div>

        </div>

        <div className="flex shrink-0 items-center gap-1.5">

          <span
            className={`h-1.5 w-1.5 rounded-full ${styles.dot}`}
          />

          <span className="text-[6px] font-bold uppercase tracking-[0.07em] text-[#94A39A]">
            {styles.label}
          </span>

        </div>

      </div>

      {/* ======================================================
          VALUE
      ====================================================== */}

      <div className="mt-4 flex items-end gap-1">

        <span
          className={[
            "text-[22px] font-extrab800 tracking-[-0.025em]",
            styles.value,
          ].join(" ")}
        >
          {numeric === null
            ? "—"
            : numeric.toFixed(
                label === "Pressure" ||
                  label === "Vibration"
                  ? 2
                  : 1
              )}
        </span>

        {numeric !== null && (
          <span className="mb-[3px] text-[8px] font-semibold text-[#94A39A]">
            {unit}
          </span>
        )}

      </div>

      {/* ======================================================
          STATUS LINE
      ====================================================== */}

      <div className="mt-3 border-t border-[#E7EEE9] pt-2.5">

        <div className="flex items-center justify-between">

          <span className="text-[7px] text-[#A0ABA4]">
            Live sensor
          </span>

          <span className="flex items-center gap-1 text-[6px] font-bold uppercase tracking-[0.07em] text-[#16A34A]">

            <span className="h-1 w-1 animate-pulse rounded-full bg-[#16A34A]" />

            Connected

          </span>

        </div>

      </div>

    </div>
  );
}

/* ============================================================
   EMPTY STATE
============================================================ */

function EmptySensorState() {
  return (
    <div className="rounded-[14px] border border-[#DDE7E1] bg-white p-6">

      <div className="flex min-h-[190px] items-center justify-center">

        <div className="text-center">

          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-[11px] bg-[#F1F6F3] text-[#7B8981]">

            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <rect
                x="4"
                y="4"
                width="16"
                height="16"
                rx="3"
              />
              <path d="M8 12h8" />
              <path d="M12 8v8" />
            </svg>

          </div>

          <p className="mt-3 text-[11px] font-bold text-[#526159]">
            No machine selected
          </p>

          <p className="mx-auto mt-1 max-w-[250px] text-[8px] leading-4 text-[#A0ABA4]">
            Select a machine from the digital twin to view its live sensor telemetry.
          </p>

        </div>

      </div>

    </div>
  );
}

/* ============================================================
   MAIN SENSOR GRID
============================================================ */

export default function SensorGrid({
  machine,
}: SensorGridProps) {
  if (!machine) {
    return (
      <EmptySensorState />
    );
  }

  return (
    <section className="rounded-[15px] border border-[#DDE7E1] bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.025)] sm:p-5">

      {/* ======================================================
          SECTION HEADER
      ====================================================== */}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">

        <div className="min-w-0">

          <div className="flex items-center gap-2">

            <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />

            <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-[#16A34A]">
              Sensor Telemetry
            </p>

          </div>

          <h3 className="mt-1.5 text-[15px] font-extrab800 tracking-[-0.02em] text-[#26332C]">
            Live Machine Sensors
          </h3>

          <p className="mt-0.5 text-[8px] text-[#94A39A]">
            Real-time telemetry for{" "}
            <span className="font-semibold text-[#64736A]">
              {machine.name}
            </span>
          </p>

        </div>

        <div className="flex w-fit items-center gap-1.5 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-1.5">

          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#16A34A]" />

          <span className="text-[6px] font-bold uppercase tracking-[0.09em] text-[#047857]">
            Live Data
          </span>

        </div>

      </div>

      {/* ======================================================
          SENSOR CARDS
      ====================================================== */}

      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">

        <SensorCard
          label="Temperature"
          value={
            machine.temperature
          }
          unit="°C"
          description="Thermal condition"
          icon={
            <TemperatureIcon />
          }
          status={getTemperatureStatus(
            machine.temperature
          )}
        />

        <SensorCard
          label="Pressure"
          value={
            machine.pressure
          }
          unit="bar"
          description="Process pressure"
          icon={
            <PressureIcon />
          }
          status={getPressureStatus(
            machine.pressure
          )}
        />

        <SensorCard
          label="Vibration"
          value={
            machine.vibration
          }
          unit="mm/s"
          description="Mechanical vibration"
          icon={
            <VibrationIcon />
          }
          status={getVibrationStatus(
            machine.vibration
          )}
        />

        <SensorCard
          label="Power"
          value={
            machine.power
          }
          unit="kW"
          description="Current energy load"
          icon={
            <PowerIcon />
          }
          status={getPowerStatus(
            machine.power
          )}
        />

      </div>

    </section>
  );
}