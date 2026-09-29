import { useEffect, useMemo, useState } from "react";

import {
  getMachines,
  type Machine,
} from "../services/api";

// ============================================================
// HELPERS
// ============================================================

function getAIRisk(machine: Machine): number {
  const prediction =
    machine.ai_prediction?.failure_probability;

  if (
    prediction &&
    typeof prediction === "object"
  ) {
    return (
      Number(
        prediction["120m"] ?? 0
      ) * 100
    );
  }

  return Number(
    machine.failure_probability || 0
  );
}

function getRiskLevel(risk: number) {
  if (risk >= 70) {
    return {
      label: "Critical",
      className:
        "border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]",
      textClass: "text-[#DC2626]",
    };
  }

  if (risk >= 40) {
    return {
      label: "High",
      className:
        "border-[#FED7AA] bg-[#FFF7ED] text-[#EA580C]",
      textClass: "text-[#EA580C]",
    };
  }

  if (risk >= 20) {
    return {
      label: "Medium",
      className:
        "border-[#FEF08A] bg-[#FEFCE8] text-[#CA8A04]",
      textClass: "text-[#CA8A04]",
    };
  }

  return {
    label: "Low",
    className:
      "border-[#A7F3D0] bg-[#ECFDF5] text-[#16A34A]",
    textClass: "text-[#16A34A]",
  };
}

function getStatusClass(
  status: string | undefined
) {
  const normalized =
    String(status ?? "").toLowerCase();

  if (
    normalized.includes("critical") ||
    normalized.includes("urgent")
  ) {
    return {
      className:
        "border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]",
    };
  }

  if (
    normalized.includes("attention") ||
    normalized.includes("maintenance") ||
    normalized.includes("due")
  ) {
    return {
      className:
        "border-[#FED7AA] bg-[#FFF7ED] text-[#EA580C]",
    };
  }

  if (
    normalized.includes("scheduled") ||
    normalized.includes("planned")
  ) {
    return {
      className:
        "border-[#DDD6FE] bg-[#F5F3FF] text-[#7C3AED]",
    };
  }

  return {
    className:
      "border-[#A7F3D0] bg-[#ECFDF5] text-[#16A34A]",
  };
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

// ============================================================
// COMPONENT
// ============================================================

export default function Reports() {
  const [machines, setMachines] =
    useState<Machine[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [filter, setFilter] =
    useState<
      "all" | "critical" | "attention"
    >("all");

  const [generating, setGenerating] =
    useState(false);

  // ============================================================
  // LOAD DATA
  // ============================================================

  async function loadReportData(
    isInitialLoad = false
  ) {
    try {
      if (isInitialLoad) {
        setLoading(true);
      }

      const data =
        await getMachines(true);

      setMachines(data);
      setError(null);
    } catch (err) {
      if (isInitialLoad) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load factory report."
        );
      }

      console.error(
        "Reports refresh error:",
        err
      );
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  }

  // ============================================================
  // INITIAL LOAD + SILENT REFRESH
  // ============================================================

  useEffect(() => {
    let mounted = true;

    async function initialLoad() {
      if (!mounted) {
        return;
      }

      await loadReportData(true);
    }

    initialLoad();

    const interval =
      window.setInterval(
        async () => {
          if (!mounted) {
            return;
          }

          await loadReportData(
            false
          );
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
  // FACTORY METRICS
  // ============================================================

  const totalPower = useMemo(
    () =>
      machines.reduce(
        (sum, machine) =>
          sum +
          Number(
            machine.power || 0
          ),
        0
      ),
    [machines]
  );

  const totalEnergy = useMemo(
    () =>
      machines.reduce(
        (sum, machine) =>
          sum +
          Number(
            machine.energy || 0
          ),
        0
      ),
    [machines]
  );

  const totalCarbon = useMemo(
    () =>
      machines.reduce(
        (sum, machine) =>
          sum +
          Number(
            machine.carbon || 0
          ),
        0
      ),
    [machines]
  );

  const averageHealth =
    machines.length > 0
      ? machines.reduce(
          (sum, machine) =>
            sum +
            Number(
              machine.health_score ||
                0
            ),
          0
        ) / machines.length
      : 0;

  const highRiskMachines =
    machines.filter(
      (machine) =>
        getAIRisk(machine) >= 70
    );

  const attentionMachines =
    machines.filter(
      (machine) => {
        const status =
          String(
            machine.maintenance_status ??
              ""
          ).toLowerCase();

        return (
          status.includes(
            "attention"
          ) ||
          status.includes(
            "maintenance"
          ) ||
          getAIRisk(machine) >= 40
        );
      }
    );

  const operationalMachines =
    machines.filter(
      (machine) => {
        const status =
          String(
            machine.maintenance_status ??
              ""
          ).toLowerCase();

        return (
          status ===
          "operational"
        );
      }
    );

  const mediumRiskMachines =
    machines.filter(
      (machine) => {
        const risk =
          getAIRisk(machine);

        return (
          risk >= 20 &&
          risk < 70
        );
      }
    );

  const averageRisk =
    machines.length > 0
      ? machines.reduce(
          (sum, machine) =>
            sum +
            getAIRisk(machine),
          0
        ) / machines.length
      : 0;

  const carbonIntensity =
    totalEnergy > 0
      ? totalCarbon /
        totalEnergy
      : 0;

  // ============================================================
  // FILTERED MACHINES
  // ============================================================

  const filteredMachines =
    useMemo(() => {
      const result =
        [...machines];

      result.sort(
        (a, b) =>
          getAIRisk(b) -
          getAIRisk(a)
      );

      if (filter === "critical") {
        return result.filter(
          (machine) =>
            getAIRisk(machine) >=
            70
        );
      }

      if (filter === "attention") {
        return result.filter(
          (machine) =>
            getAIRisk(machine) >=
            20
        );
      }

      return result;
    }, [
      machines,
      filter,
    ]);

  // ============================================================
  // GENERATE PDF REPORT
  // ============================================================

  const generateReport =
    async () => {
      try {
        setGenerating(true);

        const apiBaseUrl =
          "http://127.0.0.1:8000";

        const response =
          await fetch(
            `${apiBaseUrl}/reports/factory/pdf`,
            {
              method: "GET",
              headers: {
                Accept:
                  "application/pdf",
              },
            }
          );

        if (!response.ok) {
          throw new Error(
            `Report generation failed (${response.status}).`
          );
        }

        const contentType =
          response.headers.get(
            "content-type"
          );

        if (
          !contentType?.includes(
            "application/pdf"
          )
        ) {
          throw new Error(
            "Backend returned a non-PDF response."
          );
        }

        const blob =
          await response.blob();

        const url =
          URL.createObjectURL(
            blob
          );

        const link =
          document.createElement(
            "a"
          );

        link.href = url;

        link.download =
          "CarbonTwin-OS-Factory-Intelligence-Report.pdf";

        document.body.appendChild(
          link
        );

        link.click();

        document.body.removeChild(
          link
        );

        URL.revokeObjectURL(
          url
        );
      } catch (err) {
        console.error(
          "PDF report generation error:",
          err
        );

        window.alert(
          err instanceof Error
            ? err.message
            : "Unable to generate PDF report."
        );
      } finally {
        setGenerating(false);
      }
    };

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
              Factory Reporting Intelligence
            </span>

          </div>

          <h1 className="mt-2 text-[30px] font-extrab800 tracking-[-0.025em] sm:text-[34px]">
            Reports
          </h1>

          <p className="mt-1 text-sm text-[#64736A]">
            Loading factory intelligence report...
          </p>

          <div className="mt-6 rounded-[16px] border border-[#DDE7E1] bg-white p-6 shadow-[0_2px_10px_rgba(15,23,42,0.025)]">

            <div className="flex items-center gap-3">

              <span className="relative flex h-2.5 w-2.5">

                <span className="absolute h-full w-full animate-ping rounded-full bg-[#16A34A]/30" />

                <span className="relative h-2.5 w-2.5 rounded-full bg-[#16A34A]" />

              </span>

              <span className="text-sm text-[#64736A]">
                Generating factory report...
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

  if (error) {
    return (
      <main className="min-h-screen bg-[#F7FAF8] px-4 py-5 text-[#15211B] sm:px-6 lg:px-8">

        <div className="mx-auto w-full max-w-[1700px]">

          <div className="flex items-center gap-2">

            <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />

            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#16A34A]">
              Factory Reporting Intelligence
            </span>

          </div>

          <h1 className="mt-2 text-[30px] font-extrab800 tracking-[-0.025em] sm:text-[34px]">
            Reports
          </h1>

          <div className="mt-6 rounded-[16px] border border-[#FECACA] bg-white p-6">

            <p className="text-sm font-bold text-[#DC2626]">
              Factory report unavailable
            </p>

            <p className="mt-2 text-sm text-[#64736A]">
              {error}
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
                Factory Reporting Intelligence
              </span>

            </div>

            <h1 className="mt-2 text-[30px] font-extrab800 tracking-[-0.025em] sm:text-[34px] lg:text-[38px]">
              Reports
            </h1>

            <p className="mt-1 max-w-[720px] text-sm leading-5 text-[#64736A]">
              Executive factory intelligence combining
              digital-twin telemetry, predictive AI and
              sustainability performance.
            </p>

          </div>

          <div className="flex flex-wrap items-center gap-2">

            <div className="flex items-center gap-2 rounded-full border border-[#A7F3D0] bg-white px-3 py-2">

              <span className="relative flex h-2 w-2">

                <span className="absolute h-full w-full animate-ping rounded-full bg-[#16A34A]/30" />

                <span className="relative h-2 w-2 rounded-full bg-[#16A34A]" />

              </span>

              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#047857]">
                Live Report
              </span>

            </div>

            <button
              onClick={
                generateReport
              }
              disabled={
                generating
              }
              className="rounded-[9px] bg-[#087443] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#06663A] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generating
                ? "Generating PDF..."
                : "Export PDF"}
            </button>

          </div>

        </header>

        {/* ================================================== */}
        {/* REPORT BANNER */}
        {/* ================================================== */}

        <section className="mt-7 overflow-hidden rounded-[16px] border border-[#DDE7E1] bg-white shadow-[0_2px_10px_rgba(15,23,42,0.025)]">

          <div className="relative border-l-4 border-[#16A34A] p-5 sm:p-6">

            <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-emerald-50 blur-3xl" />

            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

              <div>

                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#047857]">
                  Live Factory Report
                </p>

                <h2 className="mt-1 text-xl font-bold text-[#15211B]">
                  CarbonTwin OS Factory Intelligence
                </h2>

                <p className="mt-2 max-w-[760px] text-sm leading-5 text-[#64736A]">
                  Current operational health, predictive
                  maintenance risk and environmental performance
                  generated from the live digital twin.
                </p>

              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">

                <MiniStat
                  label="Assets"
                  value={String(
                    machines.length
                  )}
                />

                <MiniStat
                  label="AI Risk"
                  value={`${averageRisk.toFixed(
                    1
                  )}%`}
                />

                <MiniStat
                  label="Health"
                  value={`${averageHealth.toFixed(
                    1
                  )}%`}
                />

              </div>

            </div>

          </div>

        </section>

        {/* ================================================== */}
        {/* EXECUTIVE KPIs */}
        {/* ================================================== */}

        <section className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <MetricCard
            label="Monitored Assets"
            value={String(
              machines.length
            )}
            description="Machines in digital twin"
            valueClass="text-[#15211B]"
            borderClass="border-[#DDE7E1]"
          />

          <MetricCard
            label="Average Health"
            value={`${averageHealth.toFixed(
              1
            )}%`}
            description="Fleet health score"
            valueClass="text-[#16A34A]"
            borderClass="border-[#A7F3D0]"
          />

          <MetricCard
            label="Critical AI Risk"
            value={String(
              highRiskMachines.length
            )}
            description="Assets above 70% risk"
            valueClass="text-[#DC2626]"
            borderClass="border-[#FECACA]"
          />

          <MetricCard
            label="Needs Attention"
            value={String(
              attentionMachines.length
            )}
            description="Predictive intervention queue"
            valueClass="text-[#EA580C]"
            borderClass="border-[#FED7AA]"
          />

        </section>

        {/* ================================================== */}
        {/* OPERATIONAL SNAPSHOT */}
        {/* ================================================== */}

        <section className="mt-8">

          <SectionHeading
            title="Operational Snapshot"
            description="Current factory health and predictive risk distribution"
          />

          <div className="mt-3.5 grid grid-cols-1 gap-4 lg:grid-cols-3">

            <SnapshotCard
              label="Operational Assets"
              value={
                operationalMachines.length
              }
              total={
                machines.length
              }
              percentage={
                machines.length > 0
                  ? (operationalMachines.length /
                      machines.length) *
                    100
                  : 0
              }
              barClass="bg-[#16A34A]"
              description="Currently operating normally"
            />

            <SnapshotCard
              label="Attention Assets"
              value={
                mediumRiskMachines.length
              }
              total={
                machines.length
              }
              percentage={
                machines.length > 0
                  ? (mediumRiskMachines.length /
                      machines.length) *
                    100
                  : 0
              }
              barClass="bg-[#EA580C]"
              description="Elevated predictive risk"
            />

            <SnapshotCard
              label="Critical Assets"
              value={
                highRiskMachines.length
              }
              total={
                machines.length
              }
              percentage={
                machines.length > 0
                  ? (highRiskMachines.length /
                      machines.length) *
                    100
                  : 0
              }
              barClass="bg-[#DC2626]"
              description="Immediate review recommended"
            />

          </div>

        </section>

        {/* ================================================== */}
        {/* SUSTAINABILITY REPORT */}
        {/* ================================================== */}

        <section className="mt-8">

          <SectionHeading
            title="Sustainability Summary"
            description="Factory energy and carbon performance"
            badge="LIVE DATA"
          />

          <div className="mt-3.5 grid grid-cols-1 gap-4 md:grid-cols-3">

            <SustainabilityCard
              label="Power Demand"
              value={`${formatNumber(
                totalPower
              )} kW`}
              description="Current aggregate machine demand"
              valueClass="text-[#0891B2]"
            />

            <SustainabilityCard
              label="Energy Consumption"
              value={`${formatNumber(
                totalEnergy
              )} kWh`}
              description="Current factory energy usage"
              valueClass="text-[#16A34A]"
            />

            <SustainabilityCard
              label="Carbon Footprint"
              value={`${formatNumber(
                totalCarbon
              )} kg`}
              description={`${carbonIntensity.toFixed(
                3
              )} kg CO₂e / kWh`}
              valueClass="text-[#EA580C]"
            />

          </div>

        </section>

        {/* ================================================== */}
        {/* MACHINE REPORT */}
        {/* ================================================== */}

        <section className="mt-8 rounded-[16px] border border-[#DDE7E1] bg-white shadow-[0_2px_10px_rgba(15,23,42,0.025)]">

          <div className="flex flex-col gap-4 border-b border-[#E8EFEB] p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">

            <div>

              <div className="flex items-center gap-2">

                <span className="h-1.5 w-1.5 rounded-full bg-[#7C3AED]" />

                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7C3AED]">
                  Asset Intelligence
                </p>

              </div>

              <h2 className="mt-1 text-xl font-bold text-[#15211B]">
                Machine Report
              </h2>

              <p className="mt-1 text-sm text-[#64736A]">
                Current digital-twin, predictive AI and
                sustainability status by asset.
              </p>

            </div>

            <div className="flex flex-wrap gap-2">

              <FilterButton
                label="All"
                active={
                  filter ===
                  "all"
                }
                onClick={() =>
                  setFilter(
                    "all"
                  )
                }
              />

              <FilterButton
                label="Priority"
                active={
                  filter ===
                  "attention"
                }
                onClick={() =>
                  setFilter(
                    "attention"
                  )
                }
              />

              <FilterButton
                label="Critical"
                active={
                  filter ===
                  "critical"
                }
                onClick={() =>
                  setFilter(
                    "critical"
                  )
                }
              />

            </div>

          </div>

          <div className="overflow-x-auto">

            <table className="w-full min-w-[1050px] text-left">

              <thead>

                <tr className="border-b border-[#E8EFEB] bg-[#FBFDFC] text-[9px] font-bold uppercase tracking-[0.12em] text-[#94A39A]">

                  <th className="px-5 py-3">
                    Machine
                  </th>

                  <th className="px-4 py-3">
                    Type
                  </th>

                  <th className="px-4 py-3">
                    Health
                  </th>

                  <th className="px-4 py-3">
                    AI Risk
                  </th>

                  <th className="px-4 py-3">
                    RUL
                  </th>

                  <th className="px-4 py-3">
                    Carbon
                  </th>

                  <th className="px-4 py-3">
                    Status
                  </th>

                </tr>

              </thead>

              <tbody>

                {filteredMachines.length ===
                0 ? (

                  <tr>

                    <td
                      colSpan={7}
                      className="px-5 py-10 text-center"
                    >

                      <p className="text-sm font-semibold text-[#15211B]">
                        No assets match this filter.
                      </p>

                      <p className="mt-1 text-xs text-[#94A39A]">
                        Try another report filter.
                      </p>

                    </td>

                  </tr>

                ) : (

                  filteredMachines.map(
                    (
                      machine
                    ) => {

                      const aiRisk =
                        getAIRisk(
                          machine
                        );

                      const risk =
                        getRiskLevel(
                          aiRisk
                        );

                      const status =
                        getStatusClass(
                          machine.maintenance_status
                        );

                      return (
                        <tr
                          key={
                            machine.id
                          }
                          className="border-b border-[#E8EFEB] transition hover:bg-[#FBFDFC]"
                        >

                          <td className="px-5 py-4">

                            <p className="text-sm font-bold text-[#15211B]">
                              {
                                machine.name
                              }
                            </p>

                            <p className="mt-0.5 text-[9px] text-[#94A39A]">
                              {
                                machine.id
                              }
                            </p>

                          </td>

                          <td className="px-4 py-4 text-xs text-[#64736A]">
                            {
                              machine.type
                            }
                          </td>

                          <td className="px-4 py-4">

                            <span className="text-sm font-bold text-[#16A34A]">
                              {Number(
                                machine.health_score ||
                                  0
                              ).toFixed(
                                1
                              )}
                              %
                            </span>

                          </td>

                          <td className="px-4 py-4">

                            <div className="flex items-center gap-2">

                              <span
                                className={`text-sm font-bold ${risk.textClass}`}
                              >
                                {aiRisk.toFixed(
                                  1
                                )}
                                %
                              </span>

                              <span
                                className={`rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase ${risk.className}`}
                              >
                                {
                                  risk.label
                                }
                              </span>

                            </div>

                          </td>

                          <td className="px-4 py-4 text-xs font-medium text-[#64736A]">
                            {machine.remaining_useful_life ??
                              "—"}{" "}
                            <span className="text-[9px] text-[#94A39A]">
                              cycles
                            </span>
                          </td>

                          <td className="px-4 py-4">

                            <span className="text-sm font-bold text-[#EA580C]">
                              {Number(
                                machine.carbon ||
                                  0
                              ).toFixed(
                                1
                              )}
                            </span>

                            <span className="ml-1 text-[9px] text-[#94A39A]">
                              kg
                            </span>

                          </td>

                          <td className="px-4 py-4">

                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-[8px] font-bold ${status.className}`}
                            >
                              {
                                machine.maintenance_status
                              }
                            </span>

                          </td>

                        </tr>
                      );
                    }
                  )

                )}

              </tbody>

            </table>

          </div>

          <div className="border-t border-[#E8EFEB] px-5 py-3">

            <p className="text-[9px] text-[#94A39A]">

              Showing{" "}
              <span className="font-bold text-[#64736A]">
                {
                  filteredMachines.length
                }
              </span>{" "}
              of{" "}
              <span className="font-bold text-[#64736A]">
                {machines.length}
              </span>{" "}
              monitored assets.

            </p>

          </div>

        </section>

        {/* ================================================== */}
        {/* EXECUTIVE INSIGHT */}
        {/* ================================================== */}

        <section className="mt-8 rounded-[16px] border border-[#A7F3D0] bg-white shadow-[0_2px_10px_rgba(15,23,42,0.025)]">

          <div className="border-l-4 border-[#16A34A] p-5 sm:p-6">

            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

              <div className="max-w-[820px]">

                <div className="flex items-center gap-2">

                  <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />

                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#047857]">
                    Executive Insight
                  </p>

                </div>

                <h2 className="mt-2 text-xl font-bold text-[#15211B]">
                  CarbonTwin is continuously converting
                  factory telemetry into operational decisions.
                </h2>

                <p className="mt-2 text-sm leading-6 text-[#64736A]">
                  The report combines live digital-twin state,
                  machine health, future failure probability,
                  remaining useful life and environmental metrics
                  into a single operational intelligence view.
                </p>

              </div>

              <div className="shrink-0 rounded-[12px] bg-[#ECFDF5] px-4 py-3">

                <p className="text-[9px] font-bold uppercase tracking-wider text-[#047857]">
                  Current Priority
                </p>

                <p className="mt-1 text-sm font-bold text-[#15211B]">
                  {highRiskMachines.length >
                  0
                    ? `${highRiskMachines.length} critical asset${
                        highRiskMachines.length !==
                        1
                          ? "s"
                          : ""
                      }`
                    : attentionMachines.length >
                        0
                      ? `${attentionMachines.length} asset${
                          attentionMachines.length !==
                          1
                            ? "s"
                            : ""
                        } need review`
                      : "Fleet stable"}
                </p>

                <p className="mt-0.5 text-[9px] text-[#64736A]">
                  Based on current AI risk
                </p>

              </div>

            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">

              <InsightCard
                number="01"
                title="Observe"
                description="Live telemetry establishes the current state of factory assets."
              />

              <InsightCard
                number="02"
                title="Predict"
                description="AI estimates future machine failure risk before breakdown."
              />

              <InsightCard
                number="03"
                title="Act"
                description="Maintenance and sustainability insights support operational decisions."
              />

            </div>

          </div>

        </section>

        {/* ================================================== */}
        {/* FOOTER */}
        {/* ================================================== */}

        <footer className="mt-8 border-t border-[#DCE8E1] py-5">

          <div className="flex flex-col gap-1.5 text-[10px] text-[#94A39A] sm:flex-row sm:items-center sm:justify-between">

            <span>
              CarbonTwin OS · Factory Intelligence Reports
            </span>

            <span>
              Digital Twin · Predictive AI · Sustainability
            </span>

          </div>

        </footer>

      </div>

    </main>
  );
}

// ============================================================
// METRIC CARD
// ============================================================

interface MetricCardProps {
  label: string;
  value: string;
  description: string;
  valueClass: string;
  borderClass: string;
}

function MetricCard({
  label,
  value,
  description,
  valueClass,
  borderClass,
}: MetricCardProps) {
  return (
    <div
      className={`rounded-[14px] border bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)] ${borderClass}`}
    >

      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64736A]">
        {label}
      </p>

      <p
        className={`mt-2 text-3xl font-extrab800 tracking-[-0.025em] ${valueClass}`}
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
// MINI STAT
// ============================================================

interface MiniStatProps {
  label: string;
  value: string;
}

function MiniStat({
  label,
  value,
}: MiniStatProps) {
  return (
    <div className="rounded-[10px] border border-[#DDE7E1] bg-white px-3 py-2">

      <p className="text-[8px] font-bold uppercase tracking-wider text-[#94A39A]">
        {label}
      </p>

      <p className="mt-0.5 text-sm font-bold text-[#15211B]">
        {value}
      </p>

    </div>
  );
}

// ============================================================
// SNAPSHOT CARD
// ============================================================

interface SnapshotCardProps {
  label: string;
  value: number;
  total: number;
  percentage: number;
  barClass: string;
  description: string;
}

function SnapshotCard({
  label,
  value,
  total,
  percentage,
  barClass,
  description,
}: SnapshotCardProps) {
  return (
    <div className="rounded-[14px] border border-[#DDE7E1] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)]">

      <div className="flex items-end justify-between gap-3">

        <div>

          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64736A]">
            {label}
          </p>

          <p className="mt-2 text-3xl font-extrab800 text-[#15211B]">
            {value}
          </p>

        </div>

        <p className="text-xs font-semibold text-[#94A39A]">
          / {total}
        </p>

      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#E8EFEB]">

        <div
          className={`h-full rounded-full ${barClass}`}
          style={{
            width: `${Math.min(
              Math.max(
                percentage,
                0
              ),
              100
            )}%`,
          }}
        />

      </div>

      <p className="mt-2 text-[10px] text-[#94A39A]">
        {percentage.toFixed(
          1
        )}
        % of monitored assets ·{" "}
        {description}
      </p>

    </div>
  );
}

// ============================================================
// SUSTAINABILITY CARD
// ============================================================

interface SustainabilityCardProps {
  label: string;
  value: string;
  description: string;
  valueClass: string;
}

function SustainabilityCard({
  label,
  value,
  description,
  valueClass,
}: SustainabilityCardProps) {
  return (
    <div className="rounded-[14px] border border-[#DDE7E1] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)]">

      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64736A]">
        {label}
      </p>

      <p
        className={`mt-2 text-2xl font-bold ${valueClass}`}
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
// FILTER BUTTON
// ============================================================

interface FilterButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function FilterButton({
  label,
  active,
  onClick,
}: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[8px] border px-3 py-2 text-[10px] font-bold transition ${
        active
          ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]"
          : "border-[#DDE7E1] bg-white text-[#64736A] hover:bg-[#F7FAF8]"
      }`}
    >
      {label}
    </button>
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
// INSIGHT CARD
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