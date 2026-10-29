import type {
  CoolingType,
  ComputeOption,
  PhaseId,
  ScenarioInputs,
  ScenarioResult,
} from "../types";

import {
  AFFORESTATION_OFFSET_ACRES,
  BATTERY_CAPEX_INR_PER_KWH,
  BATTERY_ROUND_TRIP_EFFICIENCY,
  BIO_SEQUESTRATION_T_YR,
  FARM_SEQUESTRATION_T_YR,
  GRID_FACTOR,
  LITRES_PER_PERSON_DAY,
  OANDM_FRACTION,
  PUMP_ENERGY_KWH_PER_KL,
  PV_CAPEX_INR_PER_KWP,
  SELF_CONSUMPTION_FACTOR,
  SOILING_FACTOR,
  SPECIFIC_YIELD,
  STP_ENERGY_KWH_PER_KL,
  SYSTEM_LIFETIME_YR,
  TARGET_PER_CAPITA_T,
  UPFRONT_KG_M2,
  USE_EMBODIED_KG_M2,
} from "../data/constants";

import {
  PHASES,
  PHASE_START_YEAR,
} from "../data/phases";
import { landscapeWaterKlYr } from "./simulation";

/* ============================================================
   SCENARIO ENGINE
   Deterministic, synchronous, no network. Every control the
   cockpit exposes maps to a physical term below.
   ============================================================ */

export const COMPUTE_LOAD_KW: Record<
  ComputeOption,
  number
> = {
  none: 0,
  workstation: 1.2,
  server: 10,
  flagship: 28,
};

export const COMPUTE_LABEL: Record<
  ComputeOption,
  string
> = {
  none: "No compute",
  workstation: "Workstation · 1.2 kW",
  server: "8-GPU node · 10 kW",
  flagship: "8× H200 · 28 kW",
};

interface CoolingProfile {
  pue: number;
  wue: number;
}

/* Dry coolers spend more electricity and almost no water.
   Evaporative cooling does the reverse. Both are real, priced
   options — the cockpit makes the trade visible. */
export const COOLING_PROFILE: Record<
  CoolingType,
  CoolingProfile
> = {
  dry: { pue: 1.38, wue: 0.15 },
  evaporative: { pue: 1.18, wue: 1.8 },
};

export const COOLING_LABEL: Record<
  CoolingType,
  string
> = {
  dry: "Dry coolers",
  evaporative: "Evaporative",
};

export function defaultScenario(
  phase: PhaseId
): ScenarioInputs {
  const config = PHASES[phase];

  const compute: ComputeOption =
    config.computeKw >= 28
      ? "flagship"
      : config.computeKw >= 10
        ? "server"
        : config.computeKw > 0
          ? "workstation"
          : "none";

  return {
    solarKwp: config.solarKwp,
    epi: config.epi,
    batteryMwh: Math.round(
      (config.solarKwp * 0.12) / 100
    ) / 10,
    gridFactor: GRID_FACTOR,
    forestAcres: config.forestAcres,
    compute,
    cooling: "dry",
  };
}

/* Capital recovery factor at 8% real over the system life. */
const DISCOUNT_RATE = 0.08;

function capitalRecoveryFactor(
  rate: number,
  years: number
): number {
  const growth = Math.pow(1 + rate, years);

  return (rate * growth) / (growth - 1);
}

const CRF = capitalRecoveryFactor(
  DISCOUNT_RATE,
  SYSTEM_LIFETIME_YR
);

export function runScenario(
  phase: PhaseId,
  inputs: ScenarioInputs
): ScenarioResult {
  const config = PHASES[phase];
  const cooling = COOLING_PROFILE[inputs.cooling];
  const itKw = COMPUTE_LOAD_KW[inputs.compute];

  const computeKwhYr =
    itKw * cooling.pue * 24 * 365;

  const buildingKwhYr =
    config.builtM2 * inputs.epi;

  const waterKwhYr =
    (config.stpKlDay * STP_ENERGY_KWH_PER_KL +
      ((config.population *
        LITRES_PER_PERSON_DAY) /
        1000) *
        PUMP_ENERGY_KWH_PER_KL) *
    365;

  const wasteKwhYr =
    (0.8 + config.organicTDay * 2) * 24 * 365;

  const spirulinaKwhYr =
    config.spirulinaKw * 24 * 365;

  const campusKwhYr =
    buildingKwhYr + waterKwhYr + wasteKwhYr;

  const demandKwhYr =
    campusKwhYr + computeKwhYr + spirulinaKwhYr;

  const solarKwhYr =
    inputs.solarKwp * SPECIFIC_YIELD * SOILING_FACTOR;

  /* Direct solar aligning with daytime campus load (~55% diurnal fraction) */
  const directSolar = Math.min(solarKwhYr, demandKwhYr * 0.55);

  /* Midday surplus solar available for battery storage charging */
  const surplusSolarKwh = Math.max(0, solarKwhYr - directSolar);

  /* Annual battery throughput (cycling once daily with round-trip storage efficiency) */
  const annualBatteryThroughputKwh =
    inputs.batteryMwh *
    1000 *
    365 *
    BATTERY_ROUND_TRIP_EFFICIENCY;

  /* Shifted solar delivered into evening and morning load */
  const shiftedSolarKwh = Math.min(
    surplusSolarKwh * BATTERY_ROUND_TRIP_EFFICIENCY,
    annualBatteryThroughputKwh,
    Math.max(0, demandKwhYr - directSolar)
  );

  /* Total usable on-site solar displacing grid import */
  const usableSolar = Math.min(
    demandKwhYr,
    (directSolar + shiftedSolarKwh) * SELF_CONSUMPTION_FACTOR
  );

  const gridKwhYr = Math.max(
    0,
    demandKwhYr - usableSolar
  );

  const renewableShare =
    demandKwhYr > 0 ? usableSolar / demandKwhYr : 0;

  const residualT =
    (gridKwhYr * inputs.gridFactor) / 1000;

  const sinkT =
    (inputs.forestAcres / AFFORESTATION_OFFSET_ACRES) *
      BIO_SEQUESTRATION_T_YR +
    FARM_SEQUESTRATION_T_YR;

  const netT = residualT - sinkT;

  const upfrontT =
    (config.builtM2 * UPFRONT_KG_M2) / 1000;

  const useEmbodiedT =
    (config.builtM2 * USE_EMBODIED_KG_M2) / 1000;

  const yearsToOffset =
    netT < 0
      ? Math.round(
          (upfrontT + useEmbodiedT) / -netT
        )
      : null;

  /* Domestic demand plus the designed landscape. The bioreserve
     itself is rain-fed; only the planting around buildings is
     irrigated. */
  const domesticKlYr =
    (config.population * LITRES_PER_PERSON_DAY * 365) /
    1000;

  const irrigationKlYr = landscapeWaterKlYr(phase);

  const computeKlYr =
    (computeKwhYr * cooling.wue) / 1000;

  const capex =
    inputs.solarKwp * PV_CAPEX_INR_PER_KWP +
    inputs.batteryMwh * 1000 * BATTERY_CAPEX_INR_PER_KWH;

  const annualCost =
    capex * CRF + capex * OANDM_FRACTION;

  /* No array means no levelised cost to report. Returning zero
     would read as a free kilowatt-hour. */
  const lcoe =
    solarKwhYr > 0 ? annualCost / solarKwhYr : null;

  /* Operational per capita follows the actual active phase population
     on site, keeping headline metrics honest. */
  const perCapitaT =
    config.population > 0 ? netT / config.population : 0;

  const paybackYear =
    yearsToOffset !== null && yearsToOffset > 0
      ? PHASE_START_YEAR[phase] + yearsToOffset
      : null;

  return {
    demandKwhYr,
    solarKwhYr,
    gridKwhYr,

    renewableShare,
    residualT,
    sinkT,
    netT,

    perCapitaT,
    targetPerCapitaT: TARGET_PER_CAPITA_T,

    waterKlYr:
      domesticKlYr + irrigationKlYr + computeKlYr,

    /* Levelised cost of the solar-plus-storage build, before
       any subsidy or feed-in credit. */
    lcoeInrPerKwh: lcoe,

    upfrontT,
    yearsToOffset:
      yearsToOffset !== null && yearsToOffset > 0
        ? yearsToOffset
        : null,
    paybackYear,
    offsetBy2050:
      paybackYear !== null && paybackYear <= 2050,

    capexCr: capex / 1e7,
  };
}
