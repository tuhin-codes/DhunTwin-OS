import type {
  Ledger,
  LedgerLine,
  PhaseId,
} from "../types";

import {
  AFFORESTATION_OFFSET_ACRES,
  BIO_SEQUESTRATION_T_YR,
  DESIGN_POPULATION,
  FARM_SEQUESTRATION_T_YR,
  SYSTEM_LIFETIME_YR,
  TARGET_PER_CAPITA_T,
  UPFRONT_KG_M2,
  USE_EMBODIED_KG_M2,
} from "../data/constants";

import { PHASES } from "../data/phases";
import { annualEnergy } from "./simulation";

/* ============================================================
   CARBON LEDGER
   Whole-life arithmetic for one phase.

   The published KPI (0.4 tCO2e per capita) counts operational
   energy only. This ledger shows what happens when the concrete,
   steel and glass are counted too — which is the whole point of
   a whole-life twin.
   ============================================================ */

export interface LedgerOptions {
  /* Forest area in acres; sink scales with it. */
  forestAcres?: number;
  /* Override the operational grid factor. */
  gridFactor?: number;
  /* Override annual grid import, e.g. after a scenario change. */
  residualT?: number;
  /* Assessment window in years for the per-capita budget. */
  horizonYears?: number;
}

export function buildLedger(
  phase: PhaseId,
  options: LedgerOptions = {}
): Ledger {
  const config = PHASES[phase];
  const energy = annualEnergy(phase);

  const horizon =
    options.horizonYears ?? SYSTEM_LIFETIME_YR;

  const forestAcres =
    options.forestAcres ?? config.forestAcres;

  /* Upfront: 200–250 kgCO2e/m2, midpoint 225 */
  const upfrontT =
    (config.builtM2 * UPFRONT_KG_M2) / 1000;

  /* Use-stage embodied: 275–300 kgCO2e/m2, midpoint 287.5 */
  const useEmbodiedT =
    (config.builtM2 * USE_EMBODIED_KG_M2) / 1000;

  const operationalT =
    options.residualT ?? energy.carbonT;

  /* Biological sequestration across the dedicated afforestation zone
     (124 acres at build-out), plus the organic food farms. */
  const sinkT =
    (forestAcres / AFFORESTATION_OFFSET_ACRES) *
      BIO_SEQUESTRATION_T_YR +
    FARM_SEQUESTRATION_T_YR;

  const netOperationalT = operationalT - sinkT;

  const productT = upfrontT * 0.62;
  const installT = upfrontT - productT;

  const maintenanceT = useEmbodiedT * 0.55;
  const endOfLifeT = useEmbodiedT - maintenanceT;

  const lines: LedgerLine[] = [
    {
      key: "a1-a3",
      label: "A1–A3 · Materials & construction",
      detail:
        "Cement, steel, brick, glass and finishes, cradle to gate.",
      valueT: productT,
      tier: "REPORT",
      tone: "emit",
    },
    {
      key: "a4-a5",
      label: "A4–A5 · Transport & installation",
      detail:
        "Inbound haulage, site energy and construction waste.",
      valueT: installT,
      tier: "ASSUMPTION",
      tone: "emit",
    },
    {
      key: "b1-b4",
      label: "B1–B4 · Maintenance & replacement",
      detail:
        "Refurbishment cycles, envelope repair and equipment swaps over the life of the build.",
      valueT: maintenanceT,
      tier: "ASSUMPTION",
      tone: "emit",
    },
    {
      key: "c1-c4",
      label: "C1–C4 · End of life",
      detail:
        "Demolition, haulage and disposal. Modelled, not measured.",
      valueT: endOfLifeT,
      tier: "ASSUMPTION",
      tone: "emit",
    },
    {
      key: "b6",
      label: "B6 · Operational energy",
      detail:
        options.residualT === undefined
          ? "Residual grid import after on-site solar, at the Dhun grid factor."
          : "Residual grid import after the modelled solar build.",
      valueT: operationalT,
      tier: "SIMULATED",
      tone: "neutral",
    },
    {
      key: "sink",
      label: "Sequestration · Bioreserve & farms",
      detail:
        "Additional annual uptake on the protected land. Standing biomass is held separately and is never netted off here.",
      valueT: -sinkT,
      tier: "ASSUMPTION",
      tone: "sink",
    },
  ];

  const wholeLifeT =
    upfrontT +
    useEmbodiedT +
    operationalT -
    sinkT;

  const annualBudgetT =
    TARGET_PER_CAPITA_T * DESIGN_POPULATION;

  const upfrontAmortisedT =
    (upfrontT + useEmbodiedT) / horizon;

  /* Does the campus pay its embodied debt back inside the
     assessment window at the current net rate? */
  const yearsToOffsetUpfront =
    netOperationalT < 0
      ? Math.round(
          (upfrontT + useEmbodiedT) /
            -netOperationalT
        )
      : null;

  return {
    phase,
    lines,

    upfrontT,
    useEmbodiedT,
    operationalT,
    sinkT,

    netOperationalT,
    wholeLifeT,

    perCapitaT:
      config.population > 0
        ? netOperationalT / config.population
        : 0,
    operationalPerCapitaT:
      config.population > 0
        ? operationalT / config.population
        : 0,
    targetPerCapitaT: TARGET_PER_CAPITA_T,
    annualBudgetT,

    upfrontAmortisedT,
    upfrontVsBudget:
      upfrontAmortisedT /
      Math.max(1, annualBudgetT),

    yearsToOffsetUpfront:
      yearsToOffsetUpfront !== null &&
      yearsToOffsetUpfront > 0
        ? yearsToOffsetUpfront
        : null,

    population: config.population,
    builtM2: config.builtM2,
  };
}
