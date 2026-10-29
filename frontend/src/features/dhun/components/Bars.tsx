import { clamp } from "../engine/simulation";

export interface Segment {
  label: string;
  value: number;
  color: string;
  text?: string;
}

/* Composition bar: one hundred percent of a total, split into
   named parts. Values are absolute tonnes. */
export function ShareBar({
  segments,
  total,
  ariaLabel,
}: {
  segments: Segment[];
  total: number;
  ariaLabel: string;
}) {
  const safeTotal = Math.max(1, total);

  return (
    <div
      className="flex h-11 w-full overflow-hidden rounded-[2px] border border-rule"
      role="img"
      aria-label={ariaLabel}
    >
      {segments.map((segment) => {
        const share = segment.value / safeTotal;

        return (
          <div
            key={segment.label}
            className="flex min-w-0 items-center justify-center border-r border-paper last:border-r-0"
            style={{
              width: `${share * 100}%`,
              background: segment.color,
            }}
            title={`${segment.label}: ${segment.text ?? segment.value.toFixed(0)}`}
          >
            {share > 0.09 ? (
              <span className="truncate px-1.5 text-[11px] font-semibold tracking-[0.02em] text-white">
                {Math.round(share * 100)}%
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/* Single quantity against a reference. */
export function BarRow({
  label,
  value,
  max,
  display,
  tone = "accent",
  note,
}: {
  label: string;
  value: number;
  max: number;
  display: string;
  tone?: "accent" | "danger" | "warn" | "good";
  note?: string;
}) {
  const colors = {
    accent: "#173D32",
    danger: "#C53B27",
    warn: "#B87A14",
    good: "#2E7D5B",
  };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13.5px] font-medium text-ink">
          {label}
        </span>
        <span className="tabular text-[13.5px] font-semibold font-mono text-ink">
          {display}
        </span>
      </div>

      <div
        className="meter mt-1.5"
        role="presentation"
      >
        <span
          style={{
            width: `${clamp(value / Math.max(1e-6, max)) * 100}%`,
            background: colors[tone],
          }}
        />
      </div>

      {note ? (
        <p className="mt-1 text-[12px] text-muted">
          {note}
        </p>
      ) : null}
    </div>
  );
}
