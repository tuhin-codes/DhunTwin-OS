import { X } from "lucide-react";

import type { DhunAsset } from "../types";
import EvidenceBadge from "./EvidenceBadge";
import StatusMark from "./StatusMark";
import { num } from "../lib/format";

function flowRows(asset: DhunAsset) {
  const rows: { label: string; value: string }[] =
    [];

  if (asset.powerKw !== 0) {
    rows.push({
      label: asset.powerKw > 0 ? "Load now" : "Charging",
      value: `${num(Math.abs(asset.powerKw), 1)} kW`,
    });
  }

  if (asset.energyKwhDay > 0) {
    rows.push({
      label: "Energy today",
      value: `${num(asset.energyKwhDay)} kWh`,
    });
  }

  rows.push({
    label: "Carbon today",
    value: `${asset.carbonKgDay < 0 ? "−" : ""}${num(
      Math.abs(asset.carbonKgDay),
      1
    )} kg`,
  });

  if (asset.waterKlDay > 0) {
    rows.push({
      label: "Water today",
      value: `${num(asset.waterKlDay, 1)} kL`,
    });
  }

  return rows;
}

export default function AssetDetail({
  asset,
  onClose,
}: {
  asset: DhunAsset;
  onClose?: () => void;
}) {
  return (
    <section
      className="panel"
      aria-label={`${asset.name} detail`}
    >
      <div className="panel-head items-start">
        <div className="min-w-0">
          <p className="eyebrow mb-1.5">
            Asset twin
          </p>
          <h2 className="t-subtitle text-ink">
            {asset.name}
          </h2>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusMark status={asset.status} />
            <EvidenceBadge tier={asset.evidence} />
          </div>
        </div>

        {onClose ? (
          <button
            type="button"
            className="btn btn-quiet btn-sm -mr-1.5 -mt-1"
            onClick={onClose}
            aria-label="Close asset detail"
          >
            <X size={13} strokeWidth={2} />
          </button>
        ) : null}
      </div>

      <div className="panel-body">
        <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-4">
          <p className="numeral text-[28px] leading-none text-ink">
            {asset.headlineValue}
          </p>
          <p className="max-w-[55%] text-right text-[11.5px] leading-snug text-muted">
            {asset.headlineLabel}
          </p>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
          {flowRows(asset).map((row) => (
            <div key={row.label}>
              <dt className="text-[10.5px] uppercase tracking-[0.08em] text-faint">
                {row.label}
              </dt>
              <dd className="tabular mt-0.5 text-[13px] text-ink">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-5">
          <p className="eyebrow mb-2.5 text-[9.5px] text-faint">
            Documented parameters
          </p>

          <dl className="divide-y divide-rule">
            {asset.metrics.map((metric) => (
              <div
                className="flex items-baseline justify-between gap-3 py-2"
                key={metric.label}
              >
                <dt className="text-[12px] text-muted">
                  {metric.label}
                </dt>
                <dd className="flex items-baseline gap-2 text-right">
                  <span className="tabular text-[12.5px] text-ink">
                    {metric.value}
                    {metric.unit ? (
                      <span className="ml-1 text-[10.5px] text-faint">
                        {metric.unit}
                      </span>
                    ) : null}
                  </span>
                  <EvidenceBadge tier={metric.tier} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="panel-foot">
        <p className="note">{asset.note}</p>
      </div>
    </section>
  );
}
