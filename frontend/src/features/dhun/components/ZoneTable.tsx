import type {
  DhunAsset,
  TwinSummary,
} from "../types";

import { ZONES } from "../data/zones";
import {
  zoneLevel,
  zonePressures,
} from "../engine/zoneStatus";
import StatusMark from "./StatusMark";

export default function ZoneTable({
  summary,
  assets,
}: {
  summary: TwinSummary;
  assets: DhunAsset[];
}) {
  const pressures = zonePressures(summary, assets);

  return (
    <section className="panel overflow-hidden">
      <div className="panel-head py-3 px-5">
        <div className="flex items-center gap-2.5">
          <h2 className="t-title text-[18px] font-semibold text-ink">
            Parcel Environmental Pressure & Allocation
          </h2>
        </div>

        <span className="tabular font-mono text-[11px] text-muted font-medium">
          Dhun 500-Acre Masterplan
        </span>
      </div>

      <table className="data-table">
        <caption className="sr-only">
          Environmental pressure by parcel
        </caption>
        <thead>
          <tr>
            <th scope="col">Parcel / Zone</th>
            <th scope="col">Operating Verdict</th>
            <th scope="col">Primary Facility</th>
            <th scope="col" className="num">
              Monitored Assets
            </th>
          </tr>
        </thead>
        <tbody>
          {ZONES.map((zone) => {
            const level = zoneLevel(pressures[zone.id]);
            const anchor = assets.find(
              (asset) => asset.id === zone.anchorAsset
            );

            return (
              <tr key={zone.id}>
                <th
                  scope="row"
                  className="px-4 py-3 text-left text-[14px] font-semibold text-ink"
                >
                  {zone.name} ({zone.short})
                </th>
                <td className="px-4 py-3">
                  <StatusMark status={level} />
                </td>
                <td className="px-4 py-3 text-[13.5px] text-muted">
                  {anchor?.name ?? "—"}
                </td>
                <td className="px-4 py-3 num font-mono text-[13.5px] text-ink font-semibold">
                  {
                    assets.filter(
                      (asset) => asset.zone === zone.id
                    ).length
                  }
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="panel-foot py-3 px-5">
        <p className="note text-[12.5px] text-muted leading-relaxed">
          Verdicts evaluate active phase demand. Energy is flagged when the campus has no on-site generation; built fabric inherits the carbon intensity of grid imports.
        </p>
      </div>
    </section>
  );
}
