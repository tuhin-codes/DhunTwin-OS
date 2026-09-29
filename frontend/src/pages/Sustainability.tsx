import { useEffect, useMemo, useState } from "react";
import { getMachines } from "../services/api";

interface Machine {
  id: string;
  name: string;
  type: string;
  power?: number;
  energy?: number;
  carbon?: number;
  water?: number;
  efficiency?: number;
}

interface SustainabilityData {
  machines: number;
  power: number;
  energy: number;
  carbon: number;
  water: number;
  averageEfficiency: number;
  topEmitters: Machine[];
}

function formatNumber(
  value: number,
  decimals = 1
) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return value.toFixed(decimals);
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

  return Math.min(
    Math.max((value / maximum) * 100, 0),
    100
  );
}

function getCarbonRisk(
  carbon: number
) {
  if (carbon > 1000) {
    return {
      label: "High",
      className:
        "border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]",
      description:
        "Factory emissions require attention",
    };
  }

  if (carbon > 500) {
    return {
      label: "Medium",
      className:
        "border-[#FED7AA] bg-[#FFF7ED] text-[#EA580C]",
      description:
        "Moderate emissions detected",
    };
  }

  return {
    label: "Low",
    className:
      "border-[#A7F3D0] bg-[#ECFDF5] text-[#16A34A]",
    description:
      "Emissions currently within normal range",
  };
}

function getSustainabilityScore(
  carbonIntensity: number,
  efficiency: number,
  water: number,
  machines: number
) {
  if (machines <= 0) {
    return 0;
  }

  const intensityScore =
    carbonIntensity <= 0.35
      ? 100
      : carbonIntensity <= 0.5
        ? 85
        : carbonIntensity <= 0.75
          ? 70
          : carbonIntensity <= 1
            ? 55
            : 35;

  const efficiencyScore = Math.min(
    Math.max(efficiency, 0),
    100
  );

  const waterScore =
    water <= 250
      ? 100
      : water <= 500
        ? 85
        : water <= 750
          ? 70
          : 55;

  return Math.round(
    intensityScore * 0.45 +
      efficiencyScore * 0.4 +
      waterScore * 0.15
  );
}

function getEfficiencyStatus(
  efficiency: number
) {
  if (efficiency >= 85) {
    return {
      label: "Excellent",
      className: "text-[#16A34A]",
    };
  }

  if (efficiency >= 70) {
    return {
      label: "Good",
      className: "text-[#0891B2]",
    };
  }

  if (efficiency >= 50) {
    return {
      label: "Watch",
      className: "text-[#CA8A04]",
    };
  }

  return {
    label: "Low",
    className: "text-[#DC2626]",
  };
}

export default function Sustainability() {
  const [data, setData] =
    useState<SustainabilityData | null>(null);

  /*
   * IMPORTANT:
   *
   * loading is only used for the initial
   * page load.
   *
   * Background refreshes must not toggle
   * this state.
   */
  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  // ============================================================
  // LOAD SUSTAINABILITY DATA
  // ============================================================

  async function loadData(
    isInitialLoad = false
  ) {
    try {
      if (isInitialLoad) {
        setLoading(true);
      }

      const machines =
        (await getMachines(
          true
        )) as Machine[];

      const totalPower =
        machines.reduce(
          (sum, machine) =>
            sum +
            Number(
              machine.power || 0
            ),
          0
        );

      const totalEnergy =
        machines.reduce(
          (sum, machine) =>
            sum +
            Number(
              machine.energy || 0
            ),
          0
        );

      const totalCarbon =
        machines.reduce(
          (sum, machine) =>
            sum +
            Number(
              machine.carbon || 0
            ),
          0
        );

      const totalWater =
        machines.reduce(
          (sum, machine) =>
            sum +
            Number(
              machine.water || 0
            ),
          0
        );

      const efficiencyValues =
        machines
          .map((machine) =>
            Number(
              machine.efficiency
            )
          )
          .filter(
            (value) =>
              Number.isFinite(
                value
              )
          );

      const averageEfficiency =
        efficiencyValues.length > 0
          ? efficiencyValues.reduce(
              (sum, value) =>
                sum + value,
              0
            ) /
            efficiencyValues.length
          : 0;

      const topEmitters =
        [...machines]
          .sort(
            (a, b) =>
              Number(
                b.carbon || 0
              ) -
              Number(
                a.carbon || 0
              )
          )
          .slice(0, 5);

      setData({
        machines:
          machines.length,
        power: totalPower,
        energy: totalEnergy,
        carbon: totalCarbon,
        water: totalWater,
        averageEfficiency,
        topEmitters,
      });

      /*
       * A successful refresh clears
       * an old error.
       */
      setError(null);
    } catch (err) {
      /*
       * Only the initial load should
       * replace the screen with an
       * error state.
       *
       * Background refresh failures
       * leave the existing dashboard
       * visible.
       */
      if (isInitialLoad) {
        setError(
          err instanceof Error
            ? err.message
            : "Sustainability data unavailable."
        );
      }

      console.error(
        "Sustainability refresh error:",
        err
      );
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  }

  // ============================================================
  // INITIAL LOAD + BACKGROUND REFRESH
  // ============================================================

  useEffect(() => {
    let mounted = true;

    async function initialLoad() {
      if (!mounted) {
        return;
      }

      await loadData(true);
    }

    initialLoad();

    /*
     * Refresh silently every 5 seconds.
     *
     * The existing UI stays on screen.
     */
    const interval =
      window.setInterval(
        async () => {
          if (!mounted) {
            return;
          }

          await loadData(false);
        },
        5000
      );

    return () => {
      mounted = false;
      window.clearInterval(
        interval
      );
    };
  }, []);

  // ============================================================
  // DERIVED DATA
  // ============================================================

  const carbonIntensity =
    useMemo(() => {
      if (
        !data ||
        data.energy <= 0
      ) {
        return 0;
      }

      return (
        data.carbon /
        data.energy
      );
    }, [data]);

  const carbonRisk =
    useMemo(() => {
      if (!data) {
        return getCarbonRisk(0);
      }

      return getCarbonRisk(
        data.carbon
      );
    }, [data]);

  const totalEmitterCarbon =
    useMemo(() => {
      if (!data) {
        return 0;
      }

      return data.topEmitters.reduce(
        (sum, machine) =>
          sum +
          Number(
            machine.carbon || 0
          ),
        0
      );
    }, [data]);

  const topEmitter =
    data?.topEmitters?.[0];

  const sustainabilityScore =
    useMemo(() => {
      if (!data) {
        return 0;
      }

      return getSustainabilityScore(
        carbonIntensity,
        data.averageEfficiency,
        data.water,
        data.machines
      );
    }, [
      data,
      carbonIntensity,
    ]);

  const sustainabilityStatus =
    sustainabilityScore >= 85
      ? "Excellent"
      : sustainabilityScore >= 70
        ? "Good"
        : sustainabilityScore >= 55
          ? "Watch"
          : "Needs attention";

  // ============================================================
  // INITIAL LOADING
  // ============================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F7FAF8] px-4 py-5 text-[#15211B] sm:px-6 lg:px-8">

        <div className="mx-auto w-full max-w-[1700px]">

          <div className="flex items-center gap-2">

            <span className="relative flex h-2 w-2">

              <span className="absolute h-full w-full animate-ping rounded-full bg-[#16A34A]/30" />

              <span className="relative h-2 w-2 rounded-full bg-[#16A34A]" />

            </span>

            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#16A34A]">
              Sustainability Intelligence
            </span>

          </div>

          <h1 className="mt-2 text-[30px] font-extrabold tracking-[-0.025em] sm:text-[34px]">
            Sustainability
          </h1>

          <p className="mt-1 text-sm text-[#64736A]">
            Loading environmental intelligence...
          </p>

          <div className="mt-6 rounded-[16px] border border-[#DDE7E1] bg-white p-6 shadow-[0_2px_10px_rgba(15,23,42,0.025)]">

            <div className="flex items-center gap-3">

              <span className="relative flex h-2.5 w-2.5">

                <span className="absolute h-full w-full animate-ping rounded-full bg-[#16A34A]/30" />

                <span className="relative h-2.5 w-2.5 rounded-full bg-[#16A34A]" />

              </span>

              <span className="text-sm text-[#64736A]">
                Connecting to sustainability services...
              </span>

            </div>

          </div>

        </div>

      </main>
    );
  }

  // ============================================================
  // ERROR
  // ============================================================

  if (error || !data) {
    return (
      <main className="min-h-screen bg-[#F7FAF8] px-4 py-5 text-[#15211B] sm:px-6 lg:px-8">

        <div className="mx-auto w-full max-w-[1700px]">

          <div className="flex items-center gap-2">

            <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />

            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#16A34A]">
              Sustainability Intelligence
            </span>

          </div>

          <h1 className="mt-2 text-[30px] font-extrabold tracking-[-0.025em] sm:text-[34px]">
            Sustainability
          </h1>

          <div className="mt-6 rounded-[16px] border border-[#FECACA] bg-white p-6">

            <p className="text-sm font-bold text-[#DC2626]">
              Sustainability service unavailable
            </p>

            <p className="mt-2 text-sm text-[#64736A]">
              {error ??
                "Sustainability data unavailable."}
            </p>

          </div>

        </div>

      </main>
    );
  }

  // ============================================================
  // MAIN PAGE
  // ============================================================

  return (
    <main className="min-h-screen bg-[#F7FAF8] px-4 py-5 text-[#15211B] sm:px-6 lg:px-8">

      <div className="mx-auto w-full max-w-[1700px]">

        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

          <div>

            <div className="flex items-center gap-2">

              <span className="relative flex h-2 w-2">

                <span className="absolute h-full w-full animate-ping rounded-full bg-[#16A34A]/30" />

                <span className="relative h-2 w-2 rounded-full bg-[#16A34A]" />

              </span>

              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#16A34A]">
                Sustainability Intelligence
              </span>

            </div>

            <h1 className="mt-2 text-[30px] font-extrabold tracking-[-0.025em] sm:text-[34px] lg:text-[38px]">
              Sustainability
            </h1>

            <p className="mt-1 max-w-[720px] text-sm leading-5 text-[#64736A]">
              Real-time environmental intelligence across
              energy, carbon, water and machine efficiency.
            </p>

          </div>

          <div className="flex w-fit items-center gap-2 rounded-full border border-[#A7F3D0] bg-white px-3 py-2">

            <span className="relative flex h-2 w-2">

              <span className="absolute h-full w-full animate-ping rounded-full bg-[#16A34A]/30" />

              <span className="relative h-2 w-2 rounded-full bg-[#16A34A]" />

            </span>

            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#047857]">
              Live Carbon Tracking
            </span>

          </div>

        </header>

        {/* ================================================== */}
        {/* KPI CARDS */}
        {/* ================================================== */}

        <section className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">

          <KpiCard
            label="Carbon Footprint"
            value={`${formatNumber(
              data.carbon
            )} kg`}
            description="Total CO₂e"
            accent="green"
          />

          <KpiCard
            label="Energy Consumption"
            value={`${formatNumber(
              data.energy
            )} kWh`}
            description="Factory energy"
            accent="cyan"
          />

          <KpiCard
            label="Water Consumption"
            value={`${formatNumber(
              data.water
            )} L`}
            description="Factory water usage"
            accent="blue"
          />

          <KpiCard
            label="Carbon Risk"
            value={carbonRisk.label}
            description={
              carbonRisk.description
            }
            accent={
              carbonRisk.label ===
              "High"
                ? "red"
                : carbonRisk.label ===
                    "Medium"
                  ? "orange"
                  : "green"
            }
          />

          <KpiCard
            label="Sustainability Score"
            value={`${sustainabilityScore}/100`}
            description={sustainabilityStatus}
            accent={
              sustainabilityScore >= 70
                ? "green"
                : sustainabilityScore >= 55
                  ? "orange"
                  : "red"
            }
          />

        </section>

        {/* ================================================== */}
        {/* ENVIRONMENTAL SNAPSHOT */}
        {/* ================================================== */}

        <section className="mt-7">

          <SectionHeading
            title="Environmental Snapshot"
            description="Current resource consumption across the factory"
            badge="LIVE DATA"
          />

          <div className="mt-3.5 grid grid-cols-1 gap-4 lg:grid-cols-3">

            {/* POWER */}

            <ResourceCard
              title="Power Demand"
              value={`${formatNumber(
                data.power
              )} kW`}
              description="Current factory demand"
              percentage={getBarWidth(
                data.power,
                2000
              )}
              barClass="bg-[#0891B2]"
              icon="⚡"
            />

            {/* ENERGY */}

            <ResourceCard
              title="Energy Consumption"
              value={`${formatNumber(
                data.energy
              )} kWh`}
              description="Current energy usage"
              percentage={getBarWidth(
                data.energy,
                5000
              )}
              barClass="bg-[#16A34A]"
              icon="↯"
            />

            {/* WATER */}

            <ResourceCard
              title="Water Consumption"
              value={`${formatNumber(
                data.water
              )} L`}
              description="Current water usage"
              percentage={getBarWidth(
                data.water,
                1000
              )}
              barClass="bg-[#2563EB]"
              icon="◌"
            />

          </div>

        </section>

        {/* ================================================== */}
        {/* SUSTAINABILITY DECISION VIEW */}
        {/* ================================================== */}

        <section className="mt-8 rounded-[16px] border border-[#A7F3D0] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)] sm:p-6">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

            <div className="max-w-[850px]">

              <div className="flex items-center gap-2">

                <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />

                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#047857]">
                  Sustainability Decision View
                </p>

              </div>

              <h2 className="mt-2 text-xl font-bold text-[#15211B]">
                {topEmitter
                  ? `${topEmitter.name} is the current emission hotspot`
                  : "Environmental baseline is being established"}
              </h2>

              <p className="mt-2 text-sm leading-6 text-[#64736A]">
                {topEmitter
                  ? `${topEmitter.name} currently contributes ${(
                      (Number(topEmitter.carbon || 0) /
                        Math.max(data.carbon, 1)) *
                      100
                    ).toFixed(1)}% of measured factory carbon. Start optimization analysis with the highest-impact asset first.`
                  : "CarbonTwin will surface the highest-impact assets as machine environmental telemetry becomes available."}
              </p>

            </div>

            <div className="shrink-0 rounded-[14px] border border-[#DDE7E1] bg-[#F7FAF8] p-4 text-center">

              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#94A39A]">
                Sustainability Score
              </p>

              <p className="mt-1 text-3xl font-extrabold text-[#16A34A]">
                {sustainabilityScore}
              </p>

              <p className="text-[9px] font-semibold uppercase tracking-wider text-[#64736A]">
                {sustainabilityStatus}
              </p>

            </div>

          </div>

        </section>

        {/* ================================================== */}
        {/* CARBON INTELLIGENCE */}
        {/* ================================================== */}

        <section className="mt-8">

          <SectionHeading
            title="Carbon Intelligence"
            description="Emission intensity and sustainability performance"
          />

          <div className="mt-3.5 grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_0.85fr]">

            {/* CARBON INTENSITY */}

            <div className="rounded-[16px] border border-[#DDE7E1] bg-white p-6 shadow-[0_2px_10px_rgba(15,23,42,0.025)]">

              <div className="flex items-start justify-between gap-4">

                <div>

                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64736A]">
                    Carbon Intensity
                  </p>

                  <p className="mt-1 text-xs text-[#94A39A]">
                    Carbon emitted per unit of energy
                  </p>

                </div>

                <span
                  className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase ${carbonRisk.className}`}
                >
                  {carbonRisk.label} Risk
                </span>

              </div>

              <div className="mt-7 flex items-end gap-3">

                <span className="text-5xl font-extrabold tracking-[-0.04em] text-[#15211B]">
                  {carbonIntensity.toFixed(
                    3
                  )}
                </span>

                <span className="mb-2 text-xs font-medium text-[#94A39A]">
                  kg CO₂e / kWh
                </span>

              </div>

              <div className="mt-6 h-2 overflow-hidden rounded-full bg-[#E8EFEB]">

                <div
                  className={`h-full rounded-full ${
                    carbonRisk.label ===
                    "High"
                      ? "bg-[#DC2626]"
                      : carbonRisk.label ===
                          "Medium"
                        ? "bg-[#EA580C]"
                        : "bg-[#16A34A]"
                  }`}
                  style={{
                    width: `${Math.min(
                      carbonIntensity *
                        100,
                      100
                    )}%`,
                  }}
                />

              </div>

              <div className="mt-2 flex justify-between text-[9px] text-[#94A39A]">

                <span>
                  Lower intensity
                </span>

                <span>
                  Higher intensity
                </span>

              </div>

            </div>

            {/* EFFICIENCY */}

            <div className="rounded-[16px] border border-[#DDE7E1] bg-white p-6 shadow-[0_2px_10px_rgba(15,23,42,0.025)]">

              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64736A]">
                Average Machine Efficiency
              </p>

              <div className="mt-4 flex items-end justify-between gap-4">

                <div>

                  <p
                    className={`text-4xl font-extrabold ${getEfficiencyStatus(
                      data.averageEfficiency
                    ).className}`}
                  >
                    {formatNumber(
                      data.averageEfficiency,
                      1
                    )}
                    %
                  </p>

                  <p
                    className={`mt-1 text-xs font-semibold ${
                      getEfficiencyStatus(
                        data.averageEfficiency
                      ).className
                    }`}
                  >
                    {
                      getEfficiencyStatus(
                        data.averageEfficiency
                      ).label
                    }
                  </p>

                </div>

                <div className="flex h-16 w-16 items-center justify-center rounded-[14px] bg-[#ECFDF5]">

                  <span className="text-2xl text-[#16A34A]">
                    %
                  </span>

                </div>

              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#E8EFEB]">

                <div
                  className="h-full rounded-full bg-[#16A34A]"
                  style={{
                    width: `${Math.min(
                      Math.max(
                        data.averageEfficiency,
                        0
                      ),
                      100
                    )}%`,
                  }}
                />

              </div>

              <p className="mt-3 text-[10px] leading-4 text-[#94A39A]">
                Higher machine efficiency generally
                indicates more effective use of energy
                during factory operations.
              </p>

            </div>

          </div>

        </section>

        {/* ================================================== */}
        {/* TOP EMITTERS */}
        {/* ================================================== */}

        <section className="mt-8 rounded-[16px] border border-[#DDE7E1] bg-white shadow-[0_2px_10px_rgba(15,23,42,0.025)]">

          <div className="border-b border-[#E8EFEB] p-5 sm:p-6">

            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

              <div>

                <div className="flex items-center gap-2">

                  <span className="h-1.5 w-1.5 rounded-full bg-[#EA580C]" />

                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#EA580C]">
                    Emission Hotspots
                  </p>

                </div>

                <h2 className="mt-1 text-xl font-bold text-[#15211B]">
                  Highest Carbon Emitters
                </h2>

                <p className="mt-1 text-sm text-[#64736A]">
                  Machines contributing most to the factory
                  carbon footprint.
                </p>

              </div>

              <div className="rounded-[10px] border border-[#DDE7E1] bg-[#F7FAF8] px-3 py-2">

                <p className="text-[9px] font-bold uppercase tracking-wider text-[#94A39A]">
                  Top 5 contribution
                </p>

                <p className="mt-0.5 text-sm font-bold text-[#15211B]">
                  {formatNumber(
                    totalEmitterCarbon
                  )}{" "}
                  kg CO₂e
                </p>

              </div>

            </div>

          </div>

          <div className="divide-y divide-[#E8EFEB]">

            {data.topEmitters.length ===
            0 ? (

              <div className="p-8 text-center">

                <p className="text-sm font-semibold text-[#15211B]">
                  No emission data available.
                </p>

                <p className="mt-1 text-xs text-[#94A39A]">
                  Machine carbon telemetry has not returned
                  measurable values yet.
                </p>

              </div>

            ) : (

              data.topEmitters.map(
                (
                  machine,
                  index
                ) => {

                  const carbon =
                    Number(
                      machine.carbon ||
                        0
                    );

                  const contribution =
                    data.carbon > 0
                      ? (carbon /
                          data.carbon) *
                        100
                      : 0;

                  const maxCarbon =
                    Number(
                      data.topEmitters[0]
                        ?.carbon || 0
                    );

                  return (
                    <div
                      key={
                        machine.id
                      }
                      className="p-5 transition hover:bg-[#FBFDFC] sm:p-6"
                    >

                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">

                        {/* RANK */}

                        <div className="flex shrink-0 items-center gap-3">

                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF7ED] text-xs font-bold text-[#EA580C]">
                            {index +
                              1}
                          </span>

                          <div className="sm:hidden">

                            <p className="font-bold text-[#15211B]">
                              {
                                machine.name
                              }
                            </p>

                            <p className="text-[10px] text-[#94A39A]">
                              {
                                machine.id
                              }{" "}
                              ·{" "}
                              {
                                machine.type
                              }
                            </p>

                          </div>

                        </div>

                        {/* MACHINE */}

                        <div className="hidden min-w-[180px] sm:block">

                          <p className="font-bold text-[#15211B]">
                            {
                              machine.name
                            }
                          </p>

                          <p className="mt-0.5 text-[10px] text-[#94A39A]">
                            {
                              machine.id
                            }{" "}
                            ·{" "}
                            {
                              machine.type
                            }
                          </p>

                        </div>

                        {/* BAR */}

                        <div className="min-w-0 flex-1">

                          <div className="mb-2 flex items-center justify-between gap-3">

                            <span className="text-[9px] font-bold uppercase tracking-wider text-[#94A39A]">
                              Relative emission
                            </span>

                            <span className="text-[9px] font-semibold text-[#64736A]">
                              {contribution.toFixed(
                                1
                              )}
                              % of total
                            </span>

                          </div>

                          <div className="h-2 overflow-hidden rounded-full bg-[#E8EFEB]">

                            <div
                              className="h-full rounded-full bg-[#EA580C]"
                              style={{
                                width: `${getBarWidth(
                                  carbon,
                                  maxCarbon
                                )}%`,
                              }}
                            />

                          </div>

                        </div>

                        {/* VALUE */}

                        <div className="shrink-0 text-left sm:min-w-[120px] sm:text-right">

                          <p className="text-base font-bold text-[#EA580C]">
                            {formatNumber(
                              carbon
                            )}{" "}
                            kg
                          </p>

                          <p className="text-[9px] text-[#94A39A]">
                            CO₂e
                          </p>

                        </div>

                      </div>

                    </div>
                  );
                }
              )

            )}

          </div>

        </section>

        {/* ================================================== */}
        {/* AI SUSTAINABILITY INTELLIGENCE */}
        {/* ================================================== */}

        <section className="mt-8 rounded-[16px] border border-[#A7F3D0] bg-white shadow-[0_2px_10px_rgba(15,23,42,0.025)]">

          <div className="border-l-4 border-[#16A34A] p-5 sm:p-6">

            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

              <div className="max-w-[800px]">

                <div className="flex items-center gap-2">

                  <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />

                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#047857]">
                    AI Sustainability Intelligence
                  </p>

                </div>

                <h2 className="mt-2 text-xl font-bold text-[#15211B]">
                  Reduce emissions by targeting the
                  highest-impact assets
                </h2>

                <p className="mt-2 text-sm leading-6 text-[#64736A]">
                  CarbonTwin continuously compares machine-level
                  environmental signals to identify where operational
                  optimization can have the greatest sustainability impact.
                </p>

              </div>

              <div className="shrink-0 rounded-[12px] bg-[#ECFDF5] px-4 py-3">

                <p className="text-[9px] font-bold uppercase tracking-wider text-[#047857]">
                  Priority Asset
                </p>

                <p className="mt-1 text-sm font-bold text-[#15211B]">
                  {topEmitter
                    ? topEmitter.name
                    : "No hotspot detected"}
                </p>

                {topEmitter && (
                  <p className="mt-0.5 text-[9px] text-[#64736A]">
                    Highest current carbon contributor
                  </p>
                )}

              </div>

            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">

              <InsightCard
                number="01"
                title="Prioritize"
                description="Investigate the highest-emission machines first."
              />

              <InsightCard
                number="02"
                title="Optimize"
                description="Review operating conditions and machine efficiency."
              />

              <InsightCard
                number="03"
                title="Reduce"
                description="Use the digital twin to evaluate lower-impact operation."
              />

            </div>

          </div>

        </section>

        {/* ================================================== */}
        {/* OPERATIONAL ACTIONS */}
        {/* ================================================== */}

        <section className="mt-8 rounded-[16px] border border-[#DDE7E1] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)] sm:p-6">

          <SectionHeading
            title="Operational Actions"
            description="Practical next steps derived from current environmental signals"
          />

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">

            <ActionCard
              number="01"
              title="Inspect hotspot"
              description={
                topEmitter
                  ? `Review ${topEmitter.name} first because it is the largest current carbon contributor.`
                  : "Review machine carbon telemetry when available."
              }
            />

            <ActionCard
              number="02"
              title="Improve efficiency"
              description={
                data.averageEfficiency < 70
                  ? "Prioritize operating-condition review on lower-efficiency assets."
                  : "Maintain efficient operating conditions and watch for degradation."
              }
            />

            <ActionCard
              number="03"
              title="Track impact"
              description="Use subsequent live measurements to verify whether interventions reduce carbon and energy intensity."
            />

          </div>

        </section>

        {/* ================================================== */}
        {/* FACTORY SUMMARY */}
        {/* ================================================== */}

        <section className="mt-8 rounded-[16px] border border-[#DDE7E1] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)] sm:p-6">

          <div className="flex items-center gap-2">

            <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />

            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#16A34A]">
              Factory Sustainability Summary
            </p>

          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">

            <SummaryValue
              label="Monitored Assets"
              value={String(
                data.machines
              )}
            />

            <SummaryValue
              label="Carbon"
              value={`${formatNumber(
                data.carbon
              )} kg`}
            />

            <SummaryValue
              label="Energy"
              value={`${formatNumber(
                data.energy
              )} kWh`}
            />

            <SummaryValue
              label="Efficiency"
              value={`${formatNumber(
                data.averageEfficiency
              )}%`}
            />

            <SummaryValue
              label="Sustainability Score"
              value={`${sustainabilityScore}/100`}
            />

          </div>

        </section>

        {/* ================================================== */}
        {/* FOOTER */}
        {/* ================================================== */}

        <footer className="mt-8 border-t border-[#DCE8E1] py-5">

          <div className="flex flex-col gap-1.5 text-[10px] text-[#94A39A] sm:flex-row sm:items-center sm:justify-between">

            <span>
              CarbonTwin OS · Sustainability Intelligence
            </span>

            <span>
              Energy · Carbon · Water · Efficiency
            </span>

          </div>

        </footer>

      </div>

    </main>
  );
}

// ============================================================
// KPI CARD
// ============================================================

interface KpiCardProps {
  label: string;
  value: string;
  description: string;
  accent:
    | "green"
    | "cyan"
    | "blue"
    | "orange"
    | "red";
}

function KpiCard({
  label,
  value,
  description,
  accent,
}: KpiCardProps) {
  const accentClasses = {
    green:
      "border-[#A7F3D0] text-[#16A34A]",
    cyan:
      "border-[#BAE6FD] text-[#0891B2]",
    blue:
      "border-[#BFDBFE] text-[#2563EB]",
    orange:
      "border-[#FED7AA] text-[#EA580C]",
    red:
      "border-[#FECACA] text-[#DC2626]",
  };

  return (
    <div
      className={`rounded-[14px] border bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)] ${accentClasses[accent]}`}
    >

      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64736A]">
        {label}
      </p>

      <p
        className={`mt-2 text-3xl font-extrabold tracking-[-0.025em] ${accentClasses[accent].split(" ")[1]}`}
      >
        {value}
      </p>

      <p className="mt-1 text-[10px] text-[#94A39A]">
        {description}
      </p>

    </div>
  );
}

// ============================================================
// RESOURCE CARD
// ============================================================

interface ResourceCardProps {
  title: string;
  value: string;
  description: string;
  percentage: number;
  barClass: string;
  icon: string;
}

function ResourceCard({
  title,
  value,
  description,
  percentage,
  barClass,
  icon,
}: ResourceCardProps) {
  return (
    <div className="rounded-[14px] border border-[#DDE7E1] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)]">

      <div className="flex items-start justify-between gap-3">

        <div>

          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64736A]">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold text-[#15211B]">
            {value}
          </p>

          <p className="mt-1 text-[10px] text-[#94A39A]">
            {description}
          </p>

        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#F7FAF8] text-lg text-[#16A34A]">
          {icon}
        </div>

      </div>

      <div className="mt-5">

        <div className="h-2 overflow-hidden rounded-full bg-[#E8EFEB]">

          <div
            className={`h-full rounded-full ${barClass}`}
            style={{
              width: `${percentage}%`,
            }}
          />

        </div>

        <div className="mt-2 flex justify-between text-[9px] text-[#94A39A]">

          <span>
            Current utilization
          </span>

          <span>
            {percentage.toFixed(0)}%
          </span>

        </div>

      </div>

    </div>
  );
}

// ============================================================
// SECTION HEADING
// ============================================================

interface SectionHeadingProps {
  title: string;
  description: string;
  badge?: string;
}

function SectionHeading({
  title,
  description,
  badge,
}: SectionHeadingProps) {
  return (
    <div className="flex items-end justify-between gap-4">

      <div className="min-w-0">

        <div className="flex items-center gap-2">

          <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />

          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#16A34A]">
            {title}
          </p>

        </div>

        <p className="mt-1 text-[11px] text-[#64736A] sm:text-xs">
          {description}
        </p>

      </div>

      {badge && (
        <span className="hidden shrink-0 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-1 text-[8px] font-bold uppercase tracking-wider text-[#047857] sm:block">
          {badge}
        </span>
      )}

    </div>
  );
}

// ============================================================
// AI INSIGHT CARD
// ============================================================

interface InsightCardProps {
  number: string;
  title: string;
  description: string;
}

function InsightCard({
  number,
  title,
  description,
}: InsightCardProps) {
  return (
    <div className="rounded-[10px] border border-[#DDE7E1] bg-[#FBFDFC] p-4">

      <div className="flex items-center gap-2">

        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#16A34A] text-[8px] font-bold text-white">
          {number}
        </span>

        <p className="text-sm font-bold text-[#15211B]">
          {title}
        </p>

      </div>

      <p className="mt-2 text-[10px] leading-4 text-[#64736A]">
        {description}
      </p>

    </div>
  );
}

// ============================================================
// ACTION CARD
// ============================================================

interface ActionCardProps {
  number: string;
  title: string;
  description: string;
}

function ActionCard({
  number,
  title,
  description,
}: ActionCardProps) {
  return (
    <div className="rounded-[12px] border border-[#DDE7E1] bg-[#FBFDFC] p-4">

      <div className="flex items-center gap-2">

        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ECFDF5] text-[9px] font-bold text-[#047857]">
          {number}
        </span>

        <p className="text-sm font-bold text-[#15211B]">
          {title}
        </p>

      </div>

      <p className="mt-2 text-[10px] leading-4 text-[#64736A]">
        {description}
      </p>

    </div>
  );
}

// ============================================================
// SUMMARY VALUE
// ============================================================

interface SummaryValueProps {
  label: string;
  value: string;
}

function SummaryValue({
  label,
  value,
}: SummaryValueProps) {
  return (
    <div className="rounded-[10px] bg-[#F7FAF8] p-4">

      <p className="text-[9px] font-bold uppercase tracking-wider text-[#94A39A]">
        {label}
      </p>

      <p className="mt-1 text-lg font-bold text-[#15211B]">
        {value}
      </p>

    </div>
  );
}