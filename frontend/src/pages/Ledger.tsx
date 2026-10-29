import { useMemo } from "react";

import PageHeader from "../features/dhun/components/PageHeader";
import MetricStrip from "../features/dhun/components/MetricStrip";
import EvidenceBadge from "../features/dhun/components/EvidenceBadge";
import {
  BarRow,
  ShareBar,
} from "../features/dhun/components/Bars";

import { useTwin } from "../features/dhun/context/useTwin";
import { useAssetRegistry } from "../features/dhun/registry/AssetRegistryContext";
import { buildLedger } from "../features/dhun/engine/ledger";
import { PHASES, PHASE_ORDER } from "../features/dhun/data/phases";
import { TARGET_PER_CAPITA_T } from "../features/dhun/data/constants";
import { num, tonnes } from "../features/dhun/lib/format";
import type { PhaseId } from "../features/dhun/types";

const SEGMENT_COLOR: Record<string, string> = {
  "a1-a3": "#6E5C46",
  "a4-a5": "#8C775D",
  "b1-b4": "#4F6573",
  "c1-c4": "#5C646B",
  b6: "#C53B27",
};

export default function Ledger() {
  const { phase } = useTwin();
  const { assets: registeredAssets } = useAssetRegistry();

  const ledger = useMemo(
    () => buildLedger(phase),
    [phase]
  );

  const programme = useMemo(
    () =>
      PHASE_ORDER.map((id: PhaseId) => ({
        id,
        ledger: buildLedger(id),
      })),
    []
  );

  const grossT =
    ledger.upfrontT +
    ledger.useEmbodiedT +
    ledger.operationalT;

  const segments = ledger.lines
    .filter((line) => line.valueT > 0)
    .map((line) => ({
      label: line.label,
      value: line.valueT,
      color:
        SEGMENT_COLOR[line.key] ?? "#55565C",
      text: `${num(line.valueT)} tCO₂e`,
    }));

  const maxBar = Math.max(
    ledger.annualBudgetT,
    ledger.upfrontAmortisedT,
    ledger.operationalT,
    ledger.sinkT
  );

  const buildout = buildLedger("buildout");
  const buildoutRatio = buildout.upfrontVsBudget;

  /* Whole-life per capita at build-out: gross operational
     emissions plus embodied spread across the assessment life. */
  const buildoutWholeLifePerCapita =
    (buildout.operationalT +
      buildout.upfrontT +
      buildout.useEmbodiedT) /
    25 /
    buildout.population;

  const lockedInShare =
    (ledger.upfrontT + ledger.useEmbodiedT) / grossT;

  return (
    <div className="sheet">
      <PageHeader
        index="03 · Carbon Ledger"
        title="Carbon Ledger & Whole-Life Debt"
        lede="Operational energy is the number commonly disclosed, but embodied construction debt represents the majority of whole-life carbon. Construction, replacement, operation and the land sink sit on one transparent axis."
        aside={
          <>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-accent font-semibold">
              {PHASES[phase].label}
            </p>
            <p className="tabular text-[12px] font-medium text-ink">
              {num(ledger.builtM2)} m² built ·{" "}
              {num(ledger.population)} active residents
            </p>
            <p className="font-mono text-[10px] text-muted">
              EN 15978 modules · 25-year horizon
            </p>
          </>
        }
      />

      <MetricStrip
        metrics={[
          {
            label: "Whole-life carbon",
            value: tonnes(ledger.wholeLifeT),
            unit: "tCO₂e",
            note: "Embodied once, plus one year of operation, less the sink.",
            tone:
              ledger.wholeLifeT > 0 ? "danger" : "good",
            domain: "alert",
          },
          {
            label: "Operational per capita",
            value: num(
              ledger.operationalPerCapitaT,
              2
            ),
            unit: "tCO₂e",
            note: `Scope 1+2 across ${num(ledger.population)} active residents (target: ${TARGET_PER_CAPITA_T.toFixed(1)} t).`,
            tone:
              ledger.operationalPerCapitaT <=
              TARGET_PER_CAPITA_T
                ? "good"
                : "danger",
            domain: "energy",
          },
          {
            label: "Upfront embodied",
            value: tonnes(ledger.upfrontT),
            unit: "tCO₂e",
            note: "A1–A5 at 225 kgCO₂e per m². Committed once built.",
            tone: "danger",
            domain: "forest",
          },
          {
            label: "Years to repay embodied",
            value:
              ledger.yearsToOffsetUpfront === null
                ? "Never"
                : num(ledger.yearsToOffsetUpfront),
            unit:
              ledger.yearsToOffsetUpfront === null
                ? undefined
                : "years",
            note:
              ledger.yearsToOffsetUpfront === null
                ? "At the current net rate the sink cannot repay it."
                : "At the current net sequestration rate.",
            tone:
              ledger.yearsToOffsetUpfront === null
                ? "danger"
                : "warn",
            domain: "ecology",
          },
        ]}
      />

      <div className="split grid-cols-1 lg:grid-cols-12">
        <section className="panel lg:col-span-7">
          <div className="panel-head">
            <h2 className="t-title text-ink">
              Whole-life composition
            </h2>

            <span className="tabular font-mono text-[11px] font-medium text-muted">
              {num(grossT)} t gross
            </span>
          </div>

          <div className="panel-body">
            <ShareBar
              segments={segments}
              total={grossT}
              ariaLabel={`Gross whole-life emissions of ${num(
                grossT
              )} tonnes, split across construction, transport, replacement, end of life and operation.`}
            />

            <ul className="mt-4 divide-y divide-rule">
              {ledger.lines.map((line) => {
                const share =
                  line.valueT > 0
                    ? line.valueT / grossT
                    : 0;

                return (
                  <li
                    key={line.key}
                    className="flex gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <span
                      className="mt-1 h-2.5 w-2.5 shrink-0 rounded-xs border border-white/15"
                      style={{
                        background:
                          line.tone === "sink"
                            ? "#12482E"
                            : SEGMENT_COLOR[
                                line.key
                              ] ?? "#55565C",
                      }}
                      aria-hidden="true"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13.5px] font-semibold text-ink">
                          {line.label}
                        </p>
                        <EvidenceBadge
                          tier={line.tier}
                        />
                      </div>

                      <p className="note mt-0.5 text-[12.5px]">
                        {line.detail}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="tabular text-[13.5px] font-semibold text-ink">
                        {line.valueT < 0 ? "−" : ""}
                        {num(Math.abs(line.valueT))} t
                      </p>
                      <p className="tabular font-mono text-[10.5px] text-muted">
                        {line.valueT < 0
                          ? "sink"
                          : `${num(
                              share * 100
                            )}% of gross`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 border-l-3 border-[#C53B27] bg-[#F5DEDA]/30 p-3 rounded-r">
              <p className="text-[13px] leading-relaxed text-ink">
                <strong className="font-semibold">{num(lockedInShare * 100)}% of gross emissions</strong> are locked in before a single
                resident moves in. Operational energy is
                the remaining{" "}
                {num(100 - lockedInShare * 100)}%, and it
                is the only part a building manager can
                still influence.
              </p>
            </div>
          </div>

          <div className="panel-foot">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted font-semibold">
                Net whole life
              </span>
              <span className="numeral text-[22px] font-semibold text-ink">
                {tonnes(ledger.wholeLifeT)}{" "}
                <span className="font-sans text-[12px] font-normal text-muted">
                  tCO₂e
                </span>
              </span>
            </div>
            <p className="note mt-1 text-[12px]">
              Embodied carbon is counted once. Operation
              and the land sink are shown as one year, so
              the annual balance compounds from this
              figure.
            </p>
          </div>
        </section>

        <div className="stack lg:col-span-5">
          <section className="panel">
            <div className="panel-head">
              <h2 className="t-title text-ink">
                Budget test
              </h2>
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted font-semibold">
                Build-out
              </span>
            </div>

            <div className="panel-body">
              <p className="numeral text-[36px] font-bold leading-none text-[#732117]">
                {buildoutRatio.toFixed(1)}
                <span className="ml-1 text-[20px] font-medium text-ink">
                  ×
                </span>
              </p>

              <p className="lede mt-2 text-[13px] leading-relaxed">
                Spread evenly over 25 years, the embodied
                carbon of the full build-out is{" "}
                <strong className="font-semibold text-ink">{buildoutRatio.toFixed(1)} times</strong> the
                campus&apos;s entire annual carbon budget.
                Operation would then have to be free.
                {phase === "buildout"
                  ? ""
                  : ` This phase stands at ${ledger.upfrontVsBudget.toFixed(
                      2
                    )}×.`}
              </p>

              <div className="mt-4 flex flex-col gap-3.5">
                <BarRow
                  label="Annual carbon budget"
                  value={ledger.annualBudgetT}
                  max={maxBar}
                  display={`${num(
                    ledger.annualBudgetT
                  )} t/yr`}
                  tone="good"
                  note="0.40 tCO₂e × 11,847 residents."
                />

                <BarRow
                  label="Embodied, annualised"
                  value={ledger.upfrontAmortisedT}
                  max={maxBar}
                  display={`${num(
                    ledger.upfrontAmortisedT
                  )} t/yr`}
                  tone="danger"
                  note="A1–C4 divided by 25 years."
                />

                <BarRow
                  label="Residual operation"
                  value={ledger.operationalT}
                  max={maxBar}
                  display={`${num(
                    ledger.operationalT
                  )} t/yr`}
                  tone="warn"
                  note="Grid import after on-site solar."
                />

                <BarRow
                  label="Land sink"
                  value={ledger.sinkT}
                  max={maxBar}
                  display={`${num(ledger.sinkT)} t/yr`}
                  tone="accent"
                  note="1,500 t bioreserve + 300 t farms."
                />
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2 className="t-title text-ink">
                Per capita benchmark
              </h2>
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted font-semibold">
                Build-out
              </span>
            </div>

            <div className="panel-body flex flex-col gap-3.5">
              <BarRow
                label="Target"
                value={TARGET_PER_CAPITA_T}
                max={1.25}
                display={`${TARGET_PER_CAPITA_T.toFixed(2)} t`}
                tone="good"
                note="The published 0.40 tCO₂e per resident."
              />

              <BarRow
                label="Operational · Scope 1+2"
                value={Math.max(
                  0,
                  buildout.operationalPerCapitaT
                )}
                max={1.25}
                display={`${num(
                  buildout.operationalPerCapitaT,
                  2
                )} t`}
                tone={
                  buildout.operationalPerCapitaT <=
                  TARGET_PER_CAPITA_T
                    ? "good"
                    : "danger"
                }
                note={
                  buildout.operationalPerCapitaT <=
                  TARGET_PER_CAPITA_T
                    ? "The published basis. Inside the target."
                    : "The published basis. Above target at full build-out."
                }
              />

              <BarRow
                label="Net of the land sink"
                value={Math.max(
                  0,
                  buildout.perCapitaT
                )}
                max={1.25}
                display={`${num(
                  buildout.perCapitaT,
                  2
                )} t`}
                tone="accent"
                note="Counts the 1,800 t/yr uptake. Not the KPI's basis."
              />

              <BarRow
                label="Whole life · amortised"
                value={Math.max(
                  0,
                  buildoutWholeLifePerCapita
                )}
                max={1.25}
                display={`${num(
                  buildoutWholeLifePerCapita,
                  2
                )} t`}
                tone="danger"
                note="Embodied spread across 25 years, then added."
              />

              <p className="note border-t border-rule pt-2.5 text-[12px]">
                The 0.40 target in the KPI report counts
                Scope 1 and 2 only, with no sequestration
                credit. The campus is above it on that
                basis. The sink is real, but it is a
                separate claim.
              </p>
            </div>
          </section>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2 className="t-title text-ink">
            Programme lifecycle
          </h2>

          <span className="font-mono text-[11px] text-muted">
            Rows in bold are current selection
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table min-w-[720px]">
            <caption className="sr-only">
              Whole-life carbon by development phase
            </caption>
            <thead>
              <tr>
                <th scope="col">Phase</th>
                <th scope="col" className="num">
                  Built m²
                </th>
                <th scope="col" className="num">
                  Upfront
                </th>
                <th scope="col" className="num">
                  Replacement & end of life
                </th>
                <th scope="col" className="num">
                  Operation
                </th>
                <th scope="col" className="num">
                  Sink
                </th>
                <th scope="col" className="num">
                  Net operational
                </th>
                <th scope="col" className="num">
                  Per capita, net
                </th>
              </tr>
            </thead>
            <tbody>
              {programme.map((row) => (
                <tr
                  key={row.id}
                  aria-selected={row.id === phase}
                  className={row.id === phase ? "bg-[#E8F0EA]/50 font-semibold" : undefined}
                >
                  <th
                    scope="row"
                    className={`px-3 py-3 text-left text-[14px] ${
                      row.id === phase
                        ? "font-semibold text-ink"
                        : "font-medium text-ink-soft"
                    }`}
                  >
                    {PHASES[row.id].label}
                  </th>
                  <td className="num px-3 py-3 text-[14px]">
                    {num(row.ledger.builtM2)}
                  </td>
                  <td className="num px-3 py-3 text-[14px]">
                    {num(row.ledger.upfrontT)}
                  </td>
                  <td className="num px-3 py-3 text-[14px]">
                    {num(row.ledger.useEmbodiedT)}
                  </td>
                  <td className="num px-3 py-3 text-[14px]">
                    {num(row.ledger.operationalT)}
                  </td>
                  <td className="num px-3 py-3 text-[14px] text-[#12482E] font-medium">
                    −{num(row.ledger.sinkT)}
                  </td>
                  <td className="num px-3 py-3 text-[14px] font-semibold">
                    {row.ledger.netOperationalT > 0
                      ? "+"
                      : "−"}
                    {num(
                      Math.abs(
                        row.ledger.netOperationalT
                      )
                    )}
                  </td>
                  <td className="num px-3 py-3 text-[14px] font-mono font-medium">
                    {num(row.ledger.perCapitaT, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel-foot">
          <p className="note text-[12px]">
            All values in tCO₂e per year except built area
            and per-capita. Sequestration is an indicative
            rate for a maturing semi-arid plantation, not a
            measured flux.
          </p>
        </div>
      </section>

      {/* Asset Carbon Attribution & Double Counting Safeguards (Section 4.E) */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2 className="t-title text-ink">
              Asset Carbon Attribution & Ledger Accounting
            </h2>
            <p className="font-mono text-[11px] text-muted mt-0.5">
              Section 4.E · Explicit emission factor tracing, reporting period, evidence tier, and double-counting prevention.
            </p>
          </div>
          <span className="font-mono text-[11px] font-medium text-muted">
            {registeredAssets.length} Registered Assets
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table min-w-[780px]">
            <caption className="sr-only">Asset level carbon attribution and double-counting ledger</caption>
            <thead>
              <tr>
                <th scope="col">Asset & ID</th>
                <th scope="col">Domain</th>
                <th scope="col">Source Input</th>
                <th scope="col">Emission Factor / Method</th>
                <th scope="col">Reporting Period</th>
                <th scope="col" className="num">Calculated tCO₂e</th>
                <th scope="col">Evidence</th>
                <th scope="col">Accounting Status & Double-Counting Safeguard</th>
              </tr>
            </thead>
            <tbody>
              {registeredAssets.map((asset) => {
                const carbon = asset.carbonAccounting;
                const isIncludedInMeter = carbon?.includedInCampusMeter ?? true;
                const embodiedT = carbon?.embodiedCarbonT;

                const domainStyles: Record<string, string> = {
                  Energy: "bg-[#F8E7C8] text-[#6B4706] border-[#E8D4B0]",
                  Water: "bg-[#DCEAF5] text-[#103E66] border-[#C3DCEF]",
                  Ecology: "bg-[#DCECE3] text-[#12482E] border-[#C4DFD1]",
                  Compute: "bg-[#E9E4F4] text-[#3C2B6A] border-[#D6CDED]",
                };

                return (
                  <tr key={asset.id} className="hover:bg-surface-subtle transition-colors">
                    <td className="px-3.5 py-3">
                      <div>
                        <span className="font-semibold text-ink text-[13.5px] block">{asset.name}</span>
                        <span className="font-mono text-[11px] text-muted">{asset.id}</span>
                      </div>
                    </td>
                    <td className="px-3.5 py-3">
                      <span className={`inline-block font-mono text-[11px] font-semibold px-2 py-0.5 rounded border ${domainStyles[asset.domain] ?? "bg-surface-subtle text-muted border-rule"}`}>
                        {asset.domain}
                      </span>
                    </td>
                    <td className="px-3.5 py-3">
                      <span className="font-mono text-[13px] text-ink-soft">
                        {asset.ratedCapacity} {asset.capacityUnit}
                      </span>
                    </td>
                    <td className="max-w-[220px] px-3.5 py-3">
                      <span className="text-[12.5px] text-muted line-clamp-2">
                        {carbon?.calculationMethod || (carbon?.emissionFactor ? `${carbon.emissionFactor} kgCO₂e/unit` : "Unconfigured")}
                      </span>
                    </td>
                    <td className="px-3.5 py-3">
                      <span className="font-mono text-[12px] text-muted">
                        {carbon?.reportingPeriod || "Annual 2026"}
                      </span>
                    </td>
                    <td className="num font-mono px-3.5 py-3">
                      {embodiedT ? (
                        <span className="font-semibold text-ink text-[13.5px]">{num(embodiedT, 1)}</span>
                      ) : (
                        <span className="text-muted text-[13px]">—</span>
                      )}
                    </td>
                    <td className="px-3.5 py-3">
                      <span className="font-mono text-[10.5px] font-semibold uppercase px-2 py-0.5 rounded bg-surface-subtle border border-rule text-muted">
                        {asset.evidenceClassification}
                      </span>
                    </td>
                    <td className="px-3.5 py-3">
                      {isIncludedInMeter ? (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-[#12482E] font-medium">
                          <span className="h-2 w-2 rounded-full bg-[#12482E]" />
                          Aggregated in Substation Meter (Prevents double counting)
                        </span>
                      ) : embodiedT ? (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-ink font-semibold">
                          <span className="h-2 w-2 rounded-full bg-[#173D32]" />
                          Included in Upfront Embodied (A1-A3)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
                          <span className="h-2 w-2 rounded-full bg-zinc-300" />
                          Excluded (No standalone emissions configured)
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="panel-foot">
          <p className="note">
            Strict Accounting Integrity: Registering an asset does not automatically invent carbon credits or offset claims. Grid electricity consumption is strictly metered at the 11kV Substation incomer to prevent double-counting asset-level inverter flows.
          </p>
        </div>
      </section>
    </div>
  );
}
