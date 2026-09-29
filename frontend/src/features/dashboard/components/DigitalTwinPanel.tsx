import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Box,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Clock3,
  Cpu,
  Droplets,
  Factory,
  Gauge,
  Leaf,
  MapPin,
  Search,
  Thermometer,
  Wrench,
  X,
  Zap,
} from "lucide-react";

import {
  useMemo,
  useState,
} from "react";

import { useMachineSelection } from "../../../context/MachineSelectionContext";

import { useMachines } from "../../../hooks/useMachines";

// ============================================================
// MACHINE IMAGES
// ============================================================

import boilerImage from "../../../assets/machines/boiler.png";
import pumpImage from "../../../assets/machines/pump.png";
import motorImage from "../../../assets/machines/motor.png";
import compressorImage from "../../../assets/machines/compressor.png";

// ============================================================
// COMPONENT
// ============================================================

export default function DigitalTwinPanel() {
  const {
    machines,
    loading,
    error,
  } = useMachines();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] =
    useState("All");

  const {
    selectedMachineId,
    selectMachine,
  } = useMachineSelection();

  const [showDetails, setShowDetails] =
    useState(false);

  // ==========================================================
  // MACHINE TYPES
  // ==========================================================

  const machineTypes = useMemo(() => {
    return Array.from(
      new Set(
        machines
          .map((machine) => machine.type)
          .filter(Boolean)
      )
    ).sort();
  }, [machines]);

  // ==========================================================
  // DEPARTMENTS
  // ==========================================================

  const departments = useMemo(() => {
    return Array.from(
      new Set(
        machines
          .map((machine) => machine.department)
          .filter(Boolean)
      )
    ).sort();
  }, [machines]);

  // ==========================================================
  // FILTER
  // ==========================================================

  const filteredMachines = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return machines.filter((machine) => {
      const matchesSearch =
        !query ||
        machine.name
          .toLowerCase()
          .includes(query) ||
        machine.id
          .toLowerCase()
          .includes(query) ||
        machine.type
          .toLowerCase()
          .includes(query) ||
        machine.location
          .toLowerCase()
          .includes(query);

      const matchesType =
        typeFilter === "All" ||
        machine.type === typeFilter;

      const matchesDepartment =
        departmentFilter === "All" ||
        machine.department === departmentFilter;

      return (
        matchesSearch &&
        matchesType &&
        matchesDepartment
      );
    });
  }, [
    machines,
    search,
    typeFilter,
    departmentFilter,
  ]);

  // ==========================================================
  // SELECTED MACHINE
  // ==========================================================

  const selectedMachine =
    machines.find(
      (machine) =>
        machine.id === selectedMachineId
    ) ?? null;

  // ==========================================================
  // SUMMARY
  // ==========================================================

  const operationalCount =
    machines.filter(
      (machine) =>
        normalizeStatus(
          machine.maintenance_status
        ) === "operational"
    ).length;

  const attentionCount =
    machines.filter(
      (machine) =>
        normalizeStatus(
          machine.maintenance_status
        ) === "attention"
    ).length;

  const criticalCount =
    machines.filter(
      (machine) =>
        normalizeStatus(
          machine.maintenance_status
        ) === "critical"
    ).length;

  // ==========================================================
  // LOADING
  // ==========================================================

  if (
    loading &&
    machines.length === 0
  ) {
    return (
      <section className="overflow-hidden rounded-[20px] border border-[#DDE7E1] bg-white shadow-[0_4px_20px_rgba(15,23,42,0.035)]">

        <div className="border-b border-[#E6ECE8] px-5 py-5 md:px-7">

          <div className="animate-pulse">

            <div className="h-4 w-36 rounded bg-[#EEF3F0]" />

            <div className="mt-2 h-2.5 w-72 rounded bg-[#F1F5F3]" />

            <div className="mt-5 h-10 w-full rounded-xl bg-[#F1F5F3]" />

          </div>

        </div>

        <div className="grid grid-cols-1 gap-4 bg-[#F8FBF9] p-5 sm:grid-cols-2 xl:grid-cols-3 md:p-7">

          {[1, 2, 3, 4, 5, 6].map(
            (item) => (
              <div
                key={item}
                className="rounded-[16px] border border-[#E4ECE7] bg-white p-5"
              >
                <div className="animate-pulse">

                  <div className="flex items-center justify-between">

                    <div className="flex gap-3">

                      <div className="h-11 w-11 rounded-xl bg-[#EEF3F0]" />

                      <div>
                        <div className="h-3 w-28 rounded bg-[#EEF3F0]" />
                        <div className="mt-2 h-2 w-20 rounded bg-[#F3F6F4]" />
                      </div>

                    </div>

                    <div className="h-3 w-3 rounded-full bg-[#EEF3F0]" />

                  </div>

                  <div className="mt-6 h-2 w-full rounded bg-[#EEF3F0]" />

                  <div className="mt-4 h-9 w-full rounded-lg bg-[#F3F6F4]" />

                </div>
              </div>
            )
          )}

        </div>

      </section>
    );
  }

  // ==========================================================
  // ERROR
  // ==========================================================

  if (
    error &&
    machines.length === 0
  ) {
    return (
      <section className="rounded-[20px] border border-red-200 bg-white p-7 shadow-sm">

        <div className="flex items-center gap-3">

          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <AlertCircle size={19} />
          </div>

          <div>

            <p className="text-sm font-extrabold text-red-700">
              Digital twin unavailable
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {error}
            </p>

          </div>

        </div>

      </section>
    );
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <section className="overflow-hidden rounded-[20px] border border-[#DDE7E1] bg-white shadow-[0_4px_20px_rgba(15,23,42,0.035)]">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="border-b border-[#E6ECE8] bg-white px-5 py-5 md:px-7">

        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

          {/* TITLE */}

          <div className="flex min-w-0 items-center gap-3">

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[#EAF8F0] text-[#128047]">
              <Factory size={19} />
            </div>

            <div className="min-w-0">

              <div className="flex flex-wrap items-center gap-2">

                <h2 className="text-[16px] font-extrab800 tracking-[-0.02em] text-[#15211B]">
                  Digital Twin
                </h2>

                <span className="flex items-center gap-1.5 rounded-full border border-[#BCE7CE] bg-[#F0FBF4] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-[#147A45]">

                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                    <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>

                  Live

                </span>

              </div>

              <p className="mt-1 text-[10px] text-[#7A8880]">
                Live representation of connected industrial assets
              </p>

            </div>

          </div>

          {/* SUMMARY */}

          <div className="flex flex-wrap gap-2">

            <SummaryBadge
              label="Assets"
              value={machines.length}
              icon={Box}
            />

            <SummaryBadge
              label="Operational"
              value={operationalCount}
              icon={CircleCheck}
              positive
            />

            {attentionCount > 0 && (
              <SummaryBadge
                label="Attention"
                value={attentionCount}
                icon={AlertTriangle}
                warning
              />
            )}

            {criticalCount > 0 && (
              <SummaryBadge
                label="Critical"
                value={criticalCount}
                icon={AlertCircle}
                danger
              />
            )}

          </div>

        </div>

        {/* FILTERS */}

        <div className="mt-5 grid grid-cols-1 gap-2.5 lg:grid-cols-[1fr_190px_190px]">

          <div className="flex h-10 items-center gap-2 rounded-xl border border-[#E1E9E4] bg-[#F8FAF9] px-3.5 transition focus-within:border-[#8ED5A8] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#DCF5E4]">

            <Search
              size={14}
              className="shrink-0 text-[#94A19A]"
            />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search assets, IDs, types or locations..."
              className="min-w-0 flex-1 bg-transparent text-[11px] text-[#526159] outline-none placeholder:text-[#A0ACA5]"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-[#98A59E] hover:text-[#526159]"
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}

          </div>

          <FilterSelect
            value={typeFilter}
            onChange={setTypeFilter}
            options={machineTypes}
            allLabel="All machine types"
          />

          <FilterSelect
            value={departmentFilter}
            onChange={setDepartmentFilter}
            options={departments}
            allLabel="All departments"
          />

        </div>

      </div>

      {/* ======================================================
          ASSET AREA
      ====================================================== */}

      <div className="bg-[#F7FAF8] px-5 py-6 md:px-7">

        <div className="mb-5 flex items-end justify-between">

          <div>

            <div className="flex items-center gap-2">

              <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />

              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#15803D]">
                Factory Assets
              </p>

            </div>

            <p className="mt-1 text-[11px] text-[#718078]">
              Select an asset to inspect its digital twin
            </p>

          </div>

          <span className="rounded-full border border-[#E1E9E4] bg-white px-3 py-1.5 text-[8px] font-bold text-[#718078]">
            {filteredMachines.length} shown
          </span>

        </div>

        {filteredMachines.length === 0 ? (

          <div className="rounded-[16px] border border-dashed border-[#DCE6E0] bg-white p-10 text-center">

            <Search
              size={24}
              className="mx-auto text-[#C6D1CA]"
            />

            <p className="mt-3 text-xs font-bold text-[#526159]">
              No matching assets
            </p>

            <p className="mt-1 text-[10px] text-[#9AA69F]">
              Try changing the search or filters.
            </p>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setTypeFilter("All");
                setDepartmentFilter("All");
              }}
              className="mt-4 rounded-lg bg-[#ECFDF5] px-3.5 py-2 text-[10px] font-bold text-[#047857] transition hover:bg-[#D1FAE5]"
            >
              Clear filters
            </button>

          </div>

        ) : (

          /*
           * IMPORTANT:
           * This is completely dynamic.
           *
           * It does NOT assume 6 machines.
           * Whatever comes from the backend is rendered.
           */

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">

            {filteredMachines.map(
              (machine) => {

                const health =
                  Number(
                    machine.health_score || 0
                  );

                const healthStyle =
                  getHealthColor(
                    health
                  );

                const status =
                  getStatusStyles(
                    machine.maintenance_status
                  );

                const StatusIcon =
                  status.icon;

                const isSelected =
                  selectedMachine?.id ===
                  machine.id;

                return (

                  <button
                    key={machine.id}
                    type="button"
                    onClick={() => {
                      selectMachine(machine.id);
                      setShowDetails(false);
                    }}
                    className={`
                      group relative overflow-hidden rounded-[16px]
                      border bg-white text-left
                      transition-all duration-200
                      focus:outline-none
                      focus:ring-2
                      focus:ring-emerald-400/20
                      ${
                        isSelected
                          ? "border-[#78D79A] shadow-[0_10px_30px_rgba(16,185,129,0.10)]"
                          : "border-[#E0E8E3] shadow-[0_4px_15px_rgba(15,23,42,0.025)] hover:-translate-y-0.5 hover:border-[#BCE7CE] hover:shadow-[0_10px_25px_rgba(15,23,42,0.06)]"
                      }
                    `}
                  >

                    {/* TOP ACCENT */}

                    <div
                      className={`
                        absolute inset-x-0 top-0 h-[3px]
                        ${
                          isSelected
                            ? "bg-[#22C55E]"
                            : "bg-transparent group-hover:bg-[#A7E8BC]"
                        }
                      `}
                    />

                    {/* MACHINE HEADER */}

                    <div className="flex items-center justify-between border-b border-[#EDF2EF] bg-[#FBFCFB] px-4 py-3">

                      <div className="flex items-center gap-2.5">

                        <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#EFF9F2] text-[#16834A]">

                          <MachineIcon
                            type={machine.type}
                            size={15}
                          />

                        </div>

                        <div>

                          <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#748179]">
                            {machine.type}
                          </p>

                          <p className="mt-0.5 text-[7px] text-[#A0AAA4]">
                            {machine.id}
                          </p>

                        </div>

                      </div>

                      <span
                        className={`
                          h-2 w-2 rounded-full
                          ${
                            normalizeStatus(
                              machine.maintenance_status
                            ) === "operational"
                              ? "bg-[#22C55E]"
                              : normalizeStatus(
                                  machine.maintenance_status
                                ) === "attention"
                                ? "bg-[#F59E0B]"
                                : "bg-[#EF4444]"
                          }
                        `}
                      />

                    </div>

                    {/* CONTENT */}

                    <div className="p-4">

                      <div className="flex items-start justify-between gap-3">

                        <div className="min-w-0">

                          <p className="truncate text-[13px] font-extrab800 text-[#1D2A23]">
                            {machine.name}
                          </p>

                          <p className="mt-1 truncate text-[8px] text-[#8A9790]">
                            {machine.department}
                            {" · "}
                            {machine.location}
                          </p>

                        </div>

                        <ChevronRight
                          size={15}
                          className={`
                            mt-0.5 shrink-0 transition
                            ${
                              isSelected
                                ? "text-[#22A052]"
                                : "text-[#CDD6D0] group-hover:translate-x-0.5 group-hover:text-[#22A052]"
                            }
                          `}
                        />

                      </div>

                      {/* STATUS + HEALTH */}

                      <div className="mt-4 flex items-center justify-between gap-2">

                        <span
                          className={`
                            flex items-center gap-1.5
                            rounded-full border
                            px-2.5 py-1.5
                            text-[7px] font-bold
                            ${status.bg}
                            ${status.border}
                            ${status.text}
                          `}
                        >

                          <StatusIcon size={9} />

                          {machine.maintenance_status}

                        </span>

                        <span
                          className={`
                            text-[11px] font-extrab800
                            ${healthStyle.text}
                          `}
                        >
                          {health.toFixed(0)}%
                        </span>

                      </div>

                      {/* HEALTH BAR */}

                      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#EDF2EF]">

                        <div
                          className={`h-full rounded-full transition-all duration-500 ${healthStyle.bar}`}
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(
                                0,
                                health
                              )
                            )}%`,
                          }}
                        />

                      </div>

                      {/* MACHINE IMAGE */}

                      <div className="mt-4 flex h-[120px] items-center justify-center overflow-hidden rounded-[13px] bg-[#F8FAF9]">

                        <MachineVisual
                          type={machine.type}
                          selected={false}
                          small
                        />

                      </div>

                      {/* METRICS */}

                      <div className="mt-3 grid grid-cols-2 gap-2">

                        <MachineData
                          label="Power"
                          value={`${Number(
                            machine.power || 0
                          ).toFixed(0)} kW`}
                          icon={Zap}
                        />

                        <MachineData
                          label="Speed"
                          value={`${Number(
                            machine.rpm || 0
                          ).toLocaleString()} RPM`}
                          icon={Activity}
                        />

                      </div>

                      {/* LOCATION */}

                      <div className="mt-3 flex items-center gap-1.5 text-[7px] text-[#8A9790]">

                        <MapPin size={8} />

                        <span className="truncate">
                          {machine.location}
                        </span>

                      </div>

                    </div>

                  </button>
                );
              }
            )}

          </div>
        )}

      </div>

      {/* ======================================================
          SELECTED MACHINE
      ====================================================== */}

      {selectedMachine && (

        <div className="border-t border-[#E2EAE5] bg-white p-5 md:p-7">

          <div className="flex flex-col gap-6">

            {/* HEADER */}

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

              <div className="flex min-w-0 items-center gap-3">

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#EAF8F0] text-[#15803D]">

                  <MachineIcon
                    type={selectedMachine.type}
                    size={22}
                  />

                </div>

                <div className="min-w-0">

                  <div className="flex flex-wrap items-center gap-2">

                    <h3 className="truncate text-[18px] font-extrab800 tracking-[-0.025em] text-[#15211B]">
                      {selectedMachine.name}
                    </h3>

                    <StatusPill
                      status={
                        selectedMachine.maintenance_status
                      }
                    />

                  </div>

                  <p className="mt-1 text-[9px] text-[#8A9790]">
                    {selectedMachine.id}
                    {" · "}
                    {selectedMachine.type}
                    {" · "}
                    {selectedMachine.department}
                    {" · "}
                    {selectedMachine.location}
                  </p>

                </div>

              </div>

              <div className="flex items-center gap-2">

                <span className="flex items-center gap-1.5 rounded-full border border-[#BCE7CE] bg-[#F0FBF4] px-2.5 py-1.5 text-[8px] font-bold text-[#15803D]">

                  <span className="relative flex h-1.5 w-1.5">

                    <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />

                    <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />

                  </span>

                  Live telemetry

                </span>

                <button
                  type="button"
                  onClick={() =>
                    setShowDetails(true)
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-[#E1E9E4] bg-white px-3 py-2 text-[9px] font-bold text-[#5F6E65] transition hover:border-[#BCE7CE] hover:bg-[#F0FBF4] hover:text-[#15803D]"
                >

                  Full telemetry

                  <ChevronRight size={12} />

                </button>

              </div>

            </div>

            {/* MACHINE VISUAL */}

            <SelectedMachineVisual
              type={selectedMachine.type}
              status={
                selectedMachine.maintenance_status
              }
              health={Number(
                selectedMachine.health_score || 0
              )}
            />

            {/* HEALTH METRICS */}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

              <MetricBlock
                label="Health"
                value={`${Number(
                  selectedMachine.health_score || 0
                ).toFixed(0)}%`}
                tone={
                  Number(
                    selectedMachine.health_score || 0
                  ) >= 80
                    ? "green"
                    : Number(
                        selectedMachine.health_score || 0
                      ) >= 60
                      ? "amber"
                      : "red"
                }
              />

              <MetricBlock
                label="Failure Risk"
                value={`${Number(
                  selectedMachine.failure_probability || 0
                ).toFixed(1)}%`}
                tone={
                  Number(
                    selectedMachine.failure_probability || 0
                  ) >= 50
                    ? "red"
                    : Number(
                        selectedMachine.failure_probability || 0
                      ) >= 20
                      ? "amber"
                      : "green"
                }
              />

              <MetricBlock
                label="Remaining Life"
                value={`${Number(
                  selectedMachine.remaining_useful_life || 0
                ).toLocaleString()} cycles`}
              />

              <MetricBlock
                label="Efficiency"
                value={`${Number(
                  selectedMachine.efficiency || 0
                ).toFixed(1)}%`}
                tone="green"
              />

            </div>

            {/* TELEMETRY */}

            <div>

              <div className="mb-3 flex items-end justify-between">

                <div>

                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#15803D]">
                    Live Telemetry
                  </p>

                  <p className="mt-1 text-[11px] text-[#718078]">
                    Current operating conditions
                  </p>

                </div>

                <span className="flex items-center gap-1.5 text-[8px] font-bold text-[#16A34A]">

                  <span className="relative flex h-1.5 w-1.5">

                    <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />

                    <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />

                  </span>

                  Updating

                </span>

              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">

                <TelemetryCard
                  label="Temperature"
                  value={`${Number(
                    selectedMachine.temperature || 0
                  ).toFixed(1)} °C`}
                  icon={Thermometer}
                />

                <TelemetryCard
                  label="Pressure"
                  value={`${Number(
                    selectedMachine.pressure || 0
                  ).toFixed(1)} bar`}
                  icon={Gauge}
                />

                <TelemetryCard
                  label="Vibration"
                  value={`${Number(
                    selectedMachine.vibration || 0
                  ).toFixed(2)} mm/s`}
                  icon={Activity}
                />

                <TelemetryCard
                  label="RPM"
                  value={Number(
                    selectedMachine.rpm || 0
                  ).toLocaleString()}
                  icon={Activity}
                />

                <TelemetryCard
                  label="Power"
                  value={`${Number(
                    selectedMachine.power || 0
                  ).toFixed(1)} kW`}
                  icon={Zap}
                />

                <TelemetryCard
                  label="Torque"
                  value={`${Number(
                    selectedMachine.torque || 0
                  ).toFixed(1)} Nm`}
                  icon={Cpu}
                />

              </div>

            </div>

            {/* SUSTAINABILITY */}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

              <EnvironmentCard
                label="Energy"
                value={`${Number(
                  selectedMachine.energy || 0
                ).toFixed(1)} kWh`}
                icon={Zap}
                iconClass="bg-blue-50 text-blue-600"
              />

              <EnvironmentCard
                label="Carbon"
                value={`${Number(
                  selectedMachine.carbon || 0
                ).toFixed(1)} kg CO₂e`}
                icon={Leaf}
                iconClass="bg-emerald-50 text-emerald-600"
              />

              <EnvironmentCard
                label="Water"
                value={`${Number(
                  selectedMachine.water || 0
                ).toFixed(1)} L`}
                icon={Droplets}
                iconClass="bg-cyan-50 text-cyan-600"
              />

            </div>

            {/* MAINTENANCE */}

            {(selectedMachine.current_technician ||
              selectedMachine.current_ticket) && (

              <div className="rounded-[14px] border border-amber-200 bg-amber-50/60 p-4">

                <div className="flex items-start gap-3">

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <Wrench size={16} />
                  </div>

                  <div>

                    <p className="text-xs font-bold text-amber-800">
                      Maintenance attention
                    </p>

                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-amber-700">

                      {selectedMachine.current_technician && (
                        <span>
                          Technician:{" "}
                          <strong>
                            {selectedMachine.current_technician}
                          </strong>
                        </span>
                      )}

                      {selectedMachine.current_ticket && (
                        <span>
                          Ticket:{" "}
                          <strong>
                            {selectedMachine.current_ticket}
                          </strong>
                        </span>
                      )}

                    </div>

                  </div>

                </div>

              </div>

            )}

          </div>

        </div>

      )}

      {/* ======================================================
          MODAL
      ====================================================== */}

      {showDetails &&
        selectedMachine && (

          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm"
            onMouseDown={() =>
              setShowDetails(false)
            }
          >

            <div
              className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[20px] border border-[#DCE8E1] bg-white shadow-2xl"
              onMouseDown={(event) =>
                event.stopPropagation()
              }
            >

              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur-md">

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">

                    <MachineIcon
                      type={selectedMachine.type}
                      size={19}
                    />

                  </div>

                  <div>

                    <h3 className="text-sm font-extrabold text-slate-900">
                      {selectedMachine.name}
                    </h3>

                    <p className="mt-0.5 text-[9px] text-slate-400">
                      {selectedMachine.id}
                      {" · "}
                      Full digital twin telemetry
                    </p>

                  </div>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowDetails(false)
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close telemetry"
                >
                  <X size={17} />
                </button>

              </div>

              <div className="p-5 md:p-6">

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">

                  <DetailValue
                    label="Machine ID"
                    value={selectedMachine.id}
                  />

                  <DetailValue
                    label="Type"
                    value={selectedMachine.type}
                  />

                  <DetailValue
                    label="Department"
                    value={selectedMachine.department}
                  />

                  <DetailValue
                    label="Location"
                    value={selectedMachine.location}
                  />

                </div>

                <DetailSection title="Operating Telemetry">

                  <DetailValue
                    label="Temperature"
                    value={`${Number(
                      selectedMachine.temperature || 0
                    ).toFixed(2)} °C`}
                  />

                  <DetailValue
                    label="Pressure"
                    value={`${Number(
                      selectedMachine.pressure || 0
                    ).toFixed(2)} bar`}
                  />

                  <DetailValue
                    label="Vibration"
                    value={`${Number(
                      selectedMachine.vibration || 0
                    ).toFixed(2)} mm/s`}
                  />

                  <DetailValue
                    label="RPM"
                    value={Number(
                      selectedMachine.rpm || 0
                    ).toLocaleString()}
                  />

                  <DetailValue
                    label="Torque"
                    value={`${Number(
                      selectedMachine.torque || 0
                    ).toFixed(2)} Nm`}
                  />

                  <DetailValue
                    label="Power"
                    value={`${Number(
                      selectedMachine.power || 0
                    ).toFixed(2)} kW`}
                  />

                  <DetailValue
                    label="Energy"
                    value={`${Number(
                      selectedMachine.energy || 0
                    ).toFixed(2)} kWh`}
                  />

                  <DetailValue
                    label="Water"
                    value={`${Number(
                      selectedMachine.water || 0
                    ).toFixed(2)} L`}
                  />

                </DetailSection>

                <DetailSection title="Sustainability">

                  <DetailValue
                    label="Carbon Footprint"
                    value={`${Number(
                      selectedMachine.carbon || 0
                    ).toFixed(2)} kg CO₂e`}
                  />

                  <DetailValue
                    label="Efficiency"
                    value={`${Number(
                      selectedMachine.efficiency || 0
                    ).toFixed(2)}%`}
                  />

                  <DetailValue
                    label="Health Score"
                    value={`${Number(
                      selectedMachine.health_score || 0
                    ).toFixed(2)}%`}
                  />

                </DetailSection>

                <DetailSection title="Predictive Maintenance">

                  <DetailValue
                    label="Failure Probability"
                    value={`${Number(
                      selectedMachine.failure_probability || 0
                    ).toFixed(2)}%`}
                  />

                  <DetailValue
                    label="Remaining Useful Life"
                    value={`${Number(
                      selectedMachine.remaining_useful_life || 0
                    ).toLocaleString()} cycles`}
                  />

                  <DetailValue
                    label="Maintenance Status"
                    value={
                      selectedMachine.maintenance_status
                    }
                  />

                  <DetailValue
                    label="Technician"
                    value={
                      selectedMachine.current_technician ??
                      "Not assigned"
                    }
                  />

                </DetailSection>

                {selectedMachine.current_ticket && (

                  <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">

                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                      <Wrench size={16} />
                    </div>

                    <div>

                      <p className="text-xs font-bold text-amber-800">
                        Active maintenance ticket
                      </p>

                      <p className="mt-0.5 text-[10px] text-amber-700">
                        {selectedMachine.current_ticket}
                      </p>

                    </div>

                  </div>

                )}

                {selectedMachine.ai_prediction && (

                  <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50/60 p-4">

                    <div className="flex items-center gap-3">

                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                        <Activity size={16} />
                      </div>

                      <div>

                        <p className="text-xs font-bold text-violet-800">
                          AI Prediction
                        </p>

                        <p className="mt-0.5 text-[9px] text-violet-500">
                          Predictive maintenance analysis
                        </p>

                      </div>

                    </div>

                    <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-white p-3 text-[9px] leading-5 text-slate-600">
                      {JSON.stringify(
                        selectedMachine.ai_prediction,
                        null,
                        2
                      )}
                    </pre>

                  </div>

                )}

              </div>

            </div>

          </div>
        )}

    </section>
  );
}

// ============================================================
// SELECTED MACHINE VISUAL
// ============================================================

function SelectedMachineVisual({
  type,
  status,
  health,
}: {
  type: string;
  status: string;
  health: number;
}) {
  const condition =
    getMachineCondition(
      status,
      health
    );

  return (
    <div
      className={`
        relative flex h-[250px] w-full
        items-center justify-center
        overflow-hidden rounded-[18px]
        border
        ${condition.border}
        ${condition.background}
      `}
    >

      <div
        className={`
          absolute h-48 w-48 rounded-full blur-3xl
          ${condition.glow}
        `}
      />

      {/* subtle technical grid */}

      <div className="pointer-events-none absolute inset-0 opacity-[0.25]">

        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(100,116,139,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(100,116,139,0.06) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

      </div>

      <div
        className={`
          relative z-10
          flex h-[190px] w-[310px]
          items-center justify-center
          transition-all duration-500
          ${condition.machine}
        `}
      >

        <MachineVisual
          type={type}
          selected
        />

      </div>

      <div
        className={`
          absolute right-4 top-4
          flex items-center gap-1.5
          rounded-full border
          px-2.5 py-1.5
          text-[8px] font-bold
          ${condition.badge}
        `}
      >

        <span
          className={`
            h-1.5 w-1.5 rounded-full
            ${condition.dot}
          `}
        />

        {condition.label}

      </div>

      <div className="absolute left-4 top-4">

        <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-[#15803D]">
          Live Asset Intelligence
        </p>

        <p className="mt-1 text-[7px] text-[#8A9790]">
          Dynamic machine condition
        </p>

      </div>

      <div className="absolute bottom-4 left-4 right-4">

        <div className="flex items-center justify-between">

          <span className="text-[8px] font-bold uppercase tracking-wider text-[#718078]">
            Condition
          </span>

          <span
            className={`text-[9px] font-extrabold ${condition.text}`}
          >
            {health.toFixed(0)}%
          </span>

        </div>

        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/5">

          <div
            className={`h-full rounded-full transition-all duration-500 ${condition.bar}`}
            style={{
              width: `${Math.min(
                100,
                Math.max(
                  0,
                  health
                )
              )}%`,
            }}
          />

        </div>

      </div>

    </div>
  );
}

// ============================================================
// MACHINE CONDITION
// ============================================================

function getMachineCondition(
  status: string,
  health: number
) {
  const normalized =
    normalizeStatus(status);

  if (
    normalized === "critical" ||
    health < 60
  ) {
    return {
      label: "Critical",
      border: "border-red-200",
      background: "bg-red-50/40",
      glow: "bg-red-200/40",
      machine:
        "brightness-[0.90] saturate-[1.15]",
      badge:
        "border-red-200 bg-red-50 text-red-700",
      dot: "bg-red-500",
      text: "text-red-600",
      bar: "bg-red-500",
    };
  }

  if (
    normalized === "attention" ||
    health < 80
  ) {
    return {
      label: "Warning",
      border: "border-amber-200",
      background: "bg-amber-50/40",
      glow: "bg-amber-200/40",
      machine:
        "brightness-[0.97] saturate-[1.10]",
      badge:
        "border-amber-200 bg-amber-50 text-amber-700",
      dot: "bg-amber-500",
      text: "text-amber-600",
      bar: "bg-amber-500",
    };
  }

  return {
    label: "Operational",
    border: "border-emerald-200",
    background: "bg-emerald-50/30",
    glow: "bg-emerald-200/40",
    machine:
      "brightness-[1.02] saturate-[1.05]",
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    text: "text-emerald-600",
    bar: "bg-emerald-500",
  };
}

// ============================================================
// MACHINE VISUAL
// ============================================================

interface MachineVisualProps {
  type: string;
  selected: boolean;
  small?: boolean;
}

function MachineVisual({
  type,
  selected,
  small = false,
}: MachineVisualProps) {

  const normalized =
    type.toLowerCase();

  let image =
    motorImage;

  let alt =
    "Industrial machine";

  if (
    normalized.includes("boiler")
  ) {
    image =
      boilerImage;

    alt =
      "Industrial boiler";
  } else if (
    normalized.includes("pump")
  ) {
    image =
      pumpImage;

    alt =
      "Industrial cooling pump";
  } else if (
    normalized.includes("compressor") ||
    normalized.includes("compress")
  ) {
    image =
      compressorImage;

    alt =
      "Industrial air compressor";
  } else if (
    normalized.includes("motor")
  ) {
    image =
      motorImage;

    alt =
      "Industrial production motor";
  }

  return (
    <div
      className={`
        relative flex
        items-center justify-center
        transition-all duration-500
        ${
          small
            ? "h-full w-full p-4"
            : "h-full w-full"
        }
        ${selected ? "scale-[1.02]" : ""}
      `}
    >

      <img
        src={image}
        alt={alt}
        draggable={false}
        className={`
          select-none
          object-contain
          ${
            small
              ? "max-h-[105px] max-w-[190px]"
              : "max-h-full max-w-full"
          }
          drop-shadow-[0_10px_16px_rgba(15,23,42,0.10)]
        `}
      />

      {selected && (
        <div className="pointer-events-none absolute inset-3 rounded-[20px] ring-1 ring-emerald-300/20" />
      )}

    </div>
  );
}

// ============================================================
// MACHINE ICON
// ============================================================

function MachineIcon({
  type,
  size = 20,
}: {
  type: string;
  size?: number;
}) {

  const normalized =
    type.toLowerCase();

  if (
    normalized.includes("boiler")
  ) {
    return <Factory size={size} />;
  }

  if (
    normalized.includes("pump")
  ) {
    return <Droplets size={size} />;
  }

  if (
    normalized.includes("motor")
  ) {
    return <Cpu size={size} />;
  }

  if (
    normalized.includes("compress")
  ) {
    return <Gauge size={size} />;
  }

  return <Box size={size} />;
}

// ============================================================
// SUMMARY BADGE
// ============================================================

interface SummaryBadgeProps {
  label: string;
  value: number;
  icon: typeof Box;
  positive?: boolean;
  warning?: boolean;
  danger?: boolean;
}

function SummaryBadge({
  label,
  value,
  icon: Icon,
  positive,
  warning,
  danger,
}: SummaryBadgeProps) {

  let classes =
    "border-[#E0E8E3] bg-white text-[#64736A]";

  if (positive) {
    classes =
      "border-[#BCE7CE] bg-[#F0FBF4] text-[#15803D]";
  }

  if (warning) {
    classes =
      "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (danger) {
    classes =
      "border-red-200 bg-red-50 text-red-700";
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-[10px] border px-3 py-1.5 ${classes}`}
    >

      <Icon size={11} />

      <div className="flex items-center gap-1.5">

        <span className="text-[7px] font-semibold uppercase tracking-wider opacity-70">
          {label}
        </span>

        <span className="text-[11px] font-extrab800">
          {value}
        </span>

      </div>

    </div>
  );
}

// ============================================================
// FILTER SELECT
// ============================================================

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  allLabel: string;
}

function FilterSelect({
  value,
  onChange,
  options,
  allLabel,
}: FilterSelectProps) {

  return (
    <div className="relative">

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="h-10 w-full appearance-none rounded-xl border border-[#E1E9E4] bg-[#F8FAF9] px-3.5 pr-9 text-[10px] font-medium text-[#64736A] outline-none transition focus:border-[#8ED5A8] focus:bg-white focus:ring-2 focus:ring-[#DCF5E4]"
      >

        <option value="All">
          {allLabel}
        </option>

        {options.map(
          (option) => (
            <option
              key={option}
              value={option}
            >
              {option}
            </option>
          )
        )}

      </select>

      <ChevronDown
        size={13}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#98A59E]"
      />

    </div>
  );
}

// ============================================================
// MACHINE DATA
// ============================================================

function MachineData({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Zap;
}) {

  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-[#F7FAF8] px-2.5 py-2">

      <Icon
        size={10}
        className="shrink-0 text-[#8A9790]"
      />

      <div className="min-w-0">

        <p className="text-[6px] font-bold uppercase tracking-wider text-[#9AA69F]">
          {label}
        </p>

        <p className="mt-0.5 truncate text-[9px] font-bold text-[#526159]">
          {value}
        </p>

      </div>

    </div>
  );
}

// ============================================================
// STATUS PILL
// ============================================================

function StatusPill({
  status,
}: {
  status: string;
}) {

  const style =
    getStatusStyles(status);

  const Icon =
    style.icon;

  return (
    <span
      className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-[7px] font-bold ${style.bg} ${style.border} ${style.text}`}
    >

      <Icon size={9} />

      {status}

    </span>
  );
}

// ============================================================
// METRIC BLOCK
// ============================================================

function MetricBlock({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "amber" | "red";
}) {

  const toneClass =
    tone === "green"
      ? "text-emerald-600"
      : tone === "amber"
        ? "text-amber-600"
        : tone === "red"
          ? "text-red-600"
          : "text-slate-800";

  return (
    <div className="rounded-[14px] border border-[#E1E9E4] bg-[#F8FAF9] p-4">

      <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1.5 text-[17px] font-extrab800 ${toneClass}`}
      >
        {value}
      </p>

    </div>
  );
}

// ============================================================
// TELEMETRY CARD
// ============================================================

function TelemetryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Activity;
}) {

  return (
    <div className="rounded-[13px] border border-[#E1E9E4] bg-white p-3 transition hover:border-emerald-200 hover:shadow-sm">

      <div className="flex items-center gap-1.5">

        <Icon
          size={11}
          className="text-emerald-500"
        />

        <p className="text-[7px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </p>

      </div>

      <p className="mt-2 truncate text-[13px] font-extrab800 text-slate-800">
        {value}
      </p>

    </div>
  );
}

// ============================================================
// ENVIRONMENT CARD
// ============================================================

function EnvironmentCard({
  label,
  value,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: string;
  icon: typeof Activity;
  iconClass: string;
}) {

  return (
    <div className="flex items-center gap-3 rounded-[13px] border border-[#E1E9E4] bg-[#F8FAF9] p-3.5">

      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconClass}`}
      >
        <Icon size={15} />
      </div>

      <div className="min-w-0">

        <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </p>

        <p className="mt-0.5 truncate text-sm font-extrab800 text-slate-800">
          {value}
        </p>

      </div>

    </div>
  );
}

// ============================================================
// DETAIL SECTION
// ============================================================

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {

  return (
    <div className="mt-5">

      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
        {title}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {children}
      </div>

    </div>
  );
}

// ============================================================
// DETAIL VALUE
// ============================================================

function DetailValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">

      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-bold text-slate-800">
        {value}
      </p>

    </div>
  );
}

// ============================================================
// HEALTH COLOR
// ============================================================

function getHealthColor(
  health: number
) {

  if (health >= 80) {
    return {
      text: "text-emerald-600",
      bar: "bg-emerald-500",
    };
  }

  if (health >= 60) {
    return {
      text: "text-amber-600",
      bar: "bg-amber-500",
    };
  }

  return {
    text: "text-red-600",
    bar: "bg-red-500",
  };
}

// ============================================================
// STATUS
// ============================================================

function getStatusStyles(
  status: string
) {

  const normalized =
    normalizeStatus(status);

  if (
    normalized ===
    "operational"
  ) {
    return {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      text: "text-emerald-700",
      icon: CircleCheck,
    };
  }

  if (
    normalized ===
    "attention"
  ) {
    return {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
      icon: AlertTriangle,
    };
  }

  if (
    normalized ===
    "critical"
  ) {
    return {
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-700",
      icon: AlertCircle,
    };
  }

  return {
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-600",
    icon: Clock3,
  };
}

// ============================================================
// NORMALIZE STATUS
// ============================================================

function normalizeStatus(
  status: string
) {

  const value =
    status
      .toLowerCase()
      .trim();

  if (
    value.includes(
      "operational"
    ) ||
    value.includes(
      "running"
    ) ||
    value.includes(
      "normal"
    )
  ) {
    return "operational";
  }

  if (
    value.includes(
      "attention"
    ) ||
    value.includes(
      "warning"
    ) ||
    value.includes(
      "maintenance"
    )
  ) {
    return "attention";
  }

  if (
    value.includes(
      "critical"
    ) ||
    value.includes(
      "failure"
    ) ||
    value.includes(
      "offline"
    ) ||
    value.includes(
      "emergency"
    ) ||
    value.includes(
      "stopped"
    )
  ) {
    return "critical";
  }

  return "unknown";
}