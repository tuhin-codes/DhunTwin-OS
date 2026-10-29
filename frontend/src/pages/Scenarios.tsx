import {
  useMemo,
  useState,
} from "react";

import PageHeader from "../features/dhun/components/PageHeader";
import EvidenceBadge from "../features/dhun/components/EvidenceBadge";
import { BarRow } from "../features/dhun/components/Bars";

import { useTwin } from "../features/dhun/context/useTwin";
import { useAssetRegistry } from "../features/dhun/registry/AssetRegistryContext";
import {
  COMPUTE_LABEL,
  COOLING_LABEL,
  defaultScenario,
  runScenario,
} from "../features/dhun/engine/scenarios";
import { PHASES } from "../features/dhun/data/phases";
import { num, percent } from "../features/dhun/lib/format";
import type {
  ComputeOption,
  CoolingType,
  PhaseId,
  ScenarioInputs,
} from "../features/dhun/types";

const COMPUTE_OPTIONS: ComputeOption[] = [
  "none",
  "workstation",
  "server",
  "flagship",
];

function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  display,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  hint: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label htmlFor={id} className="text-[13.5px] font-medium text-ink">
          {label}
        </label>
        <output
          htmlFor={id}
          className="text-[14px] font-semibold font-mono tabular-nums text-ink"
        >
          {display}
        </output>
      </div>

      <input
        id={id}
        type="range"
        className="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) =>
          onChange(Number(event.target.value))
        }
      />

      <div className="flex justify-between text-[11px] font-mono text-muted mt-1">
        <span>{min}</span>
        <span className="text-muted/80">{hint}</span>
        <span>{num(max)}</span>
      </div>
    </div>
  );
}

function deltaText(
  value: number,
  base: number,
  format: (magnitude: number) => string,
  epsilon = 0
): string {
  const change = value - base;

  if (Math.abs(change) <= epsilon) {
    return "No change";
  }

  return `${change < 0 ? "−" : "+"}${format(
    Math.abs(change)
  )}`;
}

export default function Scenarios() {
  const { phase } = useTwin();

  const baseline = useMemo(
    () => defaultScenario(phase),
    [phase]
  );

  const [draft, setDraft] = useState<{
    phase: PhaseId;
    inputs: ScenarioInputs;
  }>(() => ({ phase, inputs: baseline }));

  /* Adjusting state during render when the phase changes keeps
     the controls in sync without an effect round trip. */
  if (draft.phase !== phase) {
    setDraft({
      phase,
      inputs: defaultScenario(phase),
    });
  }

  const inputs =
    draft.phase === phase
      ? draft.inputs
      : defaultScenario(phase);

  const result = useMemo(
    () => runScenario(phase, inputs),
    [phase, inputs]
  );

  const baseResult = useMemo(
    () => runScenario(phase, baseline),
    [phase, baseline]
  );

  const solarMax = Math.max(
    5000,
    Math.ceil((baseline.solarKwp * 1.9) / 100) * 100
  );

  /* Battery is sized against the array, not against an
     arbitrary ceiling, so the control stays meaningful in
     every phase. */
  const batteryMax = Math.max(
    2,
    Math.ceil((baseline.batteryMwh * 4) / 0.5) * 0.5
  );

  const { assets } = useAssetRegistry();
  const plannedAssets = useMemo(
    () =>
      assets.filter(
        (a) =>
          a.commissioningStatus === "Planned" ||
          a.commissioningStatus === "Commissioning"
      ),
    [assets]
  );
  const [toggledPlannedIds, setToggledPlannedIds] = useState<string[]>([]);

  function togglePlannedAsset(assetId: string) {
    const asset = plannedAssets.find((a) => a.id === assetId);
    if (!asset) return;

    const isCurrentlyIncluded = toggledPlannedIds.includes(assetId);
    const updatedIds = isCurrentlyIncluded
      ? toggledPlannedIds.filter((id) => id !== assetId)
      : [...toggledPlannedIds, assetId];

    setToggledPlannedIds(updatedIds);

    if (asset.domain === "Energy" && asset.capacityUnit.toLowerCase().includes("kw")) {
      const delta = asset.ratedCapacity * (isCurrentlyIncluded ? -1 : 1);
      patch({ solarKwp: Math.max(0, inputs.solarKwp + delta) });
    } else if (asset.domain === "Energy" && asset.capacityUnit.toLowerCase().includes("kwh")) {
      const delta = (asset.ratedCapacity / 1000) * (isCurrentlyIncluded ? -1 : 1);
      patch({ batteryMwh: Math.max(0, inputs.batteryMwh + delta) });
    }
  }

  function patch(
    part: Partial<ScenarioInputs>
  ) {
    setDraft((current) => ({
      phase,
      inputs: {
        ...current.inputs,
        ...part,
      },
    }));
  }

  const verdict =
    result.netT > 0
      ? "Still a net emitter. The land sink is not keeping up with residual grid load."
      : result.paybackYear === null
        ? "Operationally net negative, but the embodied debt is never repaid at this net rate."
        : result.paybackYear <= 2050
          ? `Operationally net negative. At this rate the embodied debt is repaid by ${result.paybackYear}.`
          : `Operationally net negative, but the embodied debt runs past 2050 — repaid in ${result.paybackYear}.`;

  const verdictTone =
    result.netT <= 0
      ? result.offsetBy2050
        ? "good"
        : "warn"
      : "danger";

  const rows: {
    label: string;
    base: string;
    next: string;
    delta: string;
    better: boolean | null;
  }[] = [
    {
      label: "Net operational",
      base: `${num(baseResult.netT)} t`,
      next: `${num(result.netT)} t`,
      delta: deltaText(
        result.netT,
        baseResult.netT,
        (value) => `${num(value)} t`,
        0.5
      ),
      better:
        Math.abs(result.netT - baseResult.netT) <= 0.5
          ? null
          : result.netT < baseResult.netT,
    },
    {
      label: "Net per resident",
      base: `${num(baseResult.perCapitaT, 2)} t`,
      next: `${num(result.perCapitaT, 2)} t`,
      delta: deltaText(
        result.perCapitaT,
        baseResult.perCapitaT,
        (value) => `${num(value, 2)} t`,
        0.005
      ),
      better:
        Math.abs(
          result.perCapitaT - baseResult.perCapitaT
        ) <= 0.005
          ? null
          : result.perCapitaT < baseResult.perCapitaT,
    },
    {
      label: "Renewable share",
      base: percent(baseResult.renewableShare),
      next: percent(result.renewableShare),
      delta: deltaText(
        result.renewableShare,
        baseResult.renewableShare,
        (value) => `${num(value * 100)} pt`,
        0.0005
      ),
      better:
        Math.abs(
          result.renewableShare -
            baseResult.renewableShare
        ) <= 0.0005
          ? null
          : result.renewableShare >
            baseResult.renewableShare,
    },
    {
      label: "Grid import",
      base: `${num(baseResult.gridKwhYr / 1000)} MWh`,
      next: `${num(result.gridKwhYr / 1000)} MWh`,
      delta: deltaText(
        result.gridKwhYr,
        baseResult.gridKwhYr,
        (value) => `${num(value / 1000)} MWh`,
        500
      ),
      better:
        Math.abs(
          result.gridKwhYr - baseResult.gridKwhYr
        ) <= 500
          ? null
          : result.gridKwhYr < baseResult.gridKwhYr,
    },
    {
      label: "Water demand",
      base: `${num(baseResult.waterKlYr)} kL`,
      next: `${num(result.waterKlYr)} kL`,
      delta: deltaText(
        result.waterKlYr,
        baseResult.waterKlYr,
        (value) => `${num(value)} kL`,
        500
      ),
      better:
        Math.abs(
          result.waterKlYr - baseResult.waterKlYr
        ) <= 500
          ? null
          : result.waterKlYr < baseResult.waterKlYr,
    },
    {
      label: "Capital",
      base: `₹${num(baseResult.capexCr, 1)} Cr`,
      next: `₹${num(result.capexCr, 1)} Cr`,
      delta: deltaText(
        result.capexCr,
        baseResult.capexCr,
        (value) => `₹${num(value, 1)} Cr`,
        0.05
      ),
      better: null,
    },
  ];

  return (
    <div className="sheet">
      <PageHeader
        index="04 · Scenario Cockpit"
        title="Scenario Cockpit & Sensitivity Modeling"
        lede="Parametric levers for Dhun's energy, water, compute and carbon balance. Each adjustment propagates across capital, operating costs, and whole-life repayment horizons."
        aside={
          <>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-accent font-semibold">
              {PHASES[phase].label}
            </p>
            <p className="text-[12px] font-medium text-ink">
              Deterministic simulation · physical energy balance
            </p>
            <p className="font-mono text-[10px] text-muted">
              88% AC-AC storage efficiency · Rajasthan CEA factors
            </p>
          </>
        }
      />

      <div className="split grid-cols-1 lg:grid-cols-12">
        <section className="panel lg:col-span-4">
          <div className="panel-head">
            <h2 className="t-title text-ink">
              Programme Levers
            </h2>

            <button
              type="button"
              className="btn btn-sm"
              onClick={() =>
                setDraft({
                  phase,
                  inputs: defaultScenario(phase),
                })
              }
            >
              Reset to Base
            </button>
          </div>

          <div className="flex flex-col gap-6 p-5">
            <div className="bg-[#F8E7C8]/20 border border-[#E8D4B0]/60 p-4 rounded">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[#6B4706] font-bold mb-3 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#6B4706]" />
                Energy & Storage
              </p>
              <div className="space-y-4">
                <Slider
                  id="solar"
                  label="Solar array capacity"
                  value={inputs.solarKwp}
                  min={0}
                  max={solarMax}
                  step={100}
                  display={`${num(inputs.solarKwp)} kWp`}
                  hint="roof + carport"
                  onChange={(value) =>
                    patch({ solarKwp: value })
                  }
                />

                <Slider
                  id="battery"
                  label="Battery storage capacity"
                  value={inputs.batteryMwh}
                  min={0}
                  max={batteryMax}
                  step={0.5}
                  display={`${num(inputs.batteryMwh, 1)} MWh`}
                  hint="usable buffer"
                  onChange={(value) =>
                    patch({ batteryMwh: value })
                  }
                />

                <Slider
                  id="grid"
                  label="Grid emission factor"
                  value={inputs.gridFactor}
                  min={0.4}
                  max={1}
                  step={0.01}
                  display={`${num(inputs.gridFactor, 2)} kg/kWh`}
                  hint="Rajasthan CEA"
                  onChange={(value) =>
                    patch({ gridFactor: value })
                  }
                />
              </div>
            </div>

            <div className="bg-[#DCECE3]/20 border border-[#C4DFD1]/60 p-4 rounded">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[#12482E] font-bold mb-3 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#12482E]" />
                Built Envelope & Ecology
              </p>
              <div className="space-y-4">
                <Slider
                  id="epi"
                  label="Envelope intensity (EPI)"
                  value={inputs.epi}
                  min={30}
                  max={90}
                  step={0.5}
                  display={`${num(inputs.epi, 1)} kWh/m²`}
                  hint="annual norm"
                  onChange={(value) =>
                    patch({ epi: value })
                  }
                />

                <Slider
                  id="forest"
                  label="Protected bioreserve"
                  value={inputs.forestAcres}
                  min={200}
                  max={450}
                  step={5}
                  display={`${num(inputs.forestAcres)} acres`}
                  hint="ecological covenant"
                  onChange={(value) =>
                    patch({ forestAcres: value })
                  }
                />
              </div>
            </div>

            <div className="bg-[#E9E4F4]/20 border border-[#D6CDED]/60 p-4 rounded">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[#3C2B6A] font-bold mb-3 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#3C2B6A]" />
                Compute Infrastructure
              </p>

              <fieldset>
                <legend className="w-full text-[13px] font-medium text-ink mb-2">
                  <span>Compute load tier</span>
                </legend>

                <div className="grid grid-cols-2 gap-1.5">
                  {COMPUTE_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className="btn btn-sm justify-start text-[13px]"
                      aria-pressed={
                        inputs.compute === option
                      }
                      onClick={() =>
                        patch({ compute: option })
                      }
                      style={
                        inputs.compute === option
                          ? {
                              borderColor: "#3C2B6A",
                              background: "#E9E4F4",
                              color: "#3C2B6A",
                              fontWeight: 600,
                            }
                          : undefined
                      }
                    >
                      {COMPUTE_LABEL[option]}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="mt-4">
                <legend className="w-full text-[13px] font-medium text-ink mb-1.5">
                  <span>Cooling</span>
                </legend>

                <div className="seg w-full">
                  {(
                    ["dry", "evaporative"] as CoolingType[]
                  ).map((option) => (
                    <button
                      key={option}
                      type="button"
                      className="seg-item flex-1 text-[13px]"
                      aria-pressed={
                        inputs.cooling === option
                      }
                      onClick={() =>
                        patch({ cooling: option })
                      }
                    >
                      {COOLING_LABEL[option]}
                    </button>
                  ))}
                </div>

                <p className="note mt-2 text-[12px]">
                  Dry coolers use more electricity and almost
                  no water. Evaporative does the reverse.
                </p>
              </fieldset>
            </div>

            {/* Planned Infrastructure Dispatch (Section 4.F) */}
            {plannedAssets.length > 0 && (
              <div className="border-t border-rule pt-4">
                <p className="font-mono text-[11px] uppercase tracking-wider text-[#173D32] font-semibold mb-1">
                  Planned Registry Assets Integration
                </p>
                <p className="text-[12.5px] text-muted mb-3">
                  Toggle planned infrastructure to test scenario dispatch without altering actual operational records.
                </p>
                <div className="space-y-2">
                  {plannedAssets.map((asset) => {
                    const isToggled = toggledPlannedIds.includes(asset.id);
                    return (
                      <label
                        key={asset.id}
                        className={[
                          "flex items-start gap-2.5 p-2.5 rounded border cursor-pointer transition-colors text-[13px]",
                          isToggled
                            ? "border-[#173D32] bg-[#E8F0EA] text-ink font-medium"
                            : "border-rule bg-surface text-ink-soft hover:bg-surface-subtle",
                        ].join(" ")}
                      >
                        <input
                          type="checkbox"
                          checked={isToggled}
                          onChange={() => togglePlannedAsset(asset.id)}
                          className="mt-0.5 rounded text-[#173D32]"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold block">{asset.name}</span>
                          <span className="font-mono text-[11px] text-muted block">
                            +{asset.ratedCapacity} {asset.capacityUnit} · {asset.commissioningStatus}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="stack lg:col-span-8">
          <section className="panel">
            <div className="panel-head items-center">
              <h2 className="t-title text-ink">
                Simulated response
              </h2>

              <span className="tabular font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">
                per year
              </span>
            </div>

            <div className="grid grid-cols-2 divide-x divide-y divide-rule md:grid-cols-3">
              <div className="p-5 bg-surface">
                <p className="eyebrow text-[11px] font-mono uppercase text-muted font-semibold">
                  Net operational
                </p>
                <p
                  className={`numeral mt-2 text-[32px] md:text-[34px] font-bold leading-none ${
                    result.netT > 0
                      ? "text-[#732117]"
                      : "text-[#12482E]"
                  }`}
                >
                  {result.netT < 0 ? "−" : ""}
                  {num(Math.abs(result.netT))}
                  <span className="ml-1.5 font-sans text-[13px] font-normal text-muted">
                    tCO₂e
                  </span>
                </p>
              </div>

              <div className="p-5 bg-surface">
                <p className="eyebrow text-[11px] font-mono uppercase text-muted font-semibold">
                  Net per resident
                </p>
                <p className="numeral mt-2 text-[32px] md:text-[34px] font-bold leading-none text-ink">
                  {num(result.perCapitaT, 2)}
                  <span className="ml-1.5 font-sans text-[13px] font-normal text-muted">
                    t
                  </span>
                </p>
              </div>

              <div className="p-5 bg-[#DCECE3]/30">
                <p className="eyebrow text-[11px] font-mono uppercase text-[#12482E] font-semibold">
                  Renewable share
                </p>
                <p className="numeral mt-2 text-[32px] md:text-[34px] font-bold leading-none text-[#12482E]">
                  {percent(result.renewableShare)}
                </p>
              </div>

              <div className="p-5 bg-[#F8E7C8]/25">
                <p className="eyebrow text-[11px] font-mono uppercase text-[#6B4706] font-semibold">
                  Grid import
                </p>
                <p className="numeral mt-2 text-[26px] md:text-[28px] font-semibold leading-none text-[#6B4706]">
                  {num(result.gridKwhYr / 1000)}
                  <span className="ml-1.5 font-sans text-[12px] font-normal text-[#6B4706]/80">
                    MWh
                  </span>
                </p>
              </div>

              <div className="p-5 bg-[#DCEAF5]/30">
                <p className="eyebrow text-[11px] font-mono uppercase text-[#103E66] font-semibold">
                  Water demand
                </p>
                <p className="numeral mt-2 text-[26px] md:text-[28px] font-semibold leading-none text-[#103E66]">
                  {num(result.waterKlYr)}
                  <span className="ml-1.5 font-sans text-[12px] font-normal text-[#103E66]/80">
                    kL/yr
                  </span>
                </p>
              </div>

              <div className="p-5 bg-surface">
                <p className="eyebrow text-[11px] font-mono uppercase text-muted font-semibold">
                  Levelised cost
                </p>
                <p className="numeral mt-2 text-[26px] md:text-[28px] font-semibold leading-none text-ink">
                  {result.lcoeInrPerKwh === null ? (
                    <span className="text-muted">—</span>
                  ) : (
                    <>
                      ₹{num(result.lcoeInrPerKwh, 2)}
                      <span className="ml-1.5 font-sans text-[12px] font-normal text-muted">
                        /kWh
                      </span>
                    </>
                  )}
                </p>
                {result.lcoeInrPerKwh === null ? (
                  <p className="note mt-1.5 text-[12px]">
                    No array built, so there is no levelised
                    cost to quote.
                  </p>
                ) : null}
              </div>
            </div>

            <div
              className="panel-foot border-l-4"
              style={{
                borderLeftColor:
                  verdictTone === "good"
                    ? "#12482E"
                    : verdictTone === "warn"
                      ? "#6B4706"
                      : "#732117",
                background:
                  verdictTone === "good"
                    ? "#DCECE3"
                    : verdictTone === "warn"
                      ? "#F8E7C8"
                      : "#F5DEDA",
              }}
            >
              <p className="text-[13.5px] font-medium leading-relaxed text-ink">
                {verdict}
              </p>
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="panel-head items-center">
              <div className="flex items-center gap-2">
                <h2 className="t-title text-ink">
                  Baseline delta
                </h2>
                <span className="font-mono text-[11px] font-medium text-muted">
                  · {PHASES[phase].label}
                </span>
              </div>

              <span className="text-[12px] font-medium text-muted">
                Capital ₹{num(result.capexCr, 1)} Cr · embodied unchanged
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table min-w-[560px]">
                <caption className="sr-only">
                  Scenario against the current plan
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Metric</th>
                    <th scope="col" className="num">
                      Baseline
                    </th>
                    <th scope="col" className="num">
                      Scenario
                    </th>
                    <th scope="col" className="num">
                      Change
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.label} className="hover:bg-surface-subtle transition-colors">
                      <th
                        scope="row"
                        className="px-3.5 py-3 text-left text-[14px] font-medium text-ink"
                      >
                        {row.label}
                      </th>
                      <td className="num text-muted text-[14px] px-3.5 py-3">
                        {row.base}
                      </td>
                      <td className="num font-semibold text-ink text-[14px] px-3.5 py-3">
                        {row.next}
                      </td>
                      <td
                        className={`num text-[14px] font-semibold px-3.5 py-3 ${
                          row.better === null
                            ? "text-muted"
                            : row.better
                              ? "text-[#12482E]"
                              : "text-[#732117]"
                        }`}
                      >
                        {row.delta}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="panel-foot">
              <p className="note text-[12px]">
                This model changes operation and on-site
                supply. It does not re-run the embodied
                calculation, so capital and carbon move
                independently.
              </p>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head items-center">
              <h2 className="t-title text-ink">
                Fixed parameters
              </h2>
              <span className="font-mono text-[11px] text-muted">
                Invariant across scenarios
              </span>
            </div>

            <div className="split grid-cols-1 sm:grid-cols-3">
              <div className="p-4">
                <p className="numeral text-[24px] font-semibold leading-none text-ink">
                  {num(result.upfrontT)} t
                </p>
                <p className="mt-1.5 text-[12.5px] leading-snug text-muted">
                  Upfront embodied carbon. Set by built area,
                  not by operation.
                </p>
                <div className="mt-2.5">
                  <EvidenceBadge tier="REPORT" />
                </div>
              </div>

              <div className="p-4">
                <BarRow
                  label="Water cover"
                  value={PHASES[phase].harvestKlYr}
                  max={Math.max(
                    PHASES[phase].harvestKlYr,
                    result.waterKlYr
                  )}
                  display={percent(
                    Math.min(
                      1,
                      PHASES[phase].harvestKlYr /
                        Math.max(1, result.waterKlYr)
                    )
                  )}
                  tone={
                    result.waterKlYr >
                    PHASES[phase].harvestKlYr
                      ? "danger"
                      : "accent"
                  }
                  note={`Harvest of ${num(
                    PHASES[phase].harvestKlYr
                  )} kL against modelled demand.`}
                />
              </div>

              <div className="p-4">
                <BarRow
                  label="Carbon budget use"
                  value={Math.max(
                    0,
                    result.residualT
                  )}
                  max={4739}
                  display={percent(
                    Math.min(
                      1.4,
                      Math.max(0, result.residualT) /
                        4739
                    )
                  )}
                  tone={
                    result.residualT > 4739
                      ? "danger"
                      : "good"
                  }
                  note="Scope 1+2 against 0.40 t × 11,847 residents."
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
