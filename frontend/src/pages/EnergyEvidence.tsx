/* ============================================================
   DHUN CARBON TWIN OS — ENERGY INTELLIGENCE & BILL EVIDENCE
   Integrates historical JVVNL electricity invoices (Feb 2022),
   financial reconciliation, meter-reading verification checks,
   Dhun campus baseline calibration, and stacked infrastructure planning.
   ============================================================ */

import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  AlertTriangle,
  ShieldCheck,
  IndianRupee,
  Activity,
  ArrowRight,
  TrendingUp,
  Cpu,
  Layers,
} from "lucide-react";

import PageHeader from "../features/dhun/components/PageHeader";
import MetricStrip from "../features/dhun/components/MetricStrip";
import EvidenceBadge from "../features/dhun/components/EvidenceBadge";

import {
  HISTORICAL_REFERENCE_BILLS,
  calculateAggregateBills,
  reconcileBaselineWithEvidence,
  calculateStackedCampusDemand,
  maskAccountNumber,
} from "../features/dhun/energy/energyEvidenceEngine";
import {
  calculateComputeScenario,
  COMPUTE_DEFAULT_SCENARIOS,
  type ComputeScenarioId,
} from "../features/dhun/engine/computeCommonsEngine";
import { num } from "../features/dhun/lib/format";

export default function EnergyEvidence() {
  const [activeTab, setActiveTab] = useState<"bills" | "calibration" | "stacked" | "evidence">("bills");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("prop-vastu-resorts");
  
  // Interactive baseline calibration state
  const [dhunSpendMonthly, setDhunSpendMonthly] = useState<number>(250000);
  const [dhunTariffAssumption, setDhunTariffAssumption] = useState<number>(10.0);

  // Stacked campus model state
  const [selectedComputePreset, setSelectedComputePreset] = useState<ComputeScenarioId>("phase1");
  const [includePlannedBuildings, setIncludePlannedBuildings] = useState<boolean>(true);
  const [customExistingCampusMwh, setCustomExistingCampusMwh] = useState<number>(300);
  const [customPlannedBuildingsMwh, setCustomPlannedBuildingsMwh] = useState<number>(524);

  // Computed models
  const bills = HISTORICAL_REFERENCE_BILLS;
  const aggregates = useMemo(() => calculateAggregateBills(bills), [bills]);
  const reconciliation = useMemo(
    () => reconcileBaselineWithEvidence(dhunSpendMonthly, dhunTariffAssumption, bills),
    [dhunSpendMonthly, dhunTariffAssumption, bills]
  );

  const activeComputeScenarioInputs = COMPUTE_DEFAULT_SCENARIOS[selectedComputePreset];
  const activeComputeScenario = useMemo(
    () => calculateComputeScenario(activeComputeScenarioInputs),
    [activeComputeScenarioInputs]
  );

  const stackedCampus = useMemo(
    () =>
      calculateStackedCampusDemand(
        customExistingCampusMwh,
        customPlannedBuildingsMwh,
        includePlannedBuildings,
        activeComputeScenario.annualFacilityEnergyMwh,
        activeComputeScenarioInputs.name,
        dhunTariffAssumption
      ),
    [
      customExistingCampusMwh,
      customPlannedBuildingsMwh,
      includePlannedBuildings,
      activeComputeScenario,
      activeComputeScenarioInputs.name,
      dhunTariffAssumption,
    ]
  );

  const selectedBill = bills.find((b) => b.propertyId === selectedPropertyId) || bills[0];

  return (
    <div className="sheet">
      {/* Page Header */}
      <PageHeader
        index="06 · Energy & Bills"
        title="Energy Intelligence & Utility Bill Evidence"
        lede="Calibrate Dhun's energy baseline against empirical JVVNL utility invoices from comparable properties, verify meter reading ratios, isolate historical arrears, and model stacked campus electricity demand."
        aside={
          <>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-[11px] font-bold text-accent uppercase tracking-wider">
                Audited Reference Records
              </span>
            </div>
            <p className="text-[12px] text-ink-soft">
              Jaipur Vidyut Vitran Nigam Ltd · Feb 2022
            </p>
            <p className="font-mono text-[10px] text-muted">
              CEA Grid Factor: 0.71 kg CO₂e/kWh · Working Tariff: ₹10/kWh
            </p>
          </>
        }
      />

      {/* Aggregate Metric Strip */}
      <MetricStrip
        metrics={[
          {
            label: "Combined Monthly Consumption",
            value: num(aggregates.combinedMonthlyMwh, 2),
            unit: "MWh/mo",
            note: `${num(aggregates.combinedMonthlyKwh, 1)} kWh across 3 properties`,
            domain: "energy",
          },
          {
            label: "Combined Sanctioned Load",
            value: String(aggregates.combinedConnectedCapacityKw),
            unit: "kW",
            note: "Contracted utility demand",
            domain: "energy",
          },
          {
            label: "Sum of Recorded Demand",
            value: String(aggregates.sumRecordedBillingDemandKw),
            unit: "kW",
            note: "Arithmetic sum (non-coincident)",
            domain: "energy",
          },
          {
            label: "Effective Bill Rate",
            value: `₹${aggregates.effectiveBillRatePerKwh.toFixed(2)}`,
            unit: "/kWh",
            note: `Total current charges: ₹${num(aggregates.sumCurrentBillAmount, 2)}`,
            domain: "energy",
            tone: aggregates.effectiveBillRatePerKwh > 12 ? "warn" : "default",
          },
        ]}
      />

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-rule bg-surface-subtle px-6 pt-3 gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("bills")}
          className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "bills"
              ? "border-accent text-accent bg-surface rounded-t-[4px]"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <FileText size={15} />
          <span>Utility Bill Inspector (3 Properties)</span>
          {aggregates.hasActiveDiscrepancies && (
            <span className="ml-1 px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold">
              {aggregates.discrepancyCount} Flag
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("calibration")}
          className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "calibration"
              ? "border-accent text-accent bg-surface rounded-t-[4px]"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <TrendingUp size={15} />
          <span>Dhun Baseline Calibration</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("stacked")}
          className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "stacked"
              ? "border-accent text-accent bg-surface rounded-t-[4px]"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Layers size={15} />
          <span>Stacked Campus & Compute Demand</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("evidence")}
          className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "evidence"
              ? "border-accent text-accent bg-surface rounded-t-[4px]"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <ShieldCheck size={15} />
          <span>Evidence Provenance & Audit Log</span>
        </button>
      </div>

      {/* TAB 1: PROPERTY & BILL INSPECTOR */}
      {activeTab === "bills" && (
        <div className="p-6 space-y-6">
          {/* Property Selector Pills */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-4 rounded-lg border border-rule">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold uppercase tracking-wider text-muted">Select Property:</span>
              <div className="flex flex-wrap gap-2">
                {bills.map((bill) => (
                  <button
                    key={bill.propertyId}
                    type="button"
                    onClick={() => setSelectedPropertyId(bill.propertyId)}
                    className={`px-3.5 py-1.5 rounded-[4px] text-[12.5px] font-medium border transition-all cursor-pointer ${
                      selectedPropertyId === bill.propertyId
                        ? "bg-accent text-white border-accent shadow-xs"
                        : "bg-surface-subtle/50 text-ink border-rule hover:border-rule-strong"
                    }`}
                  >
                    {bill.propertyName}
                    {bill.verificationStatus === "DISCREPANCY_FLAGGED" && (
                      <span className="ml-1.5 text-amber-300 font-bold">⚠️</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-muted">
              <span>Account ID:</span>
              <span className="font-mono font-bold text-ink bg-surface-subtle px-2 py-0.5 rounded border border-rule">
                {maskAccountNumber(selectedBill.consumerAccount)}
              </span>
              <span>· Connection:</span>
              <span className="font-mono text-ink">
                {maskAccountNumber(selectedBill.connectionIdentifier)}
              </span>
            </div>
          </div>

          {/* Detailed Property Inspector Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 cols: Financial Breakdown & Verification */}
            <div className="lg:col-span-7 space-y-6">
              {/* Financial Breakdown Table */}
              <div className="panel border border-rule rounded-lg overflow-hidden">
                <div className="panel-head py-3 px-5 flex items-center justify-between">
                  <h3 className="text-[15px] font-semibold text-ink flex items-center gap-2">
                    <IndianRupee size={16} className="text-accent" />
                    <span>Billing Financial Breakdown — {selectedBill.propertyName}</span>
                  </h3>
                  <span className="font-mono text-[10.5px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-200">
                    Bill Recorded
                  </span>
                </div>

                <div className="p-5 space-y-4">
                  <table className="data-table w-full text-[13px]">
                    <tbody>
                      <tr className="border-b border-rule/60">
                        <td className="py-2.5 text-muted">Billing Period</td>
                        <td className="py-2.5 font-medium text-ink text-right">{selectedBill.billingPeriod.label}</td>
                      </tr>
                      <tr className="border-b border-rule/60">
                        <td className="py-2.5 text-muted">Sanctioned / Connected Load</td>
                        <td className="py-2.5 font-mono font-medium text-ink text-right">{selectedBill.connectedLoadKw} kW</td>
                      </tr>
                      <tr className="border-b border-rule/60">
                        <td className="py-2.5 text-muted">Recorded Billing Demand</td>
                        <td className="py-2.5 font-mono font-medium text-ink text-right">{selectedBill.recordedBillingDemandKw} kW</td>
                      </tr>
                      <tr className="border-b border-rule/60">
                        <td className="py-2.5 text-muted">Billed Consumption</td>
                        <td className="py-2.5 font-mono font-bold text-ink text-right">{num(selectedBill.consumptionKwh, 1)} kWh</td>
                      </tr>
                      <tr className="border-b border-rule/60">
                        <td className="py-2.5 text-muted">Power Factor</td>
                        <td className="py-2.5 font-mono font-medium text-right">
                          <span className={selectedBill.powerFactor < 0.9 ? "text-amber-700 font-bold" : "text-emerald-700 font-bold"}>
                            {selectedBill.powerFactor.toFixed(3)}
                          </span>
                          {selectedBill.powerFactor < 0.9 && (
                            <span className="ml-2 text-[10px] text-amber-700 font-normal">(Penalty threshold &lt;0.90)</span>
                          )}
                        </td>
                      </tr>
                      <tr className="border-b border-rule/60 bg-emerald-50/40">
                        <td className="py-2.5 font-semibold text-emerald-900">Current Period Bill Amount</td>
                        <td className="py-2.5 font-mono font-bold text-emerald-900 text-right">
                          ₹{num(selectedBill.currentBillAmount, 2)}
                        </td>
                      </tr>
                      <tr className="border-b border-rule/60">
                        <td className="py-2.5 text-muted">Previous Accumulated Arrears</td>
                        <td className="py-2.5 font-mono font-medium text-amber-800 text-right">
                          {selectedBill.previousArrears > 0 ? `₹${num(selectedBill.previousArrears, 2)}` : "₹0.00"}
                        </td>
                      </tr>
                      <tr className="border-b border-rule/60 bg-surface-subtle font-semibold">
                        <td className="py-3 text-ink">Total Amount Payable Reported</td>
                        <td className="py-3 font-mono text-[15px] font-bold text-ink text-right">
                          ₹{num(selectedBill.totalAmountPayable, 2)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 text-muted">Effective Rate (Current Bill ÷ kWh)</td>
                        <td className="py-2.5 font-mono font-bold text-accent text-right">
                          ₹{selectedBill.effectiveRatePerKwh.toFixed(2)}/kWh
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Arrears Note */}
                  <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-[4px] text-[11.5px] text-amber-900 leading-relaxed">
                    <strong>Arrears Separation Principle:</strong> Previous arrears (₹{num(selectedBill.previousArrears, 2)}) represent historical unpaid utility balances and are strictly excluded from the recurring cost of electricity consumed during February 2022.
                  </div>
                </div>
              </div>

              {/* Financial Discrepancy Alert for Vastu Resorts */}
              {!selectedBill.financialReconciliation.isReconciled && (
                <div className="p-5 bg-rose-50/80 border border-rose-300 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={20} className="text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <h4 className="text-[14px] font-bold text-rose-950">
                        Financial Reconciliation Discrepancy: ₹{num(selectedBill.financialReconciliation.unreconciledDifference, 2)}
                      </h4>
                      <p className="text-[12.5px] text-rose-900 leading-relaxed">
                        The arithmetic sum of the current bill (₹{num(selectedBill.currentBillAmount, 2)}) and reported arrears (₹{num(selectedBill.previousArrears, 2)}) is <strong>₹{num(selectedBill.financialReconciliation.arithmeticSum, 2)}</strong>.
                        However, the printed total amount payable on the JVVNL bill is <strong>₹{num(selectedBill.totalAmountPayable, 2)}</strong>.
                      </p>
                      <p className="text-[12px] text-rose-800 font-mono">
                        Difference: ₹{num(selectedBill.financialReconciliation.unreconciledDifference, 2)} (likely late payment surcharge / fuel surcharge adjustment).
                      </p>
                      <div className="text-[11px] font-medium text-rose-950 bg-rose-100/60 p-2 rounded">
                        Verification Status: Preserved transparently as reported. Do not force balance.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right 5 cols: Meter Reading Validation & CT Multipliers */}
            <div className="lg:col-span-5 space-y-6">
              <div className="panel border border-rule rounded-lg overflow-hidden">
                <div className="panel-head py-3 px-5 flex items-center justify-between">
                  <h3 className="text-[15px] font-semibold text-ink flex items-center gap-2">
                    <Activity size={16} className="text-accent" />
                    <span>Meter Reading Audit</span>
                  </h3>
                  <span className="font-mono text-[11px] text-muted">Physical Register</span>
                </div>

                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-surface-subtle/50 rounded border border-rule">
                      <div className="text-[11px] text-muted uppercase font-bold">Current Reading</div>
                      <div className="font-mono text-[16px] font-bold text-ink mt-0.5">
                        {num(selectedBill.meterReadings.currentReadingKwh, 1)}
                      </div>
                      <div className="text-[10px] text-faint">kWh</div>
                    </div>
                    <div className="p-3 bg-surface-subtle/50 rounded border border-rule">
                      <div className="text-[11px] text-muted uppercase font-bold">Previous Reading</div>
                      <div className="font-mono text-[16px] font-bold text-ink mt-0.5">
                        {num(selectedBill.meterReadings.previousReadingKwh, 1)}
                      </div>
                      <div className="text-[10px] text-faint">kWh</div>
                    </div>
                  </div>

                  <div className="p-4 bg-surface rounded border border-rule space-y-2.5 text-[12.5px]">
                    <div className="flex justify-between">
                      <span className="text-muted">Register Difference (Current − Prev):</span>
                      <span className="font-mono font-bold text-ink">
                        {num(selectedBill.meterReadings.differenceKwh, 1)} kWh
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-muted">Inferred CT Meter Multiplier:</span>
                      <span className="font-mono font-bold text-accent">
                        {selectedBill.meterReadings.inferredMultiplier.toFixed(1)}x
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-muted">Printed Billing Consumption:</span>
                      <span className="font-mono font-bold text-ink">
                        {num(selectedBill.meterReadings.printedConsumptionKwh, 1)} kWh
                      </span>
                    </div>

                    <div className="flex justify-between border-t border-rule/60 pt-2">
                      <span className="text-muted">Discrepancy:</span>
                      <span className={`font-mono font-bold ${
                        selectedBill.meterReadings.readingMatchesPrinted ? "text-emerald-700" : "text-rose-700"
                      }`}>
                        {selectedBill.meterReadings.readingDiscrepancyKwh === 0
                          ? "0.0 kWh (Exact Match)"
                          : `+${selectedBill.meterReadings.readingDiscrepancyKwh} kWh Discrepancy`}
                      </span>
                    </div>
                  </div>

                  <div className="text-[12px] text-ink-soft bg-surface-subtle/40 p-3 rounded border border-rule leading-relaxed">
                    {selectedBill.meterReadings.notes}
                  </div>

                  {/* Document Source Reference */}
                  <div className="text-[11px] text-muted space-y-1">
                    <div><strong>Source Document:</strong> {selectedBill.sourceDocument}</div>
                    <div><strong>Last Reviewed:</strong> {selectedBill.lastReviewed}</div>
                  </div>
                </div>
              </div>

              {/* Sanctioned vs Recorded Demand Note */}
              <div className="p-4 bg-surface border border-rule rounded-lg space-y-2 text-[12px] text-ink-soft">
                <div className="font-semibold text-ink flex items-center gap-1.5">
                  <ShieldCheck size={15} className="text-accent" />
                  <span>Billing Demand Distinction</span>
                </div>
                <p className="leading-relaxed">
                  Recorded billing demand ({selectedBill.recordedBillingDemandKw} kW) represents the maximum demand recorded by the meter during peak windows, which is distinct from the contracted connected load ({selectedBill.connectedLoadKw} kW).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DHUN BASELINE CALIBRATION & RECONCILIATION */}
      {activeTab === "calibration" && (
        <div className="p-6 space-y-6">
          <div className="bg-surface p-5 rounded-lg border border-rule space-y-4">
            <h3 className="text-[16px] font-semibold text-ink">
              Dhun Campus Energy Baseline Calibration
            </h3>
            <p className="text-[13px] text-ink-soft leading-relaxed max-w-4xl">
              The existing Dhun campus baseline of <strong>300 MWh/year</strong> is derived from a reported <strong>₹2.5 Lakh/month</strong> electricity expenditure divided by an assumed working tariff of <strong>₹10.00/kWh</strong>. Here, we reconcile that working assumption against the empirical evidence from the 3 historical JVVNL invoices.
            </p>

            {/* Interactive Inputs for Baseline Sensitivity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-surface-subtle/50 rounded border border-rule">
                <label className="text-[12px] font-semibold text-ink block mb-1">
                  Reported Dhun Monthly Electricity Spend
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={100000}
                    max={500000}
                    step={10000}
                    value={dhunSpendMonthly}
                    onChange={(e) => setDhunSpendMonthly(Number(e.target.value))}
                    className="range flex-1"
                  />
                  <span className="font-mono font-bold text-ink min-w-[100px] text-right">
                    ₹{num(dhunSpendMonthly / 100000, 2)} Lakh
                  </span>
                </div>
                <span className="text-[11px] text-muted mt-1 block">Default: ₹2.50 Lakh/month (reported estimate)</span>
              </div>

              <div className="p-4 bg-surface-subtle/50 rounded border border-rule">
                <label className="text-[12px] font-semibold text-ink block mb-1">
                  Assumed Electricity Tariff (₹/kWh)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={6}
                    max={16}
                    step={0.5}
                    value={dhunTariffAssumption}
                    onChange={(e) => setDhunTariffAssumption(Number(e.target.value))}
                    className="range flex-1"
                  />
                  <span className="font-mono font-bold text-ink min-w-[70px] text-right">
                    ₹{dhunTariffAssumption.toFixed(1)}/kWh
                  </span>
                </div>
                <span className="text-[11px] text-muted mt-1 block">Default: ₹10.00/kWh (planning assumption)</span>
              </div>
            </div>
          </div>

          {/* Side-by-Side Comparison Table */}
          <div className="panel border border-rule rounded-lg overflow-hidden">
            <div className="panel-head py-3 px-5">
              <h3 className="text-[15px] font-semibold text-ink">
                Baseline Parameter Reconciliation Matrix
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table w-full text-[13px]">
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Dhun Working Baseline</th>
                    <th>Historical Reference Evidence</th>
                    <th>Variance / Delta</th>
                    <th>Reconciliation Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-medium text-ink">Monthly Consumption</td>
                    <td className="font-mono">{num(reconciliation.dhunDerivedMonthlyKwh, 1)} kWh ({num(reconciliation.dhunDerivedAnnualMwh, 1)} MWh/yr)</td>
                    <td className="font-mono">{num(reconciliation.referenceMonthlyKwh, 1)} kWh ({num(reconciliation.referenceAnnualMwh, 1)} MWh/yr)</td>
                    <td className="font-mono font-semibold text-amber-700">
                      +{reconciliation.consumptionDeltaPercent.toFixed(1)}% higher
                    </td>
                    <td>
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900">
                        {reconciliation.verdict}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="font-medium text-ink">Effective Electricity Rate</td>
                    <td className="font-mono font-bold">₹{reconciliation.dhunWorkingTariff.toFixed(2)}/kWh (Assumed)</td>
                    <td className="font-mono font-bold text-accent">₹{reconciliation.referenceEffectiveRate.toFixed(2)}/kWh (Bill-Derived)</td>
                    <td className="font-mono font-semibold text-rose-700">
                      {reconciliation.tariffDeltaPercent.toFixed(1)}% variance (-₹{Math.abs(reconciliation.tariffDifferencePerKwh).toFixed(2)})
                    </td>
                    <td>
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-900">
                        UNDERESTIMATED TARIFF
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="font-medium text-ink">Connected Capacity</td>
                    <td className="text-muted">Unmetered / Unrecorded</td>
                    <td className="font-mono">{aggregates.combinedConnectedCapacityKw} kW across 3 properties</td>
                    <td className="text-muted">—</td>
                    <td>
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-900">
                        BENCHMARK ONLY
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="font-medium text-ink">Grid Carbon Emissions</td>
                    <td className="font-mono">{num((reconciliation.dhunDerivedAnnualMwh * 1000 * 0.71) / 1000, 1)} tCO₂e/yr</td>
                    <td className="font-mono">{num((reconciliation.referenceAnnualMwh * 1000 * 0.71) / 1000, 1)} tCO₂e/yr</td>
                    <td className="font-mono">+{num(((reconciliation.dhunDerivedAnnualMwh - reconciliation.referenceAnnualMwh) * 710) / 1000, 1)} tCO₂e</td>
                    <td>
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-800">
                        CEA 0.71 kg/kWh
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-5 bg-surface-subtle/50 border-t border-rule space-y-3">
              <h4 className="text-[13px] font-bold text-ink uppercase tracking-wider">
                Reconciliation Findings & Recommendations
              </h4>
              <p className="text-[12.5px] text-ink-soft leading-relaxed">
                {reconciliation.verdictRationale}
              </p>
              <ul className="list-disc pl-5 text-[12px] text-ink-soft space-y-1">
                {reconciliation.recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STACKED CAMPUS & COMPUTE DEMAND */}
      {activeTab === "stacked" && (
        <div className="p-6 space-y-6">
          <div className="bg-surface p-5 rounded-lg border border-rule space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-[16px] font-semibold text-ink">
                  Total Modelled Annual Campus Demand
                </h3>
                <p className="text-[12.5px] text-muted mt-0.5">
                  Combine baseline campus, planned buildings allowance, and selected Compute Commons facility energy.
                </p>
              </div>

              {/* Scenario Preset Switcher */}
              <div className="flex items-center gap-1.5 bg-surface-subtle p-1 rounded-lg border border-rule">
                {(["pilot", "phase1", "expansion"] as ComputeScenarioId[]).map((key) => {
                  const preset = COMPUTE_DEFAULT_SCENARIOS[key];
                  const isSelected = selectedComputePreset === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedComputePreset(key)}
                      className={`px-3 py-1.5 rounded-[4px] text-[12px] font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? "bg-accent text-white shadow-xs"
                          : "text-muted hover:text-ink"
                      }`}
                    >
                      {preset.name.replace(" Scenario", "").replace(" Reference", "")}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stacked Proportional Bar */}
            <div className="space-y-2 pt-2">
              <div className="h-9 w-full rounded-md overflow-hidden flex border border-rule font-mono text-[11px] font-bold text-white shadow-xs">
                {/* Existing Campus */}
                <div
                  style={{
                    width: `${(stackedCampus.existingCampusMwh / stackedCampus.totalCampusDemandMwh) * 100}%`,
                  }}
                  className="bg-[#234638] flex items-center justify-center px-2 truncate transition-all duration-300"
                  title={`Existing Campus: ${stackedCampus.existingCampusMwh} MWh/yr`}
                >
                  Campus ({num(stackedCampus.existingCampusMwh)} MWh)
                </div>

                {/* Planned Buildings (if enabled) */}
                {includePlannedBuildings && (
                  <div
                    style={{
                      width: `${(stackedCampus.plannedBuildingsMwh / stackedCampus.totalCampusDemandMwh) * 100}%`,
                    }}
                    className="bg-[#315D78] flex items-center justify-center px-2 truncate transition-all duration-300"
                    title={`Planned Buildings: ${stackedCampus.plannedBuildingsMwh} MWh/yr`}
                  >
                    Phase 1 Buildings ({num(stackedCampus.plannedBuildingsMwh)} MWh)
                  </div>
                )}

                {/* Compute Commons */}
                <div
                  style={{
                    width: `${(stackedCampus.computeFacilityMwh / stackedCampus.totalCampusDemandMwh) * 100}%`,
                  }}
                  className="bg-[#8679A9] flex items-center justify-center px-2 truncate transition-all duration-300"
                  title={`Compute Commons: ${num(stackedCampus.computeFacilityMwh, 1)} MWh/yr`}
                >
                  Compute ({num(stackedCampus.computeFacilityMwh, 1)} MWh)
                </div>
              </div>

              {/* Legend & Toggles */}
              <div className="flex flex-wrap items-center justify-between gap-4 text-[12px] pt-1">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-[#234638]" />
                    <span className="font-medium text-ink">Existing Campus:</span>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={customExistingCampusMwh}
                      onChange={(e) => setCustomExistingCampusMwh(parseFloat(e.target.value) || 0)}
                      className="w-16 px-1 py-0.5 font-mono text-[11px] rounded border border-rule text-right"
                    />
                    <span className="text-[11px] text-muted">MWh</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-[#315D78]" />
                    <span className="font-medium text-ink">Planned Buildings:</span>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={customPlannedBuildingsMwh}
                      onChange={(e) => setCustomPlannedBuildingsMwh(parseFloat(e.target.value) || 0)}
                      className="w-16 px-1 py-0.5 font-mono text-[11px] rounded border border-rule text-right"
                    />
                    <span className="text-[11px] text-muted">MWh</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-[#8679A9]" />
                    <span className="font-medium text-ink">Compute Commons ({num(stackedCampus.computeFacilityMwh, 1)} MWh)</span>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-ink text-[12px]">
                  <input
                    type="checkbox"
                    checked={includePlannedBuildings}
                    onChange={(e) => setIncludePlannedBuildings(e.target.checked)}
                    className="rounded text-accent focus:ring-accent"
                  />
                  <span>Include Planned Buildings (524 MWh/yr)</span>
                </label>
              </div>
            </div>

            {/* Total Demand KPI Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-rule">
              <div className="p-4 bg-surface-subtle/40 rounded border border-rule">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Total Annual Campus Demand
                </span>
                <div className="text-[24px] font-bold font-mono text-ink mt-0.5">
                  {num(stackedCampus.totalCampusDemandMwh, 1)} MWh/yr
                </div>
                <span className="text-[11px] text-muted">
                  {selectedComputePreset === "pilot" && "Reference: ~852.5 MWh/yr"}
                  {selectedComputePreset === "phase1" && "Reference: ~1,051.8 MWh/yr"}
                  {selectedComputePreset === "expansion" && "Reference: ~1,393.4 MWh/yr"}
                </span>
              </div>

              <div className="p-4 bg-surface-subtle/40 rounded border border-rule">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Annual Electricity Cost Equivalent
                </span>
                <div className="text-[24px] font-bold font-mono text-ink mt-0.5">
                  ₹{num(stackedCampus.totalElectricityCostLakh, 2)} Lakh
                </div>
                <span className="text-[11px] text-muted">
                  At working tariff ₹{dhunTariffAssumption.toFixed(1)}/kWh
                </span>
              </div>

              <div className="p-4 bg-surface-subtle/40 rounded border border-rule">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Marginal Grid Emissions
                </span>
                <div className="text-[24px] font-bold font-mono text-ink mt-0.5">
                  {num(stackedCampus.gridEmissionsTco2e, 1)} tCO₂e/yr
                </div>
                <span className="text-[11px] text-muted">
                  Rajasthan CEA Grid Factor (0.71 kg/kWh)
                </span>
              </div>
            </div>
          </div>

          {/* Quick link to Compute Commons Scenario Cockpit */}
          <div className="p-4 bg-surface rounded-lg border border-rule flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cpu size={20} className="text-accent" />
              <div>
                <h4 className="text-[14px] font-semibold text-ink">Fine-Tune Compute Facility Infrastructure</h4>
                <p className="text-[12px] text-muted">Adjust PUE, operating schedules, hardware accelerators, and cooling modes in the Compute Commons engine.</p>
              </div>
            </div>
            <Link
              to="/compute"
              className="btn btn-sm btn-primary flex items-center gap-1.5"
            >
              <span>Open Compute Commons</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}

      {/* TAB 4: EVIDENCE PROVENANCE & AUDIT LOG */}
      {activeTab === "evidence" && (
        <div className="p-6 space-y-6">
          <div className="panel border border-rule rounded-lg overflow-hidden">
            <div className="panel-head py-3 px-5 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-ink flex items-center gap-2">
                <ShieldCheck size={16} className="text-accent" />
                <span>Audited Energy & Utility Evidence Register</span>
              </h3>
              <span className="font-mono text-[11px] text-muted">6 Core Planning Assumptions</span>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table w-full text-[12.5px]">
                <thead>
                  <tr>
                    <th>Parameter / Input</th>
                    <th>Value & Unit</th>
                    <th>Source Document / Authority</th>
                    <th>Classification</th>
                    <th>Audit Status</th>
                    <th>Review Date</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-medium text-ink">Current Electricity Spend</td>
                    <td className="font-mono">₹2.50 Lakh / month</td>
                    <td>Dhun Operations Management</td>
                    <td><EvidenceBadge tier="REPORT" /></td>
                    <td><span className="text-amber-800 font-semibold">Pending Meter Audit</span></td>
                    <td className="font-mono text-faint">2026-10-29</td>
                  </tr>
                  <tr>
                    <td className="font-medium text-ink">Working Electricity Tariff</td>
                    <td className="font-mono">₹10.00 / kWh</td>
                    <td>Dhun Planning Model Assumption</td>
                    <td><EvidenceBadge tier="ASSUMPTION" /></td>
                    <td><span className="text-amber-800 font-semibold">Underestimated (Bills: ₹12.84)</span></td>
                    <td className="font-mono text-faint">2026-10-29</td>
                  </tr>
                  <tr>
                    <td className="font-medium text-ink">Historical Reference Bills</td>
                    <td className="font-mono">11,132.13 kWh (Feb 2022)</td>
                    <td>
                      <span className="font-mono text-[10.5px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-200">
                        Bill Recorded
                      </span>
                    </td>
                    <td><span className="text-emerald-700 font-semibold">Transcribed & Flagged</span></td>
                    <td className="font-mono text-faint">2026-10-29</td>
                  </tr>
                  <tr>
                    <td className="font-medium text-ink">Planned Buildings Allowance</td>
                    <td className="font-mono">524.0 MWh / year</td>
                    <td>EDS EcoNiwas Study (Placeholder)</td>
                    <td><EvidenceBadge tier="REPORT" /></td>
                    <td><span className="text-amber-800 font-semibold">Unvalidated Placeholder</span></td>
                    <td className="font-mono text-faint">2026-10-29</td>
                  </tr>
                  <tr>
                    <td className="font-medium text-ink">Provisional Facility PUE</td>
                    <td className="font-mono">1.30 (Ratio)</td>
                    <td>ASHRAE Technical Committee 9.9</td>
                    <td><EvidenceBadge tier="ASSUMPTION" /></td>
                    <td><span className="text-blue-800 font-semibold">Provisional Heuristic</span></td>
                    <td className="font-mono text-faint">2026-10-29</td>
                  </tr>
                  <tr>
                    <td className="font-medium text-ink">Rajasthan Grid Emission Factor</td>
                    <td className="font-mono">0.71 kg CO₂e / kWh</td>
                    <td>CEA CO₂ Baseline Database (Ver 19)</td>
                    <td><EvidenceBadge tier="REPORT" /></td>
                    <td><span className="text-emerald-700 font-semibold">Verified Official Standard</span></td>
                    <td className="font-mono text-faint">2026-10-29</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-surface-subtle/50 border-t border-rule text-[12px] text-muted leading-relaxed">
              <strong>Audit Integrity Standard:</strong> No assumptions are marked as verified merely because a software test passes. Every parameter retains its true evidentiary status (Measured, Bill-Recorded, Reported, Assumed, or Simulated).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
