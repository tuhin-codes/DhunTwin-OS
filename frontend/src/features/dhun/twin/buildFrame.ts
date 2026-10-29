/* ============================================================
   DHUN DIGITAL TWIN — FRAME BUILDER
   Deterministic 2-second frames for every instrumented asset.
   Values are derived from the same physics as the campus twin,
   then given a small, repeatable measurement texture. Nothing
   here is a live sensor reading until a gateway packet arrives.
   ============================================================ */

import type {
  DhunAsset,
  PhaseId,
  TwinSummary,
} from "../types";

import type {
  TwinAction,
  TwinEvent,
  TwinMetric,
  TwinNode,
  TwinNodeKind,
  TwinFrame,
  TwinControl,
  TelemetryPacket,
} from "./types";

import type { PhaseConfig } from "../data/phases";

import {
  MONTH_FACTOR,
  PHASES,
} from "../data/phases";

import {
  LITRES_PER_PERSON_DAY,
} from "../data/constants";

import {
  buildTwin,
  clamp,
  dayFraction,
  landscapeWaterKlYr,
  solarShape,
} from "../engine/simulation";

import {
  computeQueue,
  computeWindows,
  jobCarbon,
  marginalIntensity,
} from "../engine/compute";

import { num } from "../lib/format";

const HISTORY_POINTS = 36;
/* One history point per frame, so "last 36 frames" is
   literally true. */
const HISTORY_STEP_MS = 2000;
const PACKET_TTL_MS = 30000;

const PHASE_RANK: Record<PhaseId, number> = {
  today: 0,
  phase1: 1,
  buildout: 2,
};

interface Ctx {
  phase: PhaseId;
  at: Date;
  tick: number;
  wallNow: number;
  summary: TwinSummary;
  assets: DhunAsset[];
  packets: Record<string, TelemetryPacket>;
  config: PhaseConfig;
}

interface MetricSpec {
  key: string;
  label: string;
  unit: string;
  value: number;
  decimals: number;
  normal: [number, number];
  alarm: [number, number];
  spread: number;
  min?: number;
  max?: number;
}

function hash(value: number): number {
  const x =
    Math.sin(value * 127.1 + 311.7) * 43758.5453123;

  return x - Math.floor(x);
}

function seedOf(text: string): number {
  let seed = 0;

  for (let i = 0; i < text.length; i += 1) {
    seed = (seed * 31 + text.charCodeAt(i)) % 100000;
  }

  return seed;
}

/* Repeatable measurement texture: slow drift plus a small
   high-frequency component. No Math.random anywhere. */
function wobble(
  seed: number,
  time: number,
  amplitude: number
): number {
  const phase = hash(seed) * Math.PI * 2;

  return (
    amplitude *
    (0.6 * Math.sin(time / 37000 + phase) +
      0.25 * Math.sin(time / 13000 + phase * 1.7) +
      0.15 *
        (hash(Math.floor(time / 2000) + seed) * 2 - 1))
  );
}

function series(
  tick: number,
  seed: number,
  base: number,
  spread: number
): number[] {
  return Array.from(
    { length: HISTORY_POINTS },
    (_, index) =>
      base +
      wobble(
        seed,
        tick -
          (HISTORY_POINTS - 1 - index) *
            HISTORY_STEP_MS,
        spread
      )
  );
}

function statusFor(
  value: number,
  normal: [number, number],
  alarm: [number, number]
): TwinMetric["status"] {
  if (value < alarm[0] || value > alarm[1]) {
    return "alarm";
  }

  if (value < normal[0] || value > normal[1]) {
    return "watch";
  }

  return "normal";
}

function metric(
  ctx: Ctx,
  nodeId: string,
  spec: MetricSpec
): TwinMetric {
  const seed = seedOf(`${nodeId}:${spec.key}`);
  const floor = spec.min ?? 0;
  const ceiling =
    spec.max ?? Number.POSITIVE_INFINITY;

  const base = Math.min(
    ceiling,
    Math.max(
      floor,
      spec.value +
        wobble(seed, ctx.tick, spec.spread * 0.55)
    )
  );

  const packet =
    ctx.packets[`${nodeId}:${spec.key}`];

  const live =
    packet &&
    Number.isFinite(packet.value) &&
    ctx.wallNow - (packet.at ?? 0) <
      PACKET_TTL_MS;

  const value = live ? packet.value : base;

  const history = series(
    ctx.tick,
    seed,
    base,
    spec.spread
  ).map((point) =>
    Math.min(ceiling, Math.max(floor, point))
  );

  if (live) {
    history[history.length - 1] = value;
  }

  return {
    key: spec.key,
    label: spec.label,
    unit: spec.unit,
    decimals: spec.decimals,
    value,
    status: statusFor(
      value,
      spec.normal,
      spec.alarm
    ),
    normal: spec.normal,
    alarm: spec.alarm,
    history,
    live: Boolean(live),
  };
}

function availability(
  ctx: Ctx,
  from: PhaseId
): {
  available: boolean;
  availabilityNote?: string;
} {
  const available =
    PHASE_RANK[ctx.phase] >= PHASE_RANK[from];

  return available
    ? { available: true }
    : {
        available: false,
        availabilityNote: `Planned for ${PHASES[from].short}`,
      };
}

function finalize(
  node: Omit<TwinNode, "status">
): TwinNode {
  if (!node.available) {
    return { ...node, status: "offline" };
  }

  const status: TwinNode["status"] =
    node.metrics.some(
      (item) => item.status === "alarm"
    )
      ? "alarm"
      : node.metrics.some(
            (item) => item.status === "watch"
          )
        ? "watch"
        : "online";

  return { ...node, status };
}

function assetOf(
  ctx: Ctx,
  id: string
): DhunAsset | undefined {
  return ctx.assets.find(
    (asset) => asset.id === id
  );
}

function siteShape(fraction: number): number {
  return (
    0.58 +
    0.78 *
      Math.exp(
        -Math.pow((fraction - 0.6) / 0.15, 2)
      ) +
    0.22 *
      Math.exp(
        -Math.pow((fraction - 0.82) / 0.09, 2)
      )
  );
}

function occupancyShape(fraction: number): number {
  return clamp(
    Math.exp(
      -Math.pow((fraction - 0.52) / 0.12, 2)
    ) +
      0.35 *
        Math.exp(
          -Math.pow((fraction - 0.72) / 0.1, 2)
        ),
    0,
    1
  );
}

function computeShape(fraction: number): number {
  return (
    0.88 +
    0.1 *
      Math.sin(fraction * Math.PI * 2 - 1)
  );
}

function designPeak(ctx: Ctx): number {
  const config = ctx.config;

  const building =
    ((config.builtM2 * config.epi) / 8760) *
    1.55;

  const compute =
    config.computeKw *
    config.computePue *
    1.08;

  const water =
    (config.stpKlDay * 0.5) / 24 +
    ((config.population *
      LITRES_PER_PERSON_DAY) /
      1000) *
      (0.4 / 24);

  return Math.max(
    5,
    building + compute + water + 2
  );
}

/* ============================================================
   NODE BUILDERS
   ============================================================ */

function gridNode(ctx: Ctx): TwinNode {
  const peak = designPeak(ctx);
  const { summary } = ctx;

  return finalize({
    id: "grid-hub",
    name: "Energy hub",
    short: "Grid hub",
    kind: "grid",
    x: 655,
    y: 62,
    ...availability(ctx, "today"),
    plannedChannels: 4,
    deviceId: "DH-GRD-01",
    protocol: "Modbus TCP",
    gateway: "energy-gw-01",
    description:
      "The 11 kV incomer and site transformer. This is the reference for every kilowatt-hour the campus imports.",
    primaryKey: "import",
    metrics: [
      metric(ctx, "grid-hub", {
        key: "import",
        label: "Grid import",
        unit: "kW",
        value: summary.gridKw,
        decimals: 0,
        normal: [0, peak * 0.92],
        alarm: [0, peak * 1.05],
        spread: 7,
      }),
      metric(ctx, "grid-hub", {
        key: "voltage",
        label: "Incoming voltage",
        unit: "kV",
        value: 11,
        decimals: 2,
        normal: [10.7, 11.3],
        alarm: [10.4, 11.6],
        spread: 0.07,
        max: 12,
      }),
      metric(ctx, "grid-hub", {
        key: "frequency",
        label: "Frequency",
        unit: "Hz",
        value: 49.98,
        decimals: 2,
        normal: [49.9, 50.1],
        alarm: [49.7, 50.3],
        spread: 0.035,
        min: 49,
        max: 51,
      }),
      metric(ctx, "grid-hub", {
        key: "pf",
        label: "Power factor",
        unit: "",
        value: 0.97,
        decimals: 2,
        normal: [0.94, 1],
        alarm: [0.9, 1],
        spread: 0.008,
        max: 1,
      }),
    ],
    controls: [],
  });
}

function solarNode(ctx: Ctx): TwinNode {
  const { config, at } = ctx;
  const state = availability(ctx, "phase1");

  if (!state.available) {
    return finalize({
      id: "solar-array",
      name: "Solar farm",
      short: "Solar",
      kind: "solar",
      x: 545,
      y: 100,
      ...state,
      plannedChannels: 4,
      deviceId: "DH-SOL-01",
      protocol: "Modbus TCP",
      gateway: "energy-gw-01",
      description:
        "Rooftop and carport array. Irradiance and module temperature are the two signals that explain yield.",
      primaryKey: "output",
      metrics: [],
      controls: [],
    });
  }

  const f = dayFraction(at);
  const seasonal =
    MONTH_FACTOR[at.getMonth()] ?? 1;
  const shape = solarShape(f);
  const output = assetOf(ctx, "solar")?.powerKw ?? 0;
  const kwp = config.solarKwp;

  return finalize({
    id: "solar-array",
    name: "Solar farm",
    short: "Solar",
    kind: "solar",
    x: 545,
    y: 100,
    ...state,
    plannedChannels: 4,
    deviceId: "DH-SOL-01",
    protocol: "Modbus TCP",
    gateway: "energy-gw-01",
    description:
      "Rooftop and carport array. Irradiance and module temperature are the two signals that explain yield.",
    primaryKey: "output",
    metrics: [
      metric(ctx, "solar-array", {
        key: "output",
        label: "Array output",
        unit: "kW",
        value: output,
        decimals: 0,
        normal: [0, kwp * 0.86],
        alarm: [0, kwp * 0.98],
        spread: Math.max(1, kwp * 0.004),
      }),
      metric(ctx, "solar-array", {
        key: "irradiance",
        label: "Plane-of-array irradiance",
        unit: "W/m²",
        value: 980 * shape * seasonal,
        decimals: 0,
        normal: [0, 1100],
        alarm: [0, 1250],
        spread: 12,
      }),
      metric(ctx, "solar-array", {
        key: "module-temp",
        label: "Module temperature",
        unit: "°C",
        value: 27 + 26 * shape * seasonal,
        decimals: 1,
        normal: [10, 72],
        alarm: [0, 85],
        spread: 0.6,
      }),
      metric(ctx, "solar-array", {
        key: "efficiency",
        label: "Inverter efficiency",
        unit: "%",
        value: 97.2,
        decimals: 1,
        normal: [94, 100],
        alarm: [90, 100],
        spread: 0.4,
        max: 100,
      }),
    ],
    controls: [],
  });
}

function fieldOfficeNode(ctx: Ctx): TwinNode {
  const f = dayFraction(ctx.at);
  const shape = siteShape(f);
  const demand = 58 * shape * 0.82;
  const occupied = 18 * (0.15 + 0.85 * occupancyShape(f));

  return finalize({
    id: "field-office",
    name: "Field office & workshop",
    short: "Field office",
    kind: "building",
    x: 540,
    y: 190,
    ...availability(ctx, "today"),
    plannedChannels: 4,
    deviceId: "DH-FO-01",
    protocol: "BACnet/IP",
    gateway: "built-gw-01",
    description:
      "The existing field station and workshop. The only occupied building in the 2026 phase, and the first live indoor-environment record.",
    primaryKey: "demand",
    metrics: [
      metric(ctx, "field-office", {
        key: "demand",
        label: "Building demand",
        unit: "kW",
        value: demand,
        decimals: 1,
        normal: [0, 78],
        alarm: [0, 95],
        spread: 0.7,
      }),
      metric(ctx, "field-office", {
        key: "indoor-temp",
        label: "Indoor temperature",
        unit: "°C",
        value: 26.2,
        decimals: 1,
        normal: [18, 29],
        alarm: [15, 32],
        spread: 0.25,
      }),
      metric(ctx, "field-office", {
        key: "occupancy",
        label: "Occupancy",
        unit: "people",
        value: occupied,
        decimals: 0,
        normal: [0, 30],
        alarm: [0, 40],
        spread: 0.7,
      }),
      metric(ctx, "field-office", {
        key: "water",
        label: "Domestic water flow",
        unit: "L/min",
        value: 4 + 9 * occupancyShape(f),
        decimals: 1,
        normal: [0, 22],
        alarm: [0, 30],
        spread: 0.35,
      }),
    ],
    controls: [
      {
        key: "cooling",
        label: "Cooling setpoint",
        options: ["24 °C", "26 °C"],
        default: "26 °C",
        note: "Local demo setpoint. No command is sent to hardware.",
      },
    ],
  });
}

function r1Node(ctx: Ctx): TwinNode {
  const f = dayFraction(ctx.at);
  const state = availability(ctx, "phase1");
  const asset = assetOf(ctx, "residences");
  const power = asset?.powerKw ?? 0;
  const config = ctx.config;

  return finalize({
    id: "r1-residences",
    name: "R1 residences",
    short: "R1",
    kind: "building",
    x: 360,
    y: 408,
    ...state,
    plannedChannels: 4,
    deviceId: "DH-R1-01",
    protocol: "BACnet/IP",
    gateway: "built-gw-01",
    description:
      "The first residential block. Indoor comfort, hot-water draw and occupancy are the signals that turn a floor plan into an operating building.",
    primaryKey: "demand",
    metrics: state.available
      ? [
          metric(ctx, "r1-residences", {
            key: "demand",
            label: "Block demand",
            unit: "kW",
            value: power,
            decimals: 0,
            normal: [0, Math.max(40, power * 1.8)],
            alarm: [0, Math.max(60, power * 2.2)],
            spread: Math.max(2, power * 0.015),
          }),
          metric(ctx, "r1-residences", {
            key: "indoor-temp",
            label: "Indoor temperature",
            unit: "°C",
            value: 26.4,
            decimals: 1,
            normal: [19, 30],
            alarm: [16, 33],
            spread: 0.2,
          }),
          metric(ctx, "r1-residences", {
            key: "dhw",
            label: "Hot-water draw",
            unit: "L/min",
            value:
              (config.population *
                LITRES_PER_PERSON_DAY *
                0.35) /
              1440,
            decimals: 0,
            normal: [
              0,
              (config.population *
                LITRES_PER_PERSON_DAY *
                0.35) /
                1000,
            ],
            alarm: [
              0,
              (config.population *
                LITRES_PER_PERSON_DAY *
                0.55) /
                1000,
            ],
            spread: 4,
          }),
          metric(ctx, "r1-residences", {
            key: "occupancy",
            label: "Residents present",
            unit: "",
            value:
              config.population *
              (0.55 + 0.45 * occupancyShape(f)),
            decimals: 0,
            normal: [0, config.population * 1.05],
            alarm: [0, config.population * 1.15],
            spread: 3,
          }),
        ]
      : [],
    controls: state.available
      ? [
          {
            key: "dhw",
            label: "Hot-water setpoint",
            options: ["45 °C", "50 °C"],
            default: "45 °C",
            note: "Local demo setpoint. No command is sent to hardware.",
          },
        ]
      : [],
  });
}

function schoolNode(ctx: Ctx): TwinNode {
  const f = dayFraction(ctx.at);
  const state = availability(ctx, "phase1");
  const asset = assetOf(ctx, "school");
  const power = asset?.powerKw ?? 0;
  const occupancy = 300 * occupancyShape(f);

  return finalize({
    id: "school",
    name: "School campus",
    short: "School",
    kind: "building",
    x: 486,
    y: 418,
    ...state,
    plannedChannels: 4,
    deviceId: "DH-SCH-01",
    protocol: "BACnet/IP",
    gateway: "built-gw-01",
    description:
      "The seven-acre school. CO₂ and occupancy tell the ventilation story; both are invisible in an annual energy bill.",
    primaryKey: "co2",
    metrics: state.available
      ? [
          metric(ctx, "school", {
            key: "demand",
            label: "School demand",
            unit: "kW",
            value: power,
            decimals: 0,
            normal: [0, Math.max(20, power * 2)],
            alarm: [0, Math.max(30, power * 2.5)],
            spread: Math.max(1, power * 0.02),
          }),
          metric(ctx, "school", {
            key: "co2",
            label: "Indoor CO₂",
            unit: "ppm",
            value: 470 + 520 * occupancyShape(f),
            decimals: 0,
            normal: [400, 1000],
            alarm: [350, 1500],
            spread: 14,
          }),
          metric(ctx, "school", {
            key: "indoor-temp",
            label: "Indoor temperature",
            unit: "°C",
            value: 26.8,
            decimals: 1,
            normal: [19, 31],
            alarm: [16, 34],
            spread: 0.2,
          }),
          metric(ctx, "school", {
            key: "occupancy",
            label: "Students present",
            unit: "",
            value: occupancy,
            decimals: 0,
            normal: [0, 320],
            alarm: [0, 350],
            spread: 2.5,
          }),
        ]
      : [],
    controls: state.available
      ? [
          {
            key: "fresh-air",
            label: "Fresh-air mode",
            options: ["CO₂-led", "Scheduled"],
            default: "CO₂-led",
            note: "Local demo setpoint. No command is sent to hardware.",
          },
        ]
      : [],
  });
}

function stpNode(ctx: Ctx): TwinNode {
  const { config } = ctx;
  const stpKw = (config.stpKlDay * 0.5) / 24;

  return finalize({
    id: "stp",
    name: "STP & water reuse",
    short: "STP",
    kind: "stp",
    x: 404,
    y: 354,
    ...availability(ctx, "today"),
    plannedChannels: 4,
    deviceId: "DH-STP-01",
    protocol: "Modbus TCP",
    gateway: "water-gw-01",
    description:
      "Tertiary treatment. Inflow, aeration power and turbidity are the three signals that decide whether reuse is safe.",
    primaryKey: "inflow",
    metrics: [
      metric(ctx, "stp", {
        key: "inflow",
        label: "Inflow",
        unit: "kL/day",
        value: config.stpKlDay,
        decimals: 0,
        normal: [
          config.stpKlDay * 0.75,
          config.stpKlDay * 1.15,
        ],
        alarm: [
          config.stpKlDay * 0.55,
          config.stpKlDay * 1.3,
        ],
        spread: Math.max(0.15, config.stpKlDay * 0.006),
      }),
      metric(ctx, "stp", {
        key: "aeration",
        label: "Aeration power",
        unit: "kW",
        value: stpKw * 1.08,
        decimals: 2,
        normal: [0, Math.max(0.5, stpKw * 1.5)],
        alarm: [0, Math.max(0.7, stpKw * 2)],
        spread: Math.max(0.01, stpKw * 0.02),
      }),
      metric(ctx, "stp", {
        key: "ph",
        label: "Outlet pH",
        unit: "",
        value: 7.1,
        decimals: 1,
        normal: [6.5, 8],
        alarm: [6, 8.5],
        spread: 0.05,
        max: 14,
      }),
      metric(ctx, "stp", {
        key: "turbidity",
        label: "Turbidity",
        unit: "NTU",
        value: 4.2,
        decimals: 1,
        normal: [0, 10],
        alarm: [0, 20],
        spread: 0.55,
      }),
    ],
    controls: [
      {
        key: "aeration",
        label: "Aeration schedule",
        options: ["Day", "Night"],
        default: "Day",
        note: "Local demo setpoint. No command is sent to hardware.",
      },
    ],
  });
}

function borewellNode(ctx: Ctx): TwinNode {
  const { config, summary } = ctx;
  const demand = summary.waterKlDay;
  const pumpKw = (demand * 0.4) / 24;
  const ratio =
    landscapeWaterKlYr(ctx.phase) /
    365 /
    (config.harvestKlYr / 365);

  return finalize({
    id: "borewell",
    name: "Borewell & pumping",
    short: "Borewell",
    kind: "water",
    x: 322,
    y: 344,
    ...availability(ctx, "today"),
    plannedChannels: 4,
    deviceId: "DH-PMP-01",
    protocol: "LoRaWAN",
    gateway: "water-gw-01",
    description:
      "Abstraction and distribution. Discharge pressure and static level expose the hidden energy and water risk behind every tap.",
    primaryKey: "abstraction",
    metrics: [
      metric(ctx, "borewell", {
        key: "abstraction",
        label: "Abstraction",
        unit: "kL/day",
        value: demand,
        decimals: 0,
        normal: [0, Math.max(1, demand * 1.12)],
        alarm: [0, Math.max(2, demand * 1.3)],
        spread: Math.max(0.3, demand * 0.008),
      }),
      metric(ctx, "borewell", {
        key: "pump-power",
        label: "Pump power",
        unit: "kW",
        value: pumpKw,
        decimals: 2,
        normal: [0, Math.max(0.4, pumpKw * 1.4)],
        alarm: [0, Math.max(0.6, pumpKw * 1.8)],
        spread: Math.max(0.02, pumpKw * 0.04),
      }),
      metric(ctx, "borewell", {
        key: "pressure",
        label: "Discharge pressure",
        unit: "bar",
        value: 3.4,
        decimals: 1,
        normal: [2.2, 4.5],
        alarm: [1.8, 5.2],
        spread: 0.1,
      }),
      metric(ctx, "borewell", {
        key: "static-level",
        label: "Static water level",
        unit: "m",
        value: 32 - 12 * Math.min(ratio, 1.6),
        decimals: 1,
        normal: [12, 30],
        alarm: [6, 35],
        spread: 0.2,
        max: 40,
      }),
    ],
    controls: [
      {
        key: "pump-window",
        label: "Pump window",
        options: ["Any", "Solar"],
        default: "Any",
        note: "Local demo setpoint. No command is sent to hardware.",
      },
    ],
  });
}

function irrigationNode(ctx: Ctx): TwinNode {
  const { config } = ctx;

  /* The reservoir serves the whole campus, not just the
     landscape. Domestic draw therefore belongs in the same
     ratio, or the twin would report a healthy reservoir while
     the water balance is in deficit. */
  const domestic = ctx.summary.waterKlDay;
  const demand =
    landscapeWaterKlYr(ctx.phase) / 365;
  const available = config.harvestKlYr / 365;
  const ratio =
    (demand + domestic) / Math.max(1, available);

  return finalize({
    id: "irrigation",
    name: "Landscape & irrigation",
    short: "Irrigation",
    kind: "water",
    x: 378,
    y: 300,
    ...availability(ctx, "today"),
    plannedChannels: 4,
    deviceId: "DH-IRR-01",
    protocol: "LoRaWAN",
    gateway: "water-gw-01",
    description:
      "Domestic draw and landscape demand against harvested storage. This is the first place a dry year shows up, and the last place an annual report explains.",
    primaryKey: "reservoir",
    metrics: [
      metric(ctx, "irrigation", {
        key: "flow",
        label: "Irrigation draw",
        unit: "kL/day",
        value: demand,
        decimals: 0,
        normal: [0, available * 1.1],
        alarm: [0, available * 1.35],
        spread: Math.max(0.5, demand * 0.008),
      }),
      metric(ctx, "irrigation", {
        key: "soil-moisture",
        label: "Soil moisture",
        unit: "%",
        value: 30 - (ratio - 0.5) * 24,
        decimals: 0,
        normal: [15, 45],
        alarm: [8, 60],
        spread: 0.5,
        max: 100,
      }),
      metric(ctx, "irrigation", {
        key: "reservoir",
        label: "Harvest reservoir",
        unit: "%",
        value: 95 - ratio * 45,
        decimals: 0,
        normal: [40, 95],
        alarm: [20, 100],
        spread: 0.4,
        max: 100,
      }),
      metric(ctx, "irrigation", {
        key: "pressure",
        label: "Line pressure",
        unit: "bar",
        value: 2.8,
        decimals: 1,
        normal: [1.5, 4],
        alarm: [1, 4.5],
        spread: 0.08,
      }),
    ],
    controls: [
      {
        key: "irrigation-mode",
        label: "Irrigation mode",
        options: ["Moisture-led", "Scheduled"],
        default: "Moisture-led",
        note: "Local demo setpoint. No command is sent to hardware.",
      },
    ],
  });
}

function gaushalaNode(ctx: Ctx): TwinNode {
  const organic = ctx.config.organicTDay;

  return finalize({
    id: "gaushala",
    name: "Gaushala & compost",
    short: "Gaushala",
    kind: "organic",
    x: 145,
    y: 388,
    ...availability(ctx, "today"),
    plannedChannels: 3,
    deviceId: "DH-ORG-01",
    protocol: "LoRaWAN",
    gateway: "waste-gw-01",
    description:
      "Cattle shed and aerobic compost. Feedstock and pile temperature drive biogas yield and the methane the site avoids.",
    primaryKey: "biogas",
    metrics: [
      metric(ctx, "gaushala", {
        key: "organics",
        label: "Organics intake",
        unit: "t/day",
        value: organic,
        decimals: 2,
        normal: [0, Math.max(0.5, organic * 1.3)],
        alarm: [0, Math.max(0.8, organic * 1.7)],
        spread: Math.max(0.005, organic * 0.01),
      }),
      metric(ctx, "gaushala", {
        key: "biogas",
        label: "Biogas yield",
        unit: "m³/day",
        value: organic * 28,
        decimals: 1,
        normal: [0, Math.max(8, organic * 38)],
        alarm: [0, Math.max(12, organic * 50)],
        spread: Math.max(0.2, organic * 0.5),
      }),
      metric(ctx, "gaushala", {
        key: "pile-temp",
        label: "Compost pile",
        unit: "°C",
        value: 54,
        decimals: 1,
        normal: [40, 68],
        alarm: [30, 75],
        spread: 0.6,
      }),
    ],
    controls: [
      {
        key: "turner",
        label: "Compost turner",
        options: ["Auto", "Manual"],
        default: "Auto",
        note: "Local demo setpoint. No command is sent to hardware.",
      },
    ],
  });
}

function computeNode(ctx: Ctx): TwinNode {
  const { config } = ctx;
  const f = dayFraction(ctx.at);
  const itLoad =
    config.computeKw * computeShape(f);

  return finalize({
    id: "compute",
    name: "Compute commons",
    short: "Compute",
    kind: "compute",
    x: 672,
    y: 312,
    ...availability(ctx, "today"),
    plannedChannels: 4,
    deviceId: "DH-CMP-01",
    protocol: "Redfish / SNMP",
    gateway: "compute-gw-01",
    description:
      "The deferrable load. IT power, PUE and queue depth are what the scheduler reads before it decides to run or wait.",
    primaryKey: "it-load",
    metrics: [
      metric(ctx, "compute", {
        key: "it-load",
        label: "IT load",
        unit: "kW",
        value: itLoad,
        decimals: 1,
        normal: [0, Math.max(2, config.computeKw * 1.25)],
        alarm: [0, Math.max(3, config.computeKw * 1.5)],
        spread: Math.max(0.05, config.computeKw * 0.02),
      }),
      metric(ctx, "compute", {
        key: "pue",
        label: "PUE",
        unit: "",
        value: config.computePue,
        decimals: 2,
        normal: [1.1, 1.55],
        alarm: [1.05, 1.75],
        spread: 0.006,
        min: 1,
      }),
      metric(ctx, "compute", {
        key: "gpu-temp",
        label: "GPU temperature",
        unit: "°C",
        value:
          44 +
          22 *
            (itLoad /
              Math.max(0.1, config.computeKw)),
        decimals: 1,
        normal: [35, 78],
        alarm: [25, 88],
        spread: 0.4,
      }),
      metric(ctx, "compute", {
        key: "queue",
        label: "Queue depth",
        unit: "jobs",
        value:
          4 +
          2 *
            Math.sin(
              f * Math.PI * 2 + 0.8
            ),
        decimals: 0,
        normal: [0, 12],
        alarm: [0, 20],
        spread: 0.3,
      }),
    ],
    controls: [
      {
        key: "scheduler",
        label: "Batch scheduler",
        options: ["Run now", "Solar window"],
        default: "Run now",
        note: "Local demo setpoint. No command is sent to hardware.",
      },
    ],
  });
}

function weatherNode(ctx: Ctx): TwinNode {
  const f = dayFraction(ctx.at);
  const shape = solarShape(f);

  return finalize({
    id: "weather",
    name: "Bioreserve weather mast",
    short: "Weather",
    kind: "weather",
    x: 150,
    y: 125,
    ...availability(ctx, "today"),
    plannedChannels: 4,
    deviceId: "DH-WX-01",
    protocol: "LoRaWAN",
    gateway: "land-gw-01",
    description:
      "The ground truth for every solar and irrigation assumption. Ambient temperature, humidity, wind and rain, sampled inside the protected bioreserve.",
    primaryKey: "ambient-temp",
    metrics: [
      metric(ctx, "weather", {
        key: "ambient-temp",
        label: "Ambient temperature",
        unit: "°C",
        value: 29 + 8 * shape,
        decimals: 1,
        normal: [5, 46],
        alarm: [0, 49],
        spread: 0.2,
      }),
      metric(ctx, "weather", {
        key: "humidity",
        label: "Relative humidity",
        unit: "%",
        value: 44 - 18 * shape,
        decimals: 0,
        normal: [10, 90],
        alarm: [5, 100],
        spread: 0.8,
        max: 100,
      }),
      metric(ctx, "weather", {
        key: "wind",
        label: "Wind speed",
        unit: "m/s",
        value: 2.6,
        decimals: 1,
        normal: [0, 14],
        alarm: [0, 22],
        spread: 0.35,
      }),
      metric(ctx, "weather", {
        key: "rain",
        label: "Rainfall",
        unit: "mm/h",
        value: 0,
        decimals: 1,
        normal: [0, 10],
        alarm: [0, 30],
        spread: 0.04,
      }),
    ],
    controls: [],
  });
}

const BUILDERS: Array<(ctx: Ctx) => TwinNode> = [
  weatherNode,
  gridNode,
  solarNode,
  fieldOfficeNode,
  r1Node,
  schoolNode,
  stpNode,
  borewellNode,
  irrigationNode,
  gaushalaNode,
  computeNode,
];

/* ============================================================
   PUBLIC FRAME
   ============================================================ */

export function buildFrame(
  phase: PhaseId,
  at: Date,
  packets: Record<string, TelemetryPacket> = {}
): TwinFrame {
  const snapshot = buildTwin(phase, at);

  const ctx: Ctx = {
    phase,
    at,
    tick: at.getTime(),
    wallNow: Date.now(),
    summary: snapshot.summary,
    assets: snapshot.assets,
    packets,
    config: PHASES[phase],
  };

  const nodes = BUILDERS.map((build) =>
    build(ctx)
  );

  const online = nodes.filter(
    (node) => node.status !== "offline"
  ).length;

  const sensors = nodes.reduce(
    (sum, node) =>
      sum +
      (node.available ? node.metrics.length : 0),
    0
  );

  return {
    phase,
    at,
    summary: snapshot.summary,
    nodes,
    online,
    planned: nodes.length - online,
    sensors,
    alarms: nodes.filter(
      (node) => node.status === "alarm"
    ).length,
    watches: nodes.filter(
      (node) => node.status === "watch"
    ).length,
  };
}

/* ============================================================
   EVENTS AND RECOMMENDATIONS
   ============================================================ */

export function buildEvents(
  frame: TwinFrame
): TwinEvent[] {
  const events: TwinEvent[] = [];

  for (const node of frame.nodes) {
    if (!node.available) {
      continue;
    }

    for (const item of node.metrics) {
      if (item.status === "normal") {
        continue;
      }

      const upper = item.normal[1];
      const lower = item.normal[0];
      const above = item.value > upper;
      const bound = above ? upper : lower;

      /* Unitless channels (PUE, pH, power factor) must not
         render a dangling space before the dash. */
      const reading = `${num(
        item.value,
        item.decimals
      )}${item.unit ? ` ${item.unit}` : ""}`;

      const limit = `${num(
        bound,
        item.decimals
      )}${item.unit ? ` ${item.unit}` : ""}`;

      events.push({
        id: `${node.id}:${item.key}`,
        level:
          item.status === "alarm"
            ? "alarm"
            : "watch",
        nodeId: node.id,
        nodeName: node.short,
        message: `${item.label} ${reading} — ${
          above ? "above" : "below"
        } the ${limit} normal ${
          above ? "ceiling" : "floor"
        }.`,
        at: frame.at,
      });
    }
  }

  return events
    .sort((a, b) =>
      a.level === b.level
        ? 0
        : a.level === "alarm"
          ? -1
          : 1
    )
    .slice(0, 8);
}

export function buildActions(
  phase: PhaseId,
  at: Date
): TwinAction[] {
  const hour =
    at.getHours() + at.getMinutes() / 60;

  const jobs = computeQueue();

  const planned = jobs.map((job) => ({
    job,
    carbon: jobCarbon(
      phase,
      job,
      Math.floor(hour)
    ),
  }));

  const runNow = planned.reduce(
    (sum, row) => sum + row.carbon.runNow,
    0
  );

  const best = planned.reduce(
    (sum, row) => sum + row.carbon.bestWindow,
    0
  );

  const computeSaving = Math.max(
    0,
    runNow - best
  );

  const bestLabel =
    planned[0]?.carbon.bestLabel ?? "13:00";

  const config = PHASES[phase];

  const pumpKwh =
    ((config.population *
      LITRES_PER_PERSON_DAY) /
      1000) *
    0.4;

  const windows = computeWindows(phase);

  const cleanWindow = windows.reduce(
    (acc, item) =>
      item.intensity < acc.intensity ? item : acc,
    windows[0]
  );

  const pumpSaving =
    (pumpKwh *
      (marginalIntensity(
        phase,
        Math.floor(hour)
      ) -
        cleanWindow.intensity)) /
    1000;

  const landscapeDemand =
    landscapeWaterKlYr(phase) / 365;

  const domesticDemand =
    (config.population * LITRES_PER_PERSON_DAY) /
    1000;

  const campusDemand =
    landscapeDemand + domesticDemand;

  const harvest =
    config.harvestKlYr / 365;

  const waterGap = Math.max(
    0,
    campusDemand - harvest
  );

  return [
    {
      id: "compute",
      icon: "compute",
      title:
        computeSaving > 0.5
          ? `Move the batch queue to ${bestLabel}`
          : "Batch queue is already in a clean window",
      detail:
        computeSaving > 0.5
          ? `${jobs.length} jobs, ${num(
              planned.reduce(
                (sum, row) =>
                  sum +
                  row.carbon.runNow /
                    Math.max(
                      1e-6,
                      marginalIntensity(
                        phase,
                        Math.floor(hour)
                      ) /
                        1000
                    ),
                0
              ),
              0
            )} kWh of work. The same output runs against a lower marginal intensity without new hardware.`
          : "The current hour is within the lowest-intensity band available today. Deferral would not reduce emissions.",
      metric:
        computeSaving > 0.5
          ? `−${num(computeSaving, 1)} kgCO₂e`
          : "No gain now",
      tone:
        computeSaving > 0.5 ? "good" : "warn",
      href: "/compute",
      cta: "Open compute",
    },
    {
      id: "pump",
      icon: "pump",
      title:
        pumpSaving > 0.05
          ? `Pump inside the ${cleanWindow.label} window`
          : "Pumping is already in the cleanest window",
      detail:
        pumpSaving > 0.05
          ? `The borewell runs continuously. Shifting its four-hour block to ${cleanWindow.label} keeps the same litres moving against lower grid carbon.`
          : "The pumping block already overlaps the lowest-intensity hour. There is no free carbon left in this load.",
      metric:
        pumpSaving > 0.05
          ? `−${num(pumpSaving, 1)} kgCO₂e/day`
          : "No gain now",
      tone: pumpSaving > 0.05 ? "good" : "warn",
      href: "/scenarios",
      cta: "Test in cockpit",
    },
    {
      id: "water",
      icon: "water",
      title:
        waterGap > 0.5
          ? "Trim campus demand to the harvest line"
          : "Harvest covers the campus water schedule",
      detail:
        waterGap > 0.5
          ? `Campus demand is ${num(
              campusDemand
            )} kL/day, domestic plus landscape, against ${num(
              harvest
            )} kL/day of harvest. Closing the gap means ${num(
              waterGap
            )} kL/day less draw, or more storage.`
          : `Campus demand of ${num(
              campusDemand
            )} kL/day sits inside the ${num(
              harvest
            )} kL/day harvest. The current schedule is within the water budget.`,
      metric:
        waterGap > 0.5
          ? `−${num(waterGap)} kL/day`
          : "Balanced",
      tone: waterGap > 0.5 ? "warn" : "good",
      href: "/scenarios",
      cta: "Test in cockpit",
    },
  ];
}

/* Re-export a couple of primitives so the view layer never
   needs to reach into the engine. */
export function primaryMetric(
  node: TwinNode
): TwinMetric | null {
  return (
    node.metrics.find(
      (item) => item.key === node.primaryKey
    ) ??
    node.metrics[0] ??
    null
  );
}

export function controlValue(
  node: TwinNode,
  control: TwinControl,
  values: Record<string, string>
): string {
  return (
    values[`${node.id}:${control.key}`] ??
    control.default
  );
}

export type { TwinNodeKind };
