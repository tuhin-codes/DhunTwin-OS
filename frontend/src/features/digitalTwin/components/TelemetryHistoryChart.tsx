import {
  useEffect,
  useState,
} from "react";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Machine } from "../../../services/api";

type Metric =
  | "power"
  | "temperature"
  | "energy"
  | "carbon";

interface HistoryPoint {
  timestamp: number;
  time: string;
  power: number;
  temperature: number;
  energy: number;
  carbon: number;
}

interface Props {
  machine: Machine;
}

const MAX_POINTS = 60;

const metricConfig: Record<
  Metric,
  {
    label: string;
    unit: string;
    description: string;
    decimals: number;
  }
> = {
  power: {
    label: "Power",
    unit: "kW",
    description: "Electrical load",
    decimals: 1,
  },

  temperature: {
    label: "Temperature",
    unit: "°C",
    description: "Thermal condition",
    decimals: 1,
  },

  energy: {
    label: "Energy",
    unit: "kWh",
    description: "Accumulated energy",
    decimals: 2,
  },

  carbon: {
    label: "Carbon",
    unit: "kg CO₂e",
    description: "Estimated emissions",
    decimals: 2,
  },
};

/* ============================================================
   CREATE TELEMETRY POINT
============================================================ */

function createPoint(
  machine: Machine
): HistoryPoint {
  const timestamp =
    Date.now();

  return {
    timestamp,

    time: new Date(
      timestamp
    ).toLocaleTimeString([], {
      minute: "2-digit",
      second: "2-digit",
    }),

    power:
      Number(machine.power) || 0,

    temperature:
      Number(machine.temperature) ||
      0,

    energy:
      Number(machine.energy) || 0,

    carbon:
      Number(machine.carbon) || 0,
  };
}

/* ============================================================
   MAIN
============================================================ */

export default function TelemetryHistoryChart({
  machine,
}: Props) {
  const [
    metric,
    setMetric,
  ] = useState<Metric>("power");

  /*
   * Each machine keeps its own telemetry
   * history.
   *
   * This is important when the user changes
   * the selected machine.
   */
  const [
    machineHistories,
    setMachineHistories,
  ] = useState<
    Record<
      string,
      HistoryPoint[]
    >
  >({});

  /* ==========================================================
     COLLECT LIVE TELEMETRY
  ========================================================== */

  useEffect(() => {
    const point =
      createPoint(machine);

    setMachineHistories(
      (previous) => {
        const existing =
          previous[
            machine.id
          ] ?? [];

        const last =
          existing[
            existing.length - 1
          ];

        /*
         * Avoid duplicate samples if
         * React renders the component
         * without receiving new telemetry.
         */
        if (
          last &&
          point.timestamp -
            last.timestamp <
            500
        ) {
          return previous;
        }

        const updated = [
          ...existing,
          point,
        ].slice(-MAX_POINTS);

        return {
          ...previous,
          [machine.id]:
            updated,
        };
      }
    );
  }, [
    machine.id,
    machine.power,
    machine.temperature,
    machine.energy,
    machine.carbon,
  ]);

  const history =
    machineHistories[
      machine.id
    ] ?? [];

  const config =
    metricConfig[metric];

  const latestValue =
    history.length > 0
      ? history[
          history.length - 1
        ][metric]
      : getMachineValue(
          machine,
          metric
        );

  const firstValue =
    history.length > 0
      ? history[0][metric]
      : latestValue;

  const change =
    latestValue -
    firstValue;

  const changePercentage =
    firstValue !== 0
      ? (change /
          Math.abs(
            firstValue
          )) *
        100
      : 0;

  const trend =
    getTrend(
      changePercentage
    );

  return (
    <section className="mt-6 overflow-hidden rounded-[15px] border border-[#DDE7E1] bg-white shadow-[0_2px_10px_rgba(15,23,42,0.025)]">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="border-b border-[#E6ECE8] px-4 py-4 sm:px-5">

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

          <div className="min-w-0">

            <div className="flex items-center gap-2">

              <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />

              <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-[#16A34A]">
                Historical Telemetry
              </p>

            </div>

            <h3 className="mt-1.5 text-[16px] font-extrab800 tracking-[-0.02em] text-[#26332C]">
              {config.label} History
            </h3>

            <p className="mt-1 text-[8px] text-[#94A39A]">
              Live telemetry history for{" "}
              <span className="font-semibold text-[#64736A]">
                {machine.name}
              </span>
            </p>

          </div>

          {/* ==================================================
              METRIC SELECTOR
          ================================================== */}

          <div className="flex flex-wrap gap-1.5">

            {(
              Object.keys(
                metricConfig
              ) as Metric[]
            ).map(
              (item) => {
                const active =
                  metric ===
                  item;

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() =>
                      setMetric(
                        item
                      )
                    }
                    className={[
                      "rounded-[8px] px-3 py-1.5",
                      "text-[7px] font-bold uppercase tracking-[0.05em]",
                      "transition-all duration-150",
                      active
                        ? "bg-[#087443] text-white shadow-[0_3px_8px_rgba(5,150,105,0.12)]"
                        : "border border-[#E1E9E4] bg-[#FAFCFB] text-[#7B8981] hover:border-[#BFD8C8] hover:bg-[#F0F8F3] hover:text-[#15803D]",
                    ].join(
                      " "
                    )}
                  >
                    {
                      metricConfig[
                        item
                      ].label
                    }
                  </button>
                );
              }
            )}

          </div>

        </div>

      </div>

      {/* ======================================================
          SUMMARY
      ====================================================== */}

      <div className="grid grid-cols-2 gap-2.5 border-b border-[#E6ECE8] p-4 sm:grid-cols-4 sm:px-5">

        <SummaryCard
          label="Current"
          value={formatValue(
            latestValue,
            config.decimals
          )}
          unit={config.unit}
        />

        <SummaryCard
          label="Change"
          value={`${change >= 0 ? "+" : ""}${change.toFixed(
            config.decimals
          )}`}
          unit={config.unit}
          tone={
            change > 0
              ? "warning"
              : change < 0
                ? "positive"
                : "neutral"
          }
        />

        <SummaryCard
          label="Trend"
          value={`${changePercentage >= 0 ? "+" : ""}${changePercentage.toFixed(
            1
          )}%`}
          unit={trend}
          tone={
            changePercentage >
            0
              ? "warning"
              : changePercentage <
                  0
                ? "positive"
                : "neutral"
          }
        />

        <SummaryCard
          label="Data Points"
          value={String(
            history.length
          )}
          unit="samples"
        />

      </div>

      {/* ======================================================
          CHART
      ====================================================== */}

      <div className="p-4 sm:p-5">

        <div className="mb-3 flex items-center justify-between">

          <div>

            <p className="text-[8px] font-bold uppercase tracking-[0.11em] text-[#7B8981]">
              {config.label}
            </p>

            <p className="mt-0.5 text-[7px] text-[#A0ABA4]">
              {config.description}
            </p>

          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-1.5">

            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#16A34A]" />

            <span className="text-[6px] font-bold uppercase tracking-[0.08em] text-[#047857]">
              Live
            </span>

          </div>

        </div>

        <div className="h-[280px] w-full">

          {history.length <
          2 ? (
            <EmptyChartState />
          ) : (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <LineChart
                data={history}
                margin={{
                  top: 12,
                  right: 10,
                  left: -12,
                  bottom: 5,
                }}
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E7EEE9"
                />

                <XAxis
                  dataKey="time"
                  tick={{
                    fontSize: 8,
                    fill: "#94A39A",
                  }}
                  tickLine={false}
                  axisLine={{
                    stroke:
                      "#E1E9E4",
                  }}
                  minTickGap={28}
                />

                <YAxis
                  tick={{
                    fontSize: 8,
                    fill: "#94A39A",
                  }}
                  tickLine={false}
                  axisLine={false}
                  width={46}
                />

                <Tooltip
                  contentStyle={{
                    borderRadius:
                      10,
                    border:
                      "1px solid #DDE7E1",
                    background:
                      "#FFFFFF",
                    boxShadow:
                      "0 8px 25px rgba(15,23,42,0.08)",
                    fontSize: 9,
                  }}
                  labelStyle={{
                    color:
                      "#526159",
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                  itemStyle={{
                    color:
                      "#15803D",
                    fontWeight: 700,
                  }}
                  formatter={(
                    value
                  ) => [
                    formatValue(
                      Number(
                        value ?? 0
                      ),
                      config.decimals
                    ),
                    `${config.label} (${config.unit})`,
                  ]}
                />

                <Line
                  type="monotone"
                  dataKey={metric}
                  stroke="#16A34A"
                  strokeWidth={2.2}
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: "#16A34A",
                    stroke:
                      "#FFFFFF",
                    strokeWidth: 2,
                  }}
                  isAnimationActive={
                    false
                  }
                />

              </LineChart>

            </ResponsiveContainer>
          )}

        </div>

        {/* ====================================================
            FOOTER
        ==================================================== */}

        <div className="mt-3 flex flex-col gap-2 border-t border-[#E7EEE9] pt-3 sm:flex-row sm:items-center sm:justify-between">

          <span className="text-[7px] text-[#A0ABA4]">
            Latest{" "}
            {MAX_POINTS}{" "}
            telemetry samples
          </span>

          <div className="flex items-center gap-3">

            <span className="text-[7px] text-[#A0ABA4]">
              {machine.id}
            </span>

            <span className="flex items-center gap-1.5 text-[7px] font-bold uppercase tracking-[0.07em] text-[#16A34A]">

              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#16A34A]" />

              Connected

            </span>

          </div>

        </div>

      </div>

    </section>
  );
}

/* ============================================================
   SUMMARY CARD
============================================================ */

function SummaryCard({
  label,
  value,
  unit,
  tone = "neutral",
}: {
  label: string;
  value: string;
  unit: string;
  tone?: "positive" | "warning" | "neutral";
}) {
  const valueClass =
    tone === "positive"
      ? "text-[#15803D]"
      : tone === "warning"
        ? "text-[#D97706]"
        : "text-[#26332C]";

  return (
    <div className="rounded-[10px] border border-[#E4EBE6] bg-[#FAFCFB] p-3">

      <p className="text-[7px] font-bold uppercase tracking-[0.09em] text-[#94A39A]">
        {label}
      </p>

      <p
        className={`mt-1.5 truncate text-[15px] font-extrab800 tracking-[-0.02em] ${valueClass}`}
      >
        {value}
      </p>

      <p className="mt-0.5 text-[7px] text-[#A0ABA4]">
        {unit}
      </p>

    </div>
  );
}

/* ============================================================
   EMPTY CHART
============================================================ */

function EmptyChartState() {
  return (
    <div className="flex h-full items-center justify-center rounded-[12px] border border-dashed border-[#DDE7E1] bg-[#FAFCFB]">

      <div className="text-center">

        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#ECFDF5]">

          <span className="h-2 w-2 animate-pulse rounded-full bg-[#16A34A]" />

        </div>

        <p className="mt-3 text-[9px] font-bold text-[#526159]">
          Collecting telemetry history
        </p>

        <p className="mx-auto mt-1 max-w-[230px] text-[7px] leading-4 text-[#A0ABA4]">
          The graph will populate automatically as live telemetry updates arrive.
        </p>

      </div>

    </div>
  );
}

/* ============================================================
   MACHINE VALUE
============================================================ */

function getMachineValue(
  machine: Machine,
  metric: Metric
): number {
  switch (metric) {
    case "power":
      return Number(
        machine.power
      ) || 0;

    case "temperature":
      return Number(
        machine.temperature
      ) || 0;

    case "energy":
      return Number(
        machine.energy
      ) || 0;

    case "carbon":
      return Number(
        machine.carbon
      ) || 0;

    default:
      return 0;
  }
}

/* ============================================================
   TREND
============================================================ */

function getTrend(
  percentage: number
): string {
  if (percentage > 0.5) {
    return "Increasing";
  }

  if (percentage < -0.5) {
    return "Decreasing";
  }

  return "Stable";
}

/* ============================================================
   FORMAT
============================================================ */

function formatValue(
  value: number,
  decimals: number
): string {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return "—";
  }

  return value.toFixed(
    decimals
  );
}