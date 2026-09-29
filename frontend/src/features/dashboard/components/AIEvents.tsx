import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  Clock3,
  Cpu,
  Gauge,
  ShieldCheck,
  Thermometer,
  Wrench,
  Zap,
} from "lucide-react";

import { useMachines } from "../../../hooks/useMachines";

/* ============================================================
   TYPES
============================================================ */

type RiskLevel =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "UNKNOWN";

type RiskTone =
  | "red"
  | "orange"
  | "amber"
  | "green"
  | "slate";

type UnknownRecord = Record<string, unknown>;

/* ============================================================
   MAIN COMPONENT
============================================================ */

export default function AIEvents() {
  const {
    machines,
    loading,
    error,
  } = useMachines();

  const [
    expandedMachine,
    setExpandedMachine,
  ] = useState<string | null>(null);

  /* ==========================================================
     SORT BY LIVE AI RISK
  ========================================================== */

  const sortedMachines = useMemo(() => {
    return [...machines].sort((a, b) => {
      const aPrediction = getPredictionObject(
        a.ai_prediction
      );

      const bPrediction = getPredictionObject(
        b.ai_prediction
      );

      const aRisk = getPredictionRiskScore(
        aPrediction
      );

      const bRisk = getPredictionRiskScore(
        bPrediction
      );

      return bRisk - aRisk;
    });
  }, [machines]);

  /* ==========================================================
     AI ANALYZED MACHINES
  ========================================================== */

  const analyzedMachines = useMemo(
    () =>
      sortedMachines.filter((machine) =>
        Boolean(
          getPredictionObject(
            machine.ai_prediction
          )
        )
      ),
    [sortedMachines]
  );

  /* ==========================================================
     SUMMARY
  ========================================================== */

  const summary = useMemo(() => {
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;

    for (const machine of analyzedMachines) {
      const prediction =
        getPredictionObject(
          machine.ai_prediction
        );

      const level =
        normalizeRiskLevel(
          getPredictionRiskLevel(
            prediction
          )
        );

      switch (level) {
        case "CRITICAL":
          critical += 1;
          break;

        case "HIGH":
          high += 1;
          break;

        case "MEDIUM":
          medium += 1;
          break;

        case "LOW":
          low += 1;
          break;
      }
    }

    return {
      critical,
      high,
      medium,
      low,
    };
  }, [analyzedMachines]);

  /* ==========================================================
     INITIAL LOADING
  ========================================================== */

  if (
    loading &&
    machines.length === 0
  ) {
    return <LoadingState />;
  }

  /* ==========================================================
     INITIAL ERROR
  ========================================================== */

  if (
    error &&
    machines.length === 0
  ) {
    return (
      <ErrorState
        error={error}
      />
    );
  }

  /* ==========================================================
     NO AI ANALYSIS
  ========================================================== */

  if (
    machines.length > 0 &&
    analyzedMachines.length === 0
  ) {
    return (
      <section className="overflow-hidden rounded-[18px] border border-[#DDE7E1] bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.035)] sm:p-6">

        <Header />

        <div className="mt-6 rounded-[14px] border border-[#E5ECE8] bg-[#F8FAF9] p-5">

          <div className="flex items-start gap-3">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#FFF7E6] text-[#B45309]">
              <AlertTriangle size={18} />
            </div>

            <div>

              <p className="text-[12px] font-bold text-[#26332C]">
                Predictive analysis unavailable
              </p>

              <p className="mt-1 max-w-xl text-[9px] leading-5 text-[#718078]">
                Live machine telemetry is available,
                but the AI prediction service has not
                returned a prediction for the monitored
                machines yet.
              </p>

              <div className="mt-3 flex items-center gap-2 text-[8px] font-semibold text-[#15803D]">

                <span className="relative flex h-1.5 w-1.5">

                  <span className="absolute h-full w-full animate-ping rounded-full bg-[#16A34A]/30" />

                  <span className="relative h-1.5 w-1.5 rounded-full bg-[#16A34A]" />

                </span>

                Digital twin telemetry remains active.

              </div>

            </div>

          </div>

        </div>

        <Footer
          machineCount={machines.length}
          analyzedCount={0}
        />

      </section>
    );
  }

  /* ==========================================================
     MAIN
  ========================================================== */

  return (
    <section className="overflow-hidden rounded-[18px] border border-[#DDE7E1] bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.035)] sm:p-6">

      <Header />

      {/* ======================================================
          SUMMARY
      ====================================================== */}

      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">

        <SummaryCard
          label="Critical"
          value={summary.critical}
          icon={<AlertTriangle size={15} />}
          tone="red"
        />

        <SummaryCard
          label="High Risk"
          value={summary.high}
          icon={<Activity size={15} />}
          tone="orange"
        />

        <SummaryCard
          label="Medium"
          value={summary.medium}
          icon={<Gauge size={15} />}
          tone="amber"
        />

        <SummaryCard
          label="Low Risk"
          value={summary.low}
          icon={<ShieldCheck size={15} />}
          tone="green"
        />

      </div>

      {/* ======================================================
          AI MACHINE EVENTS
      ====================================================== */}

      <div className="mt-5 space-y-2.5">

        {analyzedMachines.map((machine) => {

          const prediction =
            getPredictionObject(
              machine.ai_prediction
            );

          if (!prediction) {
            return null;
          }

          const riskScore =
            getPredictionRiskScore(
              prediction
            );

          const riskLevel =
            normalizeRiskLevel(
              getPredictionRiskLevel(
                prediction
              )
            );

          const risk =
            getRiskStyles(
              riskLevel
            );

          /*
           * Resolve live failure probabilities from
           * all supported backend shapes.
           */
          const next30 =
            getFailureProbability(
              prediction,
              "30m"
            );

          const next60 =
            getFailureProbability(
              prediction,
              "60m"
            );

          const next120 =
            getFailureProbability(
              prediction,
              "120m"
            );

          const isExpanded =
            expandedMachine ===
            machine.id;

          return (
            <article
              key={machine.id}
              className={`
                overflow-hidden
                rounded-[14px]
                border
                bg-white
                transition-all
                duration-200
                ${
                  isExpanded
                    ? "border-[#A7D5B7] shadow-[0_6px_18px_rgba(15,23,42,0.045)]"
                    : "border-[#E1E9E4] hover:border-[#C6DFCF]"
                }
              `}
            >

              {/* ==================================================
                  MACHINE HEADER
              ================================================== */}

              <button
                type="button"
                onClick={() =>
                  setExpandedMachine(
                    isExpanded
                      ? null
                      : machine.id
                  )
                }
                className="w-full text-left"
              >

                <div className="p-4 sm:p-5">

                  <div className="flex items-start gap-3">

                    {/* Machine icon */}

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-[#EAF8F0] text-[#15803D]">
                      <Cpu size={17} />
                    </div>

                    {/* Machine information */}

                    <div className="min-w-0 flex-1">

                      <div className="flex flex-wrap items-center gap-1.5">

                        <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-[#94A39A]">
                          AI Monitoring
                        </span>

                        <span className="h-1 w-1 rounded-full bg-[#C5CEC8]" />

                        <span className="text-[8px] text-[#A0ABA4]">
                          {machine.id}
                        </span>

                      </div>

                      <h4 className="mt-1 truncate text-[13px] font-extrab800 text-[#26332C]">
                        {machine.name}
                      </h4>

                      <p className="mt-0.5 truncate text-[9px] text-[#7B8981]">
                        {machine.type}
                        {machine.department
                          ? ` · ${machine.department}`
                          : ""}
                      </p>

                    </div>

                    {/* Risk */}

                    <div className="flex shrink-0 items-center gap-1.5">

                      <span
                        className={`
                          rounded-full
                          border
                          px-2
                          py-1
                          text-[7px]
                          font-bold
                          uppercase
                          tracking-[0.1em]
                          ${risk.badge}
                        `}
                      >
                        {riskLevel}
                      </span>

                      {isExpanded ? (
                        <ChevronUp
                          size={15}
                          className="text-[#A0ABA4]"
                        />
                      ) : (
                        <ChevronDown
                          size={15}
                          className="text-[#A0ABA4]"
                        />
                      )}

                    </div>

                  </div>

                  {/* ==================================================
                      RISK SCORE
                  ================================================== */}

                  <div className="mt-4">

                    <div className="flex items-center justify-between">

                      <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#94A39A]">
                        AI Failure Risk
                      </span>

                      <span
                        className={`text-[12px] font-extrab800 ${risk.text}`}
                      >
                        {(riskScore * 100).toFixed(1)}
                        %
                      </span>

                    </div>

                    <div className="mt-2 h-[6px] overflow-hidden rounded-full bg-[#EEF3EF]">

                      <div
                        className={`h-full rounded-full transition-all duration-700 ${risk.bar}`}
                        style={{
                          width: `${
                            riskScore *
                            100
                          }%`,
                        }}
                      />

                    </div>

                  </div>

                  {/* ==================================================
                      FAILURE HORIZONS
                  ================================================== */}

                  <div className="mt-3 grid grid-cols-3 gap-2">

                    <ProbabilityCard
                      label="30 min"
                      value={next30}
                    />

                    <ProbabilityCard
                      label="60 min"
                      value={next60}
                    />

                    <ProbabilityCard
                      label="120 min"
                      value={next120}
                    />

                  </div>

                </div>

              </button>

              {/* ==================================================
                  EXPANDED AI DETAILS
              ================================================== */}

              {isExpanded && (
                <div className="border-t border-[#E5ECE8] bg-[#F8FAF9] p-4 sm:p-5">

                  {/* Live telemetry */}

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">

                    <Telemetry
                      icon={<Activity size={13} />}
                      label="Health"
                      value={`${Number(
                        machine.health_score ?? 0
                      ).toFixed(1)}%`}
                    />

                    <Telemetry
                      icon={<Zap size={13} />}
                      label="Power"
                      value={`${Number(
                        machine.power ?? 0
                      ).toFixed(1)} kW`}
                    />

                    <Telemetry
                      icon={<Gauge size={13} />}
                      label="RPM"
                      value={`${Number(
                        machine.rpm ?? 0
                      )}`}
                    />

                    <Telemetry
                      icon={<Thermometer size={13} />}
                      label="Temperature"
                      value={`${Number(
                        machine.temperature ?? 0
                      ).toFixed(1)}°`}
                    />

                  </div>

                  {/* ==================================================
                      AI ASSESSMENT
                  ================================================== */}

                  <div className="mt-3 rounded-[12px] border border-[#E1E9E4] bg-white p-4">

                    <div className="flex items-center gap-2">

                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ECFEFF] text-[#0891B2]">
                        <BrainCircuit size={14} />
                      </div>

                      <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-[#64736A]">
                        AI Assessment
                      </p>

                    </div>

                    <p className="mt-2 text-[10px] leading-5 text-[#64736A]">
                      {getPredictionReason(
                        prediction
                      ) ||
                        "The AI service has not provided an additional assessment."}
                    </p>

                  </div>

                  {/* ==================================================
                      RECOMMENDED ACTION
                  ================================================== */}

                  <div className="mt-2.5 rounded-[12px] border border-[#BCE7CE] bg-[#F0FBF4] p-4">

                    <div className="flex items-center gap-2">

                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#15803D]">
                        <Wrench size={14} />
                      </div>

                      <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-[#15803D]">
                        AI Recommended Action
                      </p>

                    </div>

                    <p className="mt-2 text-[10px] font-semibold leading-5 text-[#526159]">
                      {getPredictionRecommendedAction(
                        prediction
                      ) ||
                        "Continue monitoring machine conditions."}
                    </p>

                  </div>

                  {/* ==================================================
                      MACHINE STATE
                  ================================================== */}

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[8px] text-[#7B8981]">

                    <span className="flex items-center gap-1.5">

                      <Clock3 size={12} />

                      RUL:{" "}
                      <strong className="text-[#526159]">
                        {Number(
                          machine.remaining_useful_life ??
                            0
                        )}
                      </strong>{" "}
                      cycles

                    </span>

                    <span className="h-1 w-1 rounded-full bg-[#C5CEC8]" />

                    <span className="flex items-center gap-1.5">

                      <Activity size={12} />

                      Status:{" "}
                      <strong className="text-[#526159]">
                        {machine.maintenance_status ||
                          "Unknown"}
                      </strong>

                    </span>

                  </div>

                </div>
              )}

            </article>
          );
        })}

      </div>

      <Footer
        machineCount={machines.length}
        analyzedCount={analyzedMachines.length}
      />

    </section>
  );
}

/* ================================================================
   SAFE PREDICTION HELPERS
================================================================ */

/**
 * Converts any prediction-like value into a safe object.
 *
 * This allows the UI to survive small backend schema differences
 * without crashing the Factory Overview.
 */
function getPredictionObject(
  value: unknown
): UnknownRecord | null {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  return value as UnknownRecord;
}

/* ================================================================
   GENERIC OBJECT HELPERS
================================================================ */

function getNestedObject(
  object: UnknownRecord | null,
  keys: string[]
): UnknownRecord | null {
  if (!object) {
    return null;
  }

  let current: unknown =
    object;

  for (const key of keys) {
    if (
      !current ||
      typeof current !== "object"
    ) {
      return null;
    }

    current =
      (current as UnknownRecord)[
        key
      ];
  }

  if (
    current &&
    typeof current === "object"
  ) {
    return current as UnknownRecord;
  }

  return null;
}

function getNumber(
  value: unknown
): number | null {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string" &&
    value.trim() !== ""
  ) {
    const parsed =
      Number(value);

    if (
      Number.isFinite(parsed)
    ) {
      return parsed;
    }
  }

  return null;
}

/* ================================================================
   RISK SCORE
================================================================ */

function getPredictionRiskScore(
  prediction:
    | UnknownRecord
    | null
): number {
  if (!prediction) {
    return 0;
  }

  const direct =
    getNumber(
      prediction.risk_score
    );

  if (direct !== null) {
    return normalizeRiskScore(
      direct
    );
  }

  const nestedPrediction =
    getNestedObject(
      prediction,
      ["prediction"]
    );

  const nestedRisk =
    getNumber(
      nestedPrediction?.risk_score
    );

  if (nestedRisk !== null) {
    return normalizeRiskScore(
      nestedRisk
    );
  }

  /*
   * If the backend does not explicitly provide
   * risk_score, use the strongest available
   * failure probability.
   */
  const strongest =
    getStrongestFailureProbability(
      prediction
    );

  return strongest;
}

/* ================================================================
   RISK LEVEL
================================================================ */

function getPredictionRiskLevel(
  prediction:
    | UnknownRecord
    | null
): string {
  if (!prediction) {
    return "UNKNOWN";
  }

  const direct =
    prediction.risk_level;

  if (
    typeof direct === "string" &&
    direct.trim()
  ) {
    return direct;
  }

  const nestedPrediction =
    getNestedObject(
      prediction,
      ["prediction"]
    );

  const nestedLevel =
    nestedPrediction?.risk_level;

  if (
    typeof nestedLevel === "string" &&
    nestedLevel.trim()
  ) {
    return nestedLevel;
  }

  /*
   * Derive the level from the live risk score
   * when the backend doesn't explicitly provide one.
   */
  const score =
    getPredictionRiskScore(
      prediction
    );

  if (score >= 0.8) {
    return "CRITICAL";
  }

  if (score >= 0.5) {
    return "HIGH";
  }

  if (score >= 0.25) {
    return "MEDIUM";
  }

  return "LOW";
}

/* ================================================================
   FAILURE PROBABILITY
================================================================ */

function getFailureProbability(
  prediction:
    | UnknownRecord
    | null,
  horizon: "30m" | "60m" | "120m"
): number {
  if (!prediction) {
    return 0;
  }

  /*
   * Possible backend structures:
   *
   * prediction.failure_probability["30m"]
   *
   * prediction.probability["30m"]
   *
   * prediction.prediction.failure_probability["30m"]
   *
   * prediction.prediction.probability["30m"]
   */

  const sources: Array<
    UnknownRecord | null
  > = [
    prediction,

    getNestedObject(
      prediction,
      ["prediction"]
    ),

    getNestedObject(
      prediction,
      ["failure_probability"]
    ),

    getNestedObject(
      prediction,
      ["probability"]
    ),

    getNestedObject(
      prediction,
      [
        "prediction",
        "failure_probability",
      ]
    ),

    getNestedObject(
      prediction,
      [
        "prediction",
        "probability",
      ]
    ),
  ];

  /*
   * First inspect objects that contain the horizon.
   */
  for (
    const source of sources
  ) {
    if (!source) {
      continue;
    }

    const directValue =
      getNumber(
        source[horizon]
      );

    if (
      directValue !== null
    ) {
      return normalizeProbability(
        directValue
      );
    }
  }

  /*
   * Explicitly inspect failure_probability
   * and probability containers.
   */
  const containers: Array<
    UnknownRecord | null
  > = [
    getNestedObject(
      prediction,
      ["failure_probability"]
    ),

    getNestedObject(
      prediction,
      ["probability"]
    ),

    getNestedObject(
      prediction,
      [
        "prediction",
        "failure_probability",
      ]
    ),

    getNestedObject(
      prediction,
      [
        "prediction",
        "probability",
      ]
    ),
  ];

  for (
    const container of containers
  ) {
    if (!container) {
      continue;
    }

    const value =
      getNumber(
        container[horizon]
      );

    if (
      value !== null
    ) {
      return normalizeProbability(
        value
      );
    }
  }

  return 0;
}

/* ================================================================
   STRONGEST FAILURE PROBABILITY
================================================================ */

function getStrongestFailureProbability(
  prediction:
    | UnknownRecord
    | null
): number {
  const values = [
    getFailureProbability(
      prediction,
      "30m"
    ),

    getFailureProbability(
      prediction,
      "60m"
    ),

    getFailureProbability(
      prediction,
      "120m"
    ),
  ];

  return Math.max(
    ...values
  );
}

/* ================================================================
   REASON
================================================================ */

function getPredictionReason(
  prediction:
    | UnknownRecord
    | null
): string {
  if (!prediction) {
    return "";
  }

  const direct =
    prediction.reason;

  if (
    typeof direct === "string" &&
    direct.trim()
  ) {
    return direct;
  }

  const decisionReason =
    prediction.decision_reason;

  if (
    typeof decisionReason === "string" &&
    decisionReason.trim()
  ) {
    return decisionReason;
  }

  const nestedPrediction =
    getNestedObject(
      prediction,
      ["prediction"]
    );

  const nestedReason =
    nestedPrediction?.reason;

  if (
    typeof nestedReason === "string" &&
    nestedReason.trim()
  ) {
    return nestedReason;
  }

  return "";
}

/* ================================================================
   RECOMMENDED ACTION
================================================================ */

function getPredictionRecommendedAction(
  prediction:
    | UnknownRecord
    | null
): string {
  if (!prediction) {
    return "";
  }

  const direct =
    prediction.recommended_action;

  if (
    typeof direct === "string" &&
    direct.trim()
  ) {
    return direct;
  }

  const operational =
    getNestedObject(
      prediction,
      [
        "operational_recommendation",
      ]
    );

  const operationalReason =
    operational?.reason;

  if (
    typeof operationalReason === "string" &&
    operationalReason.trim()
  ) {
    return operationalReason;
  }

  const nestedPrediction =
    getNestedObject(
      prediction,
      ["prediction"]
    );

  const nestedAction =
    nestedPrediction?.recommended_action;

  if (
    typeof nestedAction === "string" &&
    nestedAction.trim()
  ) {
    return nestedAction;
  }

  return "";
}

/* ================================================================
   NORMALIZE RISK LEVEL
================================================================ */

function normalizeRiskLevel(
  value:
    | string
    | null
    | undefined
): RiskLevel {
  const normalized =
    String(
      value ?? ""
    )
      .trim()
      .toUpperCase();

  switch (normalized) {
    case "CRITICAL":
      return "CRITICAL";

    case "HIGH":
      return "HIGH";

    case "MEDIUM":
      return "MEDIUM";

    case "LOW":
    case "HEALTHY":
    case "NORMAL":
      return "LOW";

    default:
      return "UNKNOWN";
  }
}

/* ================================================================
   NORMALIZE RISK SCORE
================================================================ */

function normalizeRiskScore(
  value:
    | number
    | string
    | null
    | undefined
): number {
  const parsed =
    Number(value ?? 0);

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return 0;
  }

  if (parsed > 1) {
    return Math.min(
      Math.max(
        parsed / 100,
        0
      ),
      1
    );
  }

  return Math.min(
    Math.max(
      parsed,
      0
    ),
    1
  );
}

/* ================================================================
   NORMALIZE FAILURE PROBABILITY
================================================================ */

function normalizeProbability(
  value:
    | number
    | string
    | null
    | undefined
): number {
  const parsed =
    Number(value ?? 0);

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return 0;
  }

  if (parsed > 1) {
    return Math.min(
      Math.max(
        parsed / 100,
        0
      ),
      1
    );
  }

  return Math.min(
    Math.max(
      parsed,
      0
    ),
    1
  );
}

/* ================================================================
   HEADER
================================================================ */

function Header() {
  return (
    <div className="flex items-start justify-between gap-4">

      <div className="flex min-w-0 items-center gap-3">

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#EAF8F0] text-[#15803D]">
          <BrainCircuit size={19} />
        </div>

        <div className="min-w-0">

          <div className="flex items-center gap-2">

            <h3 className="text-[16px] font-extrab800 tracking-[-0.02em] text-[#26332C] sm:text-[18px]">
              AI Events
            </h3>

            <span className="hidden rounded-full border border-[#BCE7CE] bg-[#F0FBF4] px-2 py-0.5 text-[7px] font-bold uppercase tracking-[0.1em] text-[#15803D] sm:inline-flex">
              Live AI
            </span>

          </div>

          <p className="mt-0.5 text-[9px] text-[#7B8981] sm:text-[10px]">
            Predictive maintenance intelligence
          </p>

        </div>

      </div>

      <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#BCE7CE] bg-[#F0FBF4] px-2.5 py-1.5">

        <span className="relative flex h-1.5 w-1.5">

          <span className="absolute h-full w-full animate-ping rounded-full bg-[#16A34A]/30" />

          <span className="relative h-1.5 w-1.5 rounded-full bg-[#16A34A]" />

        </span>

        <span className="text-[7px] font-bold uppercase tracking-[0.1em] text-[#15803D]">
          Monitoring
        </span>

      </div>

    </div>
  );
}

/* ================================================================
   SUMMARY CARD
================================================================ */

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: RiskTone;
}) {
  const styles: Record<
    RiskTone,
    {
      box: string;
      icon: string;
      value: string;
    }
  > = {
    red: {
      box:
        "border-[#F3C2C2] bg-[#FEF2F2]",
      icon:
        "text-[#DC2626]",
      value:
        "text-[#DC2626]",
    },

    orange: {
      box:
        "border-[#F4D2B8] bg-[#FFF7ED]",
      icon:
        "text-[#EA580C]",
      value:
        "text-[#EA580C]",
    },

    amber: {
      box:
        "border-[#F3D49A] bg-[#FFF7E6]",
      icon:
        "text-[#D97706]",
      value:
        "text-[#D97706]",
    },

    green: {
      box:
        "border-[#BCE7CE] bg-[#F0FBF4]",
      icon:
        "text-[#15803D]",
      value:
        "text-[#15803D]",
    },

    slate: {
      box:
        "border-[#DDE7E1] bg-[#F7FAF8]",
      icon:
        "text-[#64736A]",
      value:
        "text-[#526159]",
    },
  };

  const style =
    styles[tone];

  return (
    <div
      className={`rounded-[11px] border p-3 ${style.box}`}
    >

      <div className={style.icon}>
        {icon}
      </div>

      <p
        className={`mt-2 text-[18px] font-extrab800 ${style.value}`}
      >
        {value}
      </p>

      <p className="mt-0.5 text-[7px] font-bold uppercase tracking-[0.12em] text-[#7B8981]">
        {label}
      </p>

    </div>
  );
}

/* ================================================================
   PROBABILITY CARD
================================================================ */

function ProbabilityCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const percentage =
    value * 100;

  const styles =
    percentage >= 70
      ? {
          text:
            "text-[#DC2626]",
          bar:
            "bg-[#EF4444]",
        }
      : percentage >= 40
        ? {
            text:
              "text-[#D97706]",
            bar:
              "bg-[#F59E0B]",
          }
        : {
            text:
              "text-[#15803D]",
            bar:
              "bg-[#16A34A]",
          };

  return (
    <div className="rounded-[9px] border border-[#E1E9E4] bg-[#F8FAF9] p-2.5">

      <div className="flex items-center gap-1">

        <Clock3
          size={10}
          className="text-[#A0ABA4]"
        />

        <p className="text-[7px] font-bold uppercase tracking-[0.1em] text-[#94A39A]">
          {label}
        </p>

      </div>

      <div className="mt-2 flex items-end justify-between gap-2">

        <p
          className={`text-[12px] font-extrab800 ${styles.text}`}
        >
          {percentage.toFixed(1)}
          %
        </p>

      </div>

      <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-[#E8EEEA]">

        <div
          className={`h-full rounded-full ${styles.bar}`}
          style={{
            width: `${Math.min(
              percentage,
              100
            )}%`,
          }}
        />

      </div>

    </div>
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
    <div className="rounded-[9px] border border-[#E1E9E4] bg-white p-2.5">

      <div className="flex items-center gap-1.5 text-[#94A39A]">

        {icon}

        <span className="text-[7px] font-bold uppercase tracking-[0.1em]">
          {label}
        </span>

      </div>

      <p className="mt-1.5 text-[11px] font-extrab800 text-[#526159]">
        {value}
      </p>

    </div>
  );
}

/* ================================================================
   RISK STYLES
================================================================ */

function getRiskStyles(
  level: RiskLevel
) {
  switch (level) {

    case "CRITICAL":
      return {
        text:
          "text-[#DC2626]",
        badge:
          "border-[#F3C2C2] bg-[#FEF2F2] text-[#DC2626]",
        bar:
          "bg-[#EF4444]",
      };

    case "HIGH":
      return {
        text:
          "text-[#EA580C]",
        badge:
          "border-[#F4D2B8] bg-[#FFF7ED] text-[#EA580C]",
        bar:
          "bg-[#F97316]",
      };

    case "MEDIUM":
      return {
        text:
          "text-[#D97706]",
        badge:
          "border-[#F3D49A] bg-[#FFF7E6] text-[#D97706]",
        bar:
          "bg-[#F59E0B]",
      };

    case "LOW":
      return {
        text:
          "text-[#15803D]",
        badge:
          "border-[#BCE7CE] bg-[#F0FBF4] text-[#15803D]",
        bar:
          "bg-[#16A34A]",
      };

    default:
      return {
        text:
          "text-[#64736A]",
        badge:
          "border-[#DDE7E1] bg-[#F5F7F6] text-[#64736A]",
        bar:
          "bg-[#94A39A]",
      };
  }
}

/* ================================================================
   LOADING
================================================================ */

function LoadingState() {
  return (
    <section className="overflow-hidden rounded-[18px] border border-[#DDE7E1] bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.035)] sm:p-6">

      <div className="flex items-center gap-3">

        <div className="h-10 w-10 animate-pulse rounded-[10px] bg-[#EAF0EC]" />

        <div>
          <div className="h-4 w-28 animate-pulse rounded bg-[#EAF0EC]" />

          <div className="mt-2 h-2.5 w-48 animate-pulse rounded bg-[#F0F4F1]" />
        </div>

      </div>

      <div className="mt-5 space-y-2.5">

        {[1, 2, 3].map(
          (item) => (
            <div
              key={item}
              className="rounded-[14px] border border-[#E8EEEA] bg-[#F8FAF9] p-4"
            >

              <div className="h-3.5 w-36 animate-pulse rounded bg-[#E1E9E4]" />

              <div className="mt-3 h-2 animate-pulse rounded-full bg-[#E1E9E4]" />

              <div className="mt-3 grid grid-cols-3 gap-2">

                {[1, 2, 3].map(
                  (box) => (
                    <div
                      key={box}
                      className="h-12 animate-pulse rounded-[9px] bg-[#EEF3EF]"
                    />
                  )
                )}

              </div>

            </div>
          )
        )}

      </div>

    </section>
  );
}

/* ================================================================
   ERROR
================================================================ */

function ErrorState({
  error,
}: {
  error: string;
}) {
  return (
    <section className="rounded-[18px] border border-[#F3C2C2] bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.035)] sm:p-6">

      <div className="flex items-center gap-3">

        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#FEF2F2] text-[#DC2626]">
          <AlertTriangle size={18} />
        </div>

        <div>

          <h3 className="text-[14px] font-extrab800 text-[#26332C]">
            AI Events
          </h3>

          <p className="mt-1 text-[9px] text-[#DC2626]">
            Predictive analysis is temporarily unavailable.
          </p>

        </div>

      </div>

      <p className="mt-4 rounded-[10px] bg-[#FEF2F2] p-3 text-[9px] leading-5 text-[#B91C1C]">
        {error}
      </p>

    </section>
  );
}

/* ================================================================
   FOOTER
================================================================ */

function Footer({
  machineCount,
  analyzedCount,
}: {
  machineCount: number;
  analyzedCount: number;
}) {
  return (
    <div className="mt-5 flex flex-col gap-2 border-t border-[#E5ECE8] pt-3 sm:flex-row sm:items-center sm:justify-between">

      <span className="text-[7px] font-bold uppercase tracking-[0.12em] text-[#A0ABA4]">
        {analyzedCount} of{" "}
        {machineCount} machines analyzed
      </span>

      <span className="flex items-center gap-1.5 text-[8px] text-[#94A39A]">

        <span className="relative flex h-1.5 w-1.5">

          <span className="absolute h-full w-full animate-ping rounded-full bg-[#16A34A]/30" />

          <span className="relative h-1.5 w-1.5 rounded-full bg-[#16A34A]" />

        </span>

        Predictive AI connected

      </span>

    </div>
  );
}