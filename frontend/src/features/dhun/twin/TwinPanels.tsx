/* ============================================================
   DHUN DIGITAL TWIN — SIDE PANELS
   Node register, threshold log, optimiser actions and the
   gateway seam. All state here is local or modelled.
   ============================================================ */

import { useState } from "react";

import {
  ArrowRight,
  Check,
  CheckCircle2,
  CloudSun,
  Cpu,
  Droplets,
  Gauge,
  Leaf,
  Recycle,
  Search,
  Sun,
  Waves,
  Zap,
  Building2,
} from "lucide-react";

import { Link } from "react-router-dom";

import type {
  FeedStatus,
  TwinAction,
  TwinEvent,
  TwinNode,
  TwinNodeKind,
} from "./types";

import { TWIN_STATUS } from "./types";

import { num } from "../lib/format";
import { istClock } from "../lib/clock";

const KIND_ICON: Record<
  TwinNodeKind,
  typeof Sun
> = {
  solar: Sun,
  grid: Zap,
  building: Building2,
  water: Droplets,
  stp: Recycle,
  organic: Leaf,
  compute: Cpu,
  weather: CloudSun,
};

function primaryValue(node: TwinNode): string {
  if (!node.available) {
    return "—";
  }

  const metric =
    node.metrics.find(
      (item) => item.key === node.primaryKey
    ) ?? node.metrics[0];

  if (!metric) {
    return "—";
  }

  return `${num(metric.value, metric.decimals)}${
    metric.unit ? ` ${metric.unit}` : ""
  }`;
}

/* ============================================================
   NODE REGISTER
   ============================================================ */

const STATUS_ORDER = {
  alarm: 0,
  watch: 1,
  online: 2,
  offline: 3,
} as const;

export function NodeRegister({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: TwinNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filterKind, setFilterKind] = useState<string>("all");

  const needle = query.trim().toLowerCase();

  const rows = nodes
    .filter((node) => {
      if (filterKind !== "all" && node.kind !== filterKind) {
        return false;
      }
      if (needle === "") {
        return true;
      }
      return `${node.name} ${node.short} ${node.deviceId} ${node.gateway} ${node.kind}`
        .toLowerCase()
        .includes(needle);
    })
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] -
          STATUS_ORDER[b.status] ||
        a.name.localeCompare(b.name)
    );

  const kinds = [
    { id: "all", label: "All Assets" },
    { id: "solar", label: "Solar" },
    { id: "grid", label: "Grid" },
    { id: "water", label: "Water" },
    { id: "compute", label: "Compute" },
    { id: "organic", label: "Ecology" },
  ];

  return (
    <section className="panel flex h-full flex-col">
      <div className="panel-head items-center">
        <h2 className="t-title text-ink">
          Asset Telemetry Register
        </h2>

        <span className="tabular font-mono text-[10.5px] text-muted">
          {rows.length} of {nodes.length} assets
        </span>
      </div>

      <div className="border-b border-rule bg-surface p-3 space-y-2.5">
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            strokeWidth={1.8}
          />
          <input
            type="search"
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            placeholder="Search asset, device id or gateway protocol..."
            className="h-8.5 w-full rounded-[4px] border border-rule bg-surface-subtle pl-9 pr-3 text-[12px] text-ink placeholder:text-muted focus:bg-surface focus:border-accent"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {kinds.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setFilterKind(k.id)}
              className={[
                "rounded-[3px] px-2 py-0.5 text-[10.5px] font-medium transition-colors",
                filterKind === k.id
                  ? "bg-accent text-white font-semibold"
                  : "bg-surface-subtle text-muted hover:text-ink hover:bg-[#EAEFEA]",
              ].join(" ")}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto flex-1 max-h-[420px]">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th scope="col">Asset & Device</th>
              <th scope="col">Status</th>
              <th scope="col" className="num">Primary Reading</th>
              <th scope="col">Telemetry Mode</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((node) => {
              const status = TWIN_STATUS[node.status];
              const Icon = KIND_ICON[node.kind];
              const active = node.id === selectedId;
              const hasLive = node.metrics.some((m) => m.live);

              return (
                <tr
                  key={node.id}
                  className="is-interactive"
                  aria-selected={active}
                  onClick={() => onSelect(node.id)}
                >
                  <td className="font-medium text-ink">
                    <div className="flex items-center gap-2">
                      <Icon size={14} className="text-muted shrink-0" />
                      <div>
                        <span className="block font-semibold text-ink text-[12px]">
                          {node.short}
                        </span>
                        <span className="block font-mono text-[9.5px] text-faint">
                          {node.deviceId}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium">
                      <span
                        className="status-dot"
                        style={{ background: status.color }}
                        aria-hidden="true"
                      />
                      <span className="capitalize">{node.status}</span>
                    </span>
                  </td>
                  <td className="num font-mono font-medium text-ink">
                    {primaryValue(node)}
                  </td>
                  <td>
                    {node.available ? (
                      hasLive ? (
                        <span className="tier tier-measured">Gateway Live</span>
                      ) : (
                        <span className="tier tier-simulated">Model Frame</span>
                      )
                    ) : (
                      <span className="tier border-l-[#87968E] text-[#87968E] bg-surface-subtle">
                        Uncommissioned
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-muted">
                  No assets match your search criteria.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="panel-foot flex items-center justify-between text-[11px] text-muted">
        <span>Click row to inspect asset channels and operating bounds.</span>
        <span className="font-mono text-[9.5px] text-faint">Seam: ws://localhost:5174</span>
      </div>
    </section>
  );
}

/* ============================================================
   ALERT LOG
   ============================================================ */

export function AlertLog({
  events,
}: {
  events: TwinEvent[];
}) {
  const [acked, setAcked] = useState<
    Record<string, true>
  >({});

  /* Keyed by level as well as channel: acknowledging a watch
     in one phase must not silence the alarm it becomes in the
     next. */
  const ackKey = (event: TwinEvent) =>
    `${event.id}:${event.level}`;

  const open = events.filter(
    (event) => !acked[ackKey(event)]
  );

  const ackedCount =
    events.length - open.length;

  return (
    <section className="panel flex h-full flex-col">
      <div className="panel-head items-center">
        <h2 className="t-title text-ink">
          Threshold log
        </h2>

        <span className="tabular font-mono text-[10px] text-muted">
          {open.length} open
          {ackedCount > 0
            ? ` · ${ackedCount} acked`
            : ""}
        </span>
      </div>

      {open.length === 0 ? (
        <div className="panel-body flex flex-1 flex-col items-start justify-center py-8">
          <CheckCircle2
            size={18}
            className="text-good"
            strokeWidth={1.8}
          />
          <p className="mt-2 text-[12.5px] font-medium text-ink-soft">
            {ackedCount > 0
              ? "Every open condition is acknowledged"
              : "No channel outside its band"}
          </p>
          <p className="note mt-1">
            {ackedCount > 0
              ? `${ackedCount} ${
                  ackedCount === 1
                    ? "channel is"
                    : "channels are"
                } still outside its normal band. The model keeps reporting it; the acknowledgement only hides it from this tab.`
              : "Every commissioned channel is inside its planning range at this frame."}
          </p>
        </div>
      ) : (
        <ul className="max-h-[360px] flex-1 divide-y divide-rule overflow-y-auto">
          {open.map((event) => (
            <li
              key={event.id}
              className="flex items-start gap-2.5 px-3 py-2.5"
            >
              <span
                className="status-dot mt-1.5"
                style={{
                  background:
                    event.level === "alarm"
                      ? "#D8624F"
                      : "#D9A03A",
                }}
                aria-hidden="true"
              />

              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2">
                  <span className="text-[11.5px] font-medium text-ink">
                    {event.nodeName}
                  </span>
                  <span className="text-[9.5px] uppercase tracking-[0.08em] text-faint">
                    {event.level === "alarm"
                      ? "Alarm"
                      : "Watch"}
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted">
                  {event.message}
                </p>
              </div>

              <button
                type="button"
                className="btn btn-quiet btn-sm shrink-0 px-1.5"
                onClick={() =>
                  setAcked((current) => ({
                    ...current,
                    [ackKey(event)]: true,
                  }))
                }
                aria-label={`Acknowledge ${event.nodeName} ${event.message}`}
                title="Acknowledge locally"
              >
                <Check size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="panel-foot">
        <p className="note">
          Bands are planning thresholds, not statutory
          limits. Acknowledgement is local to this tab.
        </p>
      </div>
    </section>
  );
}

/* ============================================================
   OPTIMISER ACTIONS
   ============================================================ */

const ACTION_ICON = {
  compute: Cpu,
  pump: Gauge,
  water: Waves,
} as const;

export function ActionList({
  actions,
}: {
  actions: TwinAction[];
}) {
  return (
    <section className="panel flex h-full flex-col">
      <div className="panel-head items-center">
        <h2 className="t-title text-ink">
          Optimiser actions
        </h2>
        <span className="font-mono text-[10px] text-faint">
          Modelled dispatch
        </span>
      </div>

      <ul className="flex-1 divide-y divide-rule">
        {actions.map((action) => {
          const Icon = ACTION_ICON[action.icon];
          const color =
            action.tone === "good"
              ? "#64A882"
              : "#D9A03A";

          return (
            <li key={action.id} className="px-4 py-3.5">
              <div className="flex items-start gap-2.5">
                <Icon
                  size={15}
                  strokeWidth={1.8}
                  className="mt-0.5 shrink-0 text-muted"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-[12px] font-semibold text-ink">
                      {action.title}
                    </p>

                    <span
                      className="tabular shrink-0 text-[11px] font-medium"
                      style={{ color }}
                    >
                      {action.metric}
                    </span>
                  </div>

                  <p className="mt-1 text-[11px] leading-snug text-muted">
                    {action.detail}
                  </p>

                  <Link
                    to={action.href}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-accent-hover"
                  >
                    {action.cta}
                    <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="panel-foot">
        <p className="note">
          Modelled savings. Nothing is dispatched to
          hardware.
        </p>
      </div>
    </section>
  );
}

/* ============================================================
   GATEWAY
   ============================================================ */

const FEED_LABEL: Record<
  FeedStatus,
  { label: string; color: string }
> = {
  simulated: {
    label: "Model feed",
    color: "#868279",
  },
  connecting: {
    label: "Connecting",
    color: "#D9A03A",
  },
  live: {
    label: "Gateway live",
    color: "#64A882",
  },
  stale: {
    label: "Stale (>30s)",
    color: "#D9A03A",
  },
  offline: {
    label: "Gateway offline",
    color: "#D8624F",
  },
};

function packetTime(at: number): string {
  const date = new Date(at);

  return istClock(
    new Date(
      date.getTime() +
        date.getTimezoneOffset() * 60000 +
        330 * 60000
    )
  );
}

export function GatewayCard({
  feed,
  endpoint,
  channels,
  lastPacketAt,
  paused,
}: {
  feed: FeedStatus;
  endpoint: string | null;
  channels: number;
  lastPacketAt: number | null;
  paused: boolean;
}) {
  const state = FEED_LABEL[feed];

  return (
    <section className="panel">
      <div className="panel-head items-center">
        <h2 className="t-title text-ink">
          Sensor gateway
        </h2>

        <span
          className="tier"
          style={{
            color: state.color,
            borderColor: `${state.color}66`,
            background: `${state.color}1A`,
          }}
        >
          <span
            className="status-dot"
            style={{ background: state.color }}
            aria-hidden="true"
          />
          {state.label}
        </span>
      </div>

      <div className="grid grid-cols-1 divide-y divide-rule md:grid-cols-3 md:divide-x md:divide-y-0">
        <div className="p-4">
          <p className="eyebrow text-[9.5px]">
            Endpoint
          </p>
          <p className="tw-code mt-1.5 break-all">
            {endpoint ?? "VITE_TELEMETRY_WS not set"}
          </p>
          <p className="note mt-2">
            {endpoint
              ? "Packets override the matching channel until they are 30 seconds old."
              : "The demo has no field hardware. Set the websocket URL before build to attach real sensors."}
          </p>
        </div>

        <div className="p-4">
          <p className="eyebrow text-[9.5px]">
            Channels overriding the model
          </p>
          <p className="numeral mt-1 text-[22px] leading-none text-ink">
            {channels}
          </p>
          <p className="tabular mt-1 text-[10.5px] text-muted">
            {paused
              ? "Feed frozen · resume to apply new packets"
              : lastPacketAt
                ? `Last packet ${packetTime(lastPacketAt)} IST`
                : "No packet received in the last 30 s"}
          </p>
          <p className="note mt-2">
            A packet is accepted only with a string node and
            channel plus a finite numeric value. Unknown keys
            never change a node.
          </p>
        </div>

        <div className="p-4">
          <p className="eyebrow text-[9.5px]">
            Packet contract
          </p>
          <pre className="tw-code mt-1.5 overflow-x-auto p-2 text-[10px] leading-relaxed">
{`{"nodeId":"grid-hub",
 "metric":"import",
 "value":318.4}`}
          </pre>
          <p className="note mt-2">
            Arrays and{" "}
            <span className="text-ink-soft">
              {"{ packets: [...] }"}
            </span>{" "}
            envelopes are accepted. Invalid packets are
            dropped.
          </p>
        </div>
      </div>

      <div className="panel-foot">
        <p className="note">
          The model keeps running underneath the gateway.
          Losing the socket is a data-quality event, not a
          blank screen.
        </p>
      </div>
    </section>
  );
}
