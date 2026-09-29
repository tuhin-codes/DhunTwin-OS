import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";

import {
  AlertTriangle,
  CheckCircle2,
  Droplets,
  Gauge,
  Leaf,
  RotateCcw,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";

import {
  getSustainability,
  previewCarbonOptimization,
} from "../../../services/api";

import type {
  OptimizationResult,
  SustainabilityData,
} from "../../../services/api";

/* ============================================================
   HELPERS
============================================================ */

function formatNumber(
  value: number,
  decimals = 1
) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return value.toLocaleString(
    undefined,
    {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }
  );
}

function clamp(
  value: number,
  min = 0,
  max = 100
) {
  return Math.min(
    Math.max(value, min),
    max
  );
}

function getBarWidth(
  value: number,
  maximum: number
) {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(maximum) ||
    maximum <= 0
  ) {
    return 0;
  }

  return clamp(
    (value / maximum) * 100
  );
}

/* ============================================================
   GAUGE STATE
============================================================ */

type GaugeState =
  | "safe"
  | "progress"
  | "near_target"
  | "achieved";

function getGaugeState(
  progress: number
): GaugeState {
  if (progress >= 100) {
    return "achieved";
  }

  if (progress >= 75) {
    return "near_target";
  }

  if (progress >= 30) {
    return "progress";
  }

  return "safe";
}

function getGaugeStyles(
  state: GaugeState
) {
  switch (state) {
    case "achieved":
      return {
        label: "Target Achieved",
        text: "text-[#15803D]",
        bg: "bg-[#ECFDF3]",
        border: "border-[#BCE7CE]",
        accent: "#15803D",
        soft: "#DCFCE7",
      };

    case "near_target":
      return {
        label: "Near Target",
        text: "text-[#B45309]",
        bg: "bg-[#FFF7E6]",
        border: "border-[#F3D49A]",
        accent: "#D97706",
        soft: "#FEF3C7",
      };

    case "progress":
      return {
        label: "Reduction In Progress",
        text: "text-[#047857]",
        bg: "bg-[#ECFDF5]",
        border: "border-[#A7F3D0]",
        accent: "#059669",
        soft: "#D1FAE5",
      };

    default:
      return {
        label: "Baseline",
        text: "text-[#64736A]",
        bg: "bg-[#F5F7F6]",
        border: "border-[#DDE7E1]",
        accent: "#64736A",
        soft: "#E8EFEB",
      };
  }
}

/* ============================================================
   MAIN COMPONENT
============================================================ */

export default function SustainabilityPanel() {
  const [data, setData] =
    useState<SustainabilityData | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  /*
   * User-selected reduction percentage.
   *
   * This is NOT a hardcoded carbon target.
   *
   * The actual target in kg is calculated from the
   * live measured carbon footprint.
   */
  const [
    reductionPercent,
    setReductionPercent,
  ] = useState(0);

  /*
   * Optimization preview state.
   */
  const [
    optimizationApplied,
    setOptimizationApplied,
  ] = useState(false);

  const [
    optimizedCarbon,
    setOptimizedCarbon,
  ] = useState<number | null>(null);

  const [
    isOptimizing,
    setIsOptimizing,
  ] = useState(false);

  const [
    optimizationResult,
    setOptimizationResult,
  ] = useState<OptimizationResult | null>(
    null
  );

  /* ============================================================
     LIVE SUSTAINABILITY DATA
  ============================================================ */

  useEffect(() => {
    let mounted = true;

    async function loadSustainability() {
      try {
        const result =
          await getSustainability(true);

        if (!mounted) {
          return;
        }

        setData(result);
      } catch (error) {
        console.error(
          "Sustainability error:",
          error
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadSustainability();

    /*
     * Sustainability follows live Digital Twin telemetry.
     */
    const interval =
      window.setInterval(
        () => {
          void loadSustainability();
        },
        3000
      );

    return () => {
      mounted = false;
      window.clearInterval(
        interval
      );
    };
  }, []);

  /* ============================================================
     DATA
  ============================================================ */

  const totalCarbon =
    Number(
      data?.summary?.carbon || 0
    );

  const totalEnergy =
    Number(
      data?.summary?.energy || 0
    );

  const totalWater =
    Number(
      data?.summary?.water || 0
    );

  const totalPower =
    Number(
      data?.summary?.power || 0
    );

  const machineCount =
    Number(
      data?.summary?.machines || 0
    );

  /* ============================================================
     CARBON REDUCTION TARGET
  ============================================================ */

  /*
   * The live factory carbon footprint itself is the
   * measurement reference.
   *
   * No manually entered baseline.
   * No localStorage baseline.
   * No reset-baseline action.
   */
  const measuredBaselineCarbon =
    Math.max(
      totalCarbon,
      0
    );

  /*
   * Exact mathematical reduction requested by the user.
   *
   * Example:
   *
   * baseline = 100 kg
   * reduction = 10%
   * reduction kg = 10 kg
   */
  const requestedReductionKg =
    measuredBaselineCarbon *
    (reductionPercent / 100);

  /*
   * Target after applying the requested reduction.
   */
  const targetCarbon =
    Math.max(
      measuredBaselineCarbon -
        requestedReductionKg,
      0
    );

  /* ============================================================
     DISPLAYED CARBON
  ============================================================ */

  /*
   * Optimization preview uses the backend's projected
   * carbon value.
   *
   * Otherwise use the live measured footprint.
   */
  const displayedCarbon =
    optimizedCarbon !== null
      ? optimizedCarbon
      : totalCarbon;

  /* ============================================================
     REDUCTION CALCULATION
  ============================================================ */

  /*
   * Required reduction is exactly what the user requested.
   */
  const requiredReduction =
    requestedReductionKg;

  /*
   * Reduction actually achieved by the optimization preview.
   */
  const achievedReduction =
    Math.max(
      measuredBaselineCarbon -
        displayedCarbon,
      0
    );

  /*
   * Progress toward the requested target.
   *
   * If no reduction has been requested,
   * progress is 0%.
   */
  const reductionProgress =
    requiredReduction > 0
      ? clamp(
          (
            achievedReduction /
            requiredReduction
          ) *
            100
        )
      : 0;

  const gaugeState =
    getGaugeState(
      reductionProgress
    );

  const gaugeStyles =
    getGaugeStyles(
      gaugeState
    );

  /*
   * Difference between displayed carbon and target.
   */
  const targetGap =
    Math.max(
      displayedCarbon -
        targetCarbon,
      0
    );

  /*
   * Remaining reduction needed.
   */
  const remainingReduction =
    Math.max(
      targetGap,
      0
    );

  /*
   * Actual reduction relative to measured baseline.
   */
  const actualReductionPercent =
    measuredBaselineCarbon > 0
      ? clamp(
          (
            achievedReduction /
            measuredBaselineCarbon
          ) *
            100
        )
      : 0;

  /* ============================================================
     TOP EMITTERS
  ============================================================ */

  const topEmitters =
    useMemo(() => {
      return [
        ...(data?.top_emitters || []),
      ]
        .sort(
          (a, b) =>
            Number(b.carbon || 0) -
            Number(a.carbon || 0)
        )
        .slice(0, 3);
    }, [data]);

  const maxEmitterCarbon =
    Math.max(
      ...topEmitters.map(
        (item) =>
          Number(
            item.carbon || 0
          )
      ),
      1
    );

  /* ============================================================
     OPTIMIZATION MACHINES
  ============================================================ */

  const optimizationMachines =
    useMemo(() => {
      return [
        ...(optimizationResult?.machines || []),
      ]
        .filter(
          (machine) =>
            Number(
              machine.impact?.carbon_reduction_kg ||
                0
            ) > 0
        )
        .sort(
          (a, b) =>
            Number(
              b.impact?.carbon_reduction_kg ||
                0
            ) -
            Number(
              a.impact?.carbon_reduction_kg ||
                0
            )
        );
    }, [optimizationResult]);

  /* ============================================================
     REDUCTION CONTROL
  ============================================================ */

  function handleReductionSliderChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const value =
      Number(
        event.target.value
      );

    const normalized =
      clamp(
        Number.isFinite(value)
          ? value
          : 0
      );

    setReductionPercent(
      normalized
    );

    /*
     * Changing the requested reduction invalidates
     * the previous optimization preview.
     */
    setOptimizationApplied(
      false
    );

    setOptimizedCarbon(
      null
    );

    setOptimizationResult(
      null
    );
  }

  /* ============================================================
     AI OPTIMIZATION
  ============================================================ */

  async function applyOptimization() {
    if (
      remainingReduction <= 0 ||
      isOptimizing
    ) {
      return;
    }

    setIsOptimizing(true);

    try {
      const result =
        await previewCarbonOptimization(
          targetCarbon
        );

      setOptimizationResult(
        result
      );

      /*
       * ALWAYS use the backend's projected value.
       *
       * Never fabricate the result in the frontend.
       */
      setOptimizedCarbon(
        Number(
          result.projected_carbon
        )
      );

      setOptimizationApplied(
        true
      );
    } catch (error) {
      console.error(
        "Optimization preview error:",
        error
      );

      setOptimizationResult(
        null
      );

      setOptimizedCarbon(
        null
      );

      setOptimizationApplied(
        false
      );
    } finally {
      setIsOptimizing(
        false
      );
    }
  }

  /* ============================================================
     RESET OPTIMIZATION
  ============================================================ */

  function resetOptimization() {
    setOptimizationApplied(
      false
    );

    setOptimizedCarbon(
      null
    );

    setOptimizationResult(
      null
    );
  }

  /* ============================================================
     LOADING
  ============================================================ */

  if (loading && !data) {
    return (
      <section className="rounded-[16px] border border-[#DDE7E1] bg-white p-6">

        <div className="flex min-h-[300px] items-center justify-center">

          <div className="text-center">

            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-emerald-100 border-t-emerald-600" />

            <p className="mt-4 text-sm font-semibold text-[#15211B]">
              Loading sustainability intelligence
            </p>

            <p className="mt-1 text-[10px] text-[#94A39A]">
              Connecting to live factory carbon telemetry...
            </p>

          </div>

        </div>

      </section>
    );
  }

  /* ============================================================
     ERROR
  ============================================================ */

  if (!data) {
    return (
      <section className="rounded-[16px] border border-red-200 bg-white p-6">

        <div className="flex items-center gap-3">

          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <AlertTriangle size={18} />
          </div>

          <div>

            <h3 className="font-semibold text-[#15211B]">
              Sustainability
            </h3>

            <p className="mt-1 text-xs text-red-600">
              Sustainability data is currently unavailable.
            </p>

          </div>

        </div>

      </section>
    );
  }

  /* ============================================================
     MAIN
  ============================================================ */

  return (
    <section className="overflow-hidden rounded-[16px] border border-[#DDE7E1] bg-white text-[#15211B] shadow-[0_2px_10px_rgba(15,23,42,0.025)]">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="flex flex-col gap-4 border-b border-[#E8EFEB] p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">

        <div className="flex items-center gap-3">

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ECFDF5] text-[#15803D]">
            <Leaf
              size={21}
              strokeWidth={1.8}
            />
          </div>

          <div>

            <div className="flex items-center gap-2">

              <h3 className="text-xl font-bold tracking-tight">
                Sustainability
              </h3>

              <span className="flex items-center gap-1.5 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-1 text-[8px] font-bold uppercase tracking-wider text-[#047857]">

                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#16A34A]" />

                Live

              </span>

            </div>

            <p className="mt-1 text-xs text-[#7B8981]">
              Carbon reduction progress and environmental intelligence
            </p>

          </div>

        </div>

        <div
          className={`flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 ${gaugeStyles.bg} ${gaugeStyles.border}`}
        >

          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor:
                gaugeStyles.accent,
            }}
          />

          <span
            className={`text-[9px] font-bold uppercase tracking-[0.14em] ${gaugeStyles.text}`}
          >
            {gaugeStyles.label}
          </span>

        </div>

      </header>

      {/* ======================================================
          SUMMARY STRIP
      ====================================================== */}

      <div className="grid grid-cols-2 border-b border-[#E8EFEB] sm:grid-cols-4">

        <SummaryMetric
          label="Assets"
          value={`${machineCount}`}
          unit="machines"
        />

        <SummaryMetric
          label="Power"
          value={formatNumber(
            totalPower
          )}
          unit="kW"
        />

        <SummaryMetric
          label="Energy"
          value={formatNumber(
            totalEnergy
          )}
          unit="kWh"
        />

        <SummaryMetric
          label="Water"
          value={formatNumber(
            totalWater
          )}
          unit="L"
        />

      </div>

      {/* ======================================================
          CARBON + REDUCTION GAUGE
      ====================================================== */}

      <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-[1.05fr_0.95fr] lg:p-6">

        {/* ====================================================
            CARBON FOOTPRINT
        ==================================================== */}

        <div className="rounded-[14px] border border-[#E1E9E4] bg-[#F8FAF9] p-5">

          <div className="flex items-start justify-between gap-3">

            <div>

              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#94A39A]">
                Carbon Footprint
              </p>

              <p className="mt-1 text-[10px] text-[#7B8981]">
                Current factory CO₂e emissions
              </p>

            </div>

            <div className="rounded-full border border-[#DDE7E1] bg-white px-2.5 py-1 text-[8px] font-bold uppercase tracking-wider text-[#64736A]">
              Live
            </div>

          </div>

          <div className="mt-5 flex items-baseline gap-2">

            <span className="truncate text-[40px] font-extrabold leading-none tracking-[-0.04em] text-[#15211B] sm:text-[48px]">
              {formatNumber(
                displayedCarbon
              )}
            </span>

            <span className="shrink-0 text-[11px] font-semibold text-[#8A968F]">
              kg CO₂e
            </span>

          </div>

          <p className="mt-2 text-[10px] text-[#7B8981]">

            {optimizationApplied
              ? `Optimization preview · ${formatNumber(
                  Number(
                    optimizationResult?.reduction ||
                      0
                  ),
                  2
                )} kg projected reduction`
              : "Live reported factory carbon footprint"}

          </p>

          {/* ==================================================
              BASELINE / CURRENT / TARGET
          ================================================== */}

          <div className="mt-5 grid grid-cols-3 gap-2">

            <CarbonValue
              label="Measured"
              value={formatNumber(
                measuredBaselineCarbon
              )}
              unit="kg"
            />

            <CarbonValue
              label="Current"
              value={formatNumber(
                displayedCarbon
              )}
              unit="kg"
            />

            <CarbonValue
              label="Target"
              value={formatNumber(
                targetCarbon
              )}
              unit="kg"
              green
            />

          </div>

          {/* ==================================================
              REQUESTED REDUCTION
          ================================================== */}

          <div className="mt-3 rounded-[12px] border border-[#DDE7E1] bg-white p-3.5">

            <div className="flex items-center justify-between gap-3">

              <div>

                <p className="text-[8px] font-bold uppercase tracking-[0.13em] text-[#94A39A]">
                  Requested reduction
                </p>

                <p className="mt-1 text-[9px] text-[#7B8981]">
                  Based directly on the measured footprint
                </p>

              </div>

              <div className="text-right">

                <p className="text-[13px] font-extrabold text-[#15803D]">
                  {formatNumber(
                    requestedReductionKg
                  )}{" "}
                  kg
                </p>

                <p className="text-[8px] font-semibold text-[#64736A]">
                  {reductionPercent.toFixed(
                    1
                  )}
                  % requested
                </p>

              </div>

            </div>

          </div>

          {/* ==================================================
              ACTUAL REDUCTION
          ================================================== */}

          <div className="mt-3 rounded-[12px] border border-[#E1E9E4] bg-white p-3.5">

            <div className="flex items-center justify-between gap-3">

              <div>

                <p className="text-[8px] font-bold uppercase tracking-[0.13em] text-[#94A39A]">
                  Actual reduction
                </p>

                <p className="mt-1 text-[9px] text-[#7B8981]">
                  Reduction demonstrated by the optimization preview
                </p>

              </div>

              <div className="text-right">

                <p className="text-[13px] font-extrabold text-[#15803D]">
                  {formatNumber(
                    achievedReduction
                  )}{" "}
                  kg
                </p>

                <p className="text-[8px] font-semibold text-[#64736A]">
                  {actualReductionPercent.toFixed(
                    1
                  )}
                  % of measured footprint
                </p>

              </div>

            </div>

          </div>

          {/* ==================================================
              REMAINING REDUCTION
          ================================================== */}

          <div className="mt-3 rounded-[12px] border border-[#E1E9E4] bg-white p-3.5">

            <div className="flex items-center justify-between gap-3">

              <div>

                <p className="text-[8px] font-bold uppercase tracking-[0.13em] text-[#94A39A]">
                  Remaining to target
                </p>

                <p className="mt-1 text-[9px] text-[#7B8981]">
                  Required additional reduction
                </p>

              </div>

              <span
                className={`text-[13px] font-extrabold ${
                  remainingReduction > 0
                    ? "text-[#DC2626]"
                    : "text-[#15803D]"
                }`}
              >
                {remainingReduction > 0
                  ? `${formatNumber(
                      remainingReduction
                    )} kg`
                  : "Target reached"}
              </span>

            </div>

          </div>

        </div>

        {/* ====================================================
            REDUCTION PROGRESS GAUGE
        ==================================================== */}

        <div className="rounded-[14px] border border-[#E1E9E4] bg-white p-5">

          <div className="flex items-start justify-between gap-3">

            <div className="flex items-center gap-3">

              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#ECFDF5] text-[#15803D]">
                <Gauge
                  size={17}
                  strokeWidth={1.8}
                />
              </div>

              <div>

                <p className="text-[11px] font-bold text-[#26332C]">
                  Carbon Reduction Progress
                </p>

                <p className="mt-0.5 text-[9px] text-[#94A39A]">
                  Actual progress against requested reduction
                </p>

              </div>

            </div>

            <span
              className={`text-[13px] font-extrabold ${gaugeStyles.text}`}
            >
              {reductionProgress.toFixed(
                1
              )}
              %
            </span>

          </div>

          {/* ==================================================
              INDUSTRIAL PROGRESS GAUGE
          ================================================== */}

          <div className="mt-6">

            <div className="relative h-[170px] overflow-hidden">

              <svg
                viewBox="0 0 360 190"
                className="h-full w-full"
                role="img"
                aria-label={`Carbon reduction progress is ${reductionProgress.toFixed(
                  1
                )}%`}
              >

                <path
                  d="M 48 155 A 132 132 0 0 1 312 155"
                  fill="none"
                  stroke="#E7EEE9"
                  strokeWidth="24"
                  strokeLinecap="round"
                />

                {reductionProgress > 0 && (
                  <path
                    d="M 48 155 A 132 132 0 0 1 312 155"
                    fill="none"
                    stroke={gaugeStyles.accent}
                    strokeWidth="24"
                    strokeLinecap="round"
                    pathLength="100"
                    strokeDasharray={`${reductionProgress} 100`}
                    className="transition-all duration-700"
                  />
                )}

                <line
                  x1="75"
                  y1="84"
                  x2="84"
                  y2="90"
                  stroke="#CBD5D0"
                  strokeWidth="2"
                />

                <line
                  x1="180"
                  y1="23"
                  x2="180"
                  y2="35"
                  stroke="#CBD5D0"
                  strokeWidth="2"
                />

                <line
                  x1="285"
                  y1="84"
                  x2="276"
                  y2="90"
                  stroke="#CBD5D0"
                  strokeWidth="2"
                />

                <circle
                  cx="312"
                  cy="155"
                  r="5"
                  fill="white"
                  stroke="#CBD5D0"
                  strokeWidth="2"
                />

                <g
                  className="transition-all duration-700"
                  transform={`translate(${getGaugeMarkerX(
                    reductionProgress
                  )} ${getGaugeMarkerY(
                    reductionProgress
                  )})`}
                >

                  <circle
                    r="7"
                    fill="white"
                    stroke={
                      gaugeStyles.accent
                    }
                    strokeWidth="4"
                  />

                </g>

              </svg>

              <div className="pointer-events-none absolute inset-x-0 bottom-1 text-center">

                <p
                  className={`text-[38px] font-extrabold leading-none tracking-[-0.04em] ${gaugeStyles.text}`}
                >
                  {reductionProgress.toFixed(
                    1
                  )}
                  %
                </p>

                <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.18em] text-[#94A39A]">
                  actual reduction progress
                </p>

              </div>

            </div>

            <div className="mt-1 flex items-start justify-between">

              <ScaleLabel
                label="START"
                value="0%"
                align="left"
              />

              <ScaleLabel
                label="MIDPOINT"
                value="50%"
                align="center"
              />

              <ScaleLabel
                label="TARGET"
                value="100%"
                align="right"
              />

            </div>

          </div>

          {/* Gauge status */}

          <div
            className={`mt-5 rounded-[12px] border p-3.5 ${gaugeStyles.bg} ${gaugeStyles.border}`}
          >

            <div className="flex items-center justify-between gap-3">

              <div className="flex items-start gap-2.5">

                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      gaugeStyles.accent,
                  }}
                />

                <div>

                  <p
                    className={`text-[9px] font-bold uppercase tracking-[0.14em] ${gaugeStyles.text}`}
                  >
                    {gaugeStyles.label}
                  </p>

                  <p className="mt-1 text-[9px] leading-4 text-[#64736A]">

                    {reductionPercent ===
                    0
                      ? "Select a reduction percentage to define the carbon target."
                      : gaugeState ===
                          "achieved"
                        ? "The optimization preview has reached the requested carbon reduction target."
                        : `CarbonTwin has demonstrated ${formatNumber(
                            achievedReduction
                          )} kg reduction against ${formatNumber(
                            requiredReduction
                          )} kg requested.`}

                  </p>

                </div>

              </div>

            </div>

          </div>

          {/* Calculation summary */}

          <div className="mt-3 grid grid-cols-2 gap-2">

            <MiniMetric
              label="Requested reduction"
              value={`${formatNumber(
                requiredReduction
              )} kg`}
            />

            <MiniMetric
              label="Actual reduction"
              value={`${formatNumber(
                achievedReduction
              )} kg`}
              green
            />

          </div>

        </div>

      </div>

      {/* ======================================================
          TARGET CONTROL
      ====================================================== */}

      <div className="mx-5 mb-5 rounded-[14px] border border-[#A7F3D0] bg-[#F0FDF4] p-4 sm:mx-6">

        <div className="flex flex-col gap-4">

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex items-center gap-3">

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#15803D] shadow-sm">
                <Target size={17} />
              </div>

              <div>

                <p className="text-sm font-bold text-[#26332C]">
                  Carbon Reduction Target
                </p>

                <p className="text-[10px] text-[#64736A]">
                  Set the desired percentage reduction from the measured factory footprint.
                </p>

              </div>

            </div>

            {/* ==================================================
                LIVE REDUCTION VALUES
            ================================================== */}

            <div className="flex items-center gap-3">

              <div className="rounded-lg border border-[#DDE7E1] bg-white px-3 py-2 text-right">

                <p className="text-[7px] font-bold uppercase tracking-[0.12em] text-[#94A39A]">
                  Reduction
                </p>

                <p className="mt-0.5 text-sm font-extrabold text-[#15803D]">
                  {reductionPercent.toFixed(
                    1
                  )}
                  %
                </p>

              </div>

              <div className="text-center text-[#94A39A]">
                →
              </div>

              <div className="rounded-lg border border-[#BCE7CE] bg-white px-3 py-2 text-right">

                <p className="text-[7px] font-bold uppercase tracking-[0.12em] text-[#94A39A]">
                  Target
                </p>

                <p className="mt-0.5 text-sm font-extrabold text-[#15803D]">
                  {formatNumber(
                    targetCarbon
                  )}{" "}
                  kg
                </p>

              </div>

            </div>

          </div>

          {/* ==================================================
              PERCENTAGE SLIDER
          ================================================== */}

          <div>

            <div className="mb-3 flex items-center justify-between">

              <div>

                <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-[#94A39A]">
                  Desired carbon reduction
                </p>

                <p className="mt-1 text-[9px] text-[#7B8981]">
                  The kg value is calculated directly from the live measured footprint.
                </p>

              </div>

              <div className="text-right">

                <p className="text-lg font-extrabold text-[#15803D]">
                  {reductionPercent.toFixed(
                    1
                  )}
                  %
                </p>

                <p className="text-[8px] font-semibold text-[#64736A]">
                  −
                  {formatNumber(
                    requestedReductionKg
                  )}{" "}
                  kg CO₂e
                </p>

              </div>

            </div>

            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={reductionPercent}
              onChange={
                handleReductionSliderChange
              }
              aria-label="Desired carbon reduction percentage"
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#DCE8E1] accent-[#15803D]"
            />

            <div className="mt-2 flex justify-between text-[8px] text-[#94A39A]">

              <span>
                0% · 0 kg
              </span>

              <span>
                25% ·{" "}
                {formatNumber(
                  measuredBaselineCarbon *
                    0.25
                )}{" "}
                kg
              </span>

              <span>
                50% ·{" "}
                {formatNumber(
                  measuredBaselineCarbon *
                    0.5
                )}{" "}
                kg
              </span>

              <span>
                75% ·{" "}
                {formatNumber(
                  measuredBaselineCarbon *
                    0.75
                )}{" "}
                kg
              </span>

              <span>
                100% ·{" "}
                {formatNumber(
                  measuredBaselineCarbon
                )}{" "}
                kg
              </span>

            </div>

          </div>

          {/* ==================================================
              LIVE CALCULATION
          ================================================== */}

          <div className="grid grid-cols-1 gap-2 border-t border-[#CDE8D5] pt-3 sm:grid-cols-3">

            <CalculationCard
              label="Measured footprint"
              value={`${formatNumber(
                measuredBaselineCarbon
              )} kg`}
              description="Live factory measurement"
            />

            <CalculationCard
              label="Requested reduction"
              value={`${formatNumber(
                requestedReductionKg
              )} kg`}
              description={`${reductionPercent.toFixed(
                1
              )}% of measured footprint`}
              green
            />

            <CalculationCard
              label="Calculated target"
              value={`${formatNumber(
                targetCarbon
              )} kg`}
              description="Measured footprint minus requested reduction"
              green
            />

          </div>

        </div>

      </div>

      {/* ======================================================
          AI OPTIMIZATION
      ====================================================== */}

      <div className="mx-5 mb-5 rounded-[14px] border border-[#DDE7E1] bg-white p-4 sm:mx-6">

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          <div className="flex items-start gap-3">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ECFEFF] text-[#0891B2]">
              <Sparkles size={18} />
            </div>

            <div>

              <p className="text-sm font-bold text-[#26332C]">
                AI Optimization Preview
              </p>

              <p className="mt-1 max-w-xl text-[10px] leading-5 text-[#64736A]">
                CarbonTwin evaluates the configured target against
                current machine conditions and estimates the realistic
                reduction achievable without unsafe operational changes.
              </p>

              {reductionPercent >
              0 ? (

                <p className="mt-2 text-[10px] font-semibold text-[#DC2626]">

                  {formatNumber(
                    remainingReduction
                  )}{" "}
                  kg additional reduction required.

                </p>

              ) : (

                <p className="mt-2 text-[10px] font-semibold text-[#64736A]">

                  Select a reduction percentage to run the optimization preview.

                </p>

              )}

            </div>

          </div>

          <div className="flex shrink-0 items-center gap-2">

            {optimizationApplied && (

              <button
                type="button"
                onClick={
                  resetOptimization
                }
                className="flex items-center gap-1.5 rounded-lg border border-[#DDE7E1] px-3 py-2 text-[9px] font-bold text-[#64736A] transition hover:bg-[#F7FAF8]"
              >

                <RotateCcw size={12} />

                Reset

              </button>

            )}

            <button
              type="button"
              onClick={
                applyOptimization
              }
              disabled={
                isOptimizing ||
                reductionPercent <= 0 ||
                remainingReduction <= 0
              }
              className="flex items-center gap-2 rounded-lg bg-[#15211B] px-4 py-2.5 text-[9px] font-bold text-white transition hover:bg-[#26332C] disabled:cursor-not-allowed disabled:opacity-40"
            >

              <Sparkles
                size={13}
                className={
                  isOptimizing
                    ? "animate-spin"
                    : ""
                }
              />

              {isOptimizing
                ? "Calculating..."
                : "Preview Optimization"}

            </button>

          </div>

        </div>

        {/* ====================================================
            OPTIMIZATION RESULT
        ==================================================== */}

        {optimizationApplied &&
          optimizationResult && (

            <>

              {/* Result summary */}

              <div className="mt-4 rounded-xl border border-[#A7F3D0] bg-[#F0FDF4] p-4">

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                  <div className="flex items-center gap-3">

                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#15803D]">
                      <CheckCircle2 size={17} />
                    </div>

                    <div>

                      <p className="text-[10px] font-bold text-[#166534]">
                        Optimization preview ready
                      </p>

                      <p className="mt-1 text-[8px] text-[#4D7C5B]">
                        Simulation preview only. No machine state has been changed.
                      </p>

                    </div>

                  </div>

                  <div className="flex items-center gap-4">

                    <div>

                      <p className="text-[7px] font-bold uppercase tracking-[0.12em] text-[#94A39A]">
                        Current
                      </p>

                      <p className="mt-1 text-[13px] font-extrabold text-[#526159]">
                        {formatNumber(
                          optimizationResult.current_carbon
                        )}{" "}
                        kg
                      </p>

                    </div>

                    <span className="text-[#B8C4BD]">
                      →
                    </span>

                    <div>

                      <p className="text-[7px] font-bold uppercase tracking-[0.12em] text-[#15803D]">
                        Projected
                      </p>

                      <p className="mt-1 text-[13px] font-extrabold text-[#15803D]">
                        {formatNumber(
                          optimizationResult.projected_carbon
                        )}{" "}
                        kg
                      </p>

                    </div>

                  </div>

                </div>

              </div>

              {/* ==================================================
                  BACKEND OPTIMIZATION METRICS
              ================================================== */}

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">

                <MiniMetric
                  label="Required reduction"
                  value={`${formatNumber(
                    optimizationResult.required_reduction,
                    2
                  )} kg`}
                />

                <MiniMetric
                  label="Realistic potential"
                  value={`${formatNumber(
                    optimizationResult.realistic_reduction_potential,
                    2
                  )} kg`}
                  green
                />

                <MiniMetric
                  label="Realistic target"
                  value={`${formatNumber(
                    optimizationResult.realistic_target_carbon,
                    2
                  )} kg`}
                />

              </div>

              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">

                <MiniMetric
                  label="Projected reduction"
                  value={`${formatNumber(
                    optimizationResult.reduction,
                    2
                  )} kg`}
                  green
                />

                <MiniMetric
                  label="Potential percentage"
                  value={`${formatNumber(
                    optimizationResult.realistic_reduction_potential_percent,
                    1
                  )}%`}
                  green
                />

                <MiniMetric
                  label="Remaining after preview"
                  value={`${formatNumber(
                    optimizationResult.remaining_reduction,
                    2
                  )} kg`}
                />

              </div>

              {/* ==================================================
                  TARGET CLASSIFICATION
              ================================================== */}

              <div
                className={`mt-3 rounded-xl border p-3 ${
                  optimizationResult.target_classification ===
                  "INFEASIBLE"
                    ? "border-red-200 bg-red-50"
                    : optimizationResult.target_classification ===
                        "REALISTIC"
                      ? "border-[#A7F3D0] bg-[#F0FDF4]"
                      : "border-[#DDE7E1] bg-[#F8FAF9]"
                }`}
              >

                <p
                  className={`text-[9px] font-bold uppercase tracking-[0.14em] ${
                    optimizationResult.target_classification ===
                    "INFEASIBLE"
                      ? "text-red-600"
                      : optimizationResult.target_classification ===
                          "REALISTIC"
                        ? "text-[#15803D]"
                        : "text-[#64736A]"
                  }`}
                >

                  {optimizationResult.target_classification ===
                  "INFEASIBLE"
                    ? "Target requires additional reduction"
                    : optimizationResult.target_classification ===
                        "REALISTIC"
                      ? "Target is operationally realistic"
                      : "Target status"}

                </p>

                <p className="mt-1 text-[9px] leading-4 text-[#64736A]">

                  {optimizationResult.target_classification ===
                  "INFEASIBLE"
                    ? `The configured target of ${formatNumber(
                        optimizationResult.target_carbon
                      )} kg cannot currently be reached through the available safe optimization actions. The realistic target is approximately ${formatNumber(
                        optimizationResult.realistic_target_carbon
                      )} kg.`
                    : optimizationResult.target_classification ===
                        "REALISTIC"
                      ? `The configured target of ${formatNumber(
                          optimizationResult.target_carbon
                        )} kg is achievable under the current optimization constraints.`
                      : `CarbonTwin evaluated the configured target of ${formatNumber(
                          optimizationResult.target_carbon
                        )} kg against the current operating conditions.`}

                </p>

              </div>

              {/* ==================================================
                  MACHINE OPPORTUNITIES
              ================================================== */}

              {optimizationMachines.length > 0 && (

                <div className="mt-4 border-t border-[#E8EFEB] pt-4">

                  <div className="flex items-center justify-between gap-3">

                    <div>

                      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#94A39A]">
                        Machine Optimization Opportunities
                      </p>

                      <p className="mt-1 text-[10px] text-[#7B8981]">
                        Recommended operational changes generated by the optimization engine
                      </p>

                    </div>

                    <span className="rounded-full border border-[#DDE7E1] bg-[#F8FAF9] px-2.5 py-1 text-[8px] font-bold uppercase tracking-wider text-[#64736A]">
                      {optimizationMachines.length}{" "}
                      opportunities
                    </span>

                  </div>

                  <div className="mt-4 space-y-2">

                    {optimizationMachines.map(
                      (machine) => (

                        <article
                          key={
                            machine.machine_id
                          }
                          className="rounded-xl border border-[#E1E9E4] bg-[#FAFCFB] p-3.5"
                        >

                          <div className="flex items-start justify-between gap-3">

                            <div className="min-w-0">

                              <div className="flex flex-wrap items-center gap-2">

                                <p className="truncate text-[11px] font-bold text-[#26332C]">
                                  {machine.machine_name}
                                </p>

                                {machine.idle && (

                                  <span className="rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2 py-0.5 text-[7px] font-bold uppercase tracking-wider text-[#B45309]">
                                    Idle
                                  </span>

                                )}

                                {machine.production_critical && (

                                  <span className="rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-2 py-0.5 text-[7px] font-bold uppercase tracking-wider text-[#2563EB]">
                                    Critical
                                  </span>

                                )}

                              </div>

                              <p className="mt-1 text-[8px] text-[#94A39A]">

                                {machine.machine_id}
                                {" · "}
                                {machine.operating_state}
                                {" · "}
                                {formatNumber(
                                  machine.utilization_percent,
                                  1
                                )}
                                % utilization

                              </p>

                            </div>

                            <div className="shrink-0 text-right">

                              <p className="text-[13px] font-extrabold text-[#15803D]">

                                -
                                {formatNumber(
                                  machine.impact.carbon_reduction_kg,
                                  2
                                )}{" "}
                                kg

                              </p>

                              <p className="text-[7px] font-bold uppercase tracking-wider text-[#94A39A]">
                                CO₂e potential
                              </p>

                            </div>

                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">

                            <MiniMetric
                              label="Power reduction"
                              value={`-${formatNumber(
                                machine.impact.power_reduction_kw,
                                2
                              )} kW`}
                            />

                            <MiniMetric
                              label="Energy reduction"
                              value={`-${formatNumber(
                                machine.impact.energy_reduction_kwh,
                                2
                              )} kWh`}
                            />

                            <MiniMetric
                              label="RPM reduction"
                              value={`${formatNumber(
                                machine.impact.rpm_reduction_percent,
                                2
                              )}%`}
                            />

                          </div>

                          <div className="mt-2 rounded-lg border border-[#D1FAE5] bg-[#ECFDF5] px-3 py-2">

                            <p className="text-[8px] font-bold uppercase tracking-wider text-[#15803D]">
                              Recommended Action
                            </p>

                            <p className="mt-1 text-[9px] leading-4 text-[#64736A]">
                              {machine.action}
                            </p>

                          </div>

                        </article>

                      )
                    )}

                  </div>

                </div>

              )}

            </>

          )}

      </div>

      {/* ======================================================
          RESOURCE CARDS
      ====================================================== */}

      <div className="grid grid-cols-2 gap-3 px-5 pb-5 sm:px-6">

        <ResourceCard
          label="Energy"
          value={formatNumber(
            totalEnergy
          )}
          unit="kWh"
          description="Factory consumption"
          icon={
            <Zap size={14} />
          }
          iconClass="bg-[#ECFEFF] text-[#0891B2]"
        />

        <ResourceCard
          label="Water"
          value={formatNumber(
            totalWater
          )}
          unit="L"
          description="Factory water usage"
          icon={
            <Droplets size={14} />
          }
          iconClass="bg-[#EFF6FF] text-[#2563EB]"
        />

      </div>

      {/* ======================================================
          TOP EMITTERS
      ====================================================== */}

      {topEmitters.length > 0 && (

        <div className="border-t border-[#E8EFEB] px-5 py-5 sm:px-6">

          <div className="flex items-end justify-between gap-4">

            <div>

              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#94A39A]">
                Highest Carbon Emitters
              </p>

              <p className="mt-1 text-[10px] text-[#7B8981]">
                Machines contributing most to the current footprint
              </p>

            </div>

            <span className="text-[8px] font-bold uppercase tracking-wider text-[#94A39A]">
              Top 3
            </span>

          </div>

          <div className="mt-4 space-y-2">

            {topEmitters.map(
              (
                emitter,
                index
              ) => {

                const carbon =
                  Number(
                    emitter.carbon || 0
                  );

                const percentage =
                  getBarWidth(
                    carbon,
                    maxEmitterCarbon
                  );

                return (
                  <div
                    key={`${emitter.name}-${index}`}
                    className="rounded-xl border border-[#E1E9E4] bg-[#FAFCFB] p-3"
                  >

                    <div className="flex items-center gap-3">

                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#FFF7ED] text-[10px] font-bold text-[#EA580C]">
                        {index + 1}
                      </div>

                      <div className="min-w-0 flex-1">

                        <div className="flex items-center justify-between gap-3">

                          <p className="truncate text-[11px] font-semibold text-[#26332C]">
                            {emitter.name}
                          </p>

                          <span className="shrink-0 text-[10px] font-bold text-[#64736A]">
                            {formatNumber(
                              carbon
                            )}{" "}
                            kg
                          </span>

                        </div>

                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E8EFEB]">

                          <div
                            className="h-full rounded-full bg-[#EA580C] transition-all duration-700"
                            style={{
                              width: `${percentage}%`,
                            }}
                          />

                        </div>

                      </div>

                    </div>

                  </div>
                );
              }
            )}

          </div>

        </div>

      )}

      {/* ======================================================
          AI RECOMMENDATIONS
      ====================================================== */}

      {data.recommendations &&
        data.recommendations.length > 0 && (

          <div className="border-t border-[#E8EFEB] px-5 py-5 sm:px-6">

            <div className="flex items-center gap-3">

              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ECFEFF] text-[9px] font-bold text-[#0891B2]">
                AI
              </div>

              <div>

                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#94A39A]">
                  AI Sustainability Recommendations
                </p>

                <p className="mt-1 text-[10px] text-[#7B8981]">
                  Suggested actions to reduce environmental impact
                </p>

              </div>

            </div>

            <div className="mt-4 space-y-2">

              {data.recommendations
                .slice(0, 3)
                .map(
                  (
                    recommendation,
                    index
                  ) => {

                    const priority =
                      String(
                        recommendation.priority ||
                          "Low"
                      );

                    const priorityClass =
                      priority
                        .toLowerCase() ===
                      "high"
                        ? "border-red-200 bg-red-50 text-red-600"
                        : priority
                              .toLowerCase() ===
                            "medium"
                          ? "border-amber-200 bg-amber-50 text-amber-600"
                          : "border-emerald-200 bg-emerald-50 text-emerald-600";

                    return (
                      <article
                        key={`${recommendation.machine}-${index}`}
                        className="rounded-xl border border-[#E1E9E4] bg-[#FAFCFB] p-3.5"
                      >

                        <div className="flex items-start justify-between gap-3">

                          <div className="min-w-0">

                            <p className="text-[11px] font-semibold text-[#26332C]">
                              {recommendation.title}
                            </p>

                            <p className="mt-1 text-[9px] text-[#94A39A]">

                              Machine:{" "}

                              <span className="font-semibold text-[#64736A]">
                                {recommendation.machine}
                              </span>

                            </p>

                          </div>

                          <span
                            className={`shrink-0 rounded-full border px-2 py-1 text-[8px] font-bold uppercase tracking-wider ${priorityClass}`}
                          >
                            {priority}
                          </span>

                        </div>

                        <p className="mt-2 text-[10px] leading-4 text-[#64736A]">
                          {recommendation.reason}
                        </p>

                        <div className="mt-2 rounded-lg border border-[#D1FAE5] bg-[#ECFDF5] px-3 py-2">

                          <p className="text-[8px] font-bold uppercase tracking-wider text-[#15803D]">
                            Expected Impact
                          </p>

                          <p className="mt-1 text-[9px] leading-4 text-[#64736A]">
                            {recommendation.expected_impact}
                          </p>

                        </div>

                      </article>
                    );
                  }
                )}

            </div>

          </div>

        )}

      {/* ======================================================
          FOOTER
      ====================================================== */}

      <footer className="flex flex-col gap-2 border-t border-[#E8EFEB] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">

        <span className="text-[8px] font-bold uppercase tracking-wider text-[#94A39A]">
          Sustainability intelligence
        </span>

        <span className="flex items-center gap-1.5 text-[8px] font-semibold text-[#15803D]">

          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#16A34A]" />

          Live carbon tracking

        </span>

      </footer>

    </section>
  );
}

/* ============================================================
   GAUGE GEOMETRY
============================================================ */

function getGaugeMarkerX(
  percentage: number
) {
  const clamped =
    clamp(
      percentage
    );

  const angle =
    Math.PI -
    (clamped / 100) *
      Math.PI;

  return (
    180 +
    Math.cos(angle) *
      132
  );
}

function getGaugeMarkerY(
  percentage: number
) {
  const clamped =
    clamp(
      percentage
    );

  const angle =
    Math.PI -
    (clamped / 100) *
      Math.PI;

  return (
    155 -
    Math.sin(angle) *
      132
  );
}

/* ============================================================
   SUMMARY METRIC
============================================================ */

function SummaryMetric({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="border-r border-b border-[#E8EFEB] p-4 last:border-r-0 sm:border-b-0">

      <p className="text-[8px] font-bold uppercase tracking-[0.13em] text-[#94A39A]">
        {label}
      </p>

      <p className="mt-1.5 text-sm font-bold text-[#26332C]">

        {value}

        <span className="ml-1 text-[9px] font-medium text-[#94A39A]">
          {unit}
        </span>

      </p>

    </div>
  );
}

/* ============================================================
   CARBON VALUE
============================================================ */

function CarbonValue({
  label,
  value,
  unit,
  green = false,
}: {
  label: string;
  value: string;
  unit: string;
  green?: boolean;
}) {
  return (
    <div
      className={`rounded-[10px] border p-3 ${
        green
          ? "border-[#BCE7CE] bg-[#F0FDF4]"
          : "border-[#DDE7E1] bg-white"
      }`}
    >

      <p
        className={`text-[7px] font-bold uppercase tracking-[0.12em] ${
          green
            ? "text-[#15803D]"
            : "text-[#94A39A]"
        }`}
      >
        {label}
      </p>

      <p
        className={`mt-1 text-[12px] font-extrabold ${
          green
            ? "text-[#15803D]"
            : "text-[#26332C]"
        }`}
      >

        {value}

        <span className="ml-1 text-[7px] font-medium text-[#94A39A]">
          {unit}
        </span>

      </p>

    </div>
  );
}

/* ============================================================
   SCALE LABEL
============================================================ */

function ScaleLabel({
  label,
  value,
  align,
}: {
  label: string;
  value: string;
  align: "left" | "center" | "right";
}) {
  const alignment =
    align === "left"
      ? "text-left"
      : align === "right"
        ? "text-right"
        : "text-center";

  return (
    <div className={alignment}>

      <p className="text-[7px] font-bold uppercase tracking-[0.14em] text-[#94A39A]">
        {label}
      </p>

      <p className="mt-1 text-[9px] font-semibold text-[#64736A]">
        {value}
      </p>

    </div>
  );
}

/* ============================================================
   MINI METRIC
============================================================ */

function MiniMetric({
  label,
  value,
  green = false,
}: {
  label: string;
  value: string;
  green?: boolean;
}) {
  return (
    <div className="rounded-[10px] border border-[#E1E9E4] bg-[#FAFCFB] p-3">

      <p className="text-[7px] font-bold uppercase tracking-[0.12em] text-[#94A39A]">
        {label}
      </p>

      <p
        className={`mt-1 text-[12px] font-extrabold ${
          green
            ? "text-[#15803D]"
            : "text-[#26332C]"
        }`}
      >
        {value}
      </p>

    </div>
  );
}

/* ============================================================
   CALCULATION CARD
============================================================ */

function CalculationCard({
  label,
  value,
  description,
  green = false,
}: {
  label: string;
  value: string;
  description: string;
  green?: boolean;
}) {
  return (
    <div
      className={`rounded-[10px] border p-3 ${
        green
          ? "border-[#BCE7CE] bg-white"
          : "border-[#E1E9E4] bg-white"
      }`}
    >

      <p className="text-[7px] font-bold uppercase tracking-[0.12em] text-[#94A39A]">
        {label}
      </p>

      <p
        className={`mt-1 text-[13px] font-extrabold ${
          green
            ? "text-[#15803D]"
            : "text-[#26332C]"
        }`}
      >
        {value}
      </p>

      <p className="mt-1 text-[8px] leading-3 text-[#94A39A]">
        {description}
      </p>

    </div>
  );
}

/* ============================================================
   RESOURCE CARD
============================================================ */

function ResourceCard({
  label,
  value,
  unit,
  description,
  icon,
  iconClass,
}: {
  label: string;
  value: string;
  unit: string;
  description: string;
  icon: React.ReactNode;
  iconClass: string;
}) {
  return (
    <div className="rounded-[12px] border border-[#E1E9E4] bg-white p-3.5">

      <div className="flex items-center justify-between">

        <p className="text-[8px] font-bold uppercase tracking-[0.13em] text-[#94A39A]">
          {label}
        </p>

        <div
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconClass}`}
        >
          {icon}
        </div>

      </div>

      <p className="mt-2 text-lg font-extrabold text-[#26332C]">

        {value}

        <span className="ml-1 text-[8px] font-medium text-[#94A39A]">
          {unit}
        </span>

      </p>

      <p className="mt-1 text-[8px] text-[#94A39A]">
        {description}
      </p>

    </div>
  );
}