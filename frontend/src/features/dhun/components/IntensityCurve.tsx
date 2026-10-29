import type { ComputeWindow } from "../types";
import { num } from "../lib/format";

const W = 720;
const H = 210;
const PAD_L = 38;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 26;

function xFor(hour: number): number {
  return (
    PAD_L +
    (hour / 23) * (W - PAD_L - PAD_R)
  );
}

export function IntensityCurve({
  windows,
  nowHour,
  bestHour,
}: {
  windows: ComputeWindow[];
  nowHour: number;
  bestHour: number;
}) {
  const maxValue =
    Math.ceil(
      Math.max(
        ...windows.map((window) => window.intensity)
      ) / 100
    ) * 100;

  const yFor = (value: number) =>
    PAD_T +
    (1 - value / maxValue) * (H - PAD_T - PAD_B);

  const points = windows.map(
    (window) =>
      `${xFor(window.hour)},${yFor(window.intensity)}`
  );

  const line = `M ${points.join(" L ")}`;

  const area = `${line} L ${xFor(
    23
  )},${yFor(0)} L ${xFor(0)},${yFor(
    0
  )} Z`;

  const current =
    windows.find((window) => window.hour === nowHour) ??
    windows[0];

  const best =
    windows.find(
      (window) => window.hour === bestHour
    ) ?? windows[0];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`Marginal grid carbon intensity across 24 hours. Lowest value ${num(
        best.intensity
      )} grams at ${best.label}; current value ${num(
        current.intensity
      )} grams at ${current.label}.`}
    >
      {/* value gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
        const value = maxValue * fraction;

        return (
          <g key={fraction}>
            <line
              x1={PAD_L}
              y1={yFor(value)}
              x2={W - PAD_R}
              y2={yFor(value)}
              stroke="#E2DFD8"
              strokeWidth="0.8"
            />
            <text
              x={PAD_L - 6}
              y={yFor(value) + 3}
              textAnchor="end"
              fontSize="11"
              fontFamily="monospace"
              fill="#4B5B52"
            >
              {num(value)}
            </text>
          </g>
        );
      })}

      {/* lowest-carbon window */}
      <rect
        x={xFor(best.hour) - 9}
        y={PAD_T}
        width={18}
        height={H - PAD_T - PAD_B}
        fill="#2E7D5B"
        opacity="0.14"
      />

      <path d={area} fill="#173D32" opacity="0.08" />

      <path
        d={line}
        fill="none"
        stroke="#173D32"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />

      {/* now marker */}
      <line
        x1={xFor(current.hour)}
        y1={PAD_T}
        x2={xFor(current.hour)}
        y2={H - PAD_B}
        stroke="#C53B27"
        strokeWidth="1.5"
        strokeDasharray="3 3"
      />
      <circle
        cx={xFor(current.hour)}
        cy={yFor(current.intensity)}
        r="4"
        fill="#C53B27"
        stroke="#FFFFFF"
        strokeWidth="2"
      />

      {/* best marker */}
      <circle
        cx={xFor(best.hour)}
        cy={yFor(best.intensity)}
        r="4"
        fill="#12482E"
        stroke="#FFFFFF"
        strokeWidth="2"
      />

      <text
        x={xFor(best.hour)}
        y={yFor(best.intensity) - 9}
        textAnchor="middle"
        fontSize="11"
        fontWeight="bold"
        fill="#12482E"
      >
        {best.label}
      </text>

      {/* hour axis */}
      {[0, 3, 6, 9, 12, 15, 18, 21].map((hour) => (
        <text
          key={hour}
          x={xFor(hour)}
          y={H - 8}
          textAnchor="middle"
          fontSize="11"
          fontFamily="monospace"
          fill="#4B5B52"
        >
          {String(hour).padStart(2, "0")}
        </text>
      ))}

      <text
        x={W - PAD_R}
        y={PAD_T + 8}
        textAnchor="end"
        fontSize="11"
        fontFamily="monospace"
        fill="#4B5B52"
      >
        gCO₂e / kWh
      </text>
    </svg>
  );
}

export function SolarStrip({
  windows,
}: {
  windows: ComputeWindow[];
}) {
  const maxSolar = Math.max(
    1,
    ...windows.map((window) => window.solarKw)
  );

  const height = 38;
  const barWidth =
    (W - PAD_L - PAD_R) / 24;

  return (
    <svg
      viewBox={`0 0 ${W} ${height + 14}`}
      className="block h-auto w-full"
      role="img"
      aria-label="On-site solar generation by hour."
    >
      {windows.map((window) => {
        const barHeight =
          (window.solarKw / maxSolar) * height;

        return (
          <rect
            key={window.hour}
            x={xFor(window.hour) - barWidth / 2 + 1}
            y={height - barHeight}
            width={Math.max(1, barWidth - 2)}
            height={barHeight}
            fill="#D9A03A"
            opacity="0.45"
          />
        );
      })}

      <line
        x1={PAD_L}
        y1={height}
        x2={W - PAD_R}
        y2={height}
        stroke="#E2DFD8"
        strokeWidth="1"
      />

      <text
        x={PAD_L}
        y={height + 12}
        fontSize="11"
        fontFamily="monospace"
        fill="#4B5B52"
        fontWeight="500"
      >
        On-site solar · {num(maxSolar)} kW peak
      </text>
    </svg>
  );
}
