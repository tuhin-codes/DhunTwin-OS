/* ============================================================
   DHUN DIGITAL TWIN — NODE DETAIL
   One asset, its channels, its history and its local controls.
   History is model output; controls are demo state only.
   ============================================================ */

import {
  Radio,
  ShieldCheck,
} from "lucide-react";

import type {
  TwinControl,
  TwinMetric,
  TwinNode,
} from "./types";

import {
  METRIC_STATUS,
  TWIN_STATUS,
} from "./types";

import {
  controlValue,
} from "./buildFrame";

import {
  istClock,
  istDate,
} from "../lib/clock";

import { num } from "../lib/format";

function Sparkline({
  values,
  color,
  height = 34,
}: {
  values: number[];
  color: string;
  height?: number;
}) {
  const width = 160;
  const pad = 3;

  if (values.length === 0) {
    return (
      <div
        className="rounded-[3px] bg-paper"
        style={{ height }}
        aria-hidden="true"
      />
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1e-6, max - min);

  const x = (index: number) =>
    pad +
    (index / Math.max(1, values.length - 1)) *
      (width - pad * 2);

  const y = (value: number) =>
    pad +
    (1 - (value - min) / span) *
      (height - pad * 2);

  const path = values
    .map(
      (value, index) =>
        `${index === 0 ? "M" : "L"}${x(
          index
        ).toFixed(2)} ${y(value).toFixed(2)}`
    )
    .join(" ");

  const last = values[values.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="block w-full"
      style={{ height }}
      aria-hidden="true"
    >
      <line
        x1={pad}
        y1={height / 2}
        x2={width - pad}
        y2={height / 2}
        stroke="#D5D1C8"
        strokeWidth="0.8"
        strokeDasharray="2 3"
      />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={x(values.length - 1)}
        cy={y(last)}
        r="2.2"
        fill={color}
      />
    </svg>
  );
}

function StatusChip({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <span
      className="tier"
      style={{
        color,
        borderColor: `${color}66`,
        background: `${color}1A`,
      }}
    >
      {label}
    </span>
  );
}

function MetricTile({
  metric,
}: {
  metric: TwinMetric;
}) {
  const status = METRIC_STATUS[metric.status];

  return (
    <div className="min-w-0 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[10px] uppercase tracking-[0.08em] text-faint">
          {metric.label}
        </p>
        <span
          className="status-dot"
          style={{ background: status.color }}
          title={status.label}
        />
      </div>

      <p className="numeral mt-1 text-[16px] leading-none text-ink">
        {num(metric.value, metric.decimals)}
        {metric.unit ? (
          <span className="ml-1 text-[10px] font-normal text-muted">
            {metric.unit}
          </span>
        ) : null}
      </p>

      <div className="mt-2">
        <Sparkline
          values={metric.history}
          color={status.color}
          height={22}
        />
      </div>

      <p className="tabular mt-1 text-[9.5px] text-faint">
        Normal {num(metric.normal[0], metric.decimals)}–
        {num(metric.normal[1], metric.decimals)}
        {metric.live ? " · gateway" : ""}
      </p>
    </div>
  );
}

function ControlGroup({
  node,
  control,
  values,
  onChange,
}: {
  node: TwinNode;
  control: TwinControl;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const value = controlValue(node, control, values);

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] font-medium text-ink-soft">
          {control.label}
        </p>

        <div
          className="seg"
          role="group"
          aria-label={`${node.name} ${control.label}`}
        >
          {control.options.map((option) => (
            <button
              key={option}
              type="button"
              className="seg-item"
              aria-pressed={value === option}
              onClick={() => onChange(control.key, option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-1.5 text-[10.5px] leading-snug text-faint">
        {control.note}
      </p>
    </div>
  );
}

export default function NodeDetail({
  node,
  at,
  controls,
  onControl,
}: {
  node: TwinNode;
  at: Date;
  controls: Record<string, string>;
  onControl: (key: string, value: string) => void;
}) {
  const status = TWIN_STATUS[node.status];

  const primary =
    node.metrics.find(
      (metric) => metric.key === node.primaryKey
    ) ?? node.metrics[0];

  const rest = node.metrics.filter(
    (metric) => metric.key !== primary?.key
  );

  const liveChannels = node.metrics.filter(
    (metric) => metric.live
  ).length;

  return (
    <section className="panel flex h-full flex-col">
      <div className="panel-head items-start">
        <div className="min-w-0">
          <h2 className="t-title truncate text-ink">
            {node.name}
          </h2>
          <p className="tabular mt-0.5 font-mono text-[11px] text-muted">
            {node.deviceId} · {node.protocol}
          </p>
        </div>

        <StatusChip
          label={status.label}
          color={status.color}
        />
      </div>

      {!node.available ? (
        <>
          <div className="panel-body flex-1">
            <p className="note">{node.description}</p>

            <div className="mt-4 border border-dashed border-rule-strong bg-paper px-3 py-3">
              <div className="flex items-center gap-2">
                <Radio
                  size={14}
                  className="text-faint"
                  strokeWidth={1.8}
                />
                <p className="text-[12px] font-medium text-ink-soft">
                  {node.availabilityNote ??
                    "Not commissioned in this phase"}
                </p>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                No readings are synthesised for a planned
                asset. The gateway binding is defined so the
                twin can accept packets on day one of
                commissioning.
              </p>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
              {[
                ["Gateway", node.gateway],
                ["Protocol", node.protocol],
                [
                  "Channels planned",
                  String(node.plannedChannels),
                ],
                ["Phase", "Not yet built"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[9.5px] uppercase tracking-[0.08em] text-faint">
                    {label}
                  </dt>
                  <dd className="tabular mt-0.5 text-[12px] text-ink-soft">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="panel-foot">
            <p className="note">
              Switch phase to see this asset's instrument set.
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="panel-body flex-1">
            <p className="note">{node.description}</p>

            {primary ? (
              <div className="mt-4">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-faint">
                      {primary.label}
                    </p>
                    <p className="numeral mt-1 text-[34px] leading-none text-ink">
                      {num(
                        primary.value,
                        primary.decimals
                      )}
                      {primary.unit ? (
                        <span className="ml-1.5 text-[12px] font-normal text-muted">
                          {primary.unit}
                        </span>
                      ) : null}
                    </p>
                  </div>

                  <StatusChip
                    label={
                      METRIC_STATUS[primary.status]
                        .label
                    }
                    color={
                      METRIC_STATUS[primary.status]
                        .color
                    }
                  />
                </div>

                <div className="mt-3">
                  <Sparkline
                    values={primary.history}
                    color={
                      METRIC_STATUS[primary.status]
                        .color
                    }
                    height={48}
                  />
                </div>

                <div className="tabular mt-1 flex items-center justify-between text-[9.5px] text-faint">
                  <span>
                    Normal{" "}
                    {num(
                      primary.normal[0],
                      primary.decimals
                    )}
                    –
                    {num(
                      primary.normal[1],
                      primary.decimals
                    )}{" "}
                    {primary.unit}
                  </span>
                  <span>Last 36 frames</span>
                </div>

                {primary.live ? (
                  <p className="mt-1.5 text-[10px] font-medium text-accent-hover">
                    Latest value from the field gateway.
                  </p>
                ) : null}
              </div>
            ) : null}

            <p className="eyebrow mt-5 text-[9.5px]">
              Channels
            </p>

            <div className="tile-grid mt-2">
              {rest.map((metric) => (
                <MetricTile
                  key={metric.key}
                  metric={metric}
                />
              ))}

              <div
                className={[
                  "min-w-0 p-3",
                  rest.length % 2 === 0
                    ? "col-span-2"
                    : "",
                ].join(" ")}
              >
                <div className="flex items-center gap-1.5">
                  <ShieldCheck
                    size={11}
                    className="text-faint"
                    strokeWidth={1.8}
                  />
                  <p className="text-[10px] uppercase tracking-[0.08em] text-faint">
                    Gateway
                  </p>
                </div>
                <p className="mt-1.5 truncate text-[12px] font-medium text-ink-soft">
                  {node.gateway}
                </p>
                <p className="tabular mt-0.5 text-[10px] text-muted">
                  {node.protocol}
                </p>
                <p className="mt-1 text-[10px] text-faint">
                  {node.plannedChannels}{" "}
                  {node.available
                    ? "channels"
                    : "channels planned"}
                </p>
              </div>
            </div>
          </div>

          {node.controls.length > 0 ? (
            <div className="border-t border-rule">
              <div className="flex items-center justify-between gap-2 px-4 pt-3">
                <p className="eyebrow text-[9.5px]">
                  Local controls
                </p>
                <span className="tier tier-simulated">
                  Demo state
                </span>
              </div>

              <div className="divide-y divide-rule">
                {node.controls.map((control) => (
                  <ControlGroup
                    key={control.key}
                    node={node}
                    control={control}
                    values={controls}
                    onChange={onControl}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="panel-foot flex items-center justify-between gap-3">
            <p className="tabular text-[10px] text-faint">
              Frame {istClock(at)} IST ·{" "}
              {istDate(at)}
            </p>
            <p className="text-[10px] text-faint">
              {liveChannels > 0
                ? `Model + gateway · ${liveChannels} live`
                : "Model output"}
            </p>
          </div>
        </>
      )}
    </section>
  );
}
