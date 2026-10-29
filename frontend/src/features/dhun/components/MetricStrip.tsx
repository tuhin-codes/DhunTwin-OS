import type { ReactNode } from "react";

export type MetricDomain = "energy" | "water" | "ecology" | "compute" | "alert" | "forest";

export interface Metric {
  label: string;
  value: string;
  unit?: string;
  note?: ReactNode;
  tone?: "default" | "good" | "warn" | "danger";
  domain?: MetricDomain;
}

const TONE: Record<NonNullable<Metric["tone"]>, string> = {
  default: "text-ink",
  good: "text-[#12482E]",
  warn: "text-[#6B4706]",
  danger: "text-[#732117]",
};

const DOMAIN_CELL_STYLE: Record<MetricDomain, string> = {
  energy: "bg-[#F8E7C8]/20 border-t-2 border-t-[#D9A03A]",
  water: "bg-[#DCEAF5]/25 border-t-2 border-t-[#256D85]",
  ecology: "bg-[#DCECE3]/25 border-t-2 border-t-[#2E7D5B]",
  compute: "bg-[#E9E4F4]/25 border-t-2 border-t-[#3C2B6A]",
  alert: "bg-[#F5DEDA]/30 border-t-2 border-t-[#C53B27]",
  forest: "bg-[#E8F0EA]/30 border-t-2 border-t-[#173D32]",
};

export default function MetricStrip({
  metrics,
}: {
  metrics: Metric[];
}) {
  return (
    <div className="metric-strip">
      {metrics.map((metric) => {
        const domainStyle = metric.domain ? DOMAIN_CELL_STYLE[metric.domain] : "";

        return (
          <div
            className={`metric-cell transition-colors ${domainStyle}`}
            key={metric.label}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="eyebrow text-[11px] font-semibold tracking-wider text-muted">
                {metric.label}
              </p>
              {metric.domain && (
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    metric.domain === "energy"
                      ? "bg-[#D9A03A]"
                      : metric.domain === "water"
                        ? "bg-[#256D85]"
                        : metric.domain === "ecology"
                          ? "bg-[#2E7D5B]"
                          : metric.domain === "compute"
                            ? "bg-[#3C2B6A]"
                            : metric.domain === "alert"
                              ? "bg-[#C53B27]"
                              : "bg-[#173D32]"
                  }`}
                />
              )}
            </div>

            <p
              className={`mt-2 flex items-baseline gap-1.5 ${
                TONE[metric.tone ?? "default"]
              }`}
            >
              <span className="numeral text-[30px] md:text-[34px] leading-tight font-semibold tracking-tight text-ink">
                {metric.value}
              </span>

              {metric.unit ? (
                <span className="font-mono text-[12px] font-medium text-muted">
                  {metric.unit}
                </span>
              ) : null}
            </p>

            {metric.note ? (
              <p className="note mt-2 text-[12.5px] leading-relaxed line-clamp-2 text-muted">
                {metric.note}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
