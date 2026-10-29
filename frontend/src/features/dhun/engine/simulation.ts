import type {
  DhunAsset,
  PhaseId,
  TwinSnapshot,
  TwinSummary,
} from "../types";

import {
  BUILD_OUT_M2,
  GRID_FACTOR,
  LANDSCAPE_KL_YR_BUILD_OUT,
  LITRES_PER_PERSON_DAY,
  PUMP_ENERGY_KWH_PER_KL,
  SELF_CONSUMPTION_FACTOR,
  SOILING_FACTOR,
  SOLAR_PEAK_FACTOR,
  SPECIFIC_YIELD,
  STANDING_STOCK_T,
  STP_ENERGY_KWH_PER_KL,
  TARGET_PER_CAPITA_T,
  TOTAL_SEQUESTRATION_T_YR,
} from "../data/constants";

import { MONTH_FACTOR, PHASES } from "../data/phases";
import type { PhaseConfig } from "../data/phases";

/* ============================================================
   SMALL HELPERS
   ============================================================ */

export function clamp(
  value: number,
  min = 0,
  max = 1
): number {
  return Math.min(Math.max(value, min), max);
}

export function dayFraction(date: Date): number {
  return (
    (date.getHours() * 3600 +
      date.getMinutes() * 60 +
      date.getSeconds()) /
    86400
  );
}

/* Solar shape: sunrise 06:15, sunset 18:20 */
export function solarShape(fraction: number): number {
  const start = 0.26;
  const end = 0.765;

  if (fraction <= start || fraction >= end) {
    return 0;
  }

  const x = (fraction - start) / (end - start);

  return Math.pow(Math.sin(Math.PI * x), 1.15);
}

/* Marginal grid carbon intensity — planning assumption.
   Solar-heavy Rajasthan grid: midday dip, evening peak. */
export function gridIntensity(fraction: number): number {
  const evening = Math.exp(
    -Math.pow((fraction - 0.79) / 0.075, 2)
  );

  const midday = Math.exp(
    -Math.pow((fraction - 0.53) / 0.11, 2)
  );

  return 0.86 + 0.14 * evening - 0.2 * midday;
}

/* Occupancy-driven building load shape */
function buildingShape(fraction: number): number {
  return (
    0.58 +
    0.78 *
      Math.exp(
        -Math.pow((fraction - 0.6) / 0.15, 2)
      ) +
    0.22 *
      Math.exp(
        -Math.pow((fraction - 0.82) / 0.09, 2)
      )
  );
}

function computeShape(fraction: number): number {
  return (
    0.88 +
    0.1 * Math.sin(fraction * Math.PI * 2 - 1)
  );
}

function seasonalFactor(date: Date): number {
  return MONTH_FACTOR[date.getMonth()] ?? 1;
}

function round(value: number, decimals = 0): string {
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/* ============================================================
   PHASE FLOWS
   ============================================================ */

interface PhaseFlows {
  config: PhaseConfig;
  solarKw: number;
  solarKwhDay: number;

  buildingKw: number;
  buildingKwhDay: number;

  computeKw: number;
  computeKwhDay: number;

  /* Three Distinct Workstreams */
  workstreamCampusKw: number;
  workstreamCampusKwhDay: number;
  workstreamComputeKw: number;
  workstreamComputeKwhDay: number;
  workstreamSpirulinaKw: number;
  workstreamSpirulinaKwhDay: number;

  spirulinaKw: number;
  spirulinaKwhDay: number;

  stpKw: number;
  stpKwhDay: number;

  pumpKw: number;
  pumpKwhDay: number;

  wasteKw: number;
  wasteKwhDay: number;

  demandKw: number;
  demandKwhDay: number;

  gridKw: number;
  gridKwhDay: number;

  batterySoc: number;
  renewableShare: number;
  carbonKgDay: number;
  sequestrationKgDay: number;
  carbonFactor: number;
}

function phaseFlows(
  phase: PhaseId,
  now: Date
): PhaseFlows {
  const config = PHASES[phase];
  const f = dayFraction(now);
  const seasonal = seasonalFactor(now);

  const solarKw =
    config.solarKwp *
    SOLAR_PEAK_FACTOR *
    seasonal *
    SOILING_FACTOR *
    solarShape(f);

  const solarKwhDay =
    (config.solarKwp * SPECIFIC_YIELD) /
    365 *
    seasonal *
    SOILING_FACTOR;

  const buildingKwhDay =
    (config.builtM2 * config.epi) / 365;

  const buildingKw =
    (config.builtM2 * config.epi) /
    8760 *
    buildingShape(f);

  const computeKwhDay =
    config.computeKw * config.computePue * 24;

  const computeKw =
    config.computeKw *
    config.computePue *
    computeShape(f);

  const stpKwhDay =
    config.stpKlDay * STP_ENERGY_KWH_PER_KL;

  const stpKw = stpKwhDay / 24;

  const pumpKwhDay =
    ((config.population * LITRES_PER_PERSON_DAY) /
      1000) *
    PUMP_ENERGY_KWH_PER_KL;

  const pumpKw = pumpKwhDay / 24;

  const wasteKw = 0.8 + config.organicTDay * 2;
  const wasteKwhDay = wasteKw * 24;

  /* Workstream 1: Phase 1 Campus & Construction (Base residential, school, pumping, STP, site power) */
  const workstreamCampusKw =
    buildingKw + stpKw + pumpKw + wasteKw;
  const workstreamCampusKwhDay =
    buildingKwhDay + stpKwhDay + pumpKwhDay + wasteKwhDay;

  /* Workstream 2: Compute Commons (IT servers + PUE cooling overhead) */
  const workstreamComputeKw = computeKw;
  const workstreamComputeKwhDay = computeKwhDay;

  /* Workstream 3: Spirulina Biomass Pilot (Raceway mixing paddle, aeration sparging, dewatering) */
  const spirulinaKwhDay = config.spirulinaKw * 24;
  const spirulinaKw =
    config.spirulinaKw *
    (0.85 + 0.15 * Math.sin(f * Math.PI * 2));
  const workstreamSpirulinaKw = spirulinaKw;
  const workstreamSpirulinaKwhDay = spirulinaKwhDay;

  /* Combined Campus Demand */
  const demandKw =
    workstreamCampusKw +
    workstreamComputeKw +
    workstreamSpirulinaKw;

  const demandKwhDay =
    workstreamCampusKwhDay +
    workstreamComputeKwhDay +
    workstreamSpirulinaKwhDay;

  const gridKw = Math.max(0, demandKw - solarKw);
  const gridKwhDay = Math.max(
    0,
    demandKwhDay - solarKwhDay
  );

  const renewableShare =
    demandKwhDay > 0
      ? Math.min(1, solarKwhDay / demandKwhDay)
      : 0;

  const carbonFactor =
    demandKwhDay > 0
      ? (gridKwhDay / demandKwhDay) * GRID_FACTOR
      : 0;

  const carbonKgDay = gridKwhDay * GRID_FACTOR;
  const sequestrationKgDay =
    (TOTAL_SEQUESTRATION_T_YR * 1000) / 365;

  const batterySoc = clamp(
    0.5 +
      0.32 *
        Math.sin(
          (f - 0.22) * Math.PI * 2
        ),
    0.12,
    0.96
  );

  return {
    config,
    solarKw,
    solarKwhDay,
    buildingKw,
    buildingKwhDay,
    computeKw,
    computeKwhDay,
    stpKw,
    stpKwhDay,
    pumpKw,
    pumpKwhDay,
    wasteKw,
    wasteKwhDay,
    workstreamCampusKw,
    workstreamCampusKwhDay,
    workstreamComputeKw,
    workstreamComputeKwhDay,
    workstreamSpirulinaKw,
    workstreamSpirulinaKwhDay,
    spirulinaKw,
    spirulinaKwhDay,
    demandKw,
    demandKwhDay,
    gridKw,
    gridKwhDay,
    batterySoc,
    renewableShare,
    carbonKgDay,
    sequestrationKgDay,
    carbonFactor,
  };
}

/* ============================================================
   ASSET BUILDER
   ============================================================ */

function assetStatus(
  carbonShare: number,
  extraWatch = false
): DhunAsset["status"] {
  if (extraWatch) {
    return "watch";
  }

  if (carbonShare > 0.45) {
    return "attention";
  }

  if (carbonShare > 0.25) {
    return "watch";
  }

  return "healthy";
}

function buildAssets(
  flows: PhaseFlows
): DhunAsset[] {
  const {
    config,
    solarKw,
    solarKwhDay,
    buildingKw,
    buildingKwhDay,
    computeKw,
    computeKwhDay,
    stpKw,
    stpKwhDay,
    pumpKw,
    pumpKwhDay,
    wasteKw,
    wasteKwhDay,
    gridKw,
    batterySoc,
    renewableShare,
    carbonKgDay,
    sequestrationKgDay,
    carbonFactor,
  } = flows;

  const carbonOf = (kwh: number) =>
    kwh * carbonFactor;

  const pct = (value: number) =>
    carbonKgDay > 0
      ? value / carbonKgDay
      : 0;

  const residenceKwh = buildingKwhDay * 0.58;
  const schoolKwh = buildingKwhDay * 0.22;
  const campusKwh = buildingKwhDay * 0.2;

  const residenceCarbon = carbonOf(residenceKwh);
  const schoolCarbon = carbonOf(schoolKwh);
  const campusCarbon = carbonOf(campusKwh);
  const computeCarbon = carbonOf(computeKwhDay);
  const stpCarbon = carbonOf(stpKwhDay);
  const pumpCarbon = carbonOf(pumpKwhDay);
  const wasteCarbon = carbonOf(wasteKwhDay);

  const gPerMillionTokens =
    (computeKwhDay / 24) *
    1000 *
    carbonFactor;

  const evShare = 0.05;

  return [
    {
      id: "bioreserve",
      name: "Bioreserve Core",
      short: "Bioreserve",
      zone: "bioreserve",
      icon: "trees",
      status: "healthy",
      x: 150,
      y: 125,
      powerKw: 0,
      energyKwhDay: 0,
      carbonKgDay:
        -(sequestrationKgDay * 0.833),
      waterKlDay: 0,
      carbonShare:
        -(sequestrationKgDay * 0.833) /
        Math.max(1, carbonKgDay),
      headlineValue: `${round(
        STANDING_STOCK_T / 1000
      )}k t`,
      headlineLabel: "standing carbon stock",
      metrics: [
        {
          label: "Protected area",
          value: "400",
          unit: "acres",
          tier: "MEASURED",
        },
        {
          label: "Trees",
          value: "300,000+",
          tier: "MEASURED",
        },
        {
          label: "Bird species",
          value: "180+",
          tier: "MEASURED",
        },
        {
          label: "Land cooling",
          value: "−8",
          unit: "°C",
          tier: "REPORT",
        },
        {
          label: "Sequestration",
          value: "1,500",
          unit: "tCO₂e/yr",
          tier: "ASSUMPTION",
        },
      ],
      note:
        "Existing stock, not an offset. The twin keeps protected biomass separate from additional sequestration so the two are never double-counted.",
      evidence: "MEASURED",
    },

    {
      id: "food-farms",
      name: "Food Farms & Miyawaki",
      short: "Food farms",
      zone: "bioreserve",
      icon: "wheat",
      status: "healthy",
      x: 300,
      y: 82,
      powerKw: 0,
      energyKwhDay: 0,
      carbonKgDay:
        -(sequestrationKgDay * 0.167),
      waterKlDay: 0,
      carbonShare:
        -(sequestrationKgDay * 0.167) /
        Math.max(1, carbonKgDay),
      headlineValue: "48,000 m²",
      headlineLabel: "Miyawaki plantation",
      metrics: [
        {
          label: "Food farms",
          value: "50,000",
          unit: "m²",
          tier: "REPORT",
        },
        {
          label: "Miyawaki",
          value: "48,000",
          unit: "m²",
          tier: "REPORT",
        },
        {
          label: "Sink",
          value: "300",
          unit: "tCO₂e/yr",
          tier: "ASSUMPTION",
        },
        {
          label: "Irrigation",
          value: "1.16",
          unit: "L/m²/day",
          tier: "REPORT",
        },
      ],
      note:
        "Faster establishment than conventional plantation. Sequestration is modelled on a growth curve, not a flat annual rate.",
      evidence: "REPORT",
    },

    {
      id: "water-bodies",
      name: "Water Bodies & Recharge",
      short: "Water bodies",
      zone: "water",
      icon: "waves",
      status: "healthy",
      x: 378,
      y: 300,
      powerKw: 0,
      energyKwhDay: 0,
      carbonKgDay: 0,
      waterKlDay: config.harvestKlYr / 365,
      carbonShare: 0,
      headlineValue: `${round(
        config.harvestKlYr / 1000
      )}k kL`,
      headlineLabel: "harvested per year",
      metrics: [
        {
          label: "Harvested to date",
          value: "600M",
          unit: "litres",
          tier: "MEASURED",
        },
        {
          label: "Storage potential",
          value: "275,800",
          unit: "m³",
          tier: "REPORT",
        },
        {
          label: "Rainfall",
          value: "375–450",
          unit: "mm/yr",
          tier: "REPORT",
        },
        {
          label: "Groundwater",
          value: "Zero",
          unit: "extraction",
          tier: "REPORT",
        },
      ],
      note:
        "Storage behaves like a seasonal battery. The twin sizes it against monsoon inflow and dry-season demand.",
      evidence: "MEASURED",
    },

    {
      id: "solar",
      name: "Solar Farm",
      short: "Solar",
      zone: "energy",
      icon: "sun",
      status: "healthy",
      x: 545,
      y: 100,
      powerKw: solarKw,
      energyKwhDay: solarKwhDay,
      carbonKgDay: 0,
      waterKlDay: 0,
      carbonShare: 0,
      headlineValue: `${round(solarKw)} kW`,
      headlineLabel: "generating now",
      metrics: [
        {
          label: "Installed",
          value: round(config.solarKwp),
          unit: "kWp",
          tier: "REPORT",
        },
        {
          label: "Specific yield",
          value: "1,547",
          unit: "kWh/kWp/yr",
          tier: "REPORT",
        },
        {
          label: "Soiling loss",
          value: "3",
          unit: "%",
          tier: "ASSUMPTION",
        },
        {
          label: "Renewable share",
          value: `${round(
            renewableShare * 100
          )}%`,
          tier: "SIMULATED",
        },
      ],
      note:
        "Roof and carport mounted to stay below the tree-height covenant. Dust and cleaning are modelled explicitly.",
      evidence: "SIMULATED",
    },

    {
      id: "grid-hub",
      name: "Energy Hub",
      short: "Grid hub",
      zone: "energy",
      icon: "zap",
      status: "healthy",
      x: 655,
      y: 62,
      powerKw: gridKw,
      energyKwhDay: flows.gridKwhDay,
      carbonKgDay: 0,
      waterKlDay: 0,
      carbonShare: 0,
      headlineValue: `${round(gridKw)} kW`,
      headlineLabel: "grid import now",
      metrics: [
        {
          label: "Incoming line",
          value: "11",
          unit: "kV",
          tier: "REPORT",
        },
        {
          label: "Transformer bank",
          value: "300",
          unit: "kVA",
          tier: "ASSUMPTION",
        },
        {
          label: "Power factor",
          value: "0.97",
          tier: "ASSUMPTION",
        },
        {
          label: "Grid factor",
          value: "0.85",
          unit: "kg/kWh",
          tier: "REPORT",
        },
      ],
      note:
        "Supplies 100% of residual load. Transformer ratings are unverified field notes and must be reconciled with the single-line diagram.",
      evidence: "ASSUMPTION",
    },

    {
      id: "battery",
      name: "Battery Storage",
      short: "Battery",
      zone: "energy",
      icon: "battery",
      status: "healthy",
      x: 728,
      y: 150,
      powerKw:
        solarKw > flows.demandKw
          ? -(solarKw - flows.demandKw) * 0.55
          : Math.min(flows.demandKw * 0.12, 20),
      energyKwhDay: 0,
      carbonKgDay: 0,
      waterKlDay: 0,
      carbonShare: 0,
      headlineValue: `${round(
        batterySoc * 100
      )}%`,
      headlineLabel: "state of charge",
      metrics: [
        {
          label: "Usable capacity",
          value: round(
            flows.demandKwhDay * 0.12
          ),
          unit: "kWh",
          tier: "ASSUMPTION",
        },
        {
          label: "Round-trip",
          value: "92",
          unit: "%",
          tier: "ASSUMPTION",
        },
        {
          label: "Chemistry",
          value: "LFP",
          tier: "ASSUMPTION",
        },
        {
          label: "Autonomy",
          value: "4",
          unit: "hours",
          tier: "ASSUMPTION",
        },
      ],
      note:
        "Sized on critical-load hours, not on a percentage of PV capacity. The 25%-of-PV rule in the field notes mixes power and energy units.",
      evidence: "SIMULATED",
    },

    {
      id: "stp",
      name: "STP & Water Reuse",
      short: "STP",
      zone: "water",
      icon: "droplets",
      status: "healthy",
      x: 404,
      y: 354,
      powerKw: stpKw,
      energyKwhDay: stpKwhDay,
      carbonKgDay: stpCarbon,
      waterKlDay: config.stpKlDay,
      carbonShare: pct(stpCarbon),
      headlineValue: `${round(
        config.stpKlDay
      )} kL`,
      headlineLabel: "treated per day",
      metrics: [
        {
          label: "Collection",
          value: "100",
          unit: "%",
          tier: "REPORT",
        },
        {
          label: "Reuse",
          value: "100",
          unit: "%",
          tier: "REPORT",
        },
        {
          label: "Energy",
          value: "0.5",
          unit: "kWh/kL",
          tier: "ASSUMPTION",
        },
        {
          label: "Standard",
          value: "Tertiary",
          tier: "REPORT",
        },
      ],
      note:
        "Treated water goes to flushing and landscape. The twin treats the STP as an energy load, not just a water asset.",
      evidence: "SIMULATED",
    },

    {
      id: "pumping",
      name: "Pumping & Distribution",
      short: "Pumping",
      zone: "water",
      icon: "gauge",
      status:
        pumpCarbon / Math.max(1, carbonKgDay) >
        0.12
          ? "watch"
          : "healthy",
      x: 322,
      y: 344,
      powerKw: pumpKw,
      energyKwhDay: pumpKwhDay,
      carbonKgDay: pumpCarbon,
      waterKlDay:
        (config.population *
          LITRES_PER_PERSON_DAY) /
        1000,
      carbonShare: pct(pumpCarbon),
      headlineValue: `${round(
        (config.population *
          LITRES_PER_PERSON_DAY) /
          1000
      )} kL`,
      headlineLabel: "demand per day",
      metrics: [
        {
          label: "Per capita",
          value: "78",
          unit: "L/day",
          tier: "REPORT",
        },
        {
          label: "Motor class",
          value: "IE5",
          unit: "target",
          tier: "REPORT",
        },
        {
          label: "Specific energy",
          value: "0.4",
          unit: "kWh/kL",
          tier: "ASSUMPTION",
        },
        {
          label: "Non-revenue water",
          value: "8",
          unit: "%",
          tier: "ASSUMPTION",
        },
      ],
      note:
        "The hidden Scope 2 load. Pumping energy is small in kWh but continuous, and it is usually left out of carbon reporting.",
      evidence: "SIMULATED",
    },

    {
      id: "residences",
      name: "R1 Residences",
      short: "Residences",
      zone: "built",
      icon: "home",
      status: assetStatus(pct(residenceCarbon)),
      x: 360,
      y: 408,
      powerKw: buildingKw * 0.58,
      energyKwhDay: residenceKwh,
      carbonKgDay: residenceCarbon,
      waterKlDay: 0,
      carbonShare: pct(residenceCarbon),
      headlineValue: `${config.epi}`,
      headlineLabel: "kWh/m²/yr EPI",
      metrics: [
        {
          label: "Efficient case",
          value: "47.1",
          unit: "kWh/m²/yr",
          tier: "REPORT",
        },
        {
          label: "Baseline",
          value: "134",
          unit: "kWh/m²/yr",
          tier: "REPORT",
        },
        {
          label: "Envelope",
          value: "12",
          unit: "W/m² RETV",
          tier: "REPORT",
        },
        {
          label: "Construction ceiling",
          value: "Tree height",
          tier: "MEASURED",
        },
      ],
      note:
        "The EcoNiwas efficient case is 65% lower than business-as-usual. The twin tracks the gap between design intent and operation.",
      evidence: "SIMULATED",
    },

    {
      id: "school",
      name: "School Campus",
      short: "School",
      zone: "built",
      icon: "school",
      status: assetStatus(pct(schoolCarbon)),
      x: 486,
      y: 418,
      powerKw: buildingKw * 0.22,
      energyKwhDay: schoolKwh,
      carbonKgDay: schoolCarbon,
      waterKlDay: 0,
      carbonShare: pct(schoolCarbon),
      headlineValue: "300",
      headlineLabel: "students",
      metrics: [
        {
          label: "Site",
          value: "7",
          unit: "acres",
          tier: "REPORT",
        },
        {
          label: "Students",
          value: "300",
          tier: "REPORT",
        },
        {
          label: "Peak ambient",
          value: "47–50",
          unit: "°C",
          tier: "MEASURED",
        },
        {
          label: "Cooling",
          value: "Passive first",
          tier: "ASSUMPTION",
        },
      ],
      note:
        "Passive cooling, shading and efficient standalone AC before mechanical load. The school is the Phase 1 testbed for the envelope strategy.",
      evidence: "SIMULATED",
    },

    {
      id: "campus-centre",
      name: "Campus Centre & Hospitality",
      short: "Hospitality",
      zone: "built",
      icon: "building",
      status: assetStatus(pct(campusCarbon)),
      x: 552,
      y: 348,
      powerKw: buildingKw * 0.2,
      energyKwhDay: campusKwh,
      carbonKgDay: campusCarbon,
      waterKlDay: 0,
      carbonShare: pct(campusCarbon),
      headlineValue: "2029",
      headlineLabel: "hospitality target",
      metrics: [
        {
          label: "Programme",
          value: "Wellness",
          tier: "REPORT",
        },
        {
          label: "Shared facilities",
          value: "Kitchen, events",
          tier: "REPORT",
        },
        {
          label: "EV parking",
          value: `${round(
            evShare * 100
          )}%`,
          tier: "REPORT",
        },
        {
          label: "Lighting",
          value: "Full cutoff",
          tier: "ASSUMPTION",
        },
      ],
      note:
        "Shared amenities concentrate load and create the campus's evening peak. This is where demand flexibility matters most.",
      evidence: "SIMULATED",
    },

    {
      id: "gaushala",
      name: "Gaushala & Compost",
      short: "Gaushala",
      zone: "waste",
      icon: "recycle",
      status: "healthy",
      x: 145,
      y: 388,
      powerKw: wasteKw,
      energyKwhDay: wasteKwhDay,
      carbonKgDay: wasteCarbon,
      waterKlDay: 0,
      carbonShare: pct(wasteCarbon),
      headlineValue: `${config.organicTDay}`,
      headlineLabel: "t organic / day",
      metrics: [
        {
          label: "Herd",
          value: "150–200",
          unit: "cattle",
          tier: "ASSUMPTION",
        },
        {
          label: "Organic diverted",
          value: "100",
          unit: "%",
          tier: "REPORT",
        },
        {
          label: "Methane avoided",
          value: round(
            config.organicTDay * 700
          ),
          unit: "kgCO₂e/day",
          tier: "ASSUMPTION",
        },
        {
          label: "Compost to farms",
          value: "Closed loop",
          tier: "ASSUMPTION",
        },
      ],
      note:
        "Aerobic composting avoids the methane a landfill would produce. The avoided emissions are shown, not silently netted off.",
      evidence: "SIMULATED",
    },

    {
      id: "compute",
      name: "Zugrama Compute Commons",
      short: "Compute",
      zone: "compute",
      icon: "cpu",
      status:
        config.computePue > 1.6
          ? "watch"
          : "healthy",
      x: 672,
      y: 312,
      powerKw: computeKw,
      energyKwhDay: computeKwhDay,
      carbonKgDay: computeCarbon,
      waterKlDay:
        computeKwhDay * 1.8,
      carbonShare: pct(computeCarbon),
      headlineValue: `${round(
        config.computeKw
      )} kW`,
      headlineLabel: "IT load",
      metrics: [
        {
          label: "PUE",
          value: config.computePue.toFixed(2),
          tier: "ASSUMPTION",
        },
        {
          label: "WUE",
          value: "1.8",
          unit: "L/kWh",
          tier: "ASSUMPTION",
        },
        {
          label: "Carbon",
          value: `${round(
            gPerMillionTokens,
            0
          )}`,
          unit: "gCO₂e / 1M tokens",
          tier: "SIMULATED",
        },
        {
          label: "Flexibility",
          value: "Deferrable",
          tier: "ASSUMPTION",
        },
      ],
      note:
        "The only load on site that can move in time. The twin schedules inference into high-solar, low-carbon hours instead of running it flat out.",
      evidence: "SIMULATED",
    },
  ];
}

/* ============================================================
   PUBLIC ENTRY POINT
   ============================================================ */

export function buildTwin(
  phase: PhaseId,
  now: Date
): TwinSnapshot {
  const flows = phaseFlows(phase, now);
  const assets = buildAssets(flows);

  const netCarbonKgDay =
    flows.carbonKgDay - flows.sequestrationKgDay;

  const summary: TwinSummary = {
    phase,
    clock: now,
    population: flows.config.population,
    builtM2: flows.config.builtM2,
    demandKw: flows.demandKw,
    solarKw: flows.solarKw,
    gridKw: flows.gridKw,
    batterySoc: flows.batterySoc,

    /* Three Distinct Demand Workstreams */
    workstreamCampusKw: flows.workstreamCampusKw,
    workstreamCampusKwhDay: flows.workstreamCampusKwhDay,
    workstreamComputeKw: flows.workstreamComputeKw,
    workstreamComputeKwhDay: flows.workstreamComputeKwhDay,
    workstreamSpirulinaKw: flows.workstreamSpirulinaKw,
    workstreamSpirulinaKwhDay: flows.workstreamSpirulinaKwhDay,

    renewableShare: flows.renewableShare,
    gridIntensity: gridIntensity(dayFraction(now)),
    demandKwhDay: flows.demandKwhDay,
    solarKwhDay: flows.solarKwhDay,
    gridKwhDay: flows.gridKwhDay,
    carbonKgDay: flows.carbonKgDay,
    sequestrationKgDay: flows.sequestrationKgDay,
    netCarbonKgDay,
    waterKlDay:
      (flows.config.population *
        LITRES_PER_PERSON_DAY) /
      1000,
    waterHarvestKlYr: flows.config.harvestKlYr,
    standingStockT: STANDING_STOCK_T,
    perCapitaT:
      flows.config.population > 0
        ? (netCarbonKgDay * 365) /
          1000 /
          flows.config.population
        : 0,
    targetPerCapitaT: TARGET_PER_CAPITA_T,
  };

  return { summary, assets };
}

/* ============================================================
   ANNUAL FLOWS
   Whole-year totals used by the ledger and scenario engines.
   Same physics as the live view, integrated over 8,760 hours.
   ============================================================ */

export interface AnnualEnergy {
  demandKwhYr: number;
  campusKwhYr: number;
  computeKwhYr: number;
  spirulinaKwhYr: number;
  buildingKwhYr: number;
  waterKwhYr: number;
  wasteKwhYr: number;
  solarKwhYr: number;
  gridKwhYr: number;
  renewableShare: number;
  carbonT: number;
  sinkT: number;
}

/* Landscape water demand, from the KPI report: 308,000 m² of
   green land at ~1.16 L/m²/day, 240,317 kL a year at full
   build-out. Earlier phases carry the share of that landscape
   which has actually been built. */
export function landscapeWaterKlYr(
  phase: PhaseId
): number {
  const config = PHASES[phase];

  return (
    LANDSCAPE_KL_YR_BUILD_OUT *
    clamp(config.builtM2 / BUILD_OUT_M2)
  );
}

export function annualEnergy(
  phase: PhaseId
): AnnualEnergy {
  const config = PHASES[phase];

  const buildingKwhYr =
    config.builtM2 * config.epi;

  const computeKwhYr =
    config.computeKw *
    config.computePue *
    24 *
    365;

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
    config.solarKwp * SPECIFIC_YIELD * SOILING_FACTOR;

  const usableSolarKwhYr =
    Math.min(solarKwhYr, demandKwhYr) *
    SELF_CONSUMPTION_FACTOR;

  const gridKwhYr = Math.max(
    0,
    demandKwhYr - usableSolarKwhYr
  );

  return {
    demandKwhYr,
    campusKwhYr,
    computeKwhYr,
    spirulinaKwhYr,
    buildingKwhYr,
    waterKwhYr,
    wasteKwhYr,
    solarKwhYr,
    gridKwhYr,
    renewableShare:
      demandKwhYr > 0
        ? Math.min(1, usableSolarKwhYr / demandKwhYr)
        : 0,
    carbonT: (gridKwhYr * GRID_FACTOR) / 1000,
    sinkT: TOTAL_SEQUESTRATION_T_YR,
  };
}
