import { useEffect, useState } from "react";

import {
  controlMachine,
  type Machine,
  type MachineControlAction,
} from "../../../services/api";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleStop,
  Gauge,
  Loader2,
  Play,
  Settings2,
  ShieldAlert,
  Thermometer,
  UserRound,
  Wrench,
  X,
  Zap,
} from "lucide-react";

interface MachineControlPanelProps {
  machine: Machine;
  onClose: () => void;
}

type ControlState =
  | "Running"
  | "Maintenance"
  | "Stopped"
  | "Emergency Stop";

type ConfirmAction =
  | "stop"
  | "emergency"
  | null;

/* ================================================================
   INITIAL STATE
================================================================ */

function getInitialState(
  machine: Machine
): ControlState {
  switch (
    machine.maintenance_status
  ) {
    case "Maintenance":
      return "Maintenance";

    case "Stopped":
      return "Stopped";

    case "Emergency Stop":
      return "Emergency Stop";

    case "Operational":
      return "Running";

    default:
      return "Running";
  }
}

/* ================================================================
   MAIN
================================================================ */

export default function MachineControlPanel({
  machine,
  onClose,
}: MachineControlPanelProps) {
  const [
    controlState,
    setControlState,
  ] = useState<ControlState>(
    getInitialState(machine)
  );

  const [
    message,
    setMessage,
  ] = useState<string | null>(
    null
  );

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  const [
    confirmAction,
    setConfirmAction,
  ] =
    useState<ConfirmAction>(
      null
    );

  const [
    loadingAction,
    setLoadingAction,
  ] =
    useState<
      MachineControlAction | null
    >(null);

  /* ==============================================================
     KEEP UI IN SYNC WITH LIVE MACHINE STATE
  ============================================================== */

  useEffect(() => {
    setControlState(
      getInitialState(machine)
    );
  }, [
    machine.maintenance_status,
    machine.id,
  ]);

  /* ==============================================================
     EXECUTE CONTROL ACTION
  ============================================================== */

  async function executeAction(
    action: MachineControlAction
  ) {
    if (loadingAction) {
      return;
    }

    setLoadingAction(action);
    setMessage(null);
    setError(null);

    try {
      const result =
        await controlMachine(
          machine.id,
          action
        );

      switch (action) {
        case "start":
          setControlState(
            "Running"
          );
          break;

        case "maintenance":
          setControlState(
            "Maintenance"
          );
          break;

        case "stop":
          setControlState(
            "Stopped"
          );
          break;

        case "emergency":
          setControlState(
            "Emergency Stop"
          );
          break;
      }

      setMessage(
        result.message ||
          `${machine.name} control action applied successfully.`
      );

      setConfirmAction(
        null
      );
    } catch (caughtError) {
      console.error(
        "Machine control failed:",
        caughtError
      );

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Machine control failed."
      );
    } finally {
      setLoadingAction(
        null
      );
    }
  }

  /* ==============================================================
     STATE FLAGS
  ============================================================== */

  const isRunning =
    controlState === "Running";

  const isMaintenance =
    controlState ===
    "Maintenance";

  const isStopped =
    controlState === "Stopped";

  const isEmergency =
    controlState ===
    "Emergency Stop";

  const stateStyle =
    getStateStyle(
      controlState
    );

  const health =
    Number(
      machine.health_score ?? 0
    );

  /* ==============================================================
     UI
  ============================================================== */

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#15211B]/45 p-4 backdrop-blur-[3px]">

      <div className="flex max-h-[92vh] w-full max-w-[720px] flex-col overflow-hidden rounded-[18px] border border-[#DCE8E1] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]">

        {/* ======================================================
            HEADER
        ====================================================== */}

        <header className="flex shrink-0 items-start justify-between border-b border-[#E5ECE8] bg-white px-5 py-4 sm:px-6">

          <div className="flex min-w-0 items-start gap-3">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-[#EAF8F0] text-[#15803D]">
              <Settings2
                size={18}
                strokeWidth={1.7}
              />
            </div>

            <div className="min-w-0">

              <div className="flex items-center gap-2">

                <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />

                <p className="text-[8px] font-bold uppercase tracking-[0.15em] text-[#16A34A]">
                  Machine Control
                </p>

              </div>

              <h2 className="mt-1.5 truncate text-[17px] font-extrab800 tracking-[-0.02em] text-[#26332C] sm:text-[19px]">
                {machine.name}
              </h2>

              <p className="mt-1 truncate text-[8px] text-[#94A39A]">
                {machine.id} ·{" "}
                {machine.type}
                {machine.location
                  ? ` · ${machine.location}`
                  : ""}
              </p>

            </div>

          </div>

          <button
            type="button"
            onClick={onClose}
            className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[#94A39A] transition hover:bg-[#F4F7F5] hover:text-[#526159]"
            aria-label="Close machine control"
          >
            <X size={17} />
          </button>

        </header>

        {/* ======================================================
            CONTENT
        ====================================================== */}

        <div className="min-h-0 overflow-y-auto p-4 sm:p-5">

          {/* ====================================================
              CURRENT STATE
          ==================================================== */}

          <div
            className={`rounded-[13px] border p-4 ${stateStyle.container}`}
          >

            <div className="flex items-center justify-between gap-3">

              <div className="flex min-w-0 items-center gap-3">

                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${stateStyle.dot}`}
                />

                <div className="min-w-0">

                  <p className="text-[7px] font-bold uppercase tracking-[0.13em] text-[#94A39A]">
                    Current Machine State
                  </p>

                  <p
                    className={`mt-1 text-[13px] font-extrab800 ${stateStyle.text}`}
                  >
                    {controlState}
                  </p>

                </div>

              </div>

              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-white ${stateStyle.text}`}
              >
                {isEmergency ? (
                  <ShieldAlert
                    size={16}
                  />
                ) : isStopped ? (
                  <CircleStop
                    size={16}
                  />
                ) : isMaintenance ? (
                  <Wrench
                    size={16}
                  />
                ) : (
                  <CheckCircle2
                    size={16}
                  />
                )}
              </div>

            </div>

          </div>

          {/* ====================================================
              MACHINE HEALTH
          ==================================================== */}

          <div className="mt-4 rounded-[13px] border border-[#E1E9E4] bg-white p-4">

            <div className="flex items-end justify-between">

              <div>

                <p className="text-[7px] font-bold uppercase tracking-[0.13em] text-[#94A39A]">
                  Machine Health
                </p>

                <p className="mt-1 text-[22px] font-extrab800 tracking-[-0.03em] text-[#26332C]">

                  {formatNumber(
                    health
                  )}

                  <span className="ml-1 text-[9px] font-semibold text-[#94A39A]">
                    %
                  </span>

                </p>

              </div>

              <HealthBadge
                health={
                  health
                }
              />

            </div>

            <div className="mt-2 h-[6px] overflow-hidden rounded-full bg-[#EAF0EC]">

              <div
                className={`h-full rounded-full transition-all duration-500 ${getHealthColor(
                  health
                )}`}
                style={{
                  width: `${Math.min(
                    Math.max(
                      health,
                      0
                    ),
                    100
                  )}%`,
                }}
              />

            </div>

          </div>

          {/* ====================================================
              LIVE TELEMETRY
          ==================================================== */}

          <section className="mt-5">

            <SectionLabel>
              Live Machine Telemetry
            </SectionLabel>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">

              <Telemetry
                icon={
                  <Thermometer
                    size={13}
                  />
                }
                label="Temperature"
                value={formatTelemetry(
                  machine.temperature,
                  "°C"
                )}
              />

              <Telemetry
                icon={
                  <Gauge
                    size={13}
                  />
                }
                label="Pressure"
                value={formatTelemetry(
                  machine.pressure,
                  "bar"
                )}
              />

              <Telemetry
                icon={
                  <Activity
                    size={13}
                  />
                }
                label="Vibration"
                value={formatTelemetry(
                  machine.vibration,
                  "mm/s"
                )}
              />

              <Telemetry
                icon={
                  <Zap
                    size={13}
                  />
                }
                label="Power"
                value={formatTelemetry(
                  machine.power,
                  "kW"
                )}
              />

            </div>

          </section>

          {/* ====================================================
              MACHINE ACTIONS
          ==================================================== */}

          <section className="mt-5">

            <SectionLabel>
              Machine Actions
            </SectionLabel>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">

              {/* START */}

              <ControlButton
                disabled={
                  isRunning ||
                  isEmergency ||
                  loadingAction !==
                    null
                }
                loading={
                  loadingAction ===
                  "start"
                }
                onClick={() =>
                  void executeAction(
                    "start"
                  )
                }
                icon={
                  <Play size={15} />
                }
                title="Start / Resume"
                description="Resume normal operation"
                className="border-[#BCE7CE] bg-[#F0FBF4] hover:border-[#86C79E] hover:bg-[#E7F8ED]"
                iconClassName="text-[#15803D]"
              />

              {/* MAINTENANCE */}

              <ControlButton
                disabled={
                  isEmergency ||
                  isMaintenance ||
                  loadingAction !==
                    null
                }
                loading={
                  loadingAction ===
                  "maintenance"
                }
                onClick={() =>
                  void executeAction(
                    "maintenance"
                  )
                }
                icon={
                  <Wrench size={15} />
                }
                title="Maintenance Mode"
                description="Prepare machine for service"
                className="border-[#F3D49A] bg-[#FFF8E8] hover:border-[#E7B95E] hover:bg-[#FFF3D7]"
                iconClassName="text-[#D97706]"
              />

              {/* SAFE STOP */}

              <ControlButton
                disabled={
                  isStopped ||
                  isEmergency ||
                  loadingAction !==
                    null
                }
                loading={
                  loadingAction ===
                  "stop"
                }
                onClick={() =>
                  setConfirmAction(
                    "stop"
                  )
                }
                icon={
                  <CircleStop
                    size={15}
                  />
                }
                title="Safe Stop"
                description="Stop machine normally"
                className="border-[#DCE3DF] bg-[#F7F9F8] hover:border-[#B7C2BC] hover:bg-[#F0F3F1]"
                iconClassName="text-[#526159]"
              />

              {/* EMERGENCY */}

              <ControlButton
                disabled={
                  isEmergency ||
                  loadingAction !==
                    null
                }
                loading={
                  loadingAction ===
                  "emergency"
                }
                onClick={() =>
                  setConfirmAction(
                    "emergency"
                  )
                }
                icon={
                  <ShieldAlert
                    size={15}
                  />
                }
                title="Emergency Stop"
                description="Immediately stop machine"
                className="border-[#F3C2C2] bg-[#FEF2F2] hover:border-[#EA9A9A] hover:bg-[#FDE8E8]"
                iconClassName="text-[#DC2626]"
                titleClassName="text-[#B91C1C]"
              />

            </div>

          </section>

          {/* ====================================================
              AI RECOMMENDATION
          ==================================================== */}

          <section className="mt-5 rounded-[13px] border border-[#DDD0F5] bg-[#FAF7FF] p-4">

            <div className="flex items-start gap-3">

              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-white text-[#7C3AED] shadow-[0_1px_5px_rgba(15,23,42,0.04)]">
                <Zap
                  size={15}
                />
              </div>

              <div className="min-w-0">

                <div className="flex items-center gap-2">

                  <p className="text-[8px] font-bold uppercase tracking-[0.13em] text-[#7C3AED]">
                    AI Recommendation
                  </p>

                  <span className="rounded-full bg-[#F1EAFE] px-1.5 py-0.5 text-[6px] font-bold uppercase tracking-[0.08em] text-[#7C3AED]">
                    AI
                  </span>

                </div>

                <p className="mt-2 text-[9px] leading-5 text-[#64736A]">

                  {machine.ai_prediction
                    ?.recommended_action ||
                    "The AI system is monitoring this asset and will provide an action when sufficient telemetry and prediction data are available."}

                </p>

              </div>

            </div>

          </section>

          {/* ====================================================
              PREDICTIVE INFORMATION
          ==================================================== */}

          <div className="mt-3 grid grid-cols-2 gap-2">

            <InfoCard
              label="Failure Probability"
              value={
                machine.failure_probability !==
                undefined
                  ? `${formatNumber(
                      machine.failure_probability
                    )}%`
                  : "—"
              }
              tone="red"
            />

            <InfoCard
              label="Remaining Useful Life"
              value={
                machine.remaining_useful_life !==
                undefined
                  ? `${formatNumber(
                      machine.remaining_useful_life
                    )}`
                  : "—"
              }
              suffix="cycles"
              tone="green"
            />

          </div>

          {/* ====================================================
              MAINTENANCE ASSIGNMENT
          ==================================================== */}

          <section className="mt-4 rounded-[13px] border border-[#E1E9E4] bg-[#F8FAF9] p-4">

            <div className="flex items-center gap-2">

              <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-white text-[#64736A]">
                <Wrench
                  size={13}
                />
              </div>

              <div>

                <p className="text-[7px] font-bold uppercase tracking-[0.12em] text-[#94A39A]">
                  Maintenance Assignment
                </p>

                <p className="mt-0.5 text-[9px] font-semibold text-[#526159]">
                  Current service information
                </p>

              </div>

            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">

              <AssignmentItem
                icon={
                  <UserRound
                    size={11}
                  />
                }
                label="Technician"
                value={
                  machine.current_technician ||
                  "Not assigned"
                }
              />

              <AssignmentItem
                icon={
                  <Wrench
                    size={11}
                  />
                }
                label="Active Ticket"
                value={
                  machine.current_ticket ||
                  "No active ticket"
                }
              />

            </div>

          </section>

          {/* ====================================================
              SUCCESS
          ==================================================== */}

          {message && (
            <div className="mt-4 flex items-start gap-2 rounded-[10px] border border-[#BCE7CE] bg-[#F0FBF4] px-3 py-2.5">

              <CheckCircle2
                size={13}
                className="mt-0.5 shrink-0 text-[#15803D]"
              />

              <p className="text-[8px] font-semibold leading-4 text-[#15803D]">
                {message}
              </p>

            </div>
          )}

          {/* ====================================================
              ERROR
          ==================================================== */}

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-[10px] border border-[#F3C2C2] bg-[#FEF2F2] px-3 py-2.5">

              <AlertTriangle
                size={13}
                className="mt-0.5 shrink-0 text-[#DC2626]"
              />

              <div>

                <p className="text-[8px] font-bold text-[#B91C1C]">
                  Machine control failed
                </p>

                <p className="mt-1 text-[8px] leading-4 text-[#DC2626]">
                  {error}
                </p>

              </div>

            </div>
          )}

        </div>

        {/* ======================================================
            CONFIRMATION BAR
        ====================================================== */}

        {confirmAction && (
          <div className="shrink-0 border-t border-[#F3C2C2] bg-[#FEF2F2] px-5 py-4 sm:px-6">

            <div className="flex items-start gap-3">

              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-white text-[#DC2626]">
                <AlertTriangle
                  size={16}
                />
              </div>

              <div className="min-w-0 flex-1">

                <p className="text-[9px] font-bold text-[#B91C1C]">
                  Confirm{" "}
                  {confirmAction ===
                  "emergency"
                    ? "Emergency Stop"
                    : "Safe Stop"}
                </p>

                <p className="mt-1 text-[8px] leading-4 text-[#DC2626]">
                  This action will change the live
                  machine state in CarbonTwin OS.
                </p>

                <div className="mt-3 flex gap-2">

                  <button
                    type="button"
                    disabled={
                      loadingAction !==
                      null
                    }
                    onClick={() =>
                      void executeAction(
                        confirmAction
                      )
                    }
                    className="flex items-center gap-2 rounded-[8px] bg-[#DC2626] px-3 py-2 text-[8px] font-bold text-white transition hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-60"
                  >

                    {loadingAction ? (
                      <Loader2
                        size={11}
                        className="animate-spin"
                      />
                    ) : null}

                    Confirm
                  </button>

                  <button
                    type="button"
                    disabled={
                      loadingAction !==
                      null
                    }
                    onClick={() =>
                      setConfirmAction(
                        null
                      )
                    }
                    className="rounded-[8px] border border-[#F0B8B8] bg-white px-3 py-2 text-[8px] font-bold text-[#DC2626] transition hover:bg-[#FFF8F8] disabled:opacity-50"
                  >
                    Cancel
                  </button>

                </div>

              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}

/* ================================================================
   CONTROL BUTTON
================================================================ */

function ControlButton({
  disabled,
  loading,
  onClick,
  icon,
  title,
  description,
  className,
  iconClassName,
  titleClassName = "text-[#26332C]",
}: {
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  className: string;
  iconClassName: string;
  titleClassName?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-[11px] border p-3.5 text-left transition-all duration-150 ${
        disabled
          ? "cursor-not-allowed border-[#E2E8E4] bg-[#F7F9F8] opacity-45"
          : `${className} hover:-translate-y-[1px]`
      }`}
    >

      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-white ${iconClassName}`}
      >

        {loading ? (
          <Loader2
            size={15}
            className="animate-spin"
          />
        ) : (
          icon
        )}

      </div>

      <div className="min-w-0">

        <p
          className={`text-[9px] font-bold ${titleClassName}`}
        >
          {title}
        </p>

        <p className="mt-1 text-[7px] leading-4 text-[#94A39A]">
          {loading
            ? "Applying control..."
            : description}
        </p>

      </div>

    </button>
  );
}

/* ================================================================
   TELEMETRY
================================================================ */

function Telemetry({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[10px] border border-[#E1E9E4] bg-[#FAFCFB] p-3">

      <div className="flex items-center gap-1.5 text-[#64736A]">

        {icon}

        <p className="truncate text-[7px] font-bold uppercase tracking-[0.08em]">
          {label}
        </p>

      </div>

      <p className="mt-1.5 text-[11px] font-extrab800 text-[#26332C]">
        {value}
      </p>

    </div>
  );
}

/* ================================================================
   INFO CARD
================================================================ */

function InfoCard({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: string;
  suffix?: string;
  tone: "red" | "green";
}) {
  const style =
    tone === "red"
      ? {
          box: "border-[#F3C2C2] bg-[#FEF8F8]",
          text: "text-[#DC2626]",
        }
      : {
          box: "border-[#BCE7CE] bg-[#F7FCF8]",
          text: "text-[#15803D]",
        };

  return (
    <div
      className={`rounded-[11px] border p-3 ${style.box}`}
    >

      <p className="text-[7px] font-bold uppercase tracking-[0.1em] text-[#94A39A]">
        {label}
      </p>

      <p
        className={`mt-1.5 text-[13px] font-extrab800 ${style.text}`}
      >
        {value}

        {suffix && (
          <span className="ml-1 text-[7px] font-semibold text-[#94A39A]">
            {suffix}
          </span>
        )}
      </p>

    </div>
  );
}

/* ================================================================
   ASSIGNMENT
================================================================ */

function AssignmentItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">

      <p className="text-[7px] text-[#A0ABA4]">
        {label}
      </p>

      <div className="mt-1 flex min-w-0 items-center gap-1.5">

        <span className="shrink-0 text-[#64736A]">
          {icon}
        </span>

        <p className="truncate text-[8px] font-semibold text-[#526159]">
          {value}
        </p>

      </div>

    </div>
  );
}

/* ================================================================
   SECTION LABEL
================================================================ */

function SectionLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <p className="mb-3 text-[8px] font-bold uppercase tracking-[0.14em] text-[#64736A]">
      {children}
    </p>
  );
}

/* ================================================================
   HEALTH BADGE
================================================================ */

function HealthBadge({
  health,
}: {
  health: number;
}) {
  const state =
    health >= 75
      ? {
          label: "Healthy",
          className:
            "border-[#BCE7CE] bg-[#F0FBF4] text-[#15803D]",
        }
      : health >= 50
        ? {
            label: "Attention",
            className:
              "border-[#F3D49A] bg-[#FFF8E8] text-[#D97706]",
          }
        : {
            label: "Critical",
            className:
              "border-[#F3C2C2] bg-[#FEF2F2] text-[#DC2626]",
          };

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[7px] font-bold uppercase tracking-[0.08em] ${state.className}`}
    >
      {state.label}
    </span>
  );
}

/* ================================================================
   STATE STYLE
================================================================ */

function getStateStyle(
  state: ControlState
) {
  switch (state) {
    case "Emergency Stop":
      return {
        container:
          "border-[#F3C2C2] bg-[#FEF2F2]",
        dot: "bg-[#EF4444]",
        text: "text-[#DC2626]",
      };

    case "Maintenance":
      return {
        container:
          "border-[#F3D49A] bg-[#FFF8E8]",
        dot: "bg-[#F59E0B]",
        text: "text-[#D97706]",
      };

    case "Stopped":
      return {
        container:
          "border-[#DCE3DF] bg-[#F7F9F8]",
        dot: "bg-[#94A39A]",
        text: "text-[#64736A]",
      };

    default:
      return {
        container:
          "border-[#BCE7CE] bg-[#F0FBF4]",
        dot: "bg-[#16A34A]",
        text: "text-[#15803D]",
      };
  }
}

/* ================================================================
   HEALTH COLOR
================================================================ */

function getHealthColor(
  health: number
) {
  if (health < 50) {
    return "bg-[#EF4444]";
  }

  if (health < 75) {
    return "bg-[#F59E0B]";
  }

  return "bg-[#16A34A]";
}

/* ================================================================
   TELEMETRY FORMAT
================================================================ */

function formatTelemetry(
  value: number | undefined,
  unit: string
) {
  if (
    value === undefined ||
    value === null ||
    !Number.isFinite(
      Number(value)
    )
  ) {
    return "—";
  }

  return `${formatNumber(
    Number(value)
  )} ${unit}`;
}

/* ================================================================
   NUMBER FORMAT
================================================================ */

function formatNumber(
  value: number
) {
  if (
    !Number.isFinite(
      Number(value)
    )
  ) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-IN",
    {
      maximumFractionDigits: 1,
    }
  ).format(
    Number(value)
  );
}