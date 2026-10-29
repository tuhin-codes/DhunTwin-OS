/* ============================================================
   DHUN TWIN OS — COMPUTE SCENARIO BUILDER
   Interactive modal & drawer for configuring compute scenarios,
   editing power assumptions, specifying hardware BOMs,
   comparing baseline vs proposed, and preventing double-counting.
   ============================================================ */

import { useState } from "react";
import {
  X,
  RotateCcw,
  Sliders,
  Cpu,
  Zap,
  IndianRupee,
  HelpCircle,
} from "lucide-react";

import {
  type ComputeScenarioInputs,
  type ComputeScenarioOutputs,
  calculateComputeScenario,
  COMPUTE_DEFAULT_SCENARIOS,
  type HardwareSpecification,
} from "../engine/computeCommonsEngine";
import { num } from "../lib/format";

interface ComputeScenarioBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  scenario: ComputeScenarioInputs;
  baselineScenario?: ComputeScenarioInputs;
  onSaveScenario: (updated: ComputeScenarioInputs, hardware?: HardwareSpecification) => void;
  initialHardware?: HardwareSpecification;
}

const GPU_PRESETS = [
  { model: "NVIDIA H100 SXM (80GB HBM3)", vramGb: 80, tdpWatts: 700, tflops: 1979 },
  { model: "NVIDIA A100 SXM (80GB HBM2e)", vramGb: 80, tdpWatts: 400, tflops: 312 },
  { model: "NVIDIA L40S (48GB GDDR6)", vramGb: 48, tdpWatts: 350, tflops: 366 },
  { model: "NVIDIA RTX 4090 (24GB GDDR6X)", vramGb: 24, tdpWatts: 450, tflops: 165 },
  { model: "Apple M2 Ultra / Mac Studio (192GB)", vramGb: 192, tdpWatts: 120, tflops: 55 },
  { model: "Custom / Unspecified Accelerator", vramGb: 32, tdpWatts: 300, tflops: 100 },
];

export default function ComputeScenarioBuilder({
  isOpen,
  onClose,
  scenario,
  baselineScenario,
  onSaveScenario,
  initialHardware,
}: ComputeScenarioBuilderProps) {
  // Scenario inputs state
  const [form, setForm] = useState<ComputeScenarioInputs>({ ...scenario });

  // Hardware config state
  const [hardware, setHardware] = useState<HardwareSpecification>(
    initialHardware || { status: "unspecified" }
  );

  const [activeTab, setActiveTab] = useState<"power" | "hardware">("power");

  if (!isOpen) return null;

  // Real-time calculation of proposed scenario
  const proposedOutputs: ComputeScenarioOutputs = calculateComputeScenario(form);

  // Real-time calculation of baseline scenario for comparison
  const baselineOutputs: ComputeScenarioOutputs = calculateComputeScenario(
    baselineScenario || COMPUTE_DEFAULT_SCENARIOS.pilot
  );

  const handleResetDefaults = () => {
    const defaultTemplate =
      COMPUTE_DEFAULT_SCENARIOS[form.id as keyof typeof COMPUTE_DEFAULT_SCENARIOS] ||
      COMPUTE_DEFAULT_SCENARIOS.pilot;
    setForm({ ...defaultTemplate });
    setHardware({ status: "unspecified" });
  };

  const handleSave = () => {
    onSaveScenario(form, hardware);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-[#FFFDF8] border border-[#DCDDD2] rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-[#202923]">
        {/* Header */}
        <div className="p-4 md:px-6 border-b border-[#DCDDD2] bg-[#F4F2EA]/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#234638] text-white flex items-center justify-center shadow-xs">
              <Sliders size={18} />
            </div>
            <div>
              <h3 className="font-bold text-[16px] text-[#202923] flex items-center gap-2">
                <span>Compute Scenario Modeller</span>
                <span className="font-mono text-[11px] font-semibold bg-[#E5EBDD] text-[#234638] px-2 py-0.5 rounded">
                  {form.name}
                </span>
              </h3>
              <p className="text-[12px] text-[#68736C]">
                Interactive assumptions engine: edit power draw, operating hours, PUE, and optional hardware specs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="btn btn-sm btn-outline text-[11.5px] flex items-center gap-1.5 py-1 px-2.5 text-[#68736C] hover:text-[#202923]"
              title="Reset all inputs back to original scenario template defaults"
            >
              <RotateCcw size={12} />
              <span>Reset Defaults</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-[#68736C] hover:text-[#202923] p-1.5 rounded-md hover:bg-gray-200/50 cursor-pointer"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#DCDDD2] bg-[#F4F2EA]/40 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab("power")}
            className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "power"
                ? "border-[#234638] text-[#234638] font-bold"
                : "border-transparent text-[#68736C] hover:text-[#202923]"
            }`}
          >
            <Zap size={14} />
            <span>Power & Energy Assumptions</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("hardware")}
            className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "hardware"
                ? "border-[#234638] text-[#234638] font-bold"
                : "border-transparent text-[#68736C] hover:text-[#202923]"
            }`}
          >
            <Cpu size={14} />
            <span>Hardware BOM (Optional)</span>
            {hardware.status === "unspecified" ? (
              <span className="text-[10px] font-mono bg-gray-200 text-gray-700 px-1.5 py-0.2 rounded">
                Unspecified
              </span>
            ) : (
              <span className="text-[10px] font-mono bg-[#E5EBDD] text-[#234638] font-bold px-1.5 py-0.2 rounded">
                Specified
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "power" ? (
            <div className="space-y-6">
              {/* Scenario Name & Description */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-[#202923] mb-1">
                    Scenario Title
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full text-[13px] px-3 py-1.5 rounded-md border border-[#DCDDD2] bg-white focus:outline-hidden focus:border-[#234638]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#202923] mb-1">
                    Description & Context
                  </label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full text-[13px] px-3 py-1.5 rounded-md border border-[#DCDDD2] bg-white focus:outline-hidden focus:border-[#234638]"
                  />
                </div>
              </div>

              {/* Input Mode Selector (Avoids Double Counting Utilisation) */}
              <div className="p-3.5 bg-white border border-[#DCDDD2] rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-semibold text-[#202923] flex items-center gap-1.5">
                    <Zap size={14} className="text-[#D9A441]" />
                    IT Power Sizing Method
                  </span>
                  <span className="text-[11px] text-[#68736C]">
                    Strictly prevents double-counting utilisation
                  </span>
                </div>

                <div className="inline-flex rounded-md border border-[#DCDDD2] bg-[#F4F2EA] p-0.5">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, inputMode: "averageLoad" })}
                    className={`px-3 py-1 text-[12px] font-medium rounded transition-all cursor-pointer ${
                      form.inputMode === "averageLoad"
                        ? "bg-[#234638] text-white shadow-xs font-semibold"
                        : "text-[#68736C] hover:text-[#202923]"
                    }`}
                  >
                    Direct Average IT Load (kW)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, inputMode: "ratedUtilisation" })}
                    className={`px-3 py-1 text-[12px] font-medium rounded transition-all cursor-pointer ${
                      form.inputMode === "ratedUtilisation"
                        ? "bg-[#234638] text-white shadow-xs font-semibold"
                        : "text-[#68736C] hover:text-[#202923]"
                    }`}
                  >
                    Rated Capacity (kW) × Utilisation (%)
                  </button>
                </div>

                {form.inputMode === "averageLoad" ? (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#DCDDD2]/60">
                    <div>
                      <label className="block text-[12px] font-semibold text-[#202923] mb-1">
                        Average Continuous IT Load (kW)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.5"
                          min="0.1"
                          max="500"
                          value={form.averageItLoadKw}
                          onChange={(e) =>
                            setForm({ ...form, averageItLoadKw: parseFloat(e.target.value) || 0 })
                          }
                          className="w-32 text-[14px] font-mono px-3 py-1.5 rounded-md border border-[#DCDDD2] bg-white font-bold text-[#234638]"
                        />
                        <span className="text-[12px] text-[#68736C]">kW active IT draw</span>
                      </div>
                    </div>
                    <p className="text-[11.5px] text-[#68736C] leading-relaxed self-center">
                      Energy calculations will use this average load directly across active operating hours.
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#DCDDD2]/60">
                    <div>
                      <label className="block text-[12px] font-semibold text-[#202923] mb-1">
                        Nameplate / Rated IT Capacity (kW)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        max="500"
                        value={form.ratedItCapacityKw || 20}
                        onChange={(e) =>
                          setForm({ ...form, ratedItCapacityKw: parseFloat(e.target.value) || 0 })
                        }
                        className="w-32 text-[14px] font-mono px-3 py-1.5 rounded-md border border-[#DCDDD2] bg-white font-bold text-[#202923]"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-[#202923] mb-1">
                        Expected Average Utilisation (%)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="10"
                          max="100"
                          step="5"
                          value={form.averageUtilisationPct || 75}
                          onChange={(e) =>
                            setForm({ ...form, averageUtilisationPct: parseFloat(e.target.value) || 0 })
                          }
                          className="w-32 accent-[#234638]"
                        />
                        <span className="font-mono text-[13px] font-bold text-[#234638]">
                          {form.averageUtilisationPct || 75}%
                        </span>
                        <span className="text-[11.5px] text-[#68736C]">
                          = <strong>{proposedOutputs.effectiveItLoadKw.toFixed(1)} kW</strong> effective
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Operating Schedule & PUE */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Operating Hours / Day */}
                <div className="p-3.5 bg-white border border-[#DCDDD2] rounded-lg">
                  <label className="block text-[12px] font-semibold text-[#202923] mb-1">
                    Operating Schedule (Hours / Day)
                  </label>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      min="1"
                      max="24"
                      step="1"
                      value={form.operatingHoursPerDay}
                      onChange={(e) =>
                        setForm({ ...form, operatingHoursPerDay: parseFloat(e.target.value) || 0 })
                      }
                      className="w-20 text-[14px] font-mono px-2.5 py-1 rounded border border-[#DCDDD2] font-bold"
                    />
                    <span className="text-[12px] text-[#68736C]">hrs / day</span>
                  </div>
                  <div className="mt-2 text-[11px] text-[#68736C]">
                    {form.operatingHoursPerDay === 24
                      ? "24/7 continuous operation"
                      : `${form.operatingHoursPerDay}h daily (e.g. daytime solar window)`}
                  </div>
                </div>

                {/* Operating Days / Year */}
                <div className="p-3.5 bg-white border border-[#DCDDD2] rounded-lg">
                  <label className="block text-[12px] font-semibold text-[#202923] mb-1">
                    Operating Days / Year
                  </label>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      step="1"
                      value={form.operatingDaysPerYear}
                      onChange={(e) =>
                        setForm({ ...form, operatingDaysPerYear: parseFloat(e.target.value) || 365 })
                      }
                      className="w-20 text-[14px] font-mono px-2.5 py-1 rounded border border-[#DCDDD2] font-bold"
                    />
                    <span className="text-[12px] text-[#68736C]">days / yr</span>
                  </div>
                  <div className="mt-2 text-[11px] text-[#68736C]">
                    Total: {proposedOutputs.annualOperatingHours.toLocaleString()} annual run hours
                  </div>
                </div>

                {/* PUE Facility Ratio */}
                <div className="p-3.5 bg-white border border-[#DCDDD2] rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[12px] font-semibold text-[#202923]">
                      Facility PUE Ratio
                    </label>
                    <span className="font-mono text-[11px] font-bold text-[#234638]">
                      {form.pue.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1.05"
                    max="2.00"
                    step="0.01"
                    value={form.pue}
                    onChange={(e) => setForm({ ...form, pue: parseFloat(e.target.value) || 1.3 })}
                    className="w-full accent-[#234638] mt-2"
                  />
                  <div className="mt-2 flex items-center justify-between text-[11px] text-[#68736C]">
                    <span>Overhead: +{proposedOutputs.pueOverheadPct.toFixed(0)}%</span>
                    <span>Min: 1.00</span>
                  </div>
                </div>
              </div>

              {/* Electricity Tariff */}
              <div className="p-3.5 bg-white border border-[#DCDDD2] rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[12px] font-semibold text-[#202923] flex items-center gap-1.5">
                    <IndianRupee size={13} className="text-[#234638]" />
                    Effective Electricity Tariff (₹ / kWh)
                  </label>
                  <span className="text-[11px] text-[#68736C]">
                    Working planning tariff assumption
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    step="0.5"
                    value={form.electricityRateInrPerKwh}
                    onChange={(e) =>
                      setForm({ ...form, electricityRateInrPerKwh: parseFloat(e.target.value) || 10 })
                    }
                    className="w-28 text-[14px] font-mono px-2.5 py-1 rounded border border-[#DCDDD2] font-bold text-[#234638]"
                  />
                  <span className="text-[12px] text-[#68736C]">₹ per kWh (pending JVVNL audit)</span>
                </div>
              </div>
            </div>
          ) : (
            /* Hardware Configuration Tab */
            <div className="space-y-5">
              <div className="p-4 bg-white border border-[#DCDDD2] rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-[14px] text-[#202923]">Hardware BOM Status</h4>
                    <p className="text-[12px] text-[#68736C]">
                      Model hardware and accelerator BOM separately from power. Energy is derived from the power inputs above.
                    </p>
                  </div>
                  <div className="inline-flex rounded-md border border-[#DCDDD2] bg-[#F4F2EA] p-0.5">
                    <button
                      type="button"
                      onClick={() => setHardware({ ...hardware, status: "unspecified" })}
                      className={`px-3 py-1 text-[12px] font-medium rounded cursor-pointer ${
                        hardware.status === "unspecified"
                          ? "bg-[#234638] text-white font-semibold"
                          : "text-[#68736C]"
                      }`}
                    >
                      Unspecified
                    </button>
                    <button
                      type="button"
                      onClick={() => setHardware({ ...hardware, status: "specified" })}
                      className={`px-3 py-1 text-[12px] font-medium rounded cursor-pointer ${
                        hardware.status === "specified"
                          ? "bg-[#234638] text-white font-semibold"
                          : "text-[#68736C]"
                      }`}
                    >
                      Specify Hardware
                    </button>
                  </div>
                </div>

                {hardware.status === "unspecified" ? (
                  <div className="p-4 bg-[#F4F2EA]/40 border border-dashed border-[#DCDDD2] rounded-lg text-center">
                    <HelpCircle size={24} className="text-[#68736C] mx-auto mb-1.5" />
                    <p className="text-[13px] font-medium text-[#202923]">
                      Hardware specifications not yet specified.
                    </p>
                    <p className="text-[12px] text-[#68736C] mt-1 max-w-md mx-auto">
                      Energy and cost calculations remain fully functional based on your {proposedOutputs.effectiveItLoadKw} kW IT power envelope. Specific GPU counts, VRAM, and token throughput can be assigned when procurement is confirmed.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[12px] font-semibold text-[#202923] mb-1">
                          GPU Accelerator Preset
                        </label>
                        <select
                          value={hardware.gpuModel || GPU_PRESETS[0].model}
                          onChange={(e) => {
                            const found = GPU_PRESETS.find((p) => p.model === e.target.value);
                            setHardware({
                              ...hardware,
                              gpuModel: e.target.value,
                              vramPerGpuGb: found?.vramGb || 80,
                              aggregateVramGb: (found?.vramGb || 80) * (hardware.gpuCount || 8),
                            });
                          }}
                          className="w-full text-[13px] px-3 py-1.5 rounded border border-[#DCDDD2] bg-white"
                        >
                          {GPU_PRESETS.map((p) => (
                            <option key={p.model} value={p.model}>
                              {p.model}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[12px] font-semibold text-[#202923] mb-1">
                          Accelerator Count
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="128"
                          value={hardware.gpuCount || 8}
                          onChange={(e) => {
                            const count = parseInt(e.target.value) || 1;
                            setHardware({
                              ...hardware,
                              gpuCount: count,
                              aggregateVramGb: (hardware.vramPerGpuGb || 80) * count,
                            });
                          }}
                          className="w-24 text-[13px] font-mono px-3 py-1.5 rounded border border-[#DCDDD2] font-bold"
                        />
                        <span className="ml-2 text-[12px] text-[#68736C]">
                          Total VRAM:{" "}
                          <strong>
                            {(hardware.vramPerGpuGb || 80) * (hardware.gpuCount || 8)} GB
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                      <div>
                        <label className="block text-[12px] font-semibold text-[#202923] mb-1">
                          Server Chassis Count
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="32"
                          value={hardware.serverChassisCount || 2}
                          onChange={(e) =>
                            setHardware({
                              ...hardware,
                              serverChassisCount: parseInt(e.target.value) || 1,
                              estimatedRackUnits: (parseInt(e.target.value) || 1) * 4,
                            })
                          }
                          className="w-20 text-[13px] font-mono px-2 py-1 rounded border border-[#DCDDD2]"
                        />
                        <span className="ml-2 text-[11.5px] text-[#68736C]">nodes (e.g. 4U each)</span>
                      </div>

                      <div>
                        <label className="block text-[12px] font-semibold text-[#202923] mb-1">
                          Local NVMe Storage (TB)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="200"
                          value={hardware.localStorageTb || 30}
                          onChange={(e) =>
                            setHardware({ ...hardware, localStorageTb: parseFloat(e.target.value) || 0 })
                          }
                          className="w-24 text-[13px] font-mono px-2 py-1 rounded border border-[#DCDDD2]"
                        />
                        <span className="ml-2 text-[11.5px] text-[#68736C]">TB PCIe Gen5</span>
                      </div>

                      <div>
                        <label className="block text-[12px] font-semibold text-[#202923] mb-1">
                          Interconnect
                        </label>
                        <select
                          value={hardware.interconnect || "400Gbps InfiniBand NDR"}
                          onChange={(e) => setHardware({ ...hardware, interconnect: e.target.value })}
                          className="w-full text-[12.5px] px-2 py-1 rounded border border-[#DCDDD2] bg-white"
                        >
                          <option value="400Gbps InfiniBand NDR">400Gbps InfiniBand NDR</option>
                          <option value="100GbE RoCE v2">100GbE RoCE v2</option>
                          <option value="25GbE Standard Ethernet">25GbE Standard Ethernet</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Real-Time Scenario Outputs & Comparison Strip */}
          <div className="p-4 bg-[#F4F2EA]/60 border border-[#DCDDD2] rounded-lg">
            <h4 className="font-bold text-[13px] text-[#202923] mb-3 flex items-center justify-between">
              <span>Recalculated Energy & Cost Impact</span>
              <span className="text-[11px] font-mono text-[#68736C]">
                {proposedOutputs.isValid ? "✓ Valid Thermodynamics" : "⚠️ Constraint Notice"}
              </span>
            </h4>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white p-2.5 rounded border border-[#DCDDD2]">
                <div className="text-[11px] text-[#68736C]">Facility Energy</div>
                <div className="font-mono text-[16px] font-bold text-[#234638]">
                  {num(proposedOutputs.annualFacilityEnergyMwh, 1)}{" "}
                  <span className="text-[11px] font-normal text-[#68736C]">MWh/yr</span>
                </div>
                <div className="text-[10px] text-[#68736C] font-mono mt-0.5">
                  IT: {num(proposedOutputs.annualItEnergyMwh, 1)} MWh
                </div>
              </div>

              <div className="bg-white p-2.5 rounded border border-[#DCDDD2]">
                <div className="text-[11px] text-[#68736C]">Electricity Cost</div>
                <div className="font-mono text-[16px] font-bold text-[#D9A441]">
                  ₹{num(proposedOutputs.annualElectricityCostLakh, 2)}{" "}
                  <span className="text-[11px] font-normal text-[#68736C]">Lakh/yr</span>
                </div>
                <div className="text-[10px] text-[#68736C] font-mono mt-0.5">
                  ₹{num(proposedOutputs.monthlyElectricityCostInr, 0)}/mo
                </div>
              </div>

              <div className="bg-white p-2.5 rounded border border-[#DCDDD2]">
                <div className="text-[11px] text-[#68736C]">Average Demand</div>
                <div className="font-mono text-[16px] font-bold text-[#315D78]">
                  {num(proposedOutputs.avgFacilityDemandKw, 1)}{" "}
                  <span className="text-[11px] font-normal text-[#68736C]">kW</span>
                </div>
                <div className="text-[10px] text-[#68736C] font-mono mt-0.5">
                  During {form.operatingHoursPerDay}h run
                </div>
              </div>

              <div className="bg-white p-2.5 rounded border border-[#DCDDD2]">
                <div className="text-[11px] text-[#68736C]">Grid Carbon (0.71)</div>
                <div className="font-mono text-[16px] font-bold text-[#202923]">
                  {num(proposedOutputs.annualCarbonEmissionsTons, 1)}{" "}
                  <span className="text-[11px] font-normal text-[#68736C]">tCO₂e/yr</span>
                </div>
                <div className="text-[10px] text-[#68736C] font-mono mt-0.5">
                  If 100% grid supplied
                </div>
              </div>
            </div>

            {/* Baseline comparison if different */}
            {baselineScenario && baselineScenario.id !== form.id && (
              <div className="mt-3 pt-3 border-t border-[#DCDDD2] flex items-center justify-between text-[12px]">
                <span className="text-[#68736C]">
                  Comparison to Baseline ({baselineScenario.name}):
                </span>
                <span className="font-mono font-semibold text-[#202923]">
                  {proposedOutputs.annualFacilityEnergyMwh >= baselineOutputs.annualFacilityEnergyMwh ? "+" : ""}
                  {num(
                    proposedOutputs.annualFacilityEnergyMwh - baselineOutputs.annualFacilityEnergyMwh,
                    1
                  )}{" "}
                  MWh/yr (
                  {proposedOutputs.annualElectricityCostLakh >= baselineOutputs.annualElectricityCostLakh ? "+" : ""}
                  ₹{num(
                    proposedOutputs.annualElectricityCostLakh - baselineOutputs.annualElectricityCostLakh,
                    2
                  )}{" "}
                  Lakh/yr)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 md:px-6 border-t border-[#DCDDD2] bg-[#F4F2EA]/80 flex items-center justify-between">
          <p className="text-[11.5px] text-[#68736C]">
            Outputs update live. Electricity costs represent energy consumption only, not total hardware TCO.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-sm btn-outline text-[12px] py-1.5 px-3"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="btn btn-sm btn-accent text-[12px] py-1.5 px-4 font-semibold"
            >
              Save & Apply Scenario
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
