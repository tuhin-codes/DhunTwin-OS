/* ============================================================
   DHUN TWIN OS — COMPUTE COMMONS MODELLING & SCENARIO ENGINE
   Central, transparent calculation engine for compute capacity,
   PUE facility overhead, electricity cost equivalent, hardware
   footprint, workload planning, and wider Dhun campus energy impact.
   ============================================================ */

import { GRID_FACTOR } from "../data/constants";

// -------------------------------------------------------------
// 1. Interfaces & Types
// -------------------------------------------------------------

export type ComputeScenarioId = "pilot" | "phase1" | "expansion" | "custom";

export interface ComputeScenarioInputs {
  id: string;
  name: string;
  description: string;
  inputMode: "averageLoad" | "ratedUtilisation";
  averageItLoadKw: number;
  ratedItCapacityKw?: number;
  averageUtilisationPct?: number;
  operatingHoursPerDay: number;
  operatingDaysPerYear: number;
  pue: number;
  electricityRateInrPerKwh: number;
  isBaseline?: boolean;
  notes?: string;
}

export interface ComputeScenarioOutputs {
  annualOperatingHours: number;
  effectiveItLoadKw: number;
  annualItEnergyKwh: number;
  annualItEnergyMwh: number;
  annualFacilityEnergyKwh: number;
  annualFacilityEnergyMwh: number;
  annualFacilityOverheadKwh: number;
  annualFacilityOverheadMwh: number;
  avgFacilityDemandKw: number;
  annualElectricityCostInr: number;
  annualElectricityCostLakh: number;
  monthlyFacilityEnergyKwh: number;
  monthlyElectricityCostInr: number;
  monthlyElectricityCostLakh: number;
  annualCarbonEmissionsTons: number;
  pueOverheadPct: number;
  isValid: boolean;
  validationErrors: string[];
}

export interface HardwareSpecification {
  status: "unspecified" | "specified";
  gpuModel?: string;
  gpuCount?: number;
  vramPerGpuGb?: number;
  aggregateVramGb?: number;
  cpuCores?: number;
  systemRamGb?: number;
  localStorageTb?: number;
  storageType?: string;
  interconnect?: string;
  serverChassisCount?: number;
  estimatedRackUnits?: number;
  estimatedFullRacks?: number;
  tdpWattsPerServer?: number;
  theoreticalTflopsFp16?: number;
}

export interface WorkloadProfile {
  id: string;
  name: string;
  category:
    | "Local Model Inference"
    | "Concurrent API Users"
    | "Embeddings & RAG"
    | "Fine-Tuning (LoRA/PEFT)"
    | "Model Evaluation"
    | "Batch & Transcoding"
    | "Selected Training"
    | "General CPU Compute";
  targetModel: string;
  parameterSize: string;
  quantization: "FP16" | "INT8" | "INT4" | "Unquantized";
  minVramGb: number;
  concurrentCapacity: string;
  isShiftableToSolarHours: boolean;
  description: string;
}

export interface CampusEnergyImpact {
  existingCampusMwhYr: number;
  existingCampusCostLakhYr: number;
  existingCampusDerivation: string;
  plannedBuildingsMwhYr: number;
  plannedBuildingsStatus: string;
  computeFacilityMwhYr: number;
  totalModelledCampusMwhYr: number;
  computeShareOfTotalPct: number;
  disclaimer: string;
}

export interface ComputeAssumption {
  id: string;
  parameter: string;
  value: string;
  unit: string;
  sourceJustification: string;
  verificationStatus:
    | "Measured"
    | "Reported"
    | "Planning Assumption"
    | "Unvalidated Placeholder"
    | "Unspecified";
  lastReviewed: string;
}

// -------------------------------------------------------------
// 2. Initial Default Scenario Templates
// -------------------------------------------------------------

export const COMPUTE_DEFAULT_SCENARIOS: Record<ComputeScenarioId, ComputeScenarioInputs> = {
  pilot: {
    id: "pilot",
    name: "Compute Pilot",
    description: "Initial experimental deployment for edge telemetry, low-power inference, and campus model testing.",
    inputMode: "averageLoad",
    averageItLoadKw: 5.0,
    operatingHoursPerDay: 12.0,
    operatingDaysPerYear: 365,
    pue: 1.30,
    electricityRateInrPerKwh: 10.0,
    isBaseline: true,
    notes: "Illustrative planning configuration: 12h/day daytime operation aligned with campus solar window.",
  },
  phase1: {
    id: "phase1",
    name: "Phase 1 Reference",
    description: "Continuous operational cluster serving campus analytics, environmental inference, and local field research.",
    inputMode: "averageLoad",
    averageItLoadKw: 20.0,
    operatingHoursPerDay: 24.0,
    operatingDaysPerYear: 365,
    pue: 1.30,
    electricityRateInrPerKwh: 10.0,
    isBaseline: false,
    notes: "Continuous 24h operational load; requires night grid import or dedicated battery storage.",
  },
  expansion: {
    id: "expansion",
    name: "Expansion Scenario",
    description: "Scale-out multi-tenant infrastructure supporting advanced regional training, agent swarms, and synthetic generation.",
    inputMode: "averageLoad",
    averageItLoadKw: 50.0,
    operatingHoursPerDay: 24.0,
    operatingDaysPerYear: 365,
    pue: 1.30,
    electricityRateInrPerKwh: 10.0,
    isBaseline: false,
    notes: "High-density scale-out configuration; represents upper planning ceiling for Phase 1 electrical allocation.",
  },
  custom: {
    id: "custom",
    name: "Custom Scenario",
    description: "User-defined compute scenario for exploring custom IT loads, duty cycles, or cooling efficiencies.",
    inputMode: "averageLoad",
    averageItLoadKw: 15.0,
    ratedItCapacityKw: 20.0,
    averageUtilisationPct: 75.0,
    operatingHoursPerDay: 18.0,
    operatingDaysPerYear: 365,
    pue: 1.25,
    electricityRateInrPerKwh: 10.0,
    isBaseline: false,
    notes: "User-configured interactive scenario parameters.",
  },
};

// -------------------------------------------------------------
// 3. Central Transparent Calculation Function
// -------------------------------------------------------------

/**
 * Calculates energy, overhead, costs, and carbon for a compute scenario.
 * Strictly avoids double-counting utilisation and enforces physical PUE bounds.
 */
export function calculateComputeScenario(inputs: ComputeScenarioInputs): ComputeScenarioOutputs {
  const validationErrors: string[] = [];

  // PUE Validation: PUE is Total Facility Power / IT Equipment Power. By physics, PUE >= 1.00.
  let pue = Number(inputs.pue);
  if (isNaN(pue) || pue < 1.0) {
    validationErrors.push("PUE must be >= 1.00 (physically, facility energy cannot be less than IT energy).");
    pue = Math.max(1.0, isNaN(pue) ? 1.3 : pue);
  }

  // Operating Hours Validation
  let hoursPerDay = Number(inputs.operatingHoursPerDay);
  if (isNaN(hoursPerDay) || hoursPerDay < 0 || hoursPerDay > 24) {
    validationErrors.push("Operating hours per day must be between 0 and 24 hours.");
    hoursPerDay = Math.min(24, Math.max(0, isNaN(hoursPerDay) ? 24 : hoursPerDay));
  }

  // Operating Days Validation
  let daysPerYear = Number(inputs.operatingDaysPerYear);
  if (isNaN(daysPerYear) || daysPerYear < 0 || daysPerYear > 366) {
    validationErrors.push("Operating days per year must be between 0 and 366 days.");
    daysPerYear = Math.min(366, Math.max(0, isNaN(daysPerYear) ? 365 : daysPerYear));
  }

  // Electricity Tariff Validation
  let tariff = Number(inputs.electricityRateInrPerKwh);
  if (isNaN(tariff) || tariff < 0) {
    validationErrors.push("Electricity tariff must be a non-negative number.");
    tariff = Math.max(0, isNaN(tariff) ? 10 : tariff);
  }

  // Determine Effective Average IT Load without double counting utilisation
  let effectiveItLoadKw = 0;
  if (inputs.inputMode === "ratedUtilisation") {
    const rated = Math.max(0, Number(inputs.ratedItCapacityKw) || 0);
    const utilPct = Math.min(100, Math.max(0, Number(inputs.averageUtilisationPct) || 0));
    effectiveItLoadKw = (rated * utilPct) / 100;
  } else {
    effectiveItLoadKw = Math.max(0, Number(inputs.averageItLoadKw) || 0);
  }

  // Core Formulas
  const annualOperatingHours = hoursPerDay * daysPerYear;
  const annualItEnergyKwh = effectiveItLoadKw * annualOperatingHours;
  const annualItEnergyMwh = annualItEnergyKwh / 1000;

  const annualFacilityEnergyKwh = annualItEnergyKwh * pue;
  const annualFacilityEnergyMwh = annualFacilityEnergyKwh / 1000;

  const annualFacilityOverheadKwh = annualFacilityEnergyKwh - annualItEnergyKwh;
  const annualFacilityOverheadMwh = annualFacilityOverheadKwh / 1000;

  // Average facility electrical demand during active operating hours
  const avgFacilityDemandKw = effectiveItLoadKw * pue;

  // Electricity Costs
  const annualElectricityCostInr = annualFacilityEnergyKwh * tariff;
  const annualElectricityCostLakh = annualElectricityCostInr / 100000;

  // Monthly values consistently derived as annual / 12
  const monthlyFacilityEnergyKwh = annualFacilityEnergyKwh / 12;
  const monthlyElectricityCostInr = annualElectricityCostInr / 12;
  const monthlyElectricityCostLakh = monthlyElectricityCostInr / 100000;

  // Carbon Impact (Grid factor 0.71 kg CO2/kWh from verified Dhun constants)
  const annualCarbonEmissionsTons = (annualFacilityEnergyKwh * GRID_FACTOR) / 1000;

  // PUE overhead percentage (e.g. 1.30 PUE = 30% overhead)
  const pueOverheadPct = (pue - 1.0) * 100;

  return {
    annualOperatingHours,
    effectiveItLoadKw,
    annualItEnergyKwh,
    annualItEnergyMwh,
    annualFacilityEnergyKwh,
    annualFacilityEnergyMwh,
    annualFacilityOverheadKwh,
    annualFacilityOverheadMwh,
    avgFacilityDemandKw,
    annualElectricityCostInr,
    annualElectricityCostLakh,
    monthlyFacilityEnergyKwh,
    monthlyElectricityCostInr,
    monthlyElectricityCostLakh,
    annualCarbonEmissionsTons,
    pueOverheadPct,
    isValid: validationErrors.length === 0,
    validationErrors,
  };
}

// -------------------------------------------------------------
// 4. Wider Dhun Campus Energy Model Integration
// -------------------------------------------------------------

export const CAMPUS_ENERGY_DEFAULTS = {
  // Existing campus: 300 MWh/year derived from ₹2.5 lakh/month at ₹10/kWh rate
  // (25,000 kWh/month * 12 months = 300,000 kWh = 300 MWh/year)
  existingCampusMwhYr: 300.0,
  existingCampusCostLakhYr: 30.0, // ₹2.5 Lakh/mo * 12 = ₹30 Lakh/yr
  existingCampusDerivation: "Derived from ₹2.5 lakh/month billing at assumed ₹10/kWh rate (pending meter audit).",

  // Planned Phase 1 buildings: 524 MWh/year, unvalidated architectural placeholder
  plannedBuildingsMwhYr: 524.0,
  plannedBuildingsStatus: "Unvalidated architectural placeholder; subject to building physics simulation.",
};

/**
 * Combines compute scenario facility energy with existing campus and planned buildings.
 * Produces the transparent campus totals:
 * - Pilot: 300 + 524 + 28.5 = 852.5 MWh/yr
 * - Phase 1: 300 + 524 + 227.8 = 1,051.8 MWh/yr
 * - Expansion: 300 + 524 + 569.4 = 1,393.4 MWh/yr
 */
export function calculateCampusEnergyImpact(
  computeFacilityMwhYr: number,
  includeExistingCampus = true,
  includePlannedBuildings = true,
  customExistingMwh?: number,
  customPlannedMwh?: number
): CampusEnergyImpact {
  const existingMwh = includeExistingCampus
    ? typeof customExistingMwh === "number"
      ? customExistingMwh
      : CAMPUS_ENERGY_DEFAULTS.existingCampusMwhYr
    : 0;

  const plannedMwh = includePlannedBuildings
    ? typeof customPlannedMwh === "number"
      ? customPlannedMwh
      : CAMPUS_ENERGY_DEFAULTS.plannedBuildingsMwhYr
    : 0;

  const totalModelledCampusMwhYr = existingMwh + plannedMwh + computeFacilityMwhYr;
  const computeShareOfTotalPct =
    totalModelledCampusMwhYr > 0 ? (computeFacilityMwhYr / totalModelledCampusMwhYr) * 100 : 0;

  return {
    existingCampusMwhYr: existingMwh,
    existingCampusCostLakhYr: (existingMwh * 1000 * 10) / 100000,
    existingCampusDerivation: CAMPUS_ENERGY_DEFAULTS.existingCampusDerivation,
    plannedBuildingsMwhYr: plannedMwh,
    plannedBuildingsStatus: CAMPUS_ENERGY_DEFAULTS.plannedBuildingsStatus,
    computeFacilityMwhYr,
    totalModelledCampusMwhYr,
    computeShareOfTotalPct,
    disclaimer:
      "These campus totals are illustrative planning figures. Existing campus consumption is bill-derived, planned buildings is an unvalidated placeholder, and compute is a modelled scenario. Do not treat as metered field data.",
  };
}

// -------------------------------------------------------------
// 5. Solar & Battery Interaction Analysis
// -------------------------------------------------------------

export interface SolarBatteryImpact {
  daytimeCoincidencePct: number;
  daytimeSolarCoincidentMwh: number;
  nighttimeGridOrBatteryMwh: number;
  nighttimeBatteryCapacityNeededKwh: number;
  coincidentSolarShareText: string;
}

export function calculateSolarBatteryInteraction(
  inputs: ComputeScenarioInputs,
  outputs: ComputeScenarioOutputs
): SolarBatteryImpact {
  // Rajasthan solar window typically spans 08:00 to 17:00 (9 peak sunlight hours)
  const solarWindowHours = 9;

  let daytimeCoincidencePct = 0;
  if (inputs.operatingHoursPerDay <= 12) {
    // If operating 12h/day, typical schedule runs 08:00 to 20:00 (9 hours coincide with solar, 3 hours evening)
    daytimeCoincidencePct = 75.0;
  } else {
    // If operating 24h/day, 9 of 24 hours coincide with the active solar window
    daytimeCoincidencePct = (solarWindowHours / 24) * 100; // ~37.5%
  }

  const daytimeSolarCoincidentMwh = (outputs.annualFacilityEnergyMwh * daytimeCoincidencePct) / 100;
  const nighttimeGridOrBatteryMwh = outputs.annualFacilityEnergyMwh - daytimeSolarCoincidentMwh;

  // Daily nighttime energy that must be buffered by BESS or drawn from grid
  const dailyNighttimeKwh = (outputs.annualFacilityEnergyKwh * (100 - daytimeCoincidencePct)) / 100 / inputs.operatingDaysPerYear;

  // Assuming 85% round-trip battery efficiency and 80% usable depth-of-discharge
  const nighttimeBatteryCapacityNeededKwh = dailyNighttimeKwh / (0.85 * 0.8);

  return {
    daytimeCoincidencePct,
    daytimeSolarCoincidentMwh,
    nighttimeGridOrBatteryMwh,
    nighttimeBatteryCapacityNeededKwh,
    coincidentSolarShareText:
      inputs.operatingHoursPerDay <= 12
        ? "High solar coincidence (~75% daytime operation aligns with site PV array)."
        : "Continuous 24h operation: ~38% aligns with solar window, remaining ~62% requires night grid import or battery discharge.",
  };
}

// -------------------------------------------------------------
// 6. Pre-configured Workload Profiles
// -------------------------------------------------------------

export const DEFAULT_WORKLOAD_PROFILES: WorkloadProfile[] = [
  {
    id: "wl-infer-local",
    name: "Edge Model Inference (7B–8B)",
    category: "Local Model Inference",
    targetModel: "Llama-3.1 8B / Mistral 7B",
    parameterSize: "8 Billion",
    quantization: "INT4",
    minVramGb: 8,
    concurrentCapacity: "10–25 streams per accelerator",
    isShiftableToSolarHours: false,
    description: "Low-latency resident queries, environmental event parsing, and campus concierge responses.",
  },
  {
    id: "wl-rag-campus",
    name: "Campus Embeddings & RAG",
    category: "Embeddings & RAG",
    targetModel: "BGE-Large / Cohere Embed v3",
    parameterSize: "330 Million",
    quantization: "FP16",
    minVramGb: 4,
    concurrentCapacity: "100+ documents/sec",
    isShiftableToSolarHours: true,
    description: "Indexing environmental sensors, water logs, solar telemetry, and architectural documents into vector stores.",
  },
  {
    id: "wl-heavy-infer",
    name: "Large Model Reasoning (70B)",
    category: "Local Model Inference",
    targetModel: "Llama-3.1 70B / Qwen 2.5 72B",
    parameterSize: "70 Billion",
    quantization: "INT8",
    minVramGb: 80,
    concurrentCapacity: "2–4 concurrent users per node",
    isShiftableToSolarHours: false,
    description: "Complex spatial synthesis, ecological scenario reasoning, and engineering report generation.",
  },
  {
    id: "wl-lora-tuning",
    name: "Domain LoRA Fine-Tuning",
    category: "Fine-Tuning (LoRA/PEFT)",
    targetModel: "Llama-3.1 8B / 70B LoRA",
    parameterSize: "8B–70B",
    quantization: "INT4",
    minVramGb: 24,
    concurrentCapacity: "Batch job queue",
    isShiftableToSolarHours: true,
    description: "Overnight training on Dhun microclimate sensors, desert afforestation, and water table records.",
  },
  {
    id: "wl-batch-media",
    name: "Acoustic & Vision Transcoding",
    category: "Batch & Transcoding",
    targetModel: "Whisper Large v3 / YOLOv10",
    parameterSize: "1.5 Billion",
    quantization: "FP16",
    minVramGb: 16,
    concurrentCapacity: "20× real-time audio batching",
    isShiftableToSolarHours: true,
    description: "Bioacoustic avian bird call classification and wildlife camera-trap biodiversity monitoring.",
  },
];

// -------------------------------------------------------------
// 7. Evidence & Assumptions Register
// -------------------------------------------------------------

export const COMPUTE_EVIDENCE_REGISTER: ComputeAssumption[] = [
  {
    id: "asm-1",
    parameter: "Existing Campus Electricity Bill",
    value: "₹2.5 Lakh / month (300 MWh / year)",
    unit: "INR / month & MWh / yr",
    sourceJustification: "Reported historical Dhun campus power bill. Yields 300,000 kWh/yr at assumed ₹10/kWh rate.",
    verificationStatus: "Reported",
    lastReviewed: "2024-10-15",
  },
  {
    id: "asm-2",
    parameter: "Effective Electricity Tariff",
    value: "₹10.00",
    unit: "₹ / kWh",
    sourceJustification: "Working planning tariff assumption; pending JVVNL industrial tariff schedule audit.",
    verificationStatus: "Planning Assumption",
    lastReviewed: "2024-10-15",
  },
  {
    id: "asm-3",
    parameter: "Power Usage Effectiveness (PUE)",
    value: "1.30",
    unit: "Facility Energy Ratio",
    sourceJustification: "Provisional planning assumption for dry/hybrid cooling with Rajasthan ambient dry-bulb consideration.",
    verificationStatus: "Planning Assumption",
    lastReviewed: "2024-10-15",
  },
  {
    id: "asm-4",
    parameter: "Compute Planning Scenarios (5 / 20 / 50 kW)",
    value: "5 kW (Pilot) · 20 kW (Phase 1) · 50 kW (Expansion)",
    unit: "kW average IT load",
    sourceJustification: "Illustrative engineering sizing envelopes for progressive compute infrastructure stages.",
    verificationStatus: "Planning Assumption",
    lastReviewed: "2024-10-15",
  },
  {
    id: "asm-5",
    parameter: "Planned Phase 1 Buildings Allowance",
    value: "524.0",
    unit: "MWh / year",
    sourceJustification: "Unvalidated placeholder derived from initial architectural built-up area; pending physics simulation.",
    verificationStatus: "Unvalidated Placeholder",
    lastReviewed: "2024-10-15",
  },
  {
    id: "asm-6",
    parameter: "Hardware Specifications & AI Throughput",
    value: "Unspecified (Generic Power Envelopes)",
    unit: "GPU count / TFLOPS / tokens/sec",
    sourceJustification: "Hardware procurement pending; compute performance shown as 'Not yet specified' until BOM is locked.",
    verificationStatus: "Unspecified",
    lastReviewed: "2024-10-15",
  },
];
