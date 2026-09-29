import {
  useState,
} from "react";

type ToggleProps = {
  enabled: boolean;
  onChange: () => void;
  disabled?: boolean;
};

function Toggle({
  enabled,
  onChange,
  disabled = false,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-all duration-200 ${
        enabled
          ? "bg-emerald-600 shadow-sm shadow-emerald-200"
          : "bg-slate-300"
      } ${
        disabled
          ? "cursor-not-allowed opacity-50"
          : "cursor-pointer"
      }`}
    >
      <span
        className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200 ${
          enabled
            ? "left-6"
            : "left-1"
        }`}
      />
    </button>
  );
}

type SettingRowProps = {
  title: string;
  description: string;
  enabled: boolean;
  onChange: () => void;
  accent?: "green" | "cyan" | "amber";
};

function SettingRow({
  title,
  description,
  enabled,
  onChange,
  accent = "green",
}: SettingRowProps) {

  const iconClasses = {
    green:
      "bg-emerald-50 text-emerald-700",
    cyan:
      "bg-cyan-50 text-cyan-700",
    amber:
      "bg-amber-50 text-amber-700",
  };

  return (
    <div className="flex items-center justify-between gap-5 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm">

      <div className="flex min-w-0 items-center gap-3">

        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${iconClasses[accent]}`}
        >
          {accent === "green"
            ? "CT"
            : accent === "cyan"
              ? "AI"
              : "CO"}
        </div>

        <div className="min-w-0">

          <p className="text-sm font-semibold text-slate-800">
            {title}
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            {description}
          </p>

        </div>

      </div>

      <Toggle
        enabled={enabled}
        onChange={onChange}
      />

    </div>
  );
}

type ServiceStatusProps = {
  name: string;
  description: string;
  status: string;
  statusColor?: "green" | "cyan";
};

function ServiceStatus({
  name,
  description,
  status,
  statusColor = "green",
}: ServiceStatusProps) {

  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-4 last:border-0">

      <div className="flex min-w-0 items-center gap-3">

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
        </div>

        <div className="min-w-0">

          <p className="text-sm font-medium text-slate-700">
            {name}
          </p>

          <p className="mt-0.5 text-[11px] text-slate-400">
            {description}
          </p>

        </div>

      </div>

      <div
        className={`flex shrink-0 items-center gap-1.5 text-xs font-semibold ${
          statusColor === "cyan"
            ? "text-cyan-700"
            : "text-emerald-700"
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            statusColor === "cyan"
              ? "bg-cyan-500"
              : "bg-emerald-500"
          }`}
        />

        {status}
      </div>

    </div>
  );
}

export default function Settings() {

  // ==========================================================
  // System controls
  // ==========================================================

  const [
    simulation,
    setSimulation,
  ] = useState(true);

  const [
    aiMonitoring,
    setAiMonitoring,
  ] = useState(true);

  const [
    carbonTracking,
    setCarbonTracking,
  ] = useState(true);

  const [
    autoRefresh,
    setAutoRefresh,
  ] = useState(true);

  // ==========================================================
  // UI state
  // ==========================================================

  const [
    saved,
    setSaved,
  ] = useState(false);

  function handleSave() {

    setSaved(true);

    window.setTimeout(
      () => {
        setSaved(false);
      },
      2000,
    );
  }

  // ==========================================================
  // Main UI
  // ==========================================================

  return (
    <div className="min-h-full bg-[#f6f8f7] px-4 py-5 text-slate-900 sm:px-6 lg:px-8">

      <div className="mx-auto max-w-6xl">

        {/* ================================================== */}
        {/* Header */}
        {/* ================================================== */}

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

          <div>

            <div className="mb-2 flex items-center gap-2">

              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600">
                ⚙
              </div>

              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                System Configuration
              </span>

            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Settings
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Configure CarbonTwin OS monitoring and intelligence services.
            </p>

          </div>

          <button
            type="button"
            onClick={handleSave}
            className={`rounded-lg px-4 py-2.5 text-xs font-bold shadow-sm transition ${
              saved
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            {saved
              ? "Settings Saved"
              : "Save Settings"}
          </button>

        </div>

        {/* ================================================== */}
        {/* Platform status */}
        {/* ================================================== */}

        <div className="mb-5 rounded-2xl border border-emerald-100 bg-white shadow-sm">

          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-center gap-4">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xs font-extrabold text-emerald-700 ring-1 ring-emerald-100">
                CT
              </div>

              <div>

                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Platform Status
                </p>

                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  CarbonTwin OS
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  Enterprise Digital Twin Platform
                </p>

              </div>

            </div>

            <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">

              <span className="relative flex h-2.5 w-2.5">

                <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400/40" />

                <span className="relative h-2.5 w-2.5 rounded-full bg-emerald-500" />

              </span>

              <div>

                <p className="text-xs font-bold text-emerald-700">
                  Operational
                </p>

                <p className="mt-0.5 text-[9px] text-emerald-600/70">
                  Core services available
                </p>

              </div>

            </div>

          </div>

        </div>

        {/* ================================================== */}
        {/* Overview cards */}
        {/* ================================================== */}

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              Digital Twin
            </p>

            <div className="mt-2 flex items-center justify-between">

              <p className="text-lg font-bold text-slate-900">
                {simulation
                  ? "Active"
                  : "Paused"}
              </p>

              <span
                className={`h-2 w-2 rounded-full ${
                  simulation
                    ? "bg-emerald-500"
                    : "bg-slate-300"
                }`}
              />

            </div>

            <p className="mt-1 text-[10px] text-slate-400">
              Live machine simulation
            </p>

          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              AI Monitoring
            </p>

            <div className="mt-2 flex items-center justify-between">

              <p className="text-lg font-bold text-slate-900">
                {aiMonitoring
                  ? "Online"
                  : "Disabled"}
              </p>

              <span
                className={`h-2 w-2 rounded-full ${
                  aiMonitoring
                    ? "bg-cyan-500"
                    : "bg-slate-300"
                }`}
              />

            </div>

            <p className="mt-1 text-[10px] text-slate-400">
              Predictive intelligence
            </p>

          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              Carbon Tracking
            </p>

            <div className="mt-2 flex items-center justify-between">

              <p className="text-lg font-bold text-slate-900">
                {carbonTracking
                  ? "Active"
                  : "Disabled"}
              </p>

              <span
                className={`h-2 w-2 rounded-full ${
                  carbonTracking
                    ? "bg-emerald-500"
                    : "bg-slate-300"
                }`}
              />

            </div>

            <p className="mt-1 text-[10px] text-slate-400">
              Energy and emissions
            </p>

          </div>

        </div>

        {/* ================================================== */}
        {/* AI configuration */}
        {/* ================================================== */}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-100 p-5">

            <div className="flex items-center gap-3">

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-xs font-bold text-cyan-700 ring-1 ring-cyan-100">
                AI
              </div>

              <div>

                <h2 className="text-base font-bold text-slate-900">
                  AI Configuration
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  Predictive intelligence and conversational AI services.
                </p>

              </div>

            </div>

          </div>

          <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-3">

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">

              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                Prediction Model
              </p>

              <p className="mt-2 text-sm font-bold text-cyan-700">
                XGBoost
              </p>

              <p className="mt-1 text-[11px] leading-5 text-slate-500">
                Machine failure prediction and risk estimation.
              </p>

            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">

              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                Conversational AI
              </p>

              <p className="mt-2 text-sm font-bold text-cyan-700">
                Gemini 3.6 Flash
              </p>

              <p className="mt-1 text-[11px] leading-5 text-slate-500">
                Natural-language reasoning over CarbonTwin context.
              </p>

            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">

              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                AI Engine
              </p>

              <div className="mt-2 flex items-center gap-2">

                <span className="h-2 w-2 rounded-full bg-emerald-500" />

                <p className="text-sm font-bold text-emerald-700">
                  Online
                </p>

              </div>

              <p className="mt-1 text-[11px] leading-5 text-slate-500">
                Predictive and operational analysis available.
              </p>

            </div>

          </div>

        </section>

        {/* ================================================== */}
        {/* System controls */}
        {/* ================================================== */}

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-100 p-5">

            <h2 className="text-base font-bold text-slate-900">
              System Controls
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Configure Digital Twin simulation and monitoring behavior.
            </p>

          </div>

          <div className="space-y-3 p-5">

            <SettingRow
              title="Digital Twin Simulation"
              description="Simulate live machine operating conditions and telemetry."
              enabled={simulation}
              onChange={() =>
                setSimulation(
                  (value) =>
                    !value,
                )
              }
              accent="green"
            />

            <SettingRow
              title="AI Monitoring"
              description="Enable predictive maintenance and AI condition analysis."
              enabled={aiMonitoring}
              onChange={() =>
                setAiMonitoring(
                  (value) =>
                    !value,
                )
              }
              accent="cyan"
            />

            <SettingRow
              title="Carbon Monitoring"
              description="Track factory energy consumption, emissions and sustainability metrics."
              enabled={carbonTracking}
              onChange={() =>
                setCarbonTracking(
                  (value) =>
                    !value,
                )
              }
              accent="amber"
            />

            <SettingRow
              title="Live Data Refresh"
              description="Automatically refresh the dashboard and current factory state."
              enabled={autoRefresh}
              onChange={() =>
                setAutoRefresh(
                  (value) =>
                    !value,
                )
              }
              accent="green"
            />

          </div>

        </section>

        {/* ================================================== */}
        {/* Connected services */}
        {/* ================================================== */}

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-100 p-5">

            <div className="flex items-center justify-between">

              <div>

                <h2 className="text-base font-bold text-slate-900">
                  Connected Services
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Current CarbonTwin platform service status.
                </p>

              </div>

              <div className="rounded-full bg-emerald-50 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                All Systems Operational
              </div>

            </div>

          </div>

          <div className="px-5">

            <ServiceStatus
              name="FastAPI Backend"
              description="CarbonTwin application API"
              status="Connected"
            />

            <ServiceStatus
              name="Digital Twin Runtime"
              description="Live machine state and simulation"
              status="Running"
            />

            <ServiceStatus
              name="Predictive AI Engine"
              description="Failure prediction and condition analysis"
              status="Online"
              statusColor="cyan"
            />

            <ServiceStatus
              name="Carbon Analytics"
              description="Energy and emissions intelligence"
              status="Online"
            />

            <ServiceStatus
              name="Machine Simulation"
              description="Synthetic live telemetry generation"
              status={
                simulation
                  ? "Active"
                  : "Paused"
              }
            />

          </div>

        </section>

        {/* ================================================== */}
        {/* Information / behavior note */}
        {/* ================================================== */}

        <div className="mt-5 rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">

          <div className="flex items-start gap-3">

            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-[10px] font-bold text-cyan-700 ring-1 ring-cyan-100">
              i
            </div>

            <div>

              <p className="text-xs font-bold text-cyan-800">
                Configuration note
              </p>

              <p className="mt-1 text-[11px] leading-5 text-cyan-700/80">
                These controls currently manage the Settings interface state.
                Backend persistence and runtime control can be connected as a
                later configuration layer without changing the dashboard design.
              </p>

            </div>

          </div>

        </div>

        {/* ================================================== */}
        {/* Footer */}
        {/* ================================================== */}

        <div className="mt-5 flex flex-col gap-1 px-1 pb-4 text-[9px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">

          <span>
            CarbonTwin OS · Enterprise Digital Twin Platform
          </span>

          <span>
            Version 1.0
          </span>

        </div>

      </div>

    </div>
  );
}