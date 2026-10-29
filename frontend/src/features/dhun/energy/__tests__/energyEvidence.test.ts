/* ============================================================
   DHUN CARBON TWIN OS — ENERGY EVIDENCE TEST SUITE
   Validates:
   1. The 3 historical JVVNL electricity bills (Feb 2022).
   2. Aggregate calculations (11,132.13 kWh, 190 kW, ₹142,958.78).
   3. Financial reconciliation & arrears separation.
   4. Meter reading delta checks & CT multiplier identification.
   5. Dhun baseline reconciliation & tariff variance.
   6. Campus stacked energy calculations with compute commons.
   ============================================================ */

declare const process: any;
import {
  HISTORICAL_REFERENCE_BILLS,
  calculateAggregateBills,
  reconcileBaselineWithEvidence,
  calculateStackedCampusDemand,
  maskAccountNumber,
} from "../energyEvidenceEngine";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(message);
  }
}

let passedCount = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ [PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}:`, err);
    throw err;
  }
}

console.log("\n=================================================");
console.log("  DHUN TWIN OS — ENERGY EVIDENCE VERIFICATION SUITE");
console.log("=================================================\n");

// --- 1. BILL RECORDS INTEGRITY ---

test("Bill 1 (Vastu Farms): accurately records 30 kW connected load and 1,490.4 kWh", () => {
  const bill = HISTORICAL_REFERENCE_BILLS.find((b) => b.propertyId === "prop-vastu-farms")!;
  assert(bill !== undefined, "Vastu Farms record must exist");
  assert(bill.connectedLoadKw === 30, "Connected load must be 30 kW");
  assert(bill.recordedBillingDemandKw === 22.5, "Recorded demand must be 22.5 kW");
  assert(bill.consumptionKwh === 1490.4, "Consumption must be 1,490.4 kWh");
  assert(bill.currentBillAmount === 21203.49, "Current bill amount must be ₹21,203.49");
  assert(bill.previousArrears === 0, "Previous arrears must be ₹0");
  assert(bill.powerFactor === 0.923, "Power factor must be 0.923");
});

test("Bill 2 (Vastu Resorts): accurately records 60 kW load, ₹71,919.43 arrears, and ₹61,638.88 current", () => {
  const bill = HISTORICAL_REFERENCE_BILLS.find((b) => b.propertyId === "prop-vastu-resorts")!;
  assert(bill !== undefined, "Vastu Resorts record must exist");
  assert(bill.connectedLoadKw === 60, "Connected load must be 60 kW");
  assert(bill.recordedBillingDemandKw === 45, "Recorded demand must be 45 kW");
  assert(bill.consumptionKwh === 4949.1, "Consumption must be 4,949.1 kWh");
  assert(bill.currentBillAmount === 61638.88, "Current bill must be ₹61,638.88");
  assert(bill.previousArrears === 71919.43, "Previous arrears must be ₹71,919.43");
  assert(bill.totalAmountPayable === 136096.0, "Reported total payable must be ₹1,36,096.00");
  assert(bill.powerFactor === 0.88, "Power factor must be 0.880");
});

test("Bill 3 (Vastu Abode): accurately records 100 kW load and 4,692.63 kWh consumption", () => {
  const bill = HISTORICAL_REFERENCE_BILLS.find((b) => b.propertyId === "prop-vastu-abode")!;
  assert(bill !== undefined, "Vastu Abode record must exist");
  assert(bill.connectedLoadKw === 100, "Connected load must be 100 kW");
  assert(bill.recordedBillingDemandKw === 56.25, "Recorded demand must be 56.25 kW");
  assert(bill.consumptionKwh === 4692.63, "Consumption must be 4,692.63 kWh");
  assert(bill.currentBillAmount === 60116.41, "Current bill must be ₹60,116.41");
  assert(bill.previousArrears === 0, "Previous arrears must be ₹0");
  assert(bill.powerFactor === 0.955, "Power factor must be 0.955");
});

// --- 2. AGGREGATE CALCULATIONS ---

test("Aggregate: Combined monthly consumption equals 11,132.13 kWh (11.13213 MWh)", () => {
  const agg = calculateAggregateBills(HISTORICAL_REFERENCE_BILLS);
  const diff = Math.abs(agg.combinedMonthlyKwh - 11132.13);
  assert(diff < 0.001, `Combined kWh must be 11,132.13 (got ${agg.combinedMonthlyKwh})`);
  assert(
    Math.abs(agg.combinedMonthlyMwh - 11.13213) < 0.00001,
    `Combined MWh must be 11.13213 (got ${agg.combinedMonthlyMwh})`
  );
});

test("Aggregate: Combined connected capacity equals 190.0 kW", () => {
  const agg = calculateAggregateBills(HISTORICAL_REFERENCE_BILLS);
  assert(agg.combinedConnectedCapacityKw === 190, `Combined capacity must be 190 kW (got ${agg.combinedConnectedCapacityKw})`);
});

test("Aggregate: Sum of recorded billing demand equals 123.75 kW (arithmetic sum)", () => {
  const agg = calculateAggregateBills(HISTORICAL_REFERENCE_BILLS);
  assert(
    agg.sumRecordedBillingDemandKw === 123.75,
    `Sum of billing demand must be 123.75 kW (got ${agg.sumRecordedBillingDemandKw})`
  );
});

test("Aggregate: Sum of current bill amounts equals ₹142,958.78", () => {
  const agg = calculateAggregateBills(HISTORICAL_REFERENCE_BILLS);
  const diff = Math.abs(agg.sumCurrentBillAmount - 142958.78);
  assert(diff < 0.01, `Current bill sum must be ₹142,958.78 (got ${agg.sumCurrentBillAmount})`);
});

test("Aggregate: Previous arrears sum equals ₹71,919.43", () => {
  const agg = calculateAggregateBills(HISTORICAL_REFERENCE_BILLS);
  const diff = Math.abs(agg.sumPreviousArrears - 71919.43);
  assert(diff < 0.01, `Arrears sum must be ₹71,919.43 (got ${agg.sumPreviousArrears})`);
});

test("Aggregate: Effective bill-to-consumption ratio equals ~₹12.842/kWh", () => {
  const agg = calculateAggregateBills(HISTORICAL_REFERENCE_BILLS);
  const expectedRate = 142958.78 / 11132.13; // ~12.8420...
  assert(
    Math.abs(agg.effectiveBillRatePerKwh - expectedRate) < 0.001,
    `Effective rate must be ~₹12.84/kWh (got ${agg.effectiveBillRatePerKwh.toFixed(4)})`
  );
});

// --- 3. FINANCIAL RECONCILIATION & DISCREPANCIES ---

test("Financial Reconciliation: Vastu Resorts flags ₹2,537.69 unreconciled difference", () => {
  const bill = HISTORICAL_REFERENCE_BILLS.find((b) => b.propertyId === "prop-vastu-resorts")!;
  const recon = bill.financialReconciliation;
  assert(!recon.isReconciled, "Vastu Resorts must be flagged as NOT reconciled");
  const diff = Math.abs(recon.unreconciledDifference - 2537.69);
  assert(diff < 0.01, `Discrepancy must be ₹2,537.69 (got ${recon.unreconciledDifference})`);
  assert(recon.arithmeticSum === 133558.31, "Sum of current + arrears must be ₹1,33,558.31");
});

test("Financial Reconciliation: Vastu Farms and Vastu Abode have zero discrepancy", () => {
  const farms = HISTORICAL_REFERENCE_BILLS.find((b) => b.propertyId === "prop-vastu-farms")!;
  const abode = HISTORICAL_REFERENCE_BILLS.find((b) => b.propertyId === "prop-vastu-abode")!;
  assert(farms.financialReconciliation.isReconciled, "Vastu Farms must be reconciled");
  assert(farms.financialReconciliation.unreconciledDifference === 0, "Farms discrepancy must be 0");
  assert(abode.financialReconciliation.isReconciled, "Vastu Abode must be reconciled");
  assert(abode.financialReconciliation.unreconciledDifference === 0, "Abode discrepancy must be 0");
});

test("Arrears Isolation: total payable with arrears is never treated as recurring monthly energy cost", () => {
  const resorts = HISTORICAL_REFERENCE_BILLS.find((b) => b.propertyId === "prop-vastu-resorts")!;
  assert(
    resorts.currentBillAmount < resorts.totalAmountPayable,
    "Current charges must exclude arrears"
  );
  assert(
    resorts.effectiveRatePerKwh === resorts.currentBillAmount / resorts.consumptionKwh,
    "Effective rate must be based solely on current billing charges"
  );
});

// --- 4. METER READING VALIDATION CHECKS ---

test("Meter Validation: Vastu Farms identifies 3.0x CT ratio (496.8 kWh delta × 3 = 1490.4 kWh)", () => {
  const farms = HISTORICAL_REFERENCE_BILLS.find((b) => b.propertyId === "prop-vastu-farms")!;
  const m = farms.meterReadings;
  assert(Math.abs((m.currentReadingKwh - m.previousReadingKwh) - 496.8) < 0.001, "Meter difference must be ~496.8");
  assert(m.inferredMultiplier === 3.0, "Multiplier must be 3.0");
  assert(m.readingMatchesPrinted, "Multiplied reading matches printed consumption exactly");
});

test("Meter Validation: Vastu Resorts flags +0.6 kWh discrepancy between readings and printed", () => {
  const resorts = HISTORICAL_REFERENCE_BILLS.find((b) => b.propertyId === "prop-vastu-resorts")!;
  const m = resorts.meterReadings;
  const rawDiff = m.currentReadingKwh - m.previousReadingKwh; // 4,949.7
  assert(Math.abs(rawDiff - 4949.7) < 0.01, `Meter delta must be 4,949.7 kWh (got ${rawDiff})`);
  assert(!m.readingMatchesPrinted, "Must flag mismatch between readings and printed consumption");
  assert(Math.abs(m.readingDiscrepancyKwh - 0.6) < 0.01, "Discrepancy must be 0.6 kWh");
});

test("Meter Validation: Vastu Abode meter difference matches printed consumption exactly (4,692.63 kWh)", () => {
  const abode = HISTORICAL_REFERENCE_BILLS.find((b) => b.propertyId === "prop-vastu-abode")!;
  const m = abode.meterReadings;
  const rawDiff = m.currentReadingKwh - m.previousReadingKwh;
  assert(Math.abs(rawDiff - 4692.63) < 0.01, "Meter delta matches printed consumption exactly");
  assert(m.readingMatchesPrinted, "Reading matches printed flag is true");
  assert(m.readingDiscrepancyKwh === 0, "Zero discrepancy");
});

// --- 5. DHUN BASELINE RECONCILIATION ---

test("Baseline Calibration: Dhun working spend (₹2.5L/mo @ ₹10/kWh) produces 300 MWh/year", () => {
  const recon = reconcileBaselineWithEvidence(250000, 10.0);
  assert(recon.dhunDerivedMonthlyKwh === 25000, "Derived monthly must be 25,000 kWh");
  assert(recon.dhunDerivedAnnualMwh === 300, "Derived annual must be 300 MWh/yr");
});

test("Baseline Calibration: compares Dhun 300 MWh/yr with reference 133.59 MWh/yr", () => {
  const recon = reconcileBaselineWithEvidence(250000, 10.0);
  const diff = Math.abs(recon.referenceAnnualMwh - 133.58556);
  assert(diff < 0.01, `Reference annualised must be ~133.59 MWh/yr (got ${recon.referenceAnnualMwh})`);
  assert(recon.consumptionDifferenceMwh > 166, "Dhun assumption exceeds reference sum by >166 MWh");
});

test("Baseline Calibration: flags reference rate (₹12.84/kWh) vs Dhun working assumption (₹10.00/kWh)", () => {
  const recon = reconcileBaselineWithEvidence(250000, 10.0);
  assert(
    recon.referenceEffectiveRate > 12.84 && recon.referenceEffectiveRate < 12.85,
    "Reference effective rate is ~₹12.84/kWh"
  );
  assert(recon.tariffDifferencePerKwh < -2.8, "Dhun tariff is ~₹2.84/kWh lower than reference");
  assert(recon.verdict === "INCOMPARABLE", "Reconciliation verdict is INCOMPARABLE (unmetered site)");
});

// --- 6. STACKED CAMPUS ENERGY MODEL ---

test("Campus Stacked: Pilot compute yields ~852.5 MWh/yr total campus demand (300 + 524 + 28.47)", () => {
  const model = calculateStackedCampusDemand(300, 524, true, 28.47, "Compute Pilot (5 kW)");
  assert(
    Math.abs(model.totalCampusDemandMwh - 852.47) < 0.01,
    `Pilot total must be 852.47 MWh (got ${model.totalCampusDemandMwh})`
  );
  assert(model.totalElectricityCostLakh === 85.247, "Annual cost at ₹10/kWh is ₹85.247 Lakh");
});

test("Campus Stacked: Phase 1 compute yields ~1,051.8 MWh/yr total campus demand (300 + 524 + 227.76)", () => {
  const model = calculateStackedCampusDemand(300, 524, true, 227.76, "Phase 1 Reference (20 kW)");
  assert(
    Math.abs(model.totalCampusDemandMwh - 1051.76) < 0.01,
    `Phase 1 total must be 1,051.76 MWh (got ${model.totalCampusDemandMwh})`
  );
  assert(model.totalElectricityCostLakh === 105.176, "Annual cost at ₹10/kWh is ₹105.176 Lakh");
});

test("Campus Stacked: Expansion compute yields ~1,393.4 MWh/yr total campus demand (300 + 524 + 569.4)", () => {
  const model = calculateStackedCampusDemand(300, 524, true, 569.4, "Expansion Scenario (50 kW)");
  assert(
    Math.abs(model.totalCampusDemandMwh - 1393.4) < 0.01,
    `Expansion total must be 1,393.4 MWh (got ${model.totalCampusDemandMwh})`
  );
  assert(model.totalElectricityCostLakh === 139.34, "Annual cost at ₹10/kWh is ₹139.34 Lakh");
});

test("Campus Stacked: Planned buildings can be independently excluded from calculation", () => {
  const model = calculateStackedCampusDemand(300, 524, false, 227.76, "Phase 1 Reference (20 kW)");
  assert(
    Math.abs(model.totalCampusDemandMwh - 527.76) < 0.01,
    `Excluding planned buildings must yield 527.76 MWh (got ${model.totalCampusDemandMwh})`
  );
});

// --- 7. SECURITY & PRIVACY ---

test("Privacy: Consumer account numbers are masked for UI display", () => {
  assert(maskAccountNumber("05910044") === "•••0044", "Masks account number to last 4 digits");
  assert(maskAccountNumber("210532020051") === "•••0051", "Masks connection ID to last 4 digits");
});

console.log("\n=================================================");
console.log(`  ALL ${passedCount} ENERGY EVIDENCE TESTS PASSED SUCCESSFULLY!`);
console.log("=================================================\n");
