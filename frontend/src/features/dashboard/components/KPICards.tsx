import { useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Factory,
  Leaf,
  Zap,
} from "lucide-react";

import { useMachines } from "../../../hooks/useMachines";
import type { Machine } from "../../../services/api";

type MetricType =
  | "assets"
  | "power"
  | "energy"
  | "carbon";

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  accent: string;
  onClick: () => void;
}

export default function KPICards() {
  const { machines } = useMachines();

  const [selectedMetric, setSelectedMetric] =
    useState<MetricType | null>(null);

  // ============================================================
  // LIVE FACTORY METRICS
  // ============================================================

  const metrics = useMemo(() => {
    const assets = machines.length;

    const power = machines.reduce(
      (total, machine) =>
        total + Number(machine.power ?? 0),
      0
    );

    const energy = machines.reduce(
      (total, machine) =>
        total + Number(machine.energy ?? 0),
      0
    );

    const carbon = machines.reduce(
      (total, machine) =>
        total + Number(machine.carbon ?? 0),
      0
    );

    let operational = 0;
    let attention = 0;
    let critical = 0;
    let stopped = 0;

    for (const machine of machines) {
      const status = normalizeStatus(
        machine.maintenance_status
      );

      const health = Number(
        machine.health_score ?? 0
      );

      if (
        status === "critical" ||
        status === "offline" ||
        status === "emergency" ||
        health < 50
      ) {
        critical += 1;
        continue;
      }

      if (status === "stopped") {
        stopped += 1;
        continue;
      }

      if (
        status === "attention" ||
        status === "maintenance" ||
        status === "warning" ||
        health < 75
      ) {
        attention += 1;
        continue;
      }

      operational += 1;
    }

    const averageHealth =
      assets > 0
        ? machines.reduce(
            (total, machine) =>
              total +
              Number(
                machine.health_score ?? 0
              ),
            0
          ) / assets
        : 0;

    const averageCarbon =
      assets > 0
        ? carbon / assets
        : 0;

    return {
      assets,
      power,
      energy,
      carbon,
      operational,
      attention,
      critical,
      stopped,
      averageHealth,
      averageCarbon,
    };
  }, [machines]);

  // ============================================================
  // KPI CARDS
  // ============================================================

  const cards: MetricCardProps[] = [
    {
      label: "Assets",

      value:
        metrics.assets.toLocaleString(
          "en-IN"
        ),

      description:
        `${metrics.operational} operational · ` +
        `${metrics.attention} attention`,

      icon: (
        <Factory
          size={17}
          strokeWidth={1.8}
        />
      ),

      accent:
        "text-emerald-600",

      onClick: () =>
        setSelectedMetric("assets"),

      children: (
        <AssetMiniChart
          operational={
            metrics.operational
          }
          attention={
            metrics.attention
          }
          critical={
            metrics.critical
          }
          stopped={
            metrics.stopped
          }
          total={
            metrics.assets
          }
        />
      ),
    },

    {
      label: "Power",

      value:
        formatNumber(
          metrics.power
        ),

      unit: "kW",

      description:
        "Current factory load",

      icon: (
        <Zap
          size={17}
          strokeWidth={1.8}
        />
      ),

      accent:
        "text-amber-500",

      onClick: () =>
        setSelectedMetric("power"),

      children: (
        <Sparkline
          machines={machines}
          field="power"
          lineClass="stroke-amber-500"
          fillClass="fill-amber-500"
        />
      ),
    },

    {
      label: "Energy",

      value:
        formatNumber(
          metrics.energy
        ),

      unit: "kWh",

      description:
        "Current reported energy",

      icon: (
        <BarChart3
          size={17}
          strokeWidth={1.8}
        />
      ),

      accent:
        "text-cyan-600",

      onClick: () =>
        setSelectedMetric("energy"),

      children: (
        <Sparkline
          machines={machines}
          field="energy"
          lineClass="stroke-cyan-600"
          fillClass="fill-cyan-600"
        />
      ),
    },

    {
      label: "Carbon",

      value:
        formatNumber(
          metrics.carbon
        ),

      unit: "kg CO₂e",

      description:
        "Current reported footprint",

      icon: (
        <Leaf
          size={17}
          strokeWidth={1.8}
        />
      ),

      accent:
        "text-emerald-600",

      onClick: () =>
        setSelectedMetric("carbon"),

      children: (
        <CarbonVisual
          carbon={
            metrics.carbon
          }
          carbonPerAsset={
            metrics.averageCarbon
          }
          assets={
            metrics.assets
          }
        />
      ),
    },
  ];

  return (
    <>
      {/* ======================================================
          KPI CARDS
      ====================================================== */}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={card.onClick}
            className="
              group
              relative
              min-h-[164px]
              overflow-hidden
              rounded-[14px]
              border
              border-[#DDE7E1]
              bg-white
              p-4
              text-left
              shadow-[0_2px_10px_rgba(15,23,42,0.025)]
              transition-all
              duration-200
              hover:-translate-y-[1px]
              hover:border-[#BFD8C8]
              hover:shadow-[0_8px_22px_rgba(15,23,42,0.06)]
              focus:outline-none
              focus:ring-2
              focus:ring-[#16A34A]/20
            "
          >
            {/* HEADER */}

            <div className="flex items-start justify-between gap-3">

              <div className="flex min-w-0 items-center gap-2.5">

                <span
                  className={`
                    flex
                    h-8
                    w-8
                    shrink-0
                    items-center
                    justify-center
                    rounded-[9px]
                    bg-[#F4F8F5]
                    ${card.accent}
                  `}
                >
                  {card.icon}
                </span>

                <div className="min-w-0">

                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#64736A]">
                    {card.label}
                  </p>

                  <p className="mt-0.5 text-[9px] text-[#9AA69F]">
                    Live factory data
                  </p>

                </div>

              </div>

              <span className="flex shrink-0 items-center gap-1 rounded-full border border-[#DDE7E1] bg-[#FAFCFB] px-2 py-1 text-[7px] font-bold uppercase tracking-[0.12em] text-[#16A34A]">

                <span className="relative flex h-1 w-1">

                  <span className="absolute h-full w-full animate-ping rounded-full bg-[#16A34A]/40" />

                  <span className="relative h-1 w-1 rounded-full bg-[#16A34A]" />

                </span>

                Live

              </span>

            </div>

            {/* VALUE */}

            <div className="mt-4 flex items-end justify-between gap-3">

              <div className="min-w-0">

                <div className="flex flex-wrap items-baseline gap-1.5">

                  <span className="text-[24px] font-extrabold leading-none tracking-[-0.025em] text-[#15211B]">
                    {card.value}
                  </span>

                  {card.unit && (
                    <span className="text-[9px] font-semibold text-[#7B8981]">
                      {card.unit}
                    </span>
                  )}

                </div>

                <p className="mt-1.5 text-[9px] leading-4 text-[#7B8981]">
                  {card.description}
                </p>

              </div>

              <span className="shrink-0 text-[9px] font-medium text-[#A0ABA4] transition-colors group-hover:text-[#16A34A]">
                Details →
              </span>

            </div>

            {/* VISUAL */}

            <div className="mt-3">
              {card.children}
            </div>

          </button>
        ))}
      </div>

      {/* DETAIL PANEL */}

      {selectedMetric && (
        <MetricDetails
          metric={
            selectedMetric
          }
          machines={
            machines
          }
          metrics={
            metrics
          }
          onClose={() =>
            setSelectedMetric(null)
          }
        />
      )}
    </>
  );
}

/* ================================================================
   ASSET MINI CHART
================================================================ */

interface AssetMiniChartProps {
  operational: number;
  attention: number;
  critical: number;
  stopped: number;
  total: number;
}

function AssetMiniChart({
  operational,
  attention,
  critical,
  stopped,
  total,
}: AssetMiniChartProps) {
  if (total === 0) {
    return (
      <div className="h-[24px] rounded-full bg-[#F1F5F2]" />
    );
  }

  const operationalWidth =
    (operational / total) *
    100;

  const attentionWidth =
    (attention / total) *
    100;

  const criticalWidth =
    (critical / total) *
    100;

  const stoppedWidth =
    (stopped / total) *
    100;

  return (
    <div>

      <div className="flex h-[7px] overflow-hidden rounded-full bg-[#EEF3EF]">

        {operationalWidth > 0 && (
          <div
            className="bg-[#16A34A]"
            style={{
              width:
                `${operationalWidth}%`,
            }}
          />
        )}

        {attentionWidth > 0 && (
          <div
            className="bg-[#F59E0B]"
            style={{
              width:
                `${attentionWidth}%`,
            }}
          />
        )}

        {criticalWidth > 0 && (
          <div
            className="bg-[#EF4444]"
            style={{
              width:
                `${criticalWidth}%`,
            }}
          />
        )}

        {stoppedWidth > 0 && (
          <div
            className="bg-[#94A39A]"
            style={{
              width:
                `${stoppedWidth}%`,
            }}
          />
        )}

      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[7px] text-[#8A968F]">

        <Legend
          color="bg-[#16A34A]"
          label={
            `${operational} operational`
          }
        />

        {attention > 0 && (
          <Legend
            color="bg-[#F59E0B]"
            label={
              `${attention} attention`
            }
          />
        )}

        {critical > 0 && (
          <Legend
            color="bg-[#EF4444]"
            label={
              `${critical} critical`
            }
          />
        )}

        {stopped > 0 && (
          <Legend
            color="bg-[#94A39A]"
            label={
              `${stopped} stopped`
            }
          />
        )}

      </div>

    </div>
  );
}

/* ================================================================
   LEGEND
================================================================ */

function Legend({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1">

      <span
        className={`h-1.5 w-1.5 rounded-full ${color}`}
      />

      {label}

    </span>
  );
}

/* ================================================================
   SPARKLINE
================================================================ */

interface SparklineProps {
  machines: Machine[];
  field:
    | "power"
    | "energy";
  lineClass: string;
  fillClass: string;
}

function Sparkline({
  machines,
  field,
  lineClass,
  fillClass,
}: SparklineProps) {
  if (machines.length === 0) {
    return (
      <div className="h-[30px] rounded-md bg-[#F4F7F5]" />
    );
  }

  const values = machines.map(
    (machine) =>
      Number(
        machine[field] ?? 0
      )
  );

  const max = Math.max(
    ...values,
    1
  );

  const min = Math.min(
    ...values
  );

  const range = Math.max(
    max - min,
    1
  );

  const points = values.map(
    (value, index) => {

      const x =
        values.length === 1
          ? 50
          : (index /
              (values.length - 1)) *
            100;

      const y =
        24 -
        ((value - min) /
          range) *
          18;

      return `${x},${y}`;
    }
  );

  const areaPoints = [
    "0,24",
    ...points,
    "100,24",
  ].join(" ");

  return (
    <div className="relative h-[30px] w-full overflow-hidden rounded-[7px] bg-[#F7FAF8]">

      <svg
        viewBox="0 0 100 25"
        preserveAspectRatio="none"
        className="h-full w-full"
        aria-hidden="true"
      >

        <polygon
          points={areaPoints}
          className={`${fillClass} opacity-[0.07]`}
        />

        <polyline
          points={points.join(" ")}
          fill="none"
          className={lineClass}
          strokeWidth="1.3"
          vectorEffect="non-scaling-stroke"
        />

      </svg>

      <div className="pointer-events-none absolute inset-x-2 bottom-1 flex justify-between text-[6px] font-medium text-[#A0ABA4]">
        <span>LOW</span>
        <span>LIVE</span>
        <span>HIGH</span>
      </div>

    </div>
  );
}

/* ================================================================
   CARBON VISUAL
================================================================ */

interface CarbonVisualProps {
  carbon: number;
  carbonPerAsset: number;
  assets: number;
}

function CarbonVisual({
  carbon,
  carbonPerAsset,
  assets,
}: CarbonVisualProps) {
  if (assets === 0) {
    return (
      <div className="flex h-[42px] items-center rounded-[8px] bg-[#F7FAF8] px-3">
        <span className="text-[8px] text-[#9AA69F]">
          Waiting for live assets
        </span>
      </div>
    );
  }

  const normalizedWidth =
    Math.min(
      Math.max(
        (carbonPerAsset /
          Math.max(
            carbon,
            1
          )) *
          100,
        0
      ),
      100
    );

  return (
    <div>

      <div className="flex items-center justify-between">

        <div className="flex items-center gap-1.5">

          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

          <span className="text-[8px] font-semibold text-[#526159]">
            {formatNumber(
              carbonPerAsset
            )}{" "}
            kg / asset
          </span>

        </div>

        <span className="text-[7px] text-[#94A39A]">
          {assets} assets
        </span>

      </div>

      <div className="mt-2 h-[6px] overflow-hidden rounded-full bg-[#EEF3EF]">

        <div
          className="h-full rounded-full bg-[#16A34A] transition-all duration-500"
          style={{
            width:
              `${normalizedWidth}%`,
          }}
        />

      </div>

      <p className="mt-1.5 text-[7px] text-[#9AA69F]">
        Current factory footprint ·{" "}
        {formatNumber(
          carbon
        )}{" "}
        kg CO₂e total
      </p>

    </div>
  );
}

/* ================================================================
   DETAIL PANEL
================================================================ */

interface MetricDetailsProps {
  metric: MetricType;
  machines: Machine[];

  metrics: {
    assets: number;
    power: number;
    energy: number;
    carbon: number;

    operational: number;
    attention: number;
    critical: number;
    stopped: number;

    averageHealth: number;
    averageCarbon: number;
  };

  onClose: () => void;
}

function MetricDetails({
  metric,
  machines,
  metrics,
  onClose,
}: MetricDetailsProps) {
  const titleMap: Record<
    MetricType,
    string
  > = {
    assets:
      "Asset Overview",

    power:
      "Power Overview",

    energy:
      "Energy Overview",

    carbon:
      "Carbon Overview",
  };

  const descriptionMap: Record<
    MetricType,
    string
  > = {
    assets:
      "Current machine population and operational state.",

    power:
      "Current power demand reported by connected assets.",

    energy:
      "Current energy values reported by connected assets.",

    carbon:
      "Current carbon footprint reported by connected assets.",
  };

  return (
    <div className="mt-3 rounded-[14px] border border-[#DDE7E1] bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.035)]">

      <div className="flex items-start justify-between gap-4">

        <div>

          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#16A34A]">
            Factory Metrics
          </p>

          <h3 className="mt-1 text-[14px] font-extrab800 text-[#15211B]">
            {titleMap[metric]}
          </h3>

          <p className="mt-1 text-[9px] leading-4 text-[#7B8981]">
            {descriptionMap[metric]}
          </p>

        </div>

        <button
          type="button"
          onClick={onClose}
          className="
            rounded-full
            border
            border-[#DDE7E1]
            px-2.5
            py-1
            text-[8px]
            font-semibold
            text-[#64736A]
            transition-colors
            hover:border-[#A7C8B3]
            hover:text-[#166534]
          "
        >
          Close
        </button>

      </div>

      {metric === "assets" && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">

          <DetailStat
            label="Total"
            value={
              metrics.assets
            }
          />

          <DetailStat
            label="Operational"
            value={
              metrics.operational
            }
          />

          <DetailStat
            label="Attention"
            value={
              metrics.attention
            }
          />

          <DetailStat
            label="Critical"
            value={
              metrics.critical
            }
          />

        </div>
      )}

      {metric === "power" && (
        <MachineValueList
          machines={
            machines
          }
          field="power"
          unit="kW"
        />
      )}

      {metric === "energy" && (
        <MachineValueList
          machines={
            machines
          }
          field="energy"
          unit="kWh"
        />
      )}

      {metric === "carbon" && (
        <MachineValueList
          machines={
            machines
          }
          field="carbon"
          unit="kg CO₂e"
        />
      )}

    </div>
  );
}

/* ================================================================
   MACHINE VALUE LIST
================================================================ */

function MachineValueList({
  machines,
  field,
  unit,
}: {
  machines: Machine[];
  field:
    | "power"
    | "energy"
    | "carbon";
  unit: string;
}) {
  const sorted =
    [...machines].sort(
      (a, b) =>
        Number(
          b[field] ?? 0
        ) -
        Number(
          a[field] ?? 0
        )
    );

  if (sorted.length === 0) {
    return (
      <div className="mt-4 rounded-[10px] bg-[#F7FAF8] p-4 text-center text-[9px] text-[#94A39A]">
        No live machine data available.
      </div>
    );
  }

  return (
    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">

      {sorted.map(
        (machine) => (
          <div
            key={
              machine.id
            }
            className="rounded-[10px] border border-[#E3EAE5] bg-[#FAFCFB] p-3"
          >

            <div className="flex items-center justify-between gap-2">

              <p className="truncate text-[9px] font-bold text-[#15211B]">
                {machine.name}
              </p>

              <Activity
                size={12}
                className="shrink-0 text-[#16A34A]"
              />

            </div>

            <p className="mt-1 text-[13px] font-extrab800 text-[#15211B]">

              {formatNumber(
                Number(
                  machine[field] ?? 0
                )
              )}

              <span className="ml-1 text-[8px] font-semibold text-[#7B8981]">
                {unit}
              </span>

            </p>

            <p className="mt-1 text-[7px] text-[#94A39A]">
              {machine.id}
            </p>

          </div>
        )
      )}

    </div>
  );
}

/* ================================================================
   DETAIL STAT
================================================================ */

function DetailStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-[10px] border border-[#E3EAE5] bg-[#FAFCFB] p-3">

      <p className="text-[7px] font-bold uppercase tracking-[0.12em] text-[#94A39A]">
        {label}
      </p>

      <p className="mt-1 text-[16px] font-extrab800 text-[#15211B]">
        {value}
      </p>

    </div>
  );
}

/* ================================================================
   STATUS NORMALIZATION
================================================================ */

function normalizeStatus(
  status:
    | string
    | null
    | undefined
) {
  const value =
    String(
      status ?? ""
    )
      .toLowerCase()
      .trim();

  if (
    value.includes(
      "emergency"
    )
  ) {
    return "emergency";
  }

  if (
    value.includes(
      "critical"
    ) ||
    value.includes(
      "failure"
    )
  ) {
    return "critical";
  }

  if (
    value.includes(
      "offline"
    )
  ) {
    return "offline";
  }

  if (
    value.includes(
      "stopped"
    ) ||
    value.includes(
      "shutdown"
    )
  ) {
    return "stopped";
  }

  if (
    value.includes(
      "maintenance"
    )
  ) {
    return "maintenance";
  }

  if (
    value.includes(
      "attention"
    )
  ) {
    return "attention";
  }

  if (
    value.includes(
      "warning"
    )
  ) {
    return "warning";
  }

  if (
    value.includes(
      "operational"
    ) ||
    value.includes(
      "running"
    ) ||
    value.includes(
      "normal"
    )
  ) {
    return "operational";
  }

  return "unknown";
}

/* ================================================================
   NUMBER FORMATTER
================================================================ */

function formatNumber(
  value: number
) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      maximumFractionDigits: 1,
    }
  ).format(
    Number.isFinite(value)
      ? value
      : 0
  );
}