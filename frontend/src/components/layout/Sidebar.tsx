import {
  Activity,
  Bot,
  Brain,
  ChevronLeft,
  ChevronRight,
  FileText,
  Factory,
  Leaf,
  MessageSquare,
  Settings,
  Wrench,
  X,
  Network,
} from "lucide-react";

import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onToggleCollapse: () => void;
}

type SystemStatus = "Operational" | "Attention" | "Critical";

interface MachineStatus {
  health_score?: number | null;
  health?: number | null;
  failure_probability?: number | null;
  maintenance_status?: string | null;
  status?: string | null;
}

const menuGroups = [
  {
    title: "COMMAND",
    items: [
      {
        icon: Factory,
        label: "Factory Overview",
        path: "/",
      },
      {
        icon: Network,
        label: "Digital Twins",
        path: "/digital-twins",
      },
      {
        icon: Bot,
        label: "AI Control Center",
        path: "/ai-control-center",
      },
    ],
  },
  {
    title: "OPERATIONS",
    items: [
      {
        icon: Brain,
        label: "FixTrace Workbench",
        path: "/fixtrace",
      },
      {
        icon: Wrench,
        label: "Maintenance",
        path: "/maintenance",
      },
      {
        icon: Leaf,
        label: "Sustainability",
        path: "/sustainability",
      },
      {
        icon: FileText,
        label: "Reports",
        path: "/reports",
      },
    ],
  },
  {
    title: "INTELLIGENCE",
    items: [
      {
        icon: MessageSquare,
        label: "AI Copilot",
        path: "/ai-copilot",
      },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      {
        icon: Settings,
        label: "Settings",
        path: "/settings",
      },
    ],
  },
];

function getHealthScore(machine: MachineStatus): number | null {
  const value =
    machine.health_score ??
    machine.health ??
    null;

  if (
    typeof value !== "number" ||
    Number.isNaN(value)
  ) {
    return null;
  }

  return value;
}

function calculateSystemStatus(
  machines: MachineStatus[]
): SystemStatus {
  if (!machines.length) {
    return "Operational";
  }

  const healthScores = machines
    .map(getHealthScore)
    .filter(
      (value): value is number =>
        value !== null
    );

  /*
   * Health thresholds:
   *
   * > 70       -> Operational
   * 40 - 70    -> Attention
   * < 40       -> Critical
   *
   * We use the worst machine because the sidebar
   * represents the overall factory condition.
   */

  if (
    healthScores.some(
      (health) => health < 40
    )
  ) {
    return "Critical";
  }

  if (
    healthScores.some(
      (health) => health <= 70
    )
  ) {
    return "Attention";
  }

  return "Operational";
}

function getStatusStyles(status: SystemStatus) {
  switch (status) {
    case "Critical":
      return {
        dot:
          "bg-[#EF4444] shadow-[0_0_0_3px_rgba(239,68,68,0.12)]",
        text: "Critical",
        description:
          "Critical machine condition detected",
        textColor: "text-[#DC2626]",
      };

    case "Attention":
      return {
        dot:
          "bg-[#F59E0B] shadow-[0_0_0_3px_rgba(245,158,11,0.12)]",
        text: "Attention",
        description:
          "Some machines require attention",
        textColor: "text-[#D97706]",
      };

    default:
      return {
        dot:
          "bg-[#16A34A] shadow-[0_0_0_3px_rgba(22,163,74,0.12)]",
        text: "Operational",
        description:
          "All systems running normally",
        textColor: "text-[#16A34A]",
      };
  }
}

export default function Sidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
  onToggleCollapse,
}: SidebarProps) {
  const [systemStatus, setSystemStatus] =
    useState<SystemStatus>("Operational");

  useEffect(() => {
    let cancelled = false;

    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL ||
      "http://127.0.0.1:8000";

    const fetchSystemStatus =
      async () => {
        try {
          const response =
            await fetch(
              `${apiBaseUrl}/machines`,
              {
                method: "GET",
                headers: {
                  Accept:
                    "application/json",
                },
              }
            );

          if (!response.ok) {
            throw new Error(
              `Machine API returned ${response.status}`
            );
          }

          const data =
            await response.json();

          /*
           * Support both:
           *
           * [
           *   {...},
           *   {...}
           * ]
           *
           * and:
           *
           * {
           *   "machines": [...]
           * }
           */

          const machines: MachineStatus[] =
            Array.isArray(data)
              ? data
              : Array.isArray(
                    data?.machines
                  )
                ? data.machines
                : [];

          if (cancelled) {
            return;
          }

          const status =
            calculateSystemStatus(
              machines
            );

          setSystemStatus(status);
        } catch (error) {
          /*
           * Do not falsely change the UI to
           * "Operational" when the backend is
           * temporarily unavailable.
           *
           * Keep the last known status.
           */

          if (
            import.meta.env.DEV
          ) {
            console.warn(
              "Unable to fetch system status:",
              error
            );
          }
        }
      };

    fetchSystemStatus();

    const interval = window.setInterval(
      fetchSystemStatus,
      10000
    );

    return () => {
      cancelled = true;
      window.clearInterval(
        interval
      );
    };
  }, []);

  const statusStyles =
    getStatusStyles(
      systemStatus
    );

  return (
    <>
      {/* =====================================================
          MOBILE OVERLAY
      ===================================================== */}

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px] lg:hidden"
        />
      )}

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          flex flex-col
          shrink-0
          border-r border-[#E2E8E4]
          bg-white
          transition-[width,transform] duration-300 ease-in-out

          lg:relative
          lg:z-auto
          lg:translate-x-0

          ${
            collapsed
              ? "lg:w-[68px]"
              : "lg:w-[280px]"
          }

          ${
            mobileOpen
              ? "translate-x-0"
              : "-translate-x-full"
          }

          w-[280px]
        `}
      >
        {/* =====================================================
            BRAND
        ===================================================== */}

        <div
          className={`
            flex h-[60px] shrink-0
            items-center
            border-b border-[#E2E8E4]
            ${
              collapsed
                ? "justify-center px-3"
                : "px-5"
            }
          `}
        >
          <div
            className={`
              flex min-w-0 items-center
              ${
                collapsed
                  ? "justify-center"
                  : "gap-2.5"
              }
            `}
          >
            {/* Logo */}

            <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-[#16A34A] to-[#065F46]">
              <Activity
                size={18}
                strokeWidth={2}
                className="text-white"
              />
            </div>

            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-[14px] font-extrabold leading-tight tracking-[-0.02em] text-[#15211B]">
                  CarbonTwin OS
                </p>

                <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-[0.1em] text-[#16A34A]">
                  Industrial Intelligence
                </p>
              </div>
            )}
          </div>

          {/* Mobile close */}

          <button
            type="button"
            onClick={onCloseMobile}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-[#64736A] transition hover:bg-[#F7FAF8] hover:text-[#15211B] lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={17} />
          </button>
        </div>

        {/* =====================================================
            NAVIGATION
        ===================================================== */}

        <nav
          className={`
            flex-1 overflow-y-auto
            ${
              collapsed
                ? "px-2 py-3"
                : "px-3 py-3"
            }
          `}
        >
          {menuGroups.map(
            (group) => (
              <div
                key={group.title}
                className="mb-5 last:mb-0"
              >
                {/* Group title */}

                {!collapsed && (
                  <p className="mb-1 px-2 text-[9px] font-bold uppercase tracking-[0.12em] text-[#9CA3AF]">
                    {group.title}
                  </p>
                )}

                <div className="space-y-0.5">
                  {group.items.map(
                    (item) => {
                      const Icon =
                        item.icon;

                      return (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          onClick={
                            onCloseMobile
                          }
                          title={
                            collapsed
                              ? item.label
                              : undefined
                          }
                          className={({ isActive }) =>
                            `
                            group relative flex w-full
                            items-center
                            rounded-[10px]
                            text-[13px]
                            transition-colors duration-150

                            ${
                              collapsed
                                ? "justify-center px-0 py-[9px]"
                                : "gap-2.5 px-2.5 py-[9px]"
                            }

                            ${
                              isActive
                                ? "bg-[#ECFDF5] font-semibold text-[#16A34A]"
                                : "font-normal text-[#4B5563] hover:bg-[#F7FAF8]"
                            }
                            `
                          }
                        >
                          {({
                            isActive,
                          }) => (
                            <>
                              {/* Active indicator */}

                              {isActive &&
                                !collapsed && (
                                  <span className="absolute left-0 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-r-[3px] bg-[#16A34A]" />
                                )}

                              <span
                                className={
                                  isActive
                                    ? "text-[#16A34A]"
                                    : "text-[#6B7280]"
                                }
                              >
                                <Icon
                                  size={18}
                                  strokeWidth={
                                    isActive
                                      ? 2
                                      : 1.8
                                  }
                                />
                              </span>

                              {!collapsed && (
                                <span>
                                  {
                                    item.label
                                  }
                                </span>
                              )}

                              {/* Active dot */}

                              {isActive &&
                                !collapsed && (
                                  <span className="ml-auto h-[6px] w-[6px] rounded-full bg-[#16A34A]" />
                                )}
                            </>
                          )}
                        </NavLink>
                      );
                    }
                  )}
                </div>
              </div>
            )
          )}
        </nav>

        {/* =====================================================
            SYSTEM STATUS
        ===================================================== */}

        {!collapsed && (
          <div className="border-t border-[#E2E8E4] px-5 py-4">
            <div className="rounded-[12px] bg-[#F7FAF8] px-3.5 py-3">
              <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">
                System Status
              </p>

              <div className="mb-1 flex items-center gap-2">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${statusStyles.dot}`}
                />

                <span
                  className={`text-[13px] font-semibold ${statusStyles.textColor}`}
                >
                  {statusStyles.text}
                </span>
              </div>

              <p className="text-[11px] text-[#64736A]">
                {
                  statusStyles.description
                }
              </p>
            </div>
          </div>
        )}

        {/* =====================================================
            COLLAPSE BUTTON
        ===================================================== */}

        <div
          className={`
            border-t border-[#E2E8E4]
            ${
              collapsed
                ? "p-2"
                : "px-3 pb-3 pt-0"
            }
          `}
        >
          <button
            type="button"
            onClick={onToggleCollapse}
            className={`
              hidden w-full
              items-center justify-center
              rounded-lg
              border border-[#E2E8E4]
              bg-white
              py-1.5
              text-[#9CA3AF]
              transition
              hover:border-[#A7F3D0]
              hover:bg-[#ECFDF5]
              hover:text-[#16A34A]
              lg:flex
            `}
            title={
              collapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
          >
            {collapsed ? (
              <ChevronRight size={15} />
            ) : (
              <ChevronLeft size={15} />
            )}
          </button>
        </div>
      </aside>
    </>
  );
}