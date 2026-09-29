import {
  Activity,
  AlertTriangle,
  ChevronRight,
  Factory,
  Settings2,
} from "lucide-react";

import type {
  Department,
  Machine,
} from "../types/digitalTwin";

import LiveStatusBadge from "./LiveStatusBadge";

interface DepartmentCardProps {
  department: Department;
  machines?: Machine[];
  onMachineSelect?: (
    machine: Machine
  ) => void;
  selectedMachineId?: string;
  onSelect?: (
    department: Department
  ) => void;
}

/* ============================================================
   HEALTH
============================================================ */

function getHealth(
  machine: Machine
): number {
  const value =
    Number(
      machine.health_score ?? 0
    );

  return Math.max(
    0,
    Math.min(
      100,
      Number.isFinite(value)
        ? value
        : 0
    )
  );
}

function getMachineStatus(
  machine: Machine
) {
  const health =
    getHealth(machine);

  const status =
    String(
      machine.maintenance_status ??
        ""
    )
      .toLowerCase()
      .trim();

  if (
    status.includes(
      "emergency"
    ) ||
    status.includes(
      "stopped"
    ) ||
    health < 60
  ) {
    return "critical";
  }

  if (
    status.includes(
      "maintenance"
    ) ||
    status.includes(
      "warning"
    ) ||
    status.includes(
      "attention"
    ) ||
    health < 80
  ) {
    return "warning";
  }

  return "healthy";
}

/* ============================================================
   DEPARTMENT STATS
============================================================ */

function getDepartmentStats(
  machines: Machine[]
) {
  let healthy = 0;
  let warning = 0;
  let critical = 0;

  let totalHealth = 0;

  for (const machine of machines) {
    const status =
      getMachineStatus(
        machine
      );

    if (
      status === "healthy"
    ) {
      healthy += 1;
    }

    if (
      status === "warning"
    ) {
      warning += 1;
    }

    if (
      status === "critical"
    ) {
      critical += 1;
    }

    totalHealth +=
      getHealth(machine);
  }

  const averageHealth =
    machines.length > 0
      ? totalHealth /
        machines.length
      : 0;

  return {
    healthy,
    warning,
    critical,
    averageHealth,
  };
}

/* ============================================================
   MACHINE TYPE ICON
============================================================ */

function MachineTypeIcon({
  type,
}: {
  type?: string;
}) {
  const normalized =
    String(type ?? "")
      .toLowerCase();

  if (
    normalized.includes(
      "boiler"
    )
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      >
        <rect
          x="6"
          y="5"
          width="12"
          height="14"
          rx="3"
        />
        <circle
          cx="12"
          cy="12"
          r="3"
        />
        <path d="M9 3h6" />
        <path d="M9 21h6" />
      </svg>
    );
  }

  if (
    normalized.includes(
      "pump"
    )
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      >
        <circle
          cx="12"
          cy="11"
          r="6"
        />
        <path d="M3 11h3" />
        <path d="M18 11h3" />
        <path d="M12 5V2" />
      </svg>
    );
  }

  if (
    normalized.includes(
      "motor"
    )
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      >
        <rect
          x="4"
          y="6"
          width="14"
          height="12"
          rx="3"
        />
        <circle
          cx="11"
          cy="12"
          r="3"
        />
        <path d="M18 10h3v4h-3" />
      </svg>
    );
  }

  if (
    normalized.includes(
      "compressor"
    )
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      >
        <rect
          x="3"
          y="9"
          width="18"
          height="8"
          rx="4"
        />
        <rect
          x="8"
          y="4"
          width="8"
          height="7"
          rx="2"
        />
      </svg>
    );
  }

  return (
    <Settings2
      size={16}
    />
  );
}

/* ============================================================
   MAIN
============================================================ */

export default function DepartmentCard({
  department,
  machines = [],
  onMachineSelect,
  selectedMachineId,
  onSelect,
}: DepartmentCardProps) {
  const stats =
    getDepartmentStats(
      machines
    );

  const departmentName =
    String(
      department.name ??
        "Department"
    );

  const departmentId =
    String(
      department.id ??
        ""
    );

  return (
    <section className="overflow-hidden rounded-[15px] border border-[#DDE7E1] bg-white shadow-[0_2px_10px_rgba(15,23,42,0.025)]">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="border-b border-[#E6ECE8] px-4 py-4">

        <div className="flex items-start justify-between gap-3">

          <button
            type="button"
            onClick={() =>
              onSelect?.(
                department
              )
            }
            className="flex min-w-0 items-center gap-3 text-left"
          >

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#ECFDF5] text-[#15803D]">

              <Factory
                size={18}
                strokeWidth={1.7}
              />

            </div>

            <div className="min-w-0">

              <div className="flex items-center gap-2">

                <h3 className="truncate text-[12px] font-extrab800 text-[#26332C]">
                  {departmentName}
                </h3>

                <ChevronRight
                  size={12}
                  className="shrink-0 text-[#B0BBB4]"
                />

              </div>

              {departmentId && (
                <p className="mt-0.5 text-[7px] text-[#A0ABA4]">
                  {departmentId}
                </p>
              )}

            </div>

          </button>

          <LiveStatusBadge
            status={
              stats.critical >
              0
                ? "Warning"
                : "Operational"
            }
          />

        </div>

        {/* ====================================================
            STATS
        ==================================================== */}

        <div className="mt-4 grid grid-cols-3 gap-2">

          <DepartmentStat
            label="Assets"
            value={String(
              machines.length
            )}
          />

          <DepartmentStat
            label="Healthy"
            value={String(
              stats.healthy
            )}
            tone="green"
          />

          <DepartmentStat
            label="Attention"
            value={String(
              stats.warning +
                stats.critical
            )}
            tone={
              stats.critical >
              0
                ? "red"
                : stats.warning >
                    0
                  ? "amber"
                  : "green"
            }
          />

        </div>

        {/* ====================================================
            HEALTH
        ==================================================== */}

        <div className="mt-3">

          <div className="flex items-center justify-between">

            <span className="text-[7px] font-bold uppercase tracking-[0.09em] text-[#94A39A]">
              Department Health
            </span>

            <span className="text-[9px] font-extrab800 text-[#15803D]">
              {stats.averageHealth.toFixed(
                1
              )}
              %
            </span>

          </div>

          <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-[#E7EEE9]">

            <div
              className="h-full rounded-full bg-[#16A34A] transition-all duration-500"
              style={{
                width: `${stats.averageHealth}%`,
              }}
            />

          </div>

        </div>

      </div>

      {/* ======================================================
          MACHINES
      ====================================================== */}

      <div className="p-3">

        {machines.length ===
        0 ? (
          <div className="flex min-h-[100px] items-center justify-center rounded-[10px] border border-dashed border-[#DDE7E1] bg-[#FAFCFB]">

            <div className="text-center">

              <Activity
                size={16}
                className="mx-auto text-[#A0ABA4]"
              />

              <p className="mt-2 text-[8px] font-semibold text-[#64736A]">
                No machines
              </p>

              <p className="mt-0.5 text-[7px] text-[#A0ABA4]">
                No assets are assigned to this department.
              </p>

            </div>

          </div>
        ) : (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">

            {machines.map(
              (machine) => {
                const status =
                  getMachineStatus(
                    machine
                  );

                const health =
                  getHealth(
                    machine
                  );

                const isSelected =
                  selectedMachineId ===
                  machine.id;

                return (
                  <button
                    key={
                      machine.id
                    }
                    type="button"
                    onClick={() =>
                      onMachineSelect?.(
                        machine
                      )
                    }
                    className={[
                      "group flex items-center gap-2.5 rounded-[10px] border p-2.5 text-left",
                      "transition-all duration-150",
                      isSelected
                        ? "border-[#16A34A] bg-[#F0FBF4] shadow-[0_0_0_1px_rgba(22,163,74,0.08)]"
                        : "border-[#E4EBE6] bg-[#FAFCFB] hover:border-[#BFD8C8] hover:bg-[#F5FAF7]",
                    ].join(
                      " "
                    )}
                  >

                    {/* ICON */}

                    <div
                      className={[
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]",
                        status ===
                          "critical"
                          ? "bg-[#FEF2F2] text-[#DC2626]"
                          : status ===
                              "warning"
                            ? "bg-[#FFF8E8] text-[#D97706]"
                            : "bg-[#ECFDF5] text-[#15803D]",
                      ].join(
                        " "
                      )}
                    >
                      <MachineTypeIcon
                        type={
                          machine.type
                        }
                      />
                    </div>

                    {/* INFO */}

                    <div className="min-w-0 flex-1">

                      <div className="flex items-center justify-between gap-2">

                        <p className="truncate text-[8px] font-bold text-[#526159]">
                          {
                            machine.name
                          }
                        </p>

                        <span
                          className={[
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            status ===
                              "critical"
                              ? "bg-[#EF4444]"
                              : status ===
                                  "warning"
                                ? "bg-[#F59E0B]"
                                : "bg-[#16A34A]",
                          ].join(
                            " "
                          )}
                        />

                      </div>

                      <div className="mt-1 flex items-center justify-between gap-2">

                        <p className="truncate text-[6px] text-[#A0ABA4]">
                          {
                            machine.id
                          }
                          {" · "}
                          {
                            machine.type
                          }
                        </p>

                        <p
                          className={[
                            "shrink-0 text-[7px] font-bold",
                            status ===
                              "critical"
                              ? "text-[#DC2626]"
                              : status ===
                                  "warning"
                                ? "text-[#D97706]"
                                : "text-[#15803D]",
                          ].join(
                            " "
                          )}
                        >
                          {health.toFixed(
                            0
                          )}
                          %
                        </p>

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
          WARNING
      ====================================================== */}

      {stats.critical >
        0 && (
        <div className="flex items-center gap-2 border-t border-[#F3C2C2] bg-[#FEF7F7] px-4 py-2.5">

          <AlertTriangle
            size={12}
            className="shrink-0 text-[#DC2626]"
          />

          <p className="text-[7px] font-semibold text-[#B91C1C]">
            {stats.critical}{" "}
            critical{" "}
            {stats.critical ===
            1
              ? "asset requires"
              : "assets require"}{" "}
            attention.
          </p>

        </div>
      )}

    </section>
  );
}

/* ============================================================
   DEPARTMENT STAT
============================================================ */

function DepartmentStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?:
    | "neutral"
    | "green"
    | "amber"
    | "red";
}) {
  const valueClass =
    tone === "green"
      ? "text-[#15803D]"
      : tone === "amber"
        ? "text-[#D97706]"
        : tone === "red"
          ? "text-[#DC2626]"
          : "text-[#26332C]";

  return (
    <div className="rounded-[9px] border border-[#E5ECE8] bg-[#FAFCFB] px-2.5 py-2">

      <p className="text-[6px] font-bold uppercase tracking-[0.08em] text-[#A0ABA4]">
        {label}
      </p>

      <p
        className={`mt-1 text-[12px] font-extrab800 ${valueClass}`}
      >
        {value}
      </p>

    </div>
  );
}