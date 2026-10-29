/* ============================================================
   DHUN TWIN OS — COMPUTE COMMONS MODELLING & SCENARIO ENGINE
   Interactive compute-capacity, energy, and infrastructure planning
   module. Models 3 canonical scenarios (Pilot: 5kW, Phase 1: 20kW,
   Expansion: 50kW), PUE overhead, workload planning, hardware BOMs,
   solar coincidence, and wider Dhun campus energy impact.
   ============================================================ */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Cpu,
  Layers,
  Sliders,
  Battery,
  RotateCcw,
  HelpCircle,
  Server,
  TrendingUp,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import PageHeader from "../features/dhun/components/PageHeader";
import MetricStrip from "../features/dhun/components/MetricStrip";
import {
  IntensityCurve,
  SolarStrip,
} from "../features/dhun/components/IntensityCurve";

import { useTwin } from "../features/dhun/context/useTwin";
import { useAssetRegistry } from "../features/dhun/registry/AssetRegistryContext";

import {
  computeWindows,
} from "../features/dhun/engine/compute";
import { COOLING_PROFILE } from "../features/dhun/engine/scenarios";
import { GRID_FACTOR } from "../features/dhun/data/constants";
import { istHour } from "../features/dhun/lib/clock";
import { num } from "../features/dhun/lib/format";

import {
  type ComputeScenarioId,
  type ComputeScenarioInputs,
  type ComputeScenarioOutputs,
  calculateComputeScenario,
  calculateCampusEnergyImpact,
  calculateSolarBatteryInteraction,
  COMPUTE_DEFAULT_SCENARIOS,
  DEFAULT_WORKLOAD_PROFILES,
  COMPUTE_EVIDENCE_REGISTER,
  type HardwareSpecification,
} from "../features/dhun/engine/computeCommonsEngine";
import ComputeScenarioBuilder from "../features/dhun/components/ComputeScenarioBuilder";

export default function Compute() {
  const { phase, now } = useTwin();
  const { assets, getOperationalState } = useAssetRegistry();
  const computeAssets = assets.filter((a) => a.domain === "Compute");

  // Active Compute Scenario State
  const [selectedScenarioId, setSelectedScenarioId] = useState<ComputeScenarioId>("pilot");
  const [scenarios, setScenarios] = useState<Record<ComputeScenarioId, ComputeScenarioInputs>>({
    ...COMPUTE_DEFAULT_SCENARIOS,
  });

  // Hardware BOM State for scenarios
  const [hardwareSpecs, setHardwareSpecs] = useState<Record<string, HardwareSpecification>>({
    pilot: { status: "unspecified" },
    phase1: { status: "unspecified" },
    expansion: { status: "unspecified" },
    custom: { status: "unspecified" },
  });

  // Builder Modal State
  const [builderModalOpen, setBuilderModalOpen] = useState(false);

  // Campus Energy Model Integration Toggles
  const [includeExistingCampus, setIncludeExistingCampus] = useState(true);
  const [includePlannedBuildings, setIncludePlannedBuildings] = useState(true);
  const [customExistingCampusMwh, setCustomExistingCampusMwh] = useState<number>(300.0);
  const [customPlannedBuildingsMwh, setCustomPlannedBuildingsMwh] = useState<number>(524.0);

  // Assumptions Drawer Collapsed State
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const nowHour = istHour(now);

  const activeScenarioInputs = scenarios[selectedScenarioId] || scenarios.pilot;
  const activeOutputs: ComputeScenarioOutputs = useMemo(
    () => calculateComputeScenario(activeScenarioInputs),
    [activeScenarioInputs]
  );

  // Campus energy impact breakdown
  const campusImpact = useMemo(
    () =>
      calculateCampusEnergyImpact(
        activeOutputs.annualFacilityEnergyMwh,
        includeExistingCampus,
        includePlannedBuildings,
        customExistingCampusMwh,
        customPlannedBuildingsMwh
      ),
    [
      activeOutputs.annualFacilityEnergyMwh,
      includeExistingCampus,
      includePlannedBuildings,
      customExistingCampusMwh,
      customPlannedBuildingsMwh,
    ]
  );

  // Solar & Battery interaction
  const solarBattery = useMemo(
    () => calculateSolarBatteryInteraction(activeScenarioInputs, activeOutputs),
    [activeScenarioInputs, activeOutputs]
  );

  // Preserved 24-hr Marginal Intensity calculations
  const windows = useMemo(() => computeWindows(phase), [phase]);
  const best = useMemo(
    () =>
      windows.reduce(
        (acc, window) => (window.intensity < acc.intensity ? window : acc),
        windows[0]
      ),
    [windows]
  );

  // Cooling Tradeoff metrics
  const itKw = activeOutputs.effectiveItLoadKw;
  const dry = COOLING_PROFILE.dry;
  const evap = COOLING_PROFILE.evaporative;
  const dryMwh = (itKw * dry.pue * activeOutputs.annualOperatingHours) / 1000;
  const evapMwh = (itKw * evap.pue * activeOutputs.annualOperatingHours) / 1000;
  const dryWater = (itKw * dry.pue * activeOutputs.annualOperatingHours * dry.wue) / 1000;
  const evapWater = (itKw * evap.pue * activeOutputs.annualOperatingHours * evap.wue) / 1000;
  const energySaved = dryMwh - evapMwh;
  const waterAdded = evapWater - dryWater;
  const carbonSaved = energySaved * GRID_FACTOR;

  const handleUpdateScenario = (
    updated: ComputeScenarioInputs,
    updatedHw?: HardwareSpecification
  ) => {
    setScenarios((prev) => ({
      ...prev,
      [selectedScenarioId]: updated,
    }));
    if (updatedHw) {
      setHardwareSpecs((prev) => ({
        ...prev,
        [selectedScenarioId]: updatedHw,
      }));
    }
  };

  const handleResetActiveScenario = () => {
    const defaultTemplate =
      COMPUTE_DEFAULT_SCENARIOS[selectedScenarioId] || COMPUTE_DEFAULT_SCENARIOS.pilot;
    setScenarios((prev) => ({
      ...prev,
      [selectedScenarioId]: { ...defaultTemplate },
    }));
    setHardwareSpecs((prev) => ({
      ...prev,
      [selectedScenarioId]: { status: "unspecified" },
    }));
  };

  return (
    <div className="sheet">
      {/* Header */}
      <PageHeader
        index="05 · Compute Commons"
        title="Compute Commons & Energy Infrastructure Planning"
        lede="Plan and evaluate compute facility sizing, PUE cooling overhead, electricity costs, and campus energy integration for the Dhun Field Station. Compare Pilot, Phase 1, and Expansion scenarios without hardware assumptions."
        aside={
          <>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-accent font-bold px-2 py-0.5 rounded bg-accent-tint border border-accent/20">
                {activeScenarioInputs.name}
              </span>
              <span className="tabular font-mono text-[11px] text-ink font-semibold">
                {num(activeOutputs.effectiveItLoadKw, 1)} kW IT Load
              </span>
            </div>
            <p className="tabular font-mono text-[10px] text-muted mt-1">
              PUE {activeScenarioInputs.pue.toFixed(2)} · {activeScenarioInputs.operatingHoursPerDay}h/day · ₹
              {activeScenarioInputs.electricityRateInrPerKwh.toFixed(2)}/kWh
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBuilderModalOpen(true)}
                className="btn btn-sm btn-accent text-[11.5px] flex items-center gap-1.5 py-1 px-2.5 cursor-pointer"
              >
                <Sliders size={13} />
                <span>Configure Scenario</span>
              </button>
              <button
                type="button"
                onClick={handleResetActiveScenario}
                className="btn btn-sm btn-outline text-[11.5px] flex items-center gap-1.5 py-1 px-2.5 text-muted hover:text-ink cursor-pointer"
                title="Restore scenario defaults"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            </div>
          </>
        }
      />

      {/* Scenario Template Switcher Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule bg-surface px-6 py-2.5 text-[13px]">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted font-bold mr-1">
            Compute Scenario:
          </span>
          <div className="inline-flex rounded-md border border-rule bg-surface-subtle p-0.5 shadow-xs">
            {(
              [
                { id: "pilot", label: "Compute Pilot (5 kW)", sub: "12h/d · ~28.5 MWh" },
                { id: "phase1", label: "Phase 1 Reference (20 kW)", sub: "24h/d · ~227.8 MWh" },
                { id: "expansion", label: "Expansion (50 kW)", sub: "24h/d · ~569.4 MWh" },
                { id: "custom", label: "Custom Configuration", sub: "User Defined" },
              ] as const
            ).map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => setSelectedScenarioId(sc.id)}
                className={`px-3 py-1 text-[12px] font-medium rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedScenarioId === sc.id
                    ? "bg-[#234638] text-white shadow-xs font-semibold"
                    : "text-muted hover:text-ink hover:bg-gray-100"
                }`}
              >
                <span>{sc.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11.5px] text-muted">
          <span className="bg-[#FAF1DC] text-[#966914] px-2 py-0.5 rounded font-bold border border-[#966914]/20">
            Planning Scenario
          </span>
          <span>Not installed equipment</span>
        </div>
      </div>

      {/* High-Value Metric Strip */}
      <MetricStrip
        metrics={[
          {
            label: "Annual facility energy",
            value: num(activeOutputs.annualFacilityEnergyMwh, 1),
            unit: "MWh/yr",
            note: `IT load: ${num(activeOutputs.annualItEnergyMwh, 1)} MWh + ${num(
              activeOutputs.annualFacilityOverheadMwh,
              1
            )} MWh overhead.`,
            domain: "energy",
          },
          {
            label: "Annual electricity cost",
            value: `₹${num(activeOutputs.annualElectricityCostLakh, 2)}`,
            unit: "Lakh/yr",
            note: `Monthly equivalent: ₹${num(
              activeOutputs.monthlyElectricityCostInr,
              0
            )} at ₹${activeScenarioInputs.electricityRateInrPerKwh}/kWh.`,
            tone: activeOutputs.annualElectricityCostLakh > 30 ? "warn" : "default",
            domain: "energy",
          },
          {
            label: "Average facility demand",
            value: num(activeOutputs.avgFacilityDemandKw, 1),
            unit: "kW",
            note: `IT draw ${num(activeOutputs.effectiveItLoadKw, 1)} kW × PUE ${activeScenarioInputs.pue.toFixed(
              2
            )} during ${activeScenarioInputs.operatingHoursPerDay}h run.`,
            domain: "compute",
          },
          {
            label: "PUE facility overhead",
            value: `+${num(activeOutputs.pueOverheadPct, 0)}%`,
            note: `PUE ${activeScenarioInputs.pue.toFixed(
              2
            )} facility multiplier over raw IT computing equipment.`,
            tone: activeScenarioInputs.pue <= 1.25 ? "good" : "warn",
            domain: "ecology",
          },
        ]}
      />

      {/* 1. Scenario Comparison Matrix */}
      <section className="panel border-b border-rule bg-surface p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[17px] font-bold text-ink flex items-center gap-2">
              <Layers size={17} className="text-[#234638]" />
              Scenario Comparison Matrix
            </h3>
            <p className="text-[12.5px] text-muted">
              Side-by-side evaluation of the three canonical templates and active custom configuration.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setBuilderModalOpen(true)}
            className="btn btn-sm btn-outline text-[12px] flex items-center gap-1.5 py-1 px-3 text-[#234638] border-[#234638]/40 hover:bg-[#E5EBDD] cursor-pointer"
          >
            <Sliders size={13} />
            <span>Tune Parameters in Builder</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table min-w-[760px]">
            <caption className="sr-only">Compute Scenario Comparison Matrix</caption>
            <thead>
              <tr>
                <th scope="col">Scenario</th>
                <th scope="col" className="num">Average IT Load</th>
                <th scope="col" className="num">Daily Schedule</th>
                <th scope="col" className="num">PUE</th>
                <th scope="col" className="num">Facility Energy</th>
                <th scope="col" className="num">Electricity Cost</th>
                <th scope="col" className="num">Grid Carbon</th>
                <th scope="col">Solar Match</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {(["pilot", "phase1", "expansion", "custom"] as const).map((scId) => {
                const scData = scenarios[scId];
                const scOut = calculateComputeScenario(scData);
                const isSelected = selectedScenarioId === scId;

                return (
                  <tr
                    key={scId}
                    className={`transition-colors cursor-pointer ${
                      isSelected ? "bg-[#E5EBDD]/40 font-semibold" : "hover:bg-surface-subtle"
                    }`}
                    onClick={() => setSelectedScenarioId(scId)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isSelected && <span className="w-2 h-2 rounded-full bg-[#234638]" />}
                        <div>
                          <span className="text-[13.5px] font-semibold text-ink block">
                            {scData.name}
                          </span>
                          <span className="text-[11px] text-muted line-clamp-1">
                            {scData.description}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 num font-mono text-[13.5px] text-ink">
                      {num(scOut.effectiveItLoadKw, 1)} kW
                    </td>
                    <td className="px-4 py-3 num font-mono text-[13px] text-muted">
                      {scData.operatingHoursPerDay}h / day
                    </td>
                    <td className="px-4 py-3 num font-mono text-[13px]">
                      {scData.pue.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 num font-mono text-[14px] text-[#234638]">
                      {num(scOut.annualFacilityEnergyMwh, 1)} MWh/yr
                    </td>
                    <td className="px-4 py-3 num font-mono text-[14px] text-[#966914]">
                      ₹{num(scOut.annualElectricityCostLakh, 2)} L
                    </td>
                    <td className="px-4 py-3 num font-mono text-[13px] text-muted">
                      {num(scOut.annualCarbonEmissionsTons, 1)} tCO₂e
                    </td>
                    <td className="px-4 py-3 text-[12px]">
                      {scData.operatingHoursPerDay <= 12 ? (
                        <span className="font-mono text-[10.5px] text-[#234638] bg-[#E5EBDD] px-1.5 py-0.5 rounded font-bold">
                          ~75% Solar Coincident
                        </span>
                      ) : (
                        <span className="font-mono text-[10.5px] text-muted bg-surface-subtle px-1.5 py-0.5 rounded">
                          ~38% Day / 62% Night
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedScenarioId(scId);
                          setBuilderModalOpen(true);
                        }}
                        className="text-[11.5px] text-[#234638] hover:underline font-semibold"
                      >
                        Edit →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. Wider Dhun Campus Energy Model Integration (Section 7) */}
      <section className="panel border-b border-rule bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-[17px] font-bold text-ink flex items-center gap-2">
                <TrendingUp size={17} className="text-[#234638]" />
                Wider Dhun Campus Energy Model Integration
              </h3>
              <Link
                to="/energy"
                className="text-[12px] font-semibold text-accent hover:underline bg-[#E5EBDD] px-2.5 py-0.5 rounded border border-[#234638]/20"
              >
                Calibrate with Reference Bills →
              </Link>
            </div>
            <p className="text-[12.5px] text-muted">
              Connects Compute Commons with the existing campus electricity baseline and planned Phase 1 buildings.
            </p>
          </div>

          <div className="flex items-center gap-3 text-[12px]">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeExistingCampus}
                onChange={(e) => setIncludeExistingCampus(e.target.checked)}
                className="accent-[#234638]"
              />
              <span>Existing Campus (300 MWh)</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includePlannedBuildings}
                onChange={(e) => setIncludePlannedBuildings(e.target.checked)}
                className="accent-[#234638]"
              />
              <span>Planned Buildings (524 MWh)</span>
            </label>
          </div>
        </div>

        {/* Stacked Campus Energy Visualisation */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-[#F4F2EA]/50 border border-[#DCDDD2] rounded-lg">
          <div className="bg-white p-3.5 rounded border border-[#DCDDD2]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-muted uppercase font-bold">1. Existing Campus</span>
              <input
                type="number"
                min="0"
                step="10"
                value={customExistingCampusMwh}
                onChange={(e) => setCustomExistingCampusMwh(parseFloat(e.target.value) || 0)}
                className="w-20 text-[11px] font-mono px-1 py-0.5 rounded border border-[#DCDDD2] text-right"
                title="Adjust existing campus annual baseline"
              />
            </div>
            <div className="font-mono text-[20px] font-bold text-[#202923] mt-0.5">
              {num(campusImpact.existingCampusMwhYr, 1)}{" "}
              <span className="text-[12px] font-normal text-muted">MWh/yr</span>
            </div>
            <p className="text-[11px] text-muted mt-1 leading-snug">
              Derived from ₹2.5L/mo bill at ₹10/kWh (reported, pending meter audit).
            </p>
          </div>

          <div className="bg-white p-3.5 rounded border border-[#DCDDD2]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-muted uppercase font-bold">2. Planned Buildings</span>
              <input
                type="number"
                min="0"
                step="10"
                value={customPlannedBuildingsMwh}
                onChange={(e) => setCustomPlannedBuildingsMwh(parseFloat(e.target.value) || 0)}
                className="w-20 text-[11px] font-mono px-1 py-0.5 rounded border border-[#DCDDD2] text-right"
                title="Adjust planned buildings annual allowance"
              />
            </div>
            <div className="font-mono text-[20px] font-bold text-[#202923] mt-0.5">
              {num(campusImpact.plannedBuildingsMwhYr, 1)}{" "}
              <span className="text-[12px] font-normal text-muted">MWh/yr</span>
            </div>
            <p className="text-[11px] text-muted mt-1 leading-snug">
              Unvalidated architectural placeholder across residential & institutional blocks.
            </p>
          </div>

          <div className="bg-white p-3.5 rounded border border-[#234638] shadow-xs">
            <div className="text-[11px] font-mono text-[#234638] uppercase font-bold">
              3. {activeScenarioInputs.name}
            </div>
            <div className="font-mono text-[20px] font-bold text-[#234638] mt-0.5">
              {num(campusImpact.computeFacilityMwhYr, 1)}{" "}
              <span className="text-[12px] font-normal text-muted">MWh/yr</span>
            </div>
            <p className="text-[11px] text-[#234638] mt-1 leading-snug">
              Represents <strong>{campusImpact.computeShareOfTotalPct.toFixed(1)}%</strong> of total modelled campus load.
            </p>
          </div>

          <div className="bg-[#E5EBDD] p-3.5 rounded border border-[#234638]/40">
            <div className="text-[11px] font-mono text-[#15372D] uppercase font-bold">Total Modelled Campus</div>
            <div className="font-mono text-[22px] font-bold text-[#15372D] mt-0.5">
              {num(campusImpact.totalModelledCampusMwhYr, 1)}{" "}
              <span className="text-[12px] font-normal text-[#15372D]">MWh/yr</span>
            </div>
            <p className="text-[11px] text-[#15372D] mt-1 leading-snug">
              {activeScenarioInputs.id === "pilot" && "Yields ~852.5 MWh/yr combined benchmark."}
              {activeScenarioInputs.id === "phase1" && "Yields ~1,051.8 MWh/yr combined benchmark."}
              {activeScenarioInputs.id === "expansion" && "Yields ~1,393.4 MWh/yr combined benchmark."}
            </p>
          </div>
        </div>

        {/* Stacked Proportional Bar */}
        <div className="mt-3">
          <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden flex">
            {campusImpact.existingCampusMwhYr > 0 && (
              <div
                style={{
                  width: `${(campusImpact.existingCampusMwhYr / campusImpact.totalModelledCampusMwhYr) * 100}%`,
                }}
                className="bg-[#202923] h-full"
                title={`Existing Campus: ${campusImpact.existingCampusMwhYr} MWh`}
              />
            )}
            {campusImpact.plannedBuildingsMwhYr > 0 && (
              <div
                style={{
                  width: `${(campusImpact.plannedBuildingsMwhYr / campusImpact.totalModelledCampusMwhYr) * 100}%`,
                }}
                className="bg-[#7EAEC1] h-full"
                title={`Planned Buildings: ${campusImpact.plannedBuildingsMwhYr} MWh`}
              />
            )}
            {campusImpact.computeFacilityMwhYr > 0 && (
              <div
                style={{
                  width: `${(campusImpact.computeFacilityMwhYr / campusImpact.totalModelledCampusMwhYr) * 100}%`,
                }}
                className="bg-[#D9A441] h-full"
                title={`Compute Commons: ${campusImpact.computeFacilityMwhYr} MWh`}
              />
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between text-[11px] text-muted mt-1.5 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#202923] rounded-xs inline-block" />
              Existing Campus ({campusImpact.existingCampusMwhYr} MWh)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#7EAEC1] rounded-xs inline-block" />
              Planned Buildings ({campusImpact.plannedBuildingsMwhYr} MWh)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#D9A441] rounded-xs inline-block" />
              Compute Facility ({num(campusImpact.computeFacilityMwhYr, 1)} MWh)
            </span>
          </div>
        </div>

        <p className="text-[11.5px] text-muted mt-3 italic border-t border-rule/50 pt-2">
          {campusImpact.disclaimer}
        </p>
      </section>

      {/* 3. Hardware Footprint & Workload Capability (Sections 5 & 6) */}
      <div className="split grid-cols-1 xl:grid-cols-12 border-b border-rule bg-surface">
        {/* Hardware Configuration Panel */}
        <div className="xl:col-span-5 p-6 border-b xl:border-b-0 xl:border-r border-rule flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[16px] font-bold text-ink flex items-center gap-2">
              <Server size={16} className="text-[#234638]" />
              Hardware BOM & Accelerator Footprint
            </h3>
            <span className="font-mono text-[10.5px] text-muted uppercase font-bold">
              {hardwareSpecs[selectedScenarioId]?.status === "specified" ? "Specified" : "Unspecified"}
            </span>
          </div>

          {hardwareSpecs[selectedScenarioId]?.status === "unspecified" ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#F4F2EA]/40 border border-dashed border-[#DCDDD2] rounded-lg text-center">
              <HelpCircle size={28} className="text-[#68736C] mb-2" />
              <h4 className="font-bold text-[14px] text-ink">Hardware BOM: Not Yet Specified</h4>
              <p className="text-[12px] text-muted mt-1.5 max-w-sm">
                Compute power is currently modelled as a generic {num(activeOutputs.effectiveItLoadKw, 1)} kW electrical envelope. Specific accelerator counts, VRAM, and server chassis can be specified without altering energy formulas.
              </p>
              <button
                type="button"
                onClick={() => setBuilderModalOpen(true)}
                className="btn btn-sm btn-outline mt-3 text-[12px] flex items-center gap-1.5 text-[#234638]"
              >
                <Cpu size={13} />
                <span>Assign Hardware Specifications</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3 flex-1">
              <div className="p-3 bg-white border border-[#DCDDD2] rounded-lg">
                <div className="text-[11px] text-muted font-mono">Selected Accelerators</div>
                <div className="font-bold text-[14px] text-ink mt-0.5">
                  {hardwareSpecs[selectedScenarioId]?.gpuCount || 8}× {hardwareSpecs[selectedScenarioId]?.gpuModel}
                </div>
                <div className="text-[12px] text-muted mt-1">
                  Aggregate VRAM:{" "}
                  <strong className="text-[#234638]">
                    {hardwareSpecs[selectedScenarioId]?.aggregateVramGb || 640} GB
                  </strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div className="p-2.5 bg-white border border-[#DCDDD2] rounded-lg">
                  <div className="text-muted text-[11px]">Server Chassis</div>
                  <div className="font-mono font-bold text-ink text-[14px]">
                    {hardwareSpecs[selectedScenarioId]?.serverChassisCount || 2} nodes
                  </div>
                </div>
                <div className="p-2.5 bg-white border border-[#DCDDD2] rounded-lg">
                  <div className="text-muted text-[11px]">Local NVMe</div>
                  <div className="font-mono font-bold text-ink text-[14px]">
                    {hardwareSpecs[selectedScenarioId]?.localStorageTb || 30} TB Gen5
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Intended Workloads & Services Planning */}
        <div className="xl:col-span-7 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[16px] font-bold text-ink flex items-center gap-2">
                <Cpu size={16} className="text-[#234638]" />
                Intended AI Services & Workload Schedulability
              </h3>
              <p className="text-[12.5px] text-muted">
                Candidate workloads for the Dhun Field Station. Batch jobs marked shiftable can be deferred to solar peak.
              </p>
            </div>
            <span className="font-mono text-[11px] text-muted">
              {DEFAULT_WORKLOAD_PROFILES.length} Workload Archetypes
            </span>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[360px]">
            {DEFAULT_WORKLOAD_PROFILES.map((wl) => (
              <div
                key={wl.id}
                className="p-3 bg-white border border-[#DCDDD2] rounded-lg hover:border-[#234638]/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-semibold text-ink text-[13.5px]">{wl.name}</span>
                    <span className="font-mono text-[11px] text-muted block mt-0.5">
                      Model: {wl.targetModel} ({wl.parameterSize}) · {wl.quantization}
                    </span>
                  </div>
                  {wl.isShiftableToSolarHours ? (
                    <span className="font-mono text-[10.5px] font-bold text-[#234638] bg-[#E5EBDD] px-2 py-0.5 rounded border border-[#234638]/20 shrink-0">
                      ☀️ Solar Shiftable
                    </span>
                  ) : (
                    <span className="font-mono text-[10.5px] text-muted bg-surface-subtle px-2 py-0.5 rounded border border-rule shrink-0">
                      ⚡ 24/7 Low Latency
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11.5px] text-muted mt-2 pt-2 border-t border-[#DCDDD2]/60">
                  <span>Capacity: {wl.concurrentCapacity}</span>
                  <span className="font-mono">Min VRAM: {wl.minVramGb} GB</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Solar, Storage & Marginal Carbon Window (Preserved & Enhanced) */}
      <div className="split grid-cols-1 xl:grid-cols-12 border-b border-rule bg-surface">
        <section className="panel xl:col-span-8 border-b xl:border-b-0 xl:border-r border-rule">
          <div className="panel-head">
            <h2 className="t-title text-ink">
              Solar Coincidence & 24-Hour Marginal Carbon Intensity
            </h2>

            <div className="flex items-center gap-3 font-mono text-[11px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-[2.5px] w-3.5 bg-[#C53B27]" />
                Now · {String(nowHour).padStart(2, "0")}:00
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 border border-[#12482E] bg-[#DCECE3]" />
                Lowest · {best.label}
              </span>
            </div>
          </div>

          <div className="p-4 bg-surface">
            <IntensityCurve windows={windows} nowHour={nowHour} bestHour={best.hour} />
            <div className="mt-3 border-t border-rule pt-3">
              <SolarStrip windows={windows} />
            </div>
          </div>

          <div className="panel-foot">
            <p className="note text-[12px]">
              {solarBattery.coincidentSolarShareText} Dhun's 100 kWp Phase 1 solar farm outputs during 08:00–17:00. Night loads draw from the regional grid (0.71 kg/kWh) unless buffered by battery storage.
            </p>
          </div>
        </section>

        {/* Battery & Scheduling Decision */}
        <section className="panel flex flex-col xl:col-span-4">
          <div className="panel-head">
            <h2 className="t-title text-ink">Battery Storage Buffer</h2>
            <span className="tabular font-mono text-[11px] font-semibold text-muted">
              BESS Sizing
            </span>
          </div>

          <div className="p-5 space-y-4 flex-1">
            <div className="p-3.5 bg-white border border-[#DCDDD2] rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] text-muted">Nighttime Energy / Day</span>
                <Battery size={15} className="text-[#234638]" />
              </div>
              <div className="font-mono text-[18px] font-bold text-ink">
                {num(
                  (activeOutputs.annualFacilityEnergyKwh * (100 - solarBattery.daytimeCoincidencePct)) /
                    100 /
                    activeScenarioInputs.operatingDaysPerYear,
                  1
                )}{" "}
                <span className="text-[12px] font-normal text-muted">kWh / night</span>
              </div>
            </div>

            <div className="p-3.5 bg-[#F4F2EA]/60 border border-[#DCDDD2] rounded-lg">
              <div className="text-[11.5px] text-muted">Dedicated Battery Sizing</div>
              <div className="font-mono text-[18px] font-bold text-[#234638] mt-0.5">
                {num(solarBattery.nighttimeBatteryCapacityNeededKwh, 0)}{" "}
                <span className="text-[12px] font-normal text-muted">kWh capacity</span>
              </div>
              <p className="text-[11px] text-muted mt-1 leading-snug">
                Assuming 85% round-trip efficiency and 80% usable depth-of-discharge to avoid night grid imports.
              </p>
            </div>

            <div className="p-3.5 bg-white border border-[#DCDDD2] rounded-lg">
              <div className="text-[11.5px] text-muted">Annual Grid Carbon Impact</div>
              <div className="font-mono text-[18px] font-bold text-[#202923] mt-0.5">
                {num(activeOutputs.annualCarbonEmissionsTons, 1)}{" "}
                <span className="text-[12px] font-normal text-muted">tCO₂e / yr</span>
              </div>
              <p className="text-[11px] text-muted mt-1 leading-snug">
                At verified grid emission factor of {GRID_FACTOR} kg CO₂/kWh.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* 5. Cooling Tradeoff & Registered Nodes */}
      <div className="split grid-cols-1 lg:grid-cols-12 border-b border-rule bg-surface">
        <section className="panel lg:col-span-6 border-b lg:border-b-0 lg:border-r border-rule">
          <div className="panel-head">
            <h2 className="t-title text-ink">Cooling Trade-off (Dry vs Evaporative)</h2>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">
              PUE vs WUE
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <caption className="sr-only">Dry versus evaporative cooling at the active compute load</caption>
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  <th scope="col" className="num">Dry Cooling</th>
                  <th scope="col" className="num">Evaporative</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-surface-subtle transition-colors">
                  <th scope="row" className="font-medium text-ink px-3.5 py-3 text-[14px]">PUE</th>
                  <td className="num font-mono text-[14px] px-3.5 py-3">{dry.pue.toFixed(2)}</td>
                  <td className="num font-mono font-semibold text-ink text-[14px] px-3.5 py-3">{evap.pue.toFixed(2)}</td>
                </tr>
                <tr className="hover:bg-surface-subtle transition-colors">
                  <th scope="row" className="font-medium text-ink px-3.5 py-3 text-[14px]">WUE (L/kWh)</th>
                  <td className="num font-mono text-[14px] px-3.5 py-3">{dry.wue.toFixed(2)}</td>
                  <td className="num font-mono font-semibold text-[#315D78] text-[14px] px-3.5 py-3">{evap.wue.toFixed(2)}</td>
                </tr>
                <tr className="hover:bg-surface-subtle transition-colors">
                  <th scope="row" className="font-medium text-ink px-3.5 py-3 text-[14px]">Facility Energy</th>
                  <td className="num font-mono text-[14px] px-3.5 py-3">{num(dryMwh, 1)} MWh</td>
                  <td className="num font-mono font-semibold text-[#234638] text-[14px] px-3.5 py-3">{num(evapMwh, 1)} MWh</td>
                </tr>
                <tr className="hover:bg-surface-subtle transition-colors">
                  <th scope="row" className="font-medium text-ink px-3.5 py-3 text-[14px]">Annual Water</th>
                  <td className="num font-mono text-[14px] px-3.5 py-3">{num(dryWater)} kL</td>
                  <td className="num font-mono font-semibold text-[#B84F43] text-[14px] px-3.5 py-3">{num(evapWater)} kL</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="panel-foot">
            <p className="note text-[12px]">
              Evaporative cooling saves {num(energySaved, 1)} MWh and {num(carbonSaved, 0)} tCO₂e a year, but draws {num(waterAdded)} kL of water against Dhun's 550M-litre annual water budget. In a semi-arid desert climate, water preservation is paramount.
            </p>
          </div>
        </section>

        {/* Registered Compute Assets in Asset Registry */}
        <section className="panel lg:col-span-6">
          <div className="panel-head">
            <div>
              <h2 className="t-title text-ink">Authoritative Compute Assets</h2>
              <p className="font-mono text-[11px] text-muted">Physical and planned compute nodes in central asset inventory</p>
            </div>
            <span className="font-mono text-[11px] text-muted">{computeAssets.length} Nodes</span>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <caption className="sr-only">Registered compute clusters</caption>
              <thead>
                <tr>
                  <th scope="col">Cluster & ID</th>
                  <th scope="col" className="num">Capacity</th>
                  <th scope="col" className="num">Target PUE</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {computeAssets.map((asset) => {
                  const comp = asset.computeAttributes;
                  const opState = getOperationalState(asset);
                  return (
                    <tr key={asset.id} className="hover:bg-surface-subtle transition-colors">
                      <td className="px-3.5 py-3">
                        <span className="font-semibold text-ink text-[13px] block">{asset.name}</span>
                        <span className="font-mono text-[10.5px] text-muted">{asset.id}</span>
                      </td>
                      <td className="num font-mono px-3.5 py-3 text-[13px]">
                        {comp ? `${comp.itLoadKw} kW` : `${asset.ratedCapacity} ${asset.capacityUnit}`}
                      </td>
                      <td className="num font-mono px-3.5 py-3 text-[13px]">
                        {comp?.targetPue.toFixed(2) || "—"}
                      </td>
                      <td className="px-3.5 py-3">
                        <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-surface-subtle border border-rule">
                          {opState.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* 6. Expandable Engineering Assumptions & Evidence Register (Section 10) */}
      <section className="panel m-6 border border-rule bg-surface rounded-lg">
        <div
          onClick={() => setAssumptionsOpen((open) => !open)}
          className="panel-head py-3.5 px-6 flex items-center justify-between cursor-pointer hover:bg-surface-subtle transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-[#234638]" />
            <h3 className="font-bold text-[15px] text-ink">
              Evidence & Assumptions Register
            </h3>
            <span className="font-mono text-[10.5px] text-muted">
              ({COMPUTE_EVIDENCE_REGISTER.length} Tracked Assumptions)
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#234638]">
            <span>{assumptionsOpen ? "Collapse Register" : "Expand Full Register"}</span>
            {assumptionsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>

        {assumptionsOpen && (
          <div className="overflow-x-auto p-4 border-t border-rule animate-fadeIn">
            <table className="data-table min-w-[700px]">
              <caption className="sr-only">Compute Evidence and Assumptions Register</caption>
              <thead>
                <tr>
                  <th scope="col">Assumption / Parameter</th>
                  <th scope="col">Value & Unit</th>
                  <th scope="col">Verification Status</th>
                  <th scope="col">Source / Justification</th>
                  <th scope="col">Last Reviewed</th>
                </tr>
              </thead>
              <tbody>
                {COMPUTE_EVIDENCE_REGISTER.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-subtle transition-colors text-[12.5px]">
                    <td className="font-semibold text-ink px-3.5 py-2.5">{item.parameter}</td>
                    <td className="font-mono text-ink px-3.5 py-2.5 font-medium">{item.value}</td>
                    <td className="px-3.5 py-2.5">
                      <span
                        className={`font-mono text-[10.5px] font-bold px-2 py-0.5 rounded border ${
                          item.verificationStatus === "Reported"
                            ? "bg-[#E5EBDD] text-[#234638] border-[#234638]/30"
                            : item.verificationStatus === "Planning Assumption"
                              ? "bg-[#FAF1DC] text-[#966914] border-[#966914]/30"
                              : "bg-gray-100 text-gray-700 border-gray-300"
                        }`}
                      >
                        {item.verificationStatus}
                      </span>
                    </td>
                    <td className="text-muted text-[12px] px-3.5 py-2.5">{item.sourceJustification}</td>
                    <td className="font-mono text-muted text-[11px] px-3.5 py-2.5">{item.lastReviewed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Interactive Scenario Builder Modal */}
      <ComputeScenarioBuilder
        isOpen={builderModalOpen}
        onClose={() => setBuilderModalOpen(false)}
        scenario={activeScenarioInputs}
        baselineScenario={scenarios.pilot}
        onSaveScenario={handleUpdateScenario}
        initialHardware={hardwareSpecs[selectedScenarioId]}
      />
    </div>
  );
}
