import type { Machine } from "../types/digitalTwin";

interface Props {
  machine: Machine | null;
}

type MachineCondition =
  | "Healthy"
  | "Warning"
  | "Critical";

function getCondition(
  machine: Machine
): MachineCondition {
  const health = Number(
    machine.health_score ?? 0
  );

  const failureProbability = Number(
    machine.failure_probability ?? 0
  );

  const status = String(
    machine.maintenance_status ?? ""
  )
    .trim()
    .toLowerCase();

  if (
    status.includes("emergency") ||
    status.includes("stopped") ||
    health < 60 ||
    failureProbability >= 70
  ) {
    return "Critical";
  }

  if (
    status.includes("maintenance") ||
    health < 80 ||
    failureProbability >= 35
  ) {
    return "Warning";
  }

  return "Healthy";
}

function getConditionStyles(
  condition: MachineCondition
) {
  switch (condition) {
    case "Critical":
      return {
        accent: "#EF4444",
        soft: "#FEF2F2",
        border: "#FECACA",
        text: "#DC2626",
        badge: "Critical",
      };

    case "Warning":
      return {
        accent: "#F59E0B",
        soft: "#FFFBEB",
        border: "#FDE68A",
        text: "#D97706",
        badge: "Attention",
      };

    default:
      return {
        accent: "#16A34A",
        soft: "#ECFDF5",
        border: "#A7F3D0",
        text: "#047857",
        badge: "Healthy",
      };
  }
}

/* ============================================================
   MACHINE VISUAL
   ============================================================ */

function MachineVisual({
  type,
  accent,
  soft,
}: {
  type: string;
  accent: string;
  soft: string;
}) {
  const normalized =
    type.toLowerCase();

  if (normalized.includes("boiler")) {
    return (
      <BoilerVisual
        accent={accent}
        soft={soft}
      />
    );
  }

  if (normalized.includes("pump")) {
    return (
      <PumpVisual
        accent={accent}
        soft={soft}
      />
    );
  }

  if (normalized.includes("motor")) {
    return (
      <MotorVisual
        accent={accent}
        soft={soft}
      />
    );
  }

  if (
    normalized.includes(
      "compressor"
    )
  ) {
    return (
      <CompressorVisual
        accent={accent}
        soft={soft}
      />
    );
  }

  return (
    <GenericMachineVisual
      accent={accent}
      soft={soft}
    />
  );
}

/* ============================================================
   BOILER
================================================================ */

function BoilerVisual({
  accent,
  soft,
}: {
  accent: string;
  soft: string;
}) {
  return (
    <div className="relative h-[190px] w-[210px]">

      <div
        className="absolute bottom-[27px] left-[48px] h-[118px] w-[114px] rounded-[21px] border-[3px] bg-white shadow-[0_14px_30px_rgba(15,23,42,0.10)]"
        style={{
          borderColor: accent,
        }}
      >

        <div
          className="absolute -top-[15px] left-[14px] h-[25px] w-[82px] rounded-full border-[3px] bg-white"
          style={{
            borderColor: accent,
          }}
        />

        <div
          className="absolute left-[20px] top-[30px] h-[68px] w-[68px] rounded-full border-[3px]"
          style={{
            borderColor: accent,
            backgroundColor: soft,
          }}
        >

          <div
            className="absolute left-1/2 top-1/2 h-[36px] w-[36px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              backgroundColor: accent,
              opacity: 0.14,
            }}
          />

          <div
            className="absolute left-1/2 top-1/2 h-[11px] w-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              backgroundColor: accent,
            }}
          />

        </div>

        <div
          className="absolute right-[10px] top-[34px] h-[24px] w-[24px] rounded-full border-2 bg-white"
          style={{
            borderColor: accent,
          }}
        />

        <div
          className="absolute -right-[27px] top-[50px] h-[9px] w-[27px] rounded-r-full"
          style={{
            backgroundColor: accent,
          }}
        />

      </div>

      <div
        className="absolute bottom-[14px] left-[30px] h-[11px] w-[155px] rounded-full"
        style={{
          backgroundColor: accent,
        }}
      />

      <div
        className="absolute bottom-0 left-[58px] h-[17px] w-[14px] rounded-b"
        style={{
          backgroundColor: accent,
        }}
      />

      <div
        className="absolute bottom-0 right-[58px] h-[17px] w-[14px] rounded-b"
        style={{
          backgroundColor: accent,
        }}
      />

      <div className="absolute left-[96px] top-[0px] flex gap-2">

        <span
          className="h-[23px] w-[6px] rounded-full"
          style={{
            backgroundColor: accent,
            opacity: 0.16,
          }}
        />

        <span
          className="mt-[-7px] h-[31px] w-[6px] rounded-full"
          style={{
            backgroundColor: accent,
            opacity: 0.10,
          }}
        />

        <span
          className="mt-[3px] h-[19px] w-[6px] rounded-full"
          style={{
            backgroundColor: accent,
            opacity: 0.18,
          }}
        />

      </div>
    </div>
  );
}

/* ============================================================
   PUMP
================================================================ */

function PumpVisual({
  accent,
  soft,
}: {
  accent: string;
  soft: string;
}) {
  return (
    <div className="relative h-[190px] w-[210px]">

      <div
        className="absolute left-[53px] top-[40px] h-[100px] w-[100px] rounded-full border-[4px] bg-white shadow-[0_14px_30px_rgba(15,23,42,0.10)]"
        style={{
          borderColor: accent,
        }}
      >

        <div
          className="absolute left-1/2 top-1/2 h-[62px] w-[62px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px]"
          style={{
            borderColor: accent,
            backgroundColor: soft,
          }}
        />

        <div className="absolute left-1/2 top-1/2 h-[40px] w-[40px] -translate-x-1/2 -translate-y-1/2">

          {[0, 60, 120, 180, 240, 300].map(
            (rotation) => (
              <span
                key={rotation}
                className="absolute left-1/2 top-1/2 h-[18px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  backgroundColor: accent,
                  transform: `translate(-50%, -50%) rotate(${rotation}deg) translateY(-11px)`,
                  transformOrigin:
                    "center 11px",
                }}
              />
            )
          )}

          <span
            className="absolute left-1/2 top-1/2 h-[11px] w-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              backgroundColor: accent,
            }}
          />

        </div>
      </div>

      <div
        className="absolute left-[8px] top-[82px] h-[16px] w-[47px] rounded-l-full"
        style={{
          backgroundColor: accent,
        }}
      />

      <div
        className="absolute right-[8px] top-[82px] h-[16px] w-[47px] rounded-r-full"
        style={{
          backgroundColor: accent,
        }}
      />

      <div
        className="absolute bottom-[18px] left-[76px] h-[43px] w-[58px] rounded-[10px] border-2 bg-white"
        style={{
          borderColor: accent,
        }}
      />

      <div
        className="absolute bottom-[7px] left-[49px] h-[9px] w-[113px] rounded-full"
        style={{
          backgroundColor: accent,
        }}
      />
    </div>
  );
}

/* ============================================================
   MOTOR
================================================================ */

function MotorVisual({
  accent,
  soft,
}: {
  accent: string;
  soft: string;
}) {
  return (
    <div className="relative h-[190px] w-[210px]">

      <div
        className="absolute left-[30px] top-[48px] h-[92px] w-[150px] rounded-[19px] border-[4px] bg-white shadow-[0_14px_30px_rgba(15,23,42,0.10)]"
        style={{
          borderColor: accent,
        }}
      >

        {[0, 1, 2, 3, 4].map(
          (rib) => (
            <span
              key={rib}
              className="absolute top-[15px] h-[59px] w-[4px] rounded-full"
              style={{
                left: `${27 + rib * 21}px`,
                backgroundColor: accent,
                opacity: 0.32,
              }}
            />
          )
        )}

        <div
          className="absolute left-[56px] top-[22px] h-[45px] w-[45px] rounded-full border-[3px]"
          style={{
            borderColor: accent,
            backgroundColor: soft,
          }}
        />

        <div
          className="absolute left-[72px] top-[38px] h-[13px] w-[13px] rounded-full"
          style={{
            backgroundColor: accent,
          }}
        />

      </div>

      <div
        className="absolute right-[8px] top-[84px] h-[16px] w-[34px]"
        style={{
          backgroundColor: accent,
        }}
      />

      <div
        className="absolute left-[17px] top-[74px] h-[38px] w-[16px] rounded-l"
        style={{
          backgroundColor: accent,
        }}
      />

      <div
        className="absolute bottom-[21px] left-[20px] h-[10px] w-[170px] rounded-full"
        style={{
          backgroundColor: accent,
        }}
      />

      <div
        className="absolute bottom-[9px] left-[44px] h-[17px] w-[11px]"
        style={{
          backgroundColor: accent,
        }}
      />

      <div
        className="absolute bottom-[9px] right-[44px] h-[17px] w-[11px]"
        style={{
          backgroundColor: accent,
        }}
      />
    </div>
  );
}

/* ============================================================
   COMPRESSOR
================================================================ */

function CompressorVisual({
  accent,
  soft,
}: {
  accent: string;
  soft: string;
}) {
  return (
    <div className="relative h-[190px] w-[210px]">

      <div
        className="absolute left-[25px] top-[76px] h-[65px] w-[160px] rounded-[32px] border-[4px] bg-white shadow-[0_14px_30px_rgba(15,23,42,0.10)]"
        style={{
          borderColor: accent,
        }}
      >

        <div
          className="absolute left-[42px] top-[18px] h-[23px] w-[73px] rounded-full"
          style={{
            backgroundColor: soft,
          }}
        />

        <div
          className="absolute right-[20px] top-[18px] h-[23px] w-[23px] rounded-full border-2"
          style={{
            borderColor: accent,
          }}
        />

      </div>

      <div
        className="absolute left-[67px] top-[34px] h-[58px] w-[80px] rounded-[13px] border-[3px] bg-white"
        style={{
          borderColor: accent,
        }}
      >

        <div
          className="absolute left-[18px] top-[12px] h-[29px] w-[29px] rounded-full border-2"
          style={{
            borderColor: accent,
            backgroundColor: soft,
          }}
        />

      </div>

      <div
        className="absolute right-[8px] top-[59px] h-[11px] w-[43px] rounded-r-full"
        style={{
          backgroundColor: accent,
        }}
      />

      <div
        className="absolute bottom-[31px] left-[49px] h-[23px] w-[11px]"
        style={{
          backgroundColor: accent,
        }}
      />

      <div
        className="absolute bottom-[31px] right-[49px] h-[23px] w-[11px]"
        style={{
          backgroundColor: accent,
        }}
      />

      <div
        className="absolute bottom-[20px] left-[35px] h-[9px] w-[143px] rounded-full"
        style={{
          backgroundColor: accent,
        }}
      />
    </div>
  );
}

/* ============================================================
   GENERIC MACHINE
================================================================ */

function GenericMachineVisual({
  accent,
  soft,
}: {
  accent: string;
  soft: string;
}) {
  return (
    <div className="relative h-[190px] w-[210px]">

      <div
        className="absolute left-[37px] top-[40px] flex h-[105px] w-[136px] items-center justify-center rounded-[20px] border-[4px] bg-white shadow-[0_14px_30px_rgba(15,23,42,0.10)]"
        style={{
          borderColor: accent,
        }}
      >

        <div
          className="flex h-[60px] w-[60px] items-center justify-center rounded-full border-[3px]"
          style={{
            borderColor: accent,
            backgroundColor: soft,
          }}
        >
          <span
            className="text-2xl"
            style={{
              color: accent,
            }}
          >
            ⚙
          </span>
        </div>

      </div>

      <div
        className="absolute bottom-[20px] left-[25px] h-[10px] w-[160px] rounded-full"
        style={{
          backgroundColor: accent,
        }}
      />

    </div>
  );
}

/* ============================================================
   METRIC
================================================================ */

function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number;
  unit?: string;
}) {
  return (
    <div className="rounded-[10px] border border-[#E4EBE6] bg-[#FAFCFB] px-3 py-2.5">

      <p className="truncate text-[7px] font-bold uppercase tracking-[0.11em] text-[#94A39A]">
        {label}
      </p>

      <p className="mt-1 text-[12px] font-extrab800 text-[#26332C]">

        {value}

        {unit && (
          <span className="ml-1 text-[8px] font-medium text-[#7B8981]">
            {unit}
          </span>
        )}

      </p>

    </div>
  );
}

/* ============================================================
   MAIN COMPONENT
================================================================ */

export default function MachineDetails({
  machine,
}: Props) {
  if (!machine) {
    return (
      <div className="rounded-[14px] border border-[#DDE7E1] bg-white p-6">

        <div className="flex min-h-[250px] items-center justify-center">

          <div className="text-center">

            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#F1F6F3] text-[#7B8981]">
              <span className="text-lg">
                ▣
              </span>
            </div>

            <p className="mt-3 text-[13px] font-bold text-[#405048]">
              Select a machine
            </p>

            <p className="mx-auto mt-1 max-w-[240px] text-[9px] leading-4 text-[#94A39A]">
              Select an asset from the digital twin to view live telemetry, health and predictive intelligence.
            </p>

          </div>

        </div>

      </div>
    );
  }

  const condition =
    getCondition(machine);

  const styles =
    getConditionStyles(
      condition
    );

  const health =
    Number(
      machine.health_score ?? 0
    );

  const efficiency =
    Number(
      machine.efficiency ?? 0
    );

  const failureProbability =
    Number(
      machine.failure_probability ?? 0
    );

  const remainingLife =
    Number(
      machine.remaining_useful_life ?? 0
    );

  const machineType =
    machine.type ||
    "Machine";

  const maintenanceStatus =
    machine.maintenance_status ||
    "Unknown";

  return (
    <div className="overflow-hidden rounded-[15px] border border-[#DDE7E1] bg-white shadow-[0_2px_10px_rgba(15,23,42,0.025)]">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="flex flex-col gap-3 border-b border-[#E6ECE8] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

        <div className="min-w-0">

          <div className="flex items-center gap-2">

            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor:
                  styles.accent,
              }}
            />

            <p className="text-[8px] font-bold uppercase tracking-[0.17em] text-[#16A34A]">
              Digital Twin Asset
            </p>

          </div>

          <h2 className="mt-1.5 truncate text-[18px] font-extrab800 tracking-[-0.025em] text-[#26332C]">
            {machine.name}
          </h2>

          <p className="mt-0.5 truncate text-[9px] text-[#94A39A]">
            {machine.id} · {machineType}
            {machine.location
              ? ` · ${machine.location}`
              : ""}
          </p>

        </div>

        <div
          className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5"
          style={{
            backgroundColor:
              styles.soft,
            borderColor:
              styles.border,
            color:
              styles.text,
          }}
        >

          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor:
                styles.accent,
            }}
          />

          <span className="text-[8px] font-bold uppercase tracking-[0.08em]">
            {styles.badge}
          </span>

        </div>

      </div>

      {/* ======================================================
          MAIN CONTENT
      ====================================================== */}

      <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-[minmax(270px,0.85fr)_1.15fr]">

        {/* ====================================================
            MACHINE VISUAL
        ==================================================== */}

        <div
          className="relative flex min-h-[285px] items-center justify-center overflow-hidden rounded-[13px] border"
          style={{
            backgroundColor:
              styles.soft,
            borderColor:
              styles.border,
          }}
        >

          {/* soft visual glow */}

          <div
            className="pointer-events-none absolute h-52 w-52 rounded-full blur-3xl"
            style={{
              backgroundColor:
                styles.accent,
              opacity: 0.09,
            }}
          />

          {/* live badge */}

          <div
            className="absolute right-3.5 top-3.5 z-20 flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-1"
            style={{
              borderColor:
                styles.border,
            }}
          >

            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full"
              style={{
                backgroundColor:
                  styles.accent,
              }}
            />

            <span
              className="text-[7px] font-bold uppercase tracking-[0.1em]"
              style={{
                color:
                  styles.text,
              }}
            >
              Live
            </span>

          </div>

          <div className="relative z-10">

            <MachineVisual
              type={machineType}
              accent={styles.accent}
              soft={styles.soft}
            />

            <div className="-mt-2 text-center">

              <p className="text-[11px] font-bold text-[#26332C]">
                {machine.name}
              </p>

              <p
                className="mt-1 text-[7px] font-bold uppercase tracking-[0.12em]"
                style={{
                  color:
                    styles.text,
                }}
              >
                {machineType}
              </p>

            </div>

          </div>

        </div>

        {/* ====================================================
            TELEMETRY / INTELLIGENCE
        ==================================================== */}

        <div className="min-w-0">

          <div className="flex items-end justify-between gap-3">

            <div className="min-w-0">

              <p className="text-[8px] font-bold uppercase tracking-[0.15em] text-[#16A34A]">
                Live Telemetry
              </p>

              <p className="mt-1 text-[10px] text-[#7B8981]">
                Current operating condition
              </p>

            </div>

            <span className="flex shrink-0 items-center gap-1.5 text-[7px] font-bold uppercase tracking-[0.08em] text-[#16A34A]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#16A34A]" />
              Connected
            </span>

          </div>

          {/* KPI METRICS */}

          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">

            <Metric
              label="Health"
              value={health.toFixed(1)}
              unit="%"
            />

            <Metric
              label="Efficiency"
              value={
                Number.isFinite(
                  efficiency
                )
                  ? efficiency.toFixed(
                      1
                    )
                  : "—"
              }
              unit="%"
            />

            <Metric
              label="Failure Risk"
              value={
                Number.isFinite(
                  failureProbability
                )
                  ? failureProbability.toFixed(
                      1
                    )
                  : "—"
              }
              unit="%"
            />

          </div>

          {/* HEALTH BAR */}

          <div className="mt-3 rounded-[11px] border border-[#E4EBE6] bg-[#FAFCFB] p-3.5">

            <div className="flex items-center justify-between">

              <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-[#7B8981]">
                Asset Health
              </span>

              <span
                className="text-[10px] font-bold"
                style={{
                  color:
                    styles.text,
                }}
              >
                {health.toFixed(1)}%
              </span>

            </div>

            <div className="mt-2 h-[6px] overflow-hidden rounded-full bg-[#E7EEE9]">

              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(
                      0,
                      health
                    )
                  )}%`,
                  backgroundColor:
                    styles.accent,
                }}
              />

            </div>

          </div>

          {/* TELEMETRY */}

          <div className="mt-3 grid grid-cols-2 gap-2.5">

            <Metric
              label="Temperature"
              value={formatNumber(
                machine.temperature
              )}
              unit="°C"
            />

            <Metric
              label="Pressure"
              value={formatNumber(
                machine.pressure
              )}
              unit="bar"
            />

            <Metric
              label="Vibration"
              value={formatNumber(
                machine.vibration
              )}
              unit="mm/s"
            />

            <Metric
              label="Power"
              value={formatNumber(
                machine.power
              )}
              unit="kW"
            />

          </div>

          {/* STATUS + RUL */}

          <div className="mt-3 grid grid-cols-2 gap-2.5">

            <Metric
              label="Machine Status"
              value={
                maintenanceStatus
              }
            />

            <Metric
              label="Remaining Useful Life"
              value={
                Number.isFinite(
                  remainingLife
                )
                  ? remainingLife
                  : "—"
              }
              unit="hrs"
            />

          </div>

        </div>

      </div>

      {/* ======================================================
          AI INSIGHT
      ====================================================== */}

      <div className="border-t border-[#E6ECE8] px-5 py-4">

        <div className="rounded-[11px] border border-[#DDD0F5] bg-[#FAF7FF] p-3.5">

          <div className="flex items-start gap-3">

            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-white text-[#7C3AED]">
              <span className="text-sm">
                ✦
              </span>
            </div>

            <div className="min-w-0">

              <div className="flex items-center gap-2">

                <p className="text-[8px] font-bold uppercase tracking-[0.13em] text-[#7C3AED]">
                  AI Predictive Insight
                </p>

                <span className="rounded-full bg-[#F0E9FE] px-1.5 py-0.5 text-[6px] font-bold uppercase tracking-[0.08em] text-[#7C3AED]">
                  AI
                </span>

              </div>

              <p className="mt-1.5 text-[9px] leading-5 text-[#64736A]">

                {machine.ai_prediction
                  ?.recommended_action ||
                  "AI monitoring is active. The system will surface a recommendation when predictive analysis identifies a meaningful action."}

              </p>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

/* ============================================================
   NUMBER FORMAT
================================================================ */

function formatNumber(
  value: number | undefined
): string {
  if (
    value === undefined ||
    value === null ||
    !Number.isFinite(
      Number(value)
    )
  ) {
    return "—";
  }

  return Number(value).toFixed(
    1
  );
}