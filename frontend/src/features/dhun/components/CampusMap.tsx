import {
  useMemo,
  useState,
} from "react";

import type {
  AssetStatus,
  DhunAsset,
  TwinSummary,
} from "../types";

import {
  CANOPY,
  CONTOURS,
  PONDS,
  ROADS,
  ZONES,
  zonePath,
} from "../data/zones";

import {
  topPressure,
  zoneLevel,
  zonePressures,
} from "../engine/zoneStatus";

const ZONE_FILL: Record<AssetStatus, string> = {
  healthy: "#DCECE3", // Sage / ecology ground
  watch: "#F8E7C8",   // Warm amber watch
  attention: "#F5DEDA", // Soft terracotta alert
};

const MARK: Record<AssetStatus, string> = {
  healthy: "#12482E",
  watch: "#6B4706",
  attention: "#732117",
};

import type { RegisteredAsset } from "../registry/types";

interface ExtendedMarkProps {
  id: string;
  name: string;
  short: string;
  x: number;
  y: number;
  status: AssetStatus;
  headlineValue: string;
  headlineLabel: string;
  commissioningStatus?: string;
  hasAlert?: boolean;
}

function AssetMark({
  asset,
  selected,
  onSelect,
}: {
  asset: ExtendedMarkProps;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const isPlanned = asset.commissioningStatus === "Planned";
  const isCommissioning = asset.commissioningStatus === "Commissioning";

  return (
    <g
      transform={`translate(${asset.x} ${asset.y})`}
      className="cursor-pointer"
      role="button"
      tabIndex={0}
      aria-label={`${asset.name}. ${asset.headlineValue} ${asset.headlineLabel}.`}
      onClick={() => onSelect(asset.id)}
      onKeyDown={(event) => {
        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();
          onSelect(asset.id);
        }
      }}
    >
      {selected ? (
        <circle
          r={16}
          fill="none"
          stroke="#173D32"
          strokeWidth={1.8}
          strokeDasharray="3 3"
          opacity={0.85}
        />
      ) : null}

      <circle r={14} fill="transparent" />

      {/* Visual State Distinction (Section 4.C) */}
      {isPlanned ? (
        <circle
          r={6}
          fill="#FAF8F5"
          stroke="#868279"
          strokeWidth={1.5}
          strokeDasharray="2 2"
        />
      ) : isCommissioning ? (
        <>
          <circle
            r={8}
            fill="none"
            stroke="#D9A03A"
            strokeWidth={1.2}
            className="animate-pulse"
          />
          <rect
            x={-3.5}
            y={-3.5}
            width={7}
            height={7}
            transform="rotate(45)"
            fill="#D9A03A"
            stroke="#FFFFFF"
            strokeWidth={1.5}
          />
        </>
      ) : (
        <rect
          x={-4}
          y={-4}
          width={8}
          height={8}
          transform="rotate(45)"
          fill={asset.hasAlert ? "#C53B27" : MARK[asset.status] || MARK.healthy}
          stroke="#FFFFFF"
          strokeWidth={1.8}
        />
      )}

      {/* Active Alert Indicator */}
      {asset.hasAlert && (
        <circle
          cx={6}
          cy={-6}
          r={3}
          fill="#EF4444"
          stroke="#FFFFFF"
          strokeWidth={1}
        />
      )}

      <text
        x={0}
        y={selected ? 27 : 19}
        textAnchor="middle"
        fontSize={9.5}
        fontWeight={600}
        letterSpacing="0.03em"
        fill="#19231E"
        stroke="#FFFFFF"
        strokeWidth={3}
        paintOrder="stroke"
        style={{ pointerEvents: "none" }}
      >
        {asset.short}
      </text>
    </g>
  );
}

export default function CampusMap({
  assets,
  summary,
  selectedId,
  onSelect,
  registeredAssets,
}: {
  assets: DhunAsset[];
  summary: TwinSummary;
  selectedId: string | null;
  onSelect: (id: string) => void;
  registeredAssets?: RegisteredAsset[];
}) {
  const [overlay, setOverlay] = useState(true);
  const [labels, setLabels] = useState(true);
  const [hovered, setHovered] = useState<
    string | null
  >(null);

  const pressures = useMemo(
    () => zonePressures(summary, assets),
    [summary, assets]
  );

  const zones = useMemo(
    () =>
      ZONES.map((zone) => {
        const level = zoneLevel(pressures[zone.id]);

        return {
          zone,
          level,
          reason: topPressure(
            pressures[zone.id],
            level
          ).text,
        };
      }),
    [pressures]
  );

  const hoveredAsset = assets.find(
    (asset) => asset.id === hovered
  );

  const counts = zones.reduce(
    (acc, zone) => {
      acc[zone.level] += 1;
      return acc;
    },
    {
      healthy: 0,
      watch: 0,
      attention: 0,
    } as Record<AssetStatus, number>
  );

  const allMapAssets = useMemo(() => {
    const list: ExtendedMarkProps[] = assets.map((a) => {
      const regMatch = registeredAssets?.find((r) => r.id === a.id);
      return {
        id: a.id,
        name: a.name,
        short: a.short,
        x: a.x,
        y: a.y,
        status: a.status,
        headlineValue: a.headlineValue,
        headlineLabel: a.headlineLabel,
        commissioningStatus: regMatch?.commissioningStatus,
      };
    });

    if (registeredAssets) {
      for (const reg of registeredAssets) {
        if (!list.some((item) => item.id.toLowerCase() === reg.id.toLowerCase())) {
          // Strictly check for verified coordinates; NEVER invent positions
          if (
            reg.location?.hasVerifiedCoordinates &&
            reg.location?.mapPosition?.x !== undefined &&
            reg.location?.mapPosition?.y !== undefined
          ) {
            list.push({
              id: reg.id,
              name: reg.name,
              short: reg.name.slice(0, 12),
              x: reg.location.mapPosition.x,
              y: reg.location.mapPosition.y,
              status: reg.commissioningStatus === "Active" ? "healthy" : "watch",
              headlineValue: `${reg.ratedCapacity} ${reg.capacityUnit}`,
              headlineLabel: "rated capacity",
              commissioningStatus: reg.commissioningStatus,
            });
          }
        }
      }
    }
    return list;
  }, [assets, registeredAssets]);

  return (
    <figure className="panel m-0 overflow-hidden">
      <div className="panel-head items-center py-3 px-5">
        <div className="flex items-center gap-2.5">
          <h2 className="t-title text-[18px] font-semibold text-ink">
            Site Masterplan & Infrastructure Map
          </h2>
          <span className="hidden font-mono text-[11px] text-muted sm:inline">
            · 500-Acre Campus Ground
          </span>
        </div>

        <div
          className="flex items-center gap-2"
          role="group"
          aria-label="Map layers"
        >
          <button
            type="button"
            className="btn btn-sm h-[30px] px-3 text-[12.5px] font-medium"
            aria-pressed={overlay}
            onClick={() => setOverlay((value) => !value)}
          >
            Environmental Condition
          </button>

          <button
            type="button"
            className="btn btn-sm h-[30px] px-3 text-[12.5px] font-medium"
            aria-pressed={labels}
            onClick={() => setLabels((value) => !value)}
          >
            Zone Labels
          </button>
        </div>
      </div>

      <div className="relative bg-surface">
        <svg
          viewBox="0 0 800 500"
          className="block h-auto w-full"
          role="group"
          aria-label="Site plan of the Dhun field station with parcels shaded by environmental pressure. Each asset is a button. Red parcels need attention, amber are on watch, green are within range."
        >
          <defs>
            <pattern
              id="hatch-attention"
              width="7"
              height="7"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="7"
                stroke="#EF4444"
                strokeWidth="1.2"
                opacity="0.35"
              />
            </pattern>
          </defs>
          <rect
            width="800"
            height="500"
            fill="#FBFBF9"
          />

          {/* survey grid */}
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

          {/* parcel base + condition fill */}
          {zones.map(({ zone, level }) => (
            <g key={zone.id}>
              <path
                d={zonePath(zone)}
                fill="#FFFFFF"
                stroke="#D5D1C8"
                strokeWidth={1}
                strokeLinejoin="round"
              />

              {overlay ? (
                <>
                  <path
                    d={zonePath(zone)}
                    fill={ZONE_FILL[level]}
                    opacity={0.94}
                    strokeLinejoin="round"
                  />

                  {level === "attention" ? (
                    <path
                      d={zonePath(zone)}
                      fill="url(#hatch-attention)"
                      stroke="none"
                    />
                  ) : null}

                  <path
                    d={zonePath(zone)}
                    fill="none"
                    stroke={
                      level === "attention"
                        ? "#C53B27"
                        : level === "watch"
                          ? "#B87A14"
                          : "#2E7D5B"
                    }
                    strokeWidth={1.4}
                    strokeLinejoin="round"
                  />
                </>
              ) : null}
            </g>
          ))}

          {/* contours */}
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

          {/* tree canopy */}
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

          {/* ponds */}
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

          {/* roads */}
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

          {/* parcel labels */}
          {labels
            ? zones.map(({ zone }) => (
                <text
                  key={`label-${zone.id}`}
                  x={zone.label[0]}
                  y={zone.label[1]}
                  fontSize={9}
                  fontWeight={600}
                  letterSpacing="0.12em"
                  fill="#63736A"
                  style={{ pointerEvents: "none" }}
                >
                  {zone.short.toUpperCase()}
                </text>
              ))
            : null}

          {/* assets */}
          {allMapAssets.map((asset) => (
            <g
              key={asset.id}
              onMouseEnter={() => setHovered(asset.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <AssetMark
                asset={asset}
                selected={asset.id === selectedId}
                onSelect={onSelect}
              />
            </g>
          ))}
        </svg>

        {/* compass */}
        <div className="pointer-events-none absolute right-4 top-4 flex flex-col items-center">
          <svg
            width="26"
            height="34"
            viewBox="0 0 26 34"
            aria-hidden="true"
          >
            <path
              d="M13 2 L18 16 L13 13 L8 16 Z"
              fill="#173D32"
            />
            <line
              x1="13"
              y1="18"
              x2="13"
              y2="32"
              stroke="#D5D1C8"
              strokeWidth="1.5"
            />
          </svg>
          <span className="mt-0.5 text-[9px] font-bold tracking-[0.12em] text-accent">
            N
          </span>
        </div>

        {/* scale bar */}
        <div className="pointer-events-none absolute bottom-3 left-4">
          <div className="flex items-end gap-1">
            <span className="text-[9.5px] font-medium text-muted">
              0
            </span>
            <div className="mb-1 h-[3px] w-[89px] border-x border-b border-[#87968E]" />
            <span className="text-[9.5px] font-medium text-muted">
              250
            </span>
            <div className="mb-1 h-[3px] w-[89px] border-x border-b border-[#87968E]" />
            <span className="text-[9.5px] font-medium text-muted">
              500 m
            </span>
          </div>
          <p className="mt-1 text-[9px] text-faint">
            Spatial grid: 422.01-acre EDS building survey within 500-acre site.
          </p>
        </div>

        {/* hover readout */}
        {hoveredAsset &&
        hoveredAsset.id !== selectedId ? (
          <div
            className="pointer-events-none absolute z-10 w-max max-w-[220px] -translate-x-1/2 -translate-y-[125%] rounded-[4px] border border-rule-strong bg-surface px-3 py-2 shadow-md"
            style={{
              left: `${(hoveredAsset.x / 800) * 100}%`,
              top: `${(hoveredAsset.y / 500) * 100}%`,
            }}
          >
            <p className="text-[12px] font-semibold text-ink">
              {hoveredAsset.name}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">
              {hoveredAsset.headlineValue}{" "}
              {hoveredAsset.headlineLabel}
            </p>
            <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.08em] font-semibold text-accent">
              {hoveredAsset.status === "attention"
                ? "Needs attention"
                : hoveredAsset.status === "watch"
                  ? "Watch"
                  : "Within range"}
            </p>
          </div>
        ) : null}
      </div>

      <figcaption className="panel-foot flex flex-wrap items-center justify-between gap-4 py-3 px-5 bg-surface-subtle">
        <div className="flex flex-wrap items-center gap-5">
          <span className="flex items-center gap-2 text-[13px] text-muted font-medium">
            <span className="h-3.5 w-3.5 rounded-[3px] border border-[#12482E] bg-[#DCECE3]" />
            Within Range
            <span className="tabular font-bold text-ink ml-0.5">
              {counts.healthy}
            </span>
          </span>

          <span className="flex items-center gap-2 text-[13px] text-muted font-medium">
            <span className="h-3.5 w-3.5 rounded-[3px] border border-[#6B4706] bg-[#F8E7C8]" />
            Watch
            <span className="tabular font-bold text-ink ml-0.5">
              {counts.watch}
            </span>
          </span>

          <span className="flex items-center gap-2 text-[13px] text-muted font-medium">
            <span className="h-3.5 w-3.5 rounded-[3px] border border-[#732117] bg-[#F5DEDA]" />
            Attention
            <span className="tabular font-bold text-ink ml-0.5">
              {counts.attention}
            </span>
          </span>

          <span className="flex items-center gap-2 text-[13px] text-muted font-medium">
            <span className="h-3.5 w-3.5 rounded-[3px] border border-dashed border-[#73847B] bg-[#F4F3ED]" />
            Planned / Under Comm.
          </span>
        </div>

        <p className="text-[12px] text-muted">
          Parcel colour reflects environmental pressure verdicts. Click any parcel or marker to inspect telemetry.
        </p>
      </figcaption>
    </figure>
  );
}
