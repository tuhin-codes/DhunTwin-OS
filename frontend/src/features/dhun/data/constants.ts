/* ============================================================
   DHUN TWIN OS — CONSTANTS
   Every constant carries the evidence tier it will render with.
   ============================================================ */

/* Masterplan boundary constraints */
export const TOTAL_SITE_ACRES = 500;           // Total property boundary
export const BIORESERVE_ACRES = 400;           // Protected ecological bioreserve
export const MAX_CONSTRUCTION_ACRES = 100;     // Maximum construction footprint ceiling
export const TREE_HEIGHT_LIMIT_M = 12;         // Building height ceiling (must not exceed tree canopy / G+2)
export const AFFORESTATION_OFFSET_ACRES = 124;  // Dedicated afforestation carbon offset zone (EDS p. 152)
export const ANNUAL_WATER_CAPACITY_KL = 550000; // Dhun reported annual water capacity: 550 million litres (550,000 kL)

/* Emission factors — Dhun KPI report (Rev 2, July 2022) & CEA */
export const GRID_FACTOR = 0.85;        // kg CO2e / kWh
export const SOLAR_FACTOR = 0.05;       // kg CO2e / kWh, lifecycle
export const PETROL_FACTOR = 2.296;     // kg CO2e / litre
export const DIESEL_FACTOR = 2.653;     // kg CO2e / litre
export const LPG_FACTOR = 2.983;        // kg CO2e / litre

/* Solar resource — KPI report, Jaipur proxy */
export const SPECIFIC_YIELD = 1547;     // kWh / kWp / year
export const SOLAR_PEAK_FACTOR = 0.56;  // kW at solar noon per kWp
export const SOILING_FACTOR = 0.97;

/* Demand — KPI report + EcoNiwas reference case */
export const EPI_TARGET = 35;           // kWh / m2 / year
export const EPI_EFFICIENT = 47.1;      // kWh / m2 / year
export const EPI_BASELINE = 134;        // kWh / m2 / year

/* Water — KPI report */
export const LITRES_PER_PERSON_DAY = 78;
export const LANDSCAPE_LITRES_M2_DAY = 1.16;
export const STP_ENERGY_KWH_PER_KL = 0.5;
export const PUMP_ENERGY_KWH_PER_KL = 0.4;

/* Population — KPI report design population */
export const DESIGN_POPULATION = 11847;

/* Carbon targets — KPI report */
export const TARGET_PER_CAPITA_T = 0.4;
export const UPFRONT_KG_M2 = 225;       // midpoint of 200–250 kgCO2e/m2 (A1–A5)
export const USE_EMBODIED_KG_M2 = 287.5; // midpoint of 275–300 kgCO2e/m2 (B1–B5, 25-yr life)
export const BUILD_OUT_M2 = 650558;     // KPI report built-up area

/* Living carbon — 124 acres dedicated afforestation offset (300,000 trees at buildout) */
export const STANDING_STOCK_T = 45000;  // t CO2e, indicative standing biomass
export const BIO_SEQUESTRATION_T_YR = 1500; // t CO2e/yr at full 124-acre maturity
export const FARM_SEQUESTRATION_T_YR = 300; // t CO2e/yr organic farm soil uptake
export const TOTAL_SEQUESTRATION_T_YR =
  BIO_SEQUESTRATION_T_YR + FARM_SEQUESTRATION_T_YR;

/* Share of gross solar that lands against campus demand once
   inverter losses, soiling and curtailment are counted. The
   campus is net-metered, so exports are credited, not lost. */
export const SELF_CONSUMPTION_FACTOR = 0.973;

/* Energy economics — planning assumptions */
export const PV_CAPEX_INR_PER_KWP = 35000;
export const BATTERY_CAPEX_INR_PER_KWH = 18000;
export const BATTERY_ROUND_TRIP_EFFICIENCY = 0.88; // 88% AC-AC storage efficiency
export const SYSTEM_LIFETIME_YR = 25;
export const OANDM_FRACTION = 0.015;
export const TARIFF_INR_PER_KWH = 8;

/* Landscape water — KPI report: 308,000 m² of green land at
   ~1.16 L/m²/day, drip and sprinkler weighted. The monthly
   table sums to 240,317 kL a year at full build-out. */
export const GREEN_LAND_M2 = 308000;
export const LANDSCAPE_KL_YR_BUILD_OUT = 240317;

/* Evidence provenance tiers across the platform */
export const TIER_LABEL = {
  MEASURED: "Measured",
  REPORTED: "Reported by Dhun",
  REPORT: "Dhun report",
  DOCUMENT: "Sourced from document",
  CALCULATED: "Calculated",
  ESTIMATED: "Estimated",
  ASSUMPTION: "Assumption",
  SIMULATED: "Simulated",
} as const;

export type EvidenceTier = keyof typeof TIER_LABEL;

