/* ============================================================
   DHUN TWIN OS — COMPUTE COMMONS VERIFICATION TEST SUITE
   Automated verification for compute scenario modeling, PUE
   overhead, electricity cost calculations, campus energy totals,
   solar coincidence, and input constraint validation.
   ============================================================ */

declare const process: any;
import {
  calculateComputeScenario,
  calculateCampusEnergyImpact,
  calculateSolarBatteryInteraction,
  COMPUTE_DEFAULT_SCENARIOS,
  type ComputeScenarioInputs,
} from "../computeCommonsEngine";
import { GRID_FACTOR } from "../../data/constants";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passedCount++;
    console.log(`✓ [PASS] ${testName}`);
  } else {
    failedCount++;
    console.error(`✗ [FAIL] ${testName}${detail ? `: ${detail}` : ""}`);
  }
}

console.log("\n=================================================");
console.log("  DHUN TWIN OS — COMPUTE COMMONS VERIFICATION SUITE");
console.log("=================================================\n");

// -------------------------------------------------------------
// Test 1: Scenario A - Compute Pilot (5 kW, 12h/day, 365 days, PUE 1.30, ₹10/kWh)
// -------------------------------------------------------------
{
  const pilot = COMPUTE_DEFAULT_SCENARIOS.pilot;
  const out = calculateComputeScenario(pilot);

  assert(out.annualOperatingHours === 4380, "Pilot: annual operating hours equals 4,380 h (12h × 365d)");
  assert(out.annualItEnergyKwh === 21900, "Pilot: annual IT energy equals 21,900 kWh (5 kW × 4,380 h)");
  assert(
    Math.abs(out.annualFacilityEnergyKwh - 28470) < 0.01,
    "Pilot: annual facility energy equals 28,470 kWh (~28.5 MWh) at PUE 1.30"
  );
  assert(
    Math.abs(out.annualFacilityEnergyMwh - 28.47) < 0.01,
    "Pilot: annual facility energy in MWh equals 28.47 MWh"
  );
  assert(
    Math.abs(out.annualFacilityOverheadKwh - 6570) < 0.01,
    "Pilot: facility overhead equals 6,570 kWh (28,470 - 21,900)"
  );
  assert(out.avgFacilityDemandKw === 6.5, "Pilot: average facility demand equals 6.5 kW (5 kW × 1.30)");
  assert(
    out.annualElectricityCostInr === 284700,
    "Pilot: annual electricity cost equals ₹2,84,700 (~₹2.85 Lakh)"
  );
  assert(
    Math.abs(out.annualElectricityCostLakh - 2.847) < 0.001,
    "Pilot: annual cost in Lakh equals ₹2.847 Lakh"
  );
  assert(
    Math.abs(out.monthlyFacilityEnergyKwh - 2372.5) < 0.01,
    "Pilot: monthly facility energy equals 2,372.5 kWh (28,470 / 12)"
  );
  assert(
    Math.abs(out.monthlyElectricityCostInr - 23725) < 0.01,
    "Pilot: monthly electricity cost equals ₹23,725 (284,700 / 12)"
  );
}

// -------------------------------------------------------------
// Test 2: Scenario B - Phase 1 Reference (20 kW, 24h/day, 365 days, PUE 1.30, ₹10/kWh)
// -------------------------------------------------------------
{
  const p1 = COMPUTE_DEFAULT_SCENARIOS.phase1;
  const out = calculateComputeScenario(p1);

  assert(out.annualOperatingHours === 8760, "Phase 1: annual operating hours equals 8,760 h (24h × 365d)");
  assert(out.annualItEnergyKwh === 175200, "Phase 1: annual IT energy equals 175,200 kWh (20 kW × 8,760 h)");
  assert(
    Math.abs(out.annualFacilityEnergyKwh - 227760) < 0.01,
    "Phase 1: annual facility energy equals 227,760 kWh (~227.8 MWh)"
  );
  assert(
    Math.abs(out.annualFacilityEnergyMwh - 227.76) < 0.01,
    "Phase 1: annual facility energy in MWh equals 227.76 MWh"
  );
  assert(
    Math.abs(out.annualFacilityOverheadKwh - 52560) < 0.01,
    "Phase 1: annual facility overhead equals 52,560 kWh"
  );
  assert(out.avgFacilityDemandKw === 26.0, "Phase 1: average facility demand equals 26.0 kW (20 kW × 1.30)");
  assert(
    out.annualElectricityCostInr === 2277600,
    "Phase 1: annual electricity cost equals ₹22,77,600 (~₹22.8 Lakh)"
  );
  assert(
    Math.abs(out.annualElectricityCostLakh - 22.776) < 0.001,
    "Phase 1: annual cost in Lakh equals ₹22.776 Lakh"
  );
  assert(
    Math.abs(out.monthlyFacilityEnergyKwh - 18980) < 0.01,
    "Phase 1: monthly facility energy equals 18,980 kWh (227,760 / 12)"
  );
  assert(
    Math.abs(out.monthlyElectricityCostInr - 189800) < 0.01,
    "Phase 1: monthly electricity cost equals ₹1,89,800 (2,277,600 / 12)"
  );
}

// -------------------------------------------------------------
// Test 3: Scenario C - Expansion Scenario (50 kW, 24h/day, 365 days, PUE 1.30, ₹10/kWh)
// -------------------------------------------------------------
{
  const exp = COMPUTE_DEFAULT_SCENARIOS.expansion;
  const out = calculateComputeScenario(exp);

  assert(out.annualOperatingHours === 8760, "Expansion: annual operating hours equals 8,760 h (24h × 365d)");
  assert(out.annualItEnergyKwh === 438000, "Expansion: annual IT energy equals 438,000 kWh (50 kW × 8,760 h)");
  assert(
    Math.abs(out.annualFacilityEnergyKwh - 569400) < 0.01,
    "Expansion: annual facility energy equals 569,400 kWh (~569.4 MWh)"
  );
  assert(
    Math.abs(out.annualFacilityEnergyMwh - 569.4) < 0.01,
    "Expansion: annual facility energy in MWh equals 569.4 MWh"
  );
  assert(
    Math.abs(out.annualFacilityOverheadKwh - 131400) < 0.01,
    "Expansion: annual facility overhead equals 131,400 kWh"
  );
  assert(out.avgFacilityDemandKw === 65.0, "Expansion: average facility demand equals 65.0 kW (50 kW × 1.30)");
  assert(
    out.annualElectricityCostInr === 5694000,
    "Expansion: annual electricity cost equals ₹56,94,000 (~₹56.9 Lakh)"
  );
  assert(
    Math.abs(out.annualElectricityCostLakh - 56.94) < 0.001,
    "Expansion: annual cost in Lakh equals ₹56.94 Lakh"
  );
  assert(
    Math.abs(out.monthlyFacilityEnergyKwh - 47450) < 0.01,
    "Expansion: monthly facility energy equals 47,450 kWh (569,400 / 12)"
  );
  assert(
    Math.abs(out.monthlyElectricityCostInr - 474500) < 0.01,
    "Expansion: monthly electricity cost equals ₹4,74,500 (5,694,000 / 12)"
  );
}

// -------------------------------------------------------------
// Test 4: Rated IT Capacity vs Average IT Load & Utilisation
// -------------------------------------------------------------
{
  const inputs: ComputeScenarioInputs = {
    id: "test-util",
    name: "Rated Utilisation Test",
    description: "Testing non-double-counted utilisation",
    inputMode: "ratedUtilisation",
    averageItLoadKw: 999, // Should be ignored when in ratedUtilisation mode
    ratedItCapacityKw: 40.0,
    averageUtilisationPct: 50.0, // 40 kW * 50% = 20 kW effective load
    operatingHoursPerDay: 24,
    operatingDaysPerYear: 365,
    pue: 1.30,
    electricityRateInrPerKwh: 10.0,
  };

  const out = calculateComputeScenario(inputs);
  assert(out.effectiveItLoadKw === 20.0, "Utilisation: correctly derives 20 kW from 40 kW @ 50% utilisation");
  assert(
    Math.abs(out.annualFacilityEnergyMwh - 227.76) < 0.01,
    "Utilisation: derives exact 227.76 MWh without double-counting utilization"
  );

  // Switch back to direct averageLoad mode
  const directInputs: ComputeScenarioInputs = {
    ...inputs,
    inputMode: "averageLoad",
    averageItLoadKw: 20.0,
  };
  const directOut = calculateComputeScenario(directInputs);
  assert(directOut.effectiveItLoadKw === 20.0, "Direct Load: correctly uses direct average IT load");
  assert(
    directOut.annualFacilityEnergyKwh === out.annualFacilityEnergyKwh,
    "Consistency: direct load and rated utilisation produce identical results"
  );
}

// -------------------------------------------------------------
// Test 5: Dynamic Parameter Changes (PUE, Tariff, Hours)
// -------------------------------------------------------------
{
  // Test PUE change: 1.30 -> 1.15
  const base = COMPUTE_DEFAULT_SCENARIOS.phase1;
  const efficientPue = calculateComputeScenario({ ...base, pue: 1.15 });
  assert(
    efficientPue.annualItEnergyKwh === 175200,
    "PUE Sensitivity: IT computing energy is invariant to PUE changes"
  );
  assert(
    Math.abs(efficientPue.annualFacilityEnergyKwh - 175200 * 1.15) < 0.01,
    "PUE Sensitivity: facility energy scales linearly with PUE (1.15)"
  );
  assert(
    efficientPue.annualFacilityOverheadKwh < calculateComputeScenario(base).annualFacilityOverheadKwh,
    "PUE Sensitivity: lower PUE strictly reduces facility cooling overhead"
  );

  // Test Tariff change: ₹10 -> ₹12.50
  const higherTariff = calculateComputeScenario({ ...base, electricityRateInrPerKwh: 12.5 });
  assert(
    higherTariff.annualFacilityEnergyKwh === calculateComputeScenario(base).annualFacilityEnergyKwh,
    "Tariff Sensitivity: tariff change does not alter physical energy consumption"
  );
  assert(
    higherTariff.annualElectricityCostInr === 227760 * 12.5,
    "Tariff Sensitivity: cost scales proportionally with new tariff rate"
  );

  // Test Schedule change: 12h -> 18h
  const extendedHours = calculateComputeScenario({ ...COMPUTE_DEFAULT_SCENARIOS.pilot, operatingHoursPerDay: 18 });
  assert(
    extendedHours.annualOperatingHours === 18 * 365,
    "Schedule Sensitivity: annual hours scale with operating hours per day"
  );
  assert(
    extendedHours.annualFacilityEnergyKwh === 5 * 18 * 365 * 1.3,
    "Schedule Sensitivity: energy scales proportionally with operating schedule"
  );
}

// -------------------------------------------------------------
// Test 6: Campus Energy Integration Totals (Pilot, Phase 1, Expansion)
// -------------------------------------------------------------
{
  // Campus totals formula: Existing campus (300 MWh) + Planned buildings (524 MWh) + Compute
  const pilotOut = calculateComputeScenario(COMPUTE_DEFAULT_SCENARIOS.pilot);
  const p1Out = calculateComputeScenario(COMPUTE_DEFAULT_SCENARIOS.phase1);
  const expOut = calculateComputeScenario(COMPUTE_DEFAULT_SCENARIOS.expansion);

  const pilotCampus = calculateCampusEnergyImpact(pilotOut.annualFacilityEnergyMwh);
  assert(
    Math.abs(pilotCampus.totalModelledCampusMwhYr - 852.47) < 0.1,
    "Campus Integration: Pilot total campus demand equals ~852.5 MWh/yr (300 + 524 + 28.5)"
  );

  const p1Campus = calculateCampusEnergyImpact(p1Out.annualFacilityEnergyMwh);
  assert(
    Math.abs(p1Campus.totalModelledCampusMwhYr - 1051.76) < 0.1,
    "Campus Integration: Phase 1 total campus demand equals ~1,051.8 MWh/yr (300 + 524 + 227.8)"
  );

  const expCampus = calculateCampusEnergyImpact(expOut.annualFacilityEnergyMwh);
  assert(
    Math.abs(expCampus.totalModelledCampusMwhYr - 1393.4) < 0.1,
    "Campus Integration: Expansion total campus demand equals ~1,393.4 MWh/yr (300 + 524 + 569.4)"
  );

  // Independent adjustment: toggle off planned buildings
  const withoutBuildings = calculateCampusEnergyImpact(p1Out.annualFacilityEnergyMwh, true, false);
  assert(
    withoutBuildings.plannedBuildingsMwhYr === 0,
    "Campus Integration: planned buildings can be independently toggled out"
  );
  assert(
    Math.abs(withoutBuildings.totalModelledCampusMwhYr - (300 + 227.76)) < 0.1,
    "Campus Integration: total recalculates cleanly without planned buildings"
  );
}

// -------------------------------------------------------------
// Test 7: Input Validation & Physical Bounds Enforcement
// -------------------------------------------------------------
{
  // PUE < 1.0 is physically impossible
  const invalidPue = calculateComputeScenario({
    ...COMPUTE_DEFAULT_SCENARIOS.pilot,
    pue: 0.8,
  });
  assert(
    !invalidPue.isValid,
    "Validation: flags PUE < 1.00 as physically invalid"
  );
  assert(
    invalidPue.validationErrors.some((e) => e.includes("PUE must be >= 1.00")),
    "Validation: provides clear thermodynamic rationale for PUE minimum"
  );

  // Operating hours > 24 is physically impossible in a standard day
  const invalidHours = calculateComputeScenario({
    ...COMPUTE_DEFAULT_SCENARIOS.pilot,
    operatingHoursPerDay: 28,
  });
  assert(
    !invalidHours.isValid,
    "Validation: flags operating hours > 24 as invalid"
  );

  // Negative tariff is rejected
  const negativeTariff = calculateComputeScenario({
    ...COMPUTE_DEFAULT_SCENARIOS.pilot,
    electricityRateInrPerKwh: -5,
  });
  assert(
    !negativeTariff.isValid,
    "Validation: flags negative electricity tariff as invalid"
  );
}

// -------------------------------------------------------------
// Test 8: Solar & Battery Interaction Modeling
// -------------------------------------------------------------
{
  const pilot = COMPUTE_DEFAULT_SCENARIOS.pilot;
  const pilotOut = calculateComputeScenario(pilot);
  const pilotSolar = calculateSolarBatteryInteraction(pilot, pilotOut);
  assert(
    pilotSolar.daytimeCoincidencePct === 75.0,
    "Solar Interaction: 12h daytime pilot achieves 75% solar coincidence"
  );

  const p1 = COMPUTE_DEFAULT_SCENARIOS.phase1;
  const p1Out = calculateComputeScenario(p1);
  const p1Solar = calculateSolarBatteryInteraction(p1, p1Out);
  assert(
    Math.abs(p1Solar.daytimeCoincidencePct - 37.5) < 0.1,
    "Solar Interaction: 24h continuous operation has ~38% solar coincidence"
  );
  assert(
    p1Solar.nighttimeBatteryCapacityNeededKwh > 0,
    "Solar Interaction: calculates dedicated BESS buffer needed for night load"
  );
}

// -------------------------------------------------------------
// Test 9: Grid Carbon Calculations
// -------------------------------------------------------------
{
  const p1Out = calculateComputeScenario(COMPUTE_DEFAULT_SCENARIOS.phase1);
  const expectedTons = (227760 * GRID_FACTOR) / 1000;
  assert(
    Math.abs(p1Out.annualCarbonEmissionsTons - expectedTons) < 0.01,
    "Carbon Accounting: annual emissions use verified Dhun grid factor (0.71 kg/kWh)"
  );
}

console.log("\n=================================================");
console.log(`  COMPUTE COMMONS TESTS: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log("=================================================\n");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
