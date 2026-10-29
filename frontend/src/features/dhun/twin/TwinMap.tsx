/* ============================================================
   DHUN DIGITAL TWIN — INSTRUMENT MAP
   The same site geometry as the campus plan, but drawn as a
   topology: every instrumented asset, its status ring, and the
   direction of the flow it sits on.
   ============================================================ */

import { useState } from "react";

import type {
  TwinNode,
  TwinNodeKind,
} from "./types";

import { TWIN_STATUS } from "./types";

import {
  CANOPY,
  CONTOURS,
  PONDS,
  ROADS,
  ZONES,
  zonePath,
} from "../data/zones";

import { num } from "../lib/format";

interface Flow {
  from: string;
  to: string;
  kind: "energy" | "water";
}

const FLOWS: Flow[] = [
  { from: "solar-array", to: "grid-hub", kind: "energy" },
  { from: "grid-hub", to: "field-office", kind: "energy" },
  { from: "grid-hub", to: "compute", kind: "energy" },
  { from: "grid-hub", to: "r1-residences", kind: "energy" },
  { from: "grid-hub", to: "school", kind: "energy" },
  { from: "borewell", to: "irrigation", kind: "water" },
  { from: "stp", to: "irrigation", kind: "water" },
  { from: "irrigation", to: "gaushala", kind: "water" },
];

const FLOW_COLOR = {
  energy: "#868279",
  water: "#7FA6BC",
};

function glyph(kind: TwinNodeKind) {
  switch (kind) {
    case "solar":
      return (
        <>
          <rect x={-5} y={-5} width={10} height={10} rx={1} />
          <path d="M-5 -1.5 H5 M-1.5 -5 V5" />
        </>
      );
    case "grid":
      return (
        <path
          d="M0 -6 L4 -0.5 H1 L2.5 6 L-4 -1 H-1 Z"
          fill="currentColor"
          stroke="none"
        />
      );
    case "building":
      return (
        <>
          <path d="M-5 5 V-5 H5 V5" />
          <path d="M-2 5 V-1 H2 V5" />
        </>
      );
    case "water":
      return (
        <path d="M0 -6 C4 -1 5 1 5 3 A5 5 0 0 1 -5 3 C-5 1 -4 -1 0 -6 Z" />
      );
    case "stp":
      return (
        <>
          <path d="M0 -6 L5 -3 V3 L0 6 L-5 3 V-3 Z" />
          <path d="M-2.5 0 H2.5 M-2 3 H2" />
        </>
      );
    case "organic":
      return (
        <>
          <path d="M-5 5 C-5 -3 2 -5 6 -6 C5 1 -1 6 -5 5 Z" />
          <path d="M-4 5 L3 -3" />
        </>
      );
    case "compute":
      return (
        <>
          <rect x={-5} y={-5} width={10} height={10} rx={1} />
          <path d="M-2.5 -2.5 H-1 V-1 H-2.5 Z M1 -2.5 H2.5 V-1 H1 Z M-2.5 1.5 H2.5" />
        </>
      );
    case "weather":
      return (
        <>
          <circle cx={0} cy={-1} r={3.5} />
          <path d="M0 2.5 V6 M-7 4.5 H-2 M2 4.5 H6" />
        </>
      );
    default:
      return <circle r={4} />;
  }
}

function NodeMark({
  node,
  selected,
  onSelect,
  onHover,
}: {
  node: TwinNode;
  selected: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const status = TWIN_STATUS[node.status];

  const visible = node.available
    ? node.short
    : `${node.short} · planned`;

  return (
    <g
      transform={`translate(${node.x} ${node.y})`}
      className="cursor-pointer"
      role="button"
      tabIndex={0}
      aria-label={`${visible}. ${node.name}. ${status.label}.`}
      onClick={() => onSelect(node.id)}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(node.id)}
      onBlur={() => onHover(null)}
      onKeyDown={(event) => {
        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();
          onSelect(node.id);
        }
      }}
    >
      {selected ? (
        <circle
          r={17}
          fill="none"
          stroke="#173D32"
          strokeWidth={1.8}
          strokeDasharray="3 3"
          opacity={0.85}
        />
      ) : null}

      <circle r={22} fill="transparent" />

      <circle
        r={11}
        fill="#FFFFFF"
        stroke={status.color}
        strokeWidth={node.available ? 2 : 1.3}
        strokeDasharray={
          node.available ? undefined : "2 2"
        }
      />

      <g
        fill="none"
        stroke={
          node.available ? "#173D32" : "#87968E"
        }
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ pointerEvents: "none" }}
      >
        {glyph(node.kind)}
      </g>

      <text
        x={0}
        y={selected ? 28 : 24}
        textAnchor="middle"
        fontSize={9.5}
        fontWeight={600}
        letterSpacing="0.03em"
        fill={
          node.available ? "#19231E" : "#87968E"
        }
        stroke="#FFFFFF"
        strokeWidth={3}
        paintOrder="stroke"
        style={{ pointerEvents: "none" }}
      >
        {visible}
      </text>
    </g>
  );
}

function flowLine(
  a: TwinNode,
  b: TwinNode
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / length;
  const uy = dy / length;

  return {
    x1: a.x + ux * 15,
    y1: a.y + uy * 15,
    x2: b.x - ux * 17,
    y2: b.y - uy * 17,
  };
}

export default function TwinMap({
  nodes,
  selectedId,
  onSelect,
  paused = false,
}: {
  nodes: TwinNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  paused?: boolean;
}) {
  const [hovered, setHovered] = useState<
    string | null
  >(null);

  const byId = new Map(
    nodes.map((node) => [node.id, node])
  );

  const hoveredNode =
    hovered !== selectedId && hovered
      ? byId.get(hovered)
      : undefined;

  /* Nodes near the top of the site need the tooltip below
     them, or it lands outside the map frame. */
  const tooltipBelow = hoveredNode
    ? hoveredNode.y < 110
    : false;

  const online = nodes.filter(
    (node) => node.available
  ).length;

  const counts = nodes.reduce(
    (acc, node) => {
      acc[node.status] += 1;
      return acc;
    },
    {
      online: 0,
      watch: 0,
      alarm: 0,
      offline: 0,
    }
  );

  return (
    <figure
      className={`panel m-0 overflow-hidden${paused ? " tw-paused" : ""}`}
    >
      <div className="panel-head items-center">
        <div className="flex items-center gap-2">
          <h2 className="t-title text-ink">
            Live topology
          </h2>
          <span className="hidden font-mono text-[11px] text-muted sm:inline">
            · Field station
          </span>
        </div>

        <p className="tabular hidden font-mono text-[10.5px] text-muted sm:block">
          {paused ? "Frames paused · " : ""}
          {online} online · {nodes.length - online}{" "}
          planned
        </p>
      </div>

      <div className="overflow-x-auto bg-surface">
        {/* The drawing box is wider than the scroll port on
            phones. Percentages inside this wrapper therefore
            match the SVG, not the visible frame. */}
        <div className="relative min-w-[560px]">
          <svg
            viewBox="0 0 800 500"
            className="block h-auto w-full"
            role="group"
            aria-label="Topology map of the Dhun field station. Each instrumented asset is a button. Red rings are alarms, amber are on watch, grey dashed rings are planned but not commissioned."
          >
            <defs>
              <marker
                id="tw-arrow-energy"
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <path
                  d="M0 0 L8 4 L0 8 Z"
                  fill={FLOW_COLOR.energy}
                />
              </marker>
              <marker
                id="tw-arrow-water"
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <path
                  d="M0 0 L8 4 L0 8 Z"
                  fill={FLOW_COLOR.water}
                />
              </marker>
            </defs>

            <rect
              width="800"
              height="500"
              fill="#FBFBF9"
            />

            <g stroke="#EAE7DF" strokeWidth="0.7">
              {[100, 200, 300, 400, 500, 600, 700].map(
                (x) => (
                  <line
                    key={`vx-${x}`}
                    x1={x}
                    y1="0"
                    x2={x}
                    y2="500"
                  />
                )
              )}
              {[100, 200, 300, 400].map((y) => (
                <line
                  key={`hy-${y}`}
                  x1="0"
                  y1={y}
                  x2="800"
                  y2={y}
                />
              ))}
            </g>

            {ZONES.map((zone) => (
              <g key={zone.id}>
                <path
                  d={zonePath(zone)}
                  fill="#FFFFFF"
                  stroke="#D5D1C8"
                  strokeWidth={1}
                  strokeLinejoin="round"
                />
                <text
                  x={zone.label[0]}
                  y={zone.label[1]}
                  fontSize={8.5}
                  fontWeight={600}
                  letterSpacing="0.12em"
                  fill="#63736A"
                  style={{ pointerEvents: "none" }}
                >
                  {zone.short.toUpperCase()}
                </text>
              </g>
            ))}

            <g
              fill="none"
              stroke="#D5D0C5"
              strokeWidth="0.9"
              opacity="0.6"
              strokeDasharray="3 4"
            >
              {CONTOURS.map((d) => (
                <path d={d} key={d} />
              ))}
            </g>

            <g fill="#A9CCA4" opacity={0.35}>
              {CANOPY.map((tree, index) => (
                <circle
                  key={index}
                  cx={tree.x}
                  cy={tree.y}
                  r={tree.r}
                  opacity={tree.o}
                />
              ))}
            </g>

            <g
              fill="#D5E8F2"
              stroke="#9AC3D8"
              strokeWidth="1.2"
              opacity={0.9}
            >
              {PONDS.map((pond) => (
                <ellipse
                  key={`${pond.cx}-${pond.cy}`}
                  cx={pond.cx}
                  cy={pond.cy}
                  rx={pond.rx}
                  ry={pond.ry}
                />
              ))}
            </g>

            <g fill="none" strokeLinecap="round">
              {ROADS.map((d) => (
                <path
                  key={d}
                  d={d}
                  stroke="#E2DFD8"
                  strokeWidth={7}
                />
              ))}
              {ROADS.map((d) => (
                <path
                  key={`c-${d}`}
                  d={d}
                  stroke="#B5B1A8"
                  strokeWidth="0.9"
                  strokeDasharray="5 6"
                />
              ))}
            </g>

            {/* Flow links: only where both ends exist in this phase. */}
            <g fill="none" strokeWidth={1.1}>
              {FLOWS.map((flow) => {
                const a = byId.get(flow.from);
                const b = byId.get(flow.to);

                if (!a?.available || !b?.available) {
                  return null;
                }

                const line = flowLine(a, b);
                const highlight =
                  selectedId === a.id ||
                  selectedId === b.id;

                return (
                  <line
                    key={`${flow.from}-${flow.to}`}
                    {...line}
                    stroke={FLOW_COLOR[flow.kind]}
                    strokeOpacity={highlight ? 0.8 : 0.42}
                    strokeWidth={highlight ? 1.7 : 1.1}
                    markerEnd={`url(#tw-arrow-${flow.kind})`}
                    className="tw-flow"
                  />
                );
              })}
            </g>

            {nodes.map((node) => (
              <NodeMark
                key={node.id}
                node={node}
                selected={node.id === selectedId}
                onSelect={onSelect}
                onHover={setHovered}
              />
            ))}
          </svg>

          {hoveredNode ? (
            <div
              className={[
                "tw-tip pointer-events-none absolute z-10 w-max max-w-[220px] -translate-x-1/2 rounded-[2px] border border-rule-strong bg-card px-2.5 py-2",
                tooltipBelow
                  ? "translate-y-[30px]"
                  : "-translate-y-[125%]",
              ].join(" ")}
              style={{
                left: `${(hoveredNode.x / 800) * 100}%`,
                top: `${(hoveredNode.y / 500) * 100}%`,
              }}
            >
              <p className="text-[11.5px] font-semibold text-ink">
                {hoveredNode.name}
              </p>
              {hoveredNode.available ? (
                (() => {
                  const primary =
                    hoveredNode.metrics.find(
                      (item) =>
                        item.key ===
                        hoveredNode.primaryKey
                    ) ?? hoveredNode.metrics[0];

                  return primary ? (
                    <p className="tabular mt-0.5 text-[11px] text-muted">
                      {num(
                        primary.value,
                        primary.decimals
                      )}{" "}
                      {primary.unit}
                    </p>
                  ) : null;
                })()
              ) : (
                <p className="mt-0.5 text-[11px] text-faint">
                  {hoveredNode.availabilityNote ??
                    "Not commissioned"}
                </p>
              )}
              <p className="mt-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-faint">
                <span
                  className="status-dot"
                  style={{
                    background:
                      TWIN_STATUS[hoveredNode.status]
                        .color,
                  }}
                />
                {TWIN_STATUS[hoveredNode.status].label}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <figcaption className="panel-foot">
        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
          <div className="flex flex-wrap items-center gap-4">
            {(
              [
                "online",
                "watch",
                "alarm",
                "offline",
              ] as const
            ).map((status) => (
              <span
                key={status}
                className="flex items-center gap-1.5 text-[11px] text-muted"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full border"
                  style={{
                    borderColor:
                      TWIN_STATUS[status].color,
                    background:
                      status === "offline"
                        ? "transparent"
                        : TWIN_STATUS[status].color,
                  }}
                />
                {TWIN_STATUS[status].label}
                <span className="tabular text-faint">
                  {counts[status]}
                </span>
              </span>
            ))}
          </div>

          <p className="text-[10.5px] text-faint">
            Flow arrows show direction, not measured volume.
          </p>
        </div>

        <p className="mt-2 text-[10.5px] text-faint sm:hidden">
          Scroll the map sideways to reach the east parcel.
        </p>
      </figcaption>
    </figure>
  );
}
