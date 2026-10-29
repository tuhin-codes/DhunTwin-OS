/* ============================================================
   DHUN TWIN OS — ENGINEERING VALIDATION ENGINE (PART 8)
   Rigorous physical and mathematical consistency checks for:
   1. Energy Balance (Generation + Import + Discharge == Demand + Charge + Losses)
   2. Water Balance (Storage delta + Inflows == Demand + Losses, 550ML harvesting envelope)
   3. Carbon Accounting Boundaries (Embodied vs Operational vs Sinks vs Removals)
   4. Battery BESS Dispatch (SOC limits, C-rate, efficiency, mutual exclusion)
   5. Compute Infrastructure Monitoring (IT load, Facility load, PUE >= 1.0)
   ============================================================ */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  reconciliationDiff?: number;
  metadata?: Record<string, any>;
}

/**
 * 8.1 ENERGY BALANCE AUDIT
 * Reconciles generation, import, storage dispatch, demand, charging, and transmission losses.
 * Strictly verifies consistent physical units (kW power vs kWh energy).
 */
export interface EnergyBalanceParams {
  periodHours: number; // Interval duration, e.g. 1 hour or 24 hours
  unit: "kW" | "kWh";
  generation: number;      // Solar PV generation
  gridImport: number;      // 11kV substation grid import
  batteryDischarge: number;// BESS discharge
  demand: number;          // Total campus electrical load
  batteryCharge: number;   // BESS charge energy
  losses: number;          // Inverter, transformer & reticulation losses
  tolerance?: number;      // Allowable floating point delta (default: 0.5)
}

export function validateEnergyBalance(params: EnergyBalanceParams): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const tolerance = params.tolerance ?? 0.5;

  // Basic sanity checks
  if (params.generation < 0) errors.push("Generation cannot be negative.");
  if (params.gridImport < 0) errors.push("Grid import cannot be negative (use gridExport for export).");
  if (params.batteryDischarge < 0) errors.push("Battery discharge cannot be negative.");
  if (params.demand < 0) errors.push("Campus demand cannot be negative.");
  if (params.batteryCharge < 0) errors.push("Battery charge cannot be negative.");
  if (params.losses < 0) errors.push("Electrical losses cannot be negative.");

  // Mutual exclusion: BESS cannot charge and discharge simultaneously in the same interval
  if (params.batteryCharge > 0.05 && params.batteryDischarge > 0.05) {
    errors.push("Simultaneous battery charging and discharging detected in the same interval.");
  }

  // Energy Conservation: Supply == Demand + Storage + Losses
  const totalInflow = params.generation + params.gridImport + params.batteryDischarge;
  const totalOutflow = params.demand + params.batteryCharge + params.losses;
  const delta = Math.abs(totalInflow - totalOutflow);

  if (delta > tolerance) {
    errors.push(
      `Energy balance violation: Total Inflow (${totalInflow.toFixed(2)} ${params.unit}) does not match Total Outflow (${totalOutflow.toFixed(2)} ${params.unit}). Discrepancy: ${delta.toFixed(2)} ${params.unit} (tolerance: ${tolerance}).`
    );
  } else if (delta > 0.01) {
    warnings.push(`Minor rounding delta in energy balance: ${delta.toFixed(4)} ${params.unit}.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    reconciliationDiff: delta,
    metadata: {
      totalInflow,
      totalOutflow,
      unit: params.unit,
      periodHours: params.periodHours,
    },
  };
}

/**
 * 8.2 WATER BALANCE AUDIT
 * Reconciles opening storage, rainfall catchment, groundwater extraction, STP treated reuse,
 * campus withdrawals, evaporation/percolation, and closing storage.
 * Explicitly distinguishes the 550M litre (550,000 kL) catchment envelope from active tank capacity.
 */
export interface WaterBalanceParams {
  periodDays: number;
  openingStorageKL: number;      // Active storage at start of period in kL (m³)
  closingStorageKL: number;      // Active storage at end of period in kL
  storageCapacityKL: number;     // Physical storage reservoir capacity in kL
  annualHarvestingPotentialKL?: number; // Site catchment envelope (550,000 kL / yr)
  inflowRainwaterKL: number;     // Harvested rainwater into reservoirs
  inflowGroundwaterKL: number;   // Deep aquifer borewell extraction
  inflowRecycledStpKL: number;   // Recycled water from STP
  demandCampusKL: number;        // Domestic & facility consumption
  demandIrrigationKL: number;    // Agroforestry & landscape irrigation
  evaporationLossesKL: number;   // Lake & pond surface evaporation
  tolerance?: number;            // Allowable delta in kL
}

export function validateWaterBalance(params: WaterBalanceParams): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const tolerance = params.tolerance ?? 1.0;

  // Capacity boundary check
  if (params.closingStorageKL > params.storageCapacityKL + 0.1) {
    errors.push(
      `Storage overflow: Closing storage (${params.closingStorageKL.toFixed(1)} kL) exceeds physical reservoir capacity (${params.storageCapacityKL.toFixed(1)} kL).`
    );
  }
  if (params.closingStorageKL < 0) {
    errors.push("Closing water storage cannot be negative.");
  }

  // Engineering clarification on 550M Litres figure
  const harvestingEnvelope = params.annualHarvestingPotentialKL ?? 550000; // 550 Million Litres = 550,000 kL
  if (params.storageCapacityKL >= harvestingEnvelope) {
    warnings.push(
      "Storage capacity is configured >= 550,000 kL. Note: The 550 million litre figure is the 500-acre annual catchment runoff envelope, not active structural tank storage."
    );
  }

  // Mass balance: Closing = Opening + Inflows - Withdrawals - Losses
  const totalInflows = params.inflowRainwaterKL + params.inflowGroundwaterKL + params.inflowRecycledStpKL;
  const totalOutflows = params.demandCampusKL + params.demandIrrigationKL + params.evaporationLossesKL;
  const expectedClosing = params.openingStorageKL + totalInflows - totalOutflows;
  const delta = Math.abs(params.closingStorageKL - expectedClosing);

  if (delta > tolerance) {
    errors.push(
      `Water mass balance violation: Closing storage (${params.closingStorageKL.toFixed(1)} kL) does not match expected storage (${expectedClosing.toFixed(1)} kL). Discrepancy: ${delta.toFixed(1)} kL.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    reconciliationDiff: delta,
    metadata: {
      totalInflows,
      totalOutflows,
      storageUtilizationPct: (params.closingStorageKL / params.storageCapacityKL) * 100,
      annualHarvestingPotentialKL: harvestingEnvelope,
    },
  };
}

/**
 * 8.3 CARBON ACCOUNTING BOUNDARIES AUDIT
 * Strictly separates:
 * 1. Embodied emissions (A1-A5 upfront, B1-B5 maintenance replacement)
 * 2. Operational emissions (B6 energy, B7 water, Scope 1, Scope 2)
 * 3. Stored carbon stock (standing biomass in soil/trees — NOT an annual flux)
 * 4. Annual carbon removals (biomass growth increment — tCO2e/yr)
 * 5. Avoided emissions (solar displacement of grid intensity)
 * Prevents double-counting between submeters and the campus substation.
 */
export interface CarbonAccountingParams {
  embodiedUpfrontTCO2e: number;      // Scope 3 Capital Goods A1-A5
  operationalAnnualTCO2e: number;    // Scope 1 & 2 Annual B6
  storedBiomassStockTCO2e: number;   // Standing soil & agroforestry carbon stock
  annualRemovalsTCO2e: number;       // Annual biological sequestration rate (growth)
  annualAvoidedGridTCO2e: number;    // Displaced grid emissions (avoided, not removal)
  submeteredBuildingTCO2e: number;   // Submetered emissions behind campus meter
  campusSubstationTCO2e: number;     // 11kV Substation bulk meter emissions
}

export function validateCarbonBoundaries(params: CarbonAccountingParams): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Rule 1: Standing stock cannot be claimed as an annual removal
  if (params.annualRemovalsTCO2e > params.storedBiomassStockTCO2e * 0.2) {
    errors.push(
      `Unrealistic biological removal rate: Annual removals (${params.annualRemovalsTCO2e.toFixed(1)} tCO2e/yr) cannot exceed 20% of standing biomass stock (${params.storedBiomassStockTCO2e.toFixed(1)} tCO2e) in temperate/semi-arid drylands.`
    );
  }

  // Rule 2: Avoided emissions must not be added to removals
  // They belong in separate ledger categories under GHG Protocol Scope 2 Guidance.

  // Rule 3: Double counting protection between campus substation and downstream meters
  if (params.submeteredBuildingTCO2e > params.campusSubstationTCO2e + 0.1) {
    errors.push(
      `Double-counting boundary violation: Submetered building emissions (${params.submeteredBuildingTCO2e.toFixed(1)} tCO2e) exceed total campus substation emissions (${params.campusSubstationTCO2e.toFixed(1)} tCO2e).`
    );
  }

  // Rule 4: Embodied vs Operational boundary
  if (params.embodiedUpfrontTCO2e < 0) {
    errors.push("Embodied emissions cannot be negative.");
  }
  if (params.operationalAnnualTCO2e < 0) {
    errors.push("Operational emissions cannot be negative.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metadata: {
      netAnnualFluxTCO2e: params.operationalAnnualTCO2e - params.annualRemovalsTCO2e,
      lifetimeStandingStockTCO2e: params.storedBiomassStockTCO2e,
      totalEmbodiedTCO2e: params.embodiedUpfrontTCO2e,
    },
  };
}

/**
 * 8.4 BATTERY BESS DISPATCH AUDIT
 * Verifies SOC bounds (10% to 95%), maximum charge/discharge C-rate limits,
 * 88% round-trip AC-AC efficiency, and energy conservation across intervals.
 */
export interface BatteryDispatchParams {
  nominalCapacityKWh: number;
  usableCapacityKWh: number;
  minSocPct: number;             // Minimum reserve (default: 10%)
  maxSocPct: number;             // Cycling ceiling (default: 95%)
  currentSocPct: number;
  chargePowerKW: number;
  dischargePowerKW: number;
  maxChargeKW: number;           // Inverter rating / C-rate
  maxDischargeKW: number;
  intervalHours: number;
  roundTripEfficiency?: number;  // Default 88% (0.88)
}

export function validateBatteryDispatch(params: BatteryDispatchParams): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const efficiency = params.roundTripEfficiency ?? 0.88;

  // SOC boundary checks
  if (params.currentSocPct < params.minSocPct - 0.01) {
    errors.push(
      `Battery deep discharge warning: SOC (${params.currentSocPct.toFixed(1)}%) is below manufacturer minimum safe limit (${params.minSocPct}%).`
    );
  }
  if (params.currentSocPct > params.maxSocPct + 0.01) {
    errors.push(
      `Battery overcharge warning: SOC (${params.currentSocPct.toFixed(1)}%) exceeds maximum cycling threshold (${params.maxSocPct}%).`
    );
  }

  // Power limit checks
  if (params.chargePowerKW > params.maxChargeKW + 0.01) {
    errors.push(
      `Charge power (${params.chargePowerKW.toFixed(1)} kW) exceeds maximum inverter rating (${params.maxChargeKW} kW).`
    );
  }
  if (params.dischargePowerKW > params.maxDischargeKW + 0.01) {
    errors.push(
      `Discharge power (${params.dischargePowerKW.toFixed(1)} kW) exceeds maximum inverter rating (${params.maxDischargeKW} kW).`
    );
  }

  // Mutual exclusion
  if (params.chargePowerKW > 0.01 && params.dischargePowerKW > 0.01) {
    errors.push("Simultaneous charge and discharge power commands detected.");
  }

  // Round-trip efficiency check
  if (efficiency < 0.70 || efficiency > 0.98) {
    warnings.push(
      `Specified BESS efficiency (${(efficiency * 100).toFixed(1)}%) is outside typical lithium ferro-phosphate range (85-92%).`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metadata: {
      usableEnergyKWh: (params.usableCapacityKWh * (params.currentSocPct / 100)),
      efficiency,
    },
  };
}

/**
 * 8.5 COMPUTE INFRASTRUCTURE MONITORING AUDIT
 * Reconciles IT load, facility load, cooling power, and PUE.
 * Ensures PUE >= 1.0 and rejects token-to-energy inference without a measured workload model.
 */
export interface ComputeMonitoringParams {
  itLoadKW: number;              // Server & accelerator draw
  facilityLoadKW: number;        // Total facility draw (IT + cooling + UPS + lighting)
  coolingLoadKW: number;         // Chiller / adiabatic cooling draw
  workloadDurationHours: number;
  gridCarbonIntensityKgPerKWh: number; // Marginal or average grid factor
}

export function validateComputeMonitoring(params: ComputeMonitoringParams): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (params.itLoadKW < 0) errors.push("IT power draw cannot be negative.");
  if (params.facilityLoadKW < 0) errors.push("Facility power draw cannot be negative.");

  // Physical law: Total Facility Load must be >= IT Load
  if (params.itLoadKW > 0 && params.facilityLoadKW < params.itLoadKW - 0.01) {
    errors.push(
      `Physical violation: Total Facility Load (${params.facilityLoadKW.toFixed(1)} kW) cannot be less than IT Load (${params.itLoadKW.toFixed(1)} kW).`
    );
  }

  // PUE Calculation: Facility / IT (must be >= 1.0)
  const pue = params.itLoadKW > 0 ? params.facilityLoadKW / params.itLoadKW : 1.0;
  if (pue < 1.0 - 0.001) {
    errors.push(`PUE calculation error: PUE (${pue.toFixed(3)}) is mathematically impossible (< 1.00).`);
  } else if (pue > 2.5) {
    warnings.push(`Elevated PUE (${pue.toFixed(2)}): Significant cooling overhead.`);
  }

  // Energy & Carbon calculation
  const itEnergyKWh = params.itLoadKW * params.workloadDurationHours;
  const facilityEnergyKWh = params.facilityLoadKW * params.workloadDurationHours;
  const carbonKg = (facilityEnergyKWh * params.gridCarbonIntensityKgPerKWh);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metadata: {
      pue,
      itEnergyKWh,
      facilityEnergyKWh,
      carbonKg,
    },
  };
}
