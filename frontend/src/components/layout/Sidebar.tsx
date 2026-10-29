import {
  ChevronLeft,
  ChevronRight,
  Database,
  FileCheck2,
  Info,
  Sliders,
  X,
} from "lucide-react";

import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

import EvidenceBadge from "../../features/dhun/components/EvidenceBadge";
import * as CONSTANTS from "../../features/dhun/data/constants";

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onToggleCollapse: () => void;
}

const ITEMS = [
  {
    index: "01",
    label: "Campus Masterplan",
    path: "/",
  },
  {
    index: "02",
    label: "Digital Twin",
    path: "/twin",
  },
  {
    index: "03",
    label: "Carbon Ledger",
    path: "/ledger",
  },
  {
    index: "04",
    label: "Scenario Cockpit",
    path: "/scenarios",
  },
  {
    index: "05",
    label: "Compute Commons",
    path: "/compute",
  },
  {
    index: "06",
    label: "Energy & Bills",
    path: "/energy",
  },
];

function BrandMark() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect
        width="28"
        height="28"
        rx="5"
        fill="#173D32"
      />
      <path
        d="M8 20 V8 h5 a6 6 0 0 1 0 12 Z"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="14" r="2" fill="#EAEFEA" />
    </svg>
  );
}

export default function Sidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
  onToggleCollapse,
}: SidebarProps) {
  const year = new Date().getFullYear();
  const [activeDialog, setActiveDialog] = useState<
    "registry" | "provenance" | "settings" | null
  >(null);

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden"
          aria-label="Close navigation"
          onClick={onCloseMobile}
        />
      ) : null}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-rule bg-paper transition-[width,transform] duration-200 lg:static lg:z-auto lg:translate-x-0",
          collapsed ? "w-[58px]" : "w-[244px]",
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full",
        ].join(" ")}
        aria-label="Primary navigation"
      >
        <div
          className={[
            "flex h-[56px] shrink-0 items-center border-b border-rule bg-surface",
            collapsed
              ? "justify-center px-0"
              : "justify-between px-4",
          ].join(" ")}
        >
          <Link
            to="/"
            onClick={onCloseMobile}
            className={[
              "flex min-w-0 items-center gap-2.5",
              collapsed ? "" : "pr-2",
            ].join(" ")}
            aria-label="Dhun Twin OS — go to Campus Masterplan"
          >
            <BrandMark />

            {collapsed ? null : (
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold leading-tight text-ink">
                  Dhun Twin OS
                </span>
                <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-accent font-semibold">
                  Logos × ZuGrama
                </span>
              </span>
            )}
          </Link>

          {collapsed ? null : (
            <button
              type="button"
              className="btn btn-quiet btn-sm -mr-1 px-1.5 lg:hidden text-muted hover:text-ink"
              onClick={onCloseMobile}
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {collapsed ? null : (
          <div className="border-b border-rule bg-surface-subtle/60 px-4 py-3.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted font-semibold">
                Field Station
              </span>
              <span className="font-mono text-[10.5px] text-faint">
                26°N 75°E
              </span>
            </div>
            <p className="mt-1 text-[13.5px] font-semibold text-ink">
              Dhun · Chak Gulabpura
            </p>
            <p className="text-[12px] text-muted">
              500 acres · 400-ac bioreserve
            </p>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-3.5">
          {collapsed ? null : (
            <p className="mb-2.5 px-4 font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint font-semibold">
              Workspaces
            </p>
          )}

          <ul className="space-y-1 px-2.5">
            {ITEMS.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === "/"}
                  title={item.label}
                  onClick={onCloseMobile}
                  className={({ isActive }) =>
                    [
                      "group relative flex items-center gap-3 rounded-[5px] px-3 py-2.5 text-[14px] transition-all",
                      collapsed
                        ? "justify-center px-0 py-3"
                        : "",
                      isActive
                        ? "bg-accent-tint text-accent font-semibold shadow-xs"
                        : "text-ink-soft hover:bg-surface-subtle hover:text-ink font-medium",
                    ].join(" ")
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={[
                          "font-mono text-[11px] tabular",
                          isActive
                            ? "text-accent font-bold"
                            : "text-faint",
                        ].join(" ")}
                      >
                        {item.index}
                      </span>

                      {collapsed ? null : (
                        <span className="flex-1 truncate">
                          {item.label}
                        </span>
                      )}

                      {isActive && !collapsed ? (
                        <span className="h-2 w-2 rounded-full bg-accent" />
                      ) : null}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>

          {collapsed ? null : (
            <div className="mt-6 border-t border-rule px-4 pt-4">
              <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-faint font-semibold">
                System Registry
              </p>

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setActiveDialog("registry")}
                  className="flex w-full items-center justify-between rounded-[5px] px-2.5 py-2 text-left text-[13px] text-ink-soft hover:bg-surface-subtle hover:text-ink transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Database size={15} className="text-muted" />
                    <span>Parameter Registry</span>
                  </span>
                  <span className="font-mono text-[10.5px] text-faint">24</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveDialog("provenance")}
                  className="flex w-full items-center justify-between rounded-[5px] px-2.5 py-2 text-left text-[13px] text-ink-soft hover:bg-surface-subtle hover:text-ink transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <FileCheck2 size={15} className="text-muted" />
                    <span>Data Quality</span>
                  </span>
                  <EvidenceBadge tier="REPORT" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveDialog("settings")}
                  className="flex w-full items-center justify-between rounded-[5px] px-2.5 py-2 text-left text-[13px] text-ink-soft hover:bg-surface-subtle hover:text-ink transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Sliders size={15} className="text-muted" />
                    <span>Settings & Standards</span>
                  </span>
                  <span className="font-mono text-[10.5px] text-faint">IST</span>
                </button>
              </div>

              <div className="mt-4 border-t border-rule pt-3">
                <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.12em] text-faint font-medium">
                  Evidence Taxonomy
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <span className="flex items-center gap-1.5 text-[10.5px] text-muted">
                    <span className="status-dot status-healthy" /> Measured
                  </span>
                  <span className="flex items-center gap-1.5 text-[10.5px] text-muted">
                    <span className="status-dot bg-[#256D85]" /> Reported
                  </span>
                  <span className="flex items-center gap-1.5 text-[10.5px] text-muted">
                    <span className="status-dot status-watch" /> Assumption
                  </span>
                  <span className="flex items-center gap-1.5 text-[10.5px] text-muted">
                    <span className="status-dot bg-[#87968E]" /> Simulated
                  </span>
                </div>
              </div>
            </div>
          )}
        </nav>

        <div className="shrink-0 border-t border-rule bg-surface p-2.5">
          {collapsed ? (
            <button
              type="button"
              className="btn btn-quiet btn-sm mx-auto hidden lg:flex"
              onClick={onToggleCollapse}
              aria-label="Expand navigation"
            >
              <ChevronRight size={15} />
            </button>
          ) : (
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] text-muted">
                © {year} Logos × ZuGrama
              </span>
              <button
                type="button"
                className="btn btn-quiet btn-sm hidden items-center gap-1 px-1.5 lg:flex text-muted hover:text-ink"
                onClick={onToggleCollapse}
                aria-label="Collapse navigation"
              >
                <ChevronLeft size={14} />
                <span className="text-[10.5px]">Collapse</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Shared Function Modal Dialogs */}
      {activeDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-[6px] border border-rule bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-rule bg-surface-subtle px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Info size={16} className="text-accent" />
                <h3 className="text-[14px] font-semibold text-ink">
                  {activeDialog === "registry"
                    ? "Parameter Registry — Audited Constants"
                    : activeDialog === "provenance"
                      ? "Data Quality & Provenance Taxonomy"
                      : "System Settings & Accounting Standards"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveDialog(null)}
                className="btn btn-quiet btn-sm px-1.5"
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-5 text-[12.5px] text-ink-soft">
              {activeDialog === "registry" ? (
                <div className="space-y-4">
                  <p className="text-[12px] text-muted leading-relaxed">
                    Every engineering value is anchored in the verified project record (EDS EcoNiwas study, Dhun Masterplan 2022 Rev 2, or Central Electricity Authority factors). No values are fabricated.
                  </p>
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th>Parameter</th>
                        <th>Value</th>
                        <th>Unit</th>
                        <th>Evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="font-medium text-ink">TOTAL_SITE_ACRES</td>
                        <td className="num font-mono">{CONSTANTS.TOTAL_SITE_ACRES}</td>
                        <td>acres</td>
                        <td><EvidenceBadge tier="MEASURED" /></td>
                      </tr>
                      <tr>
                        <td className="font-medium text-ink">BIORESERVE_ACRES</td>
                        <td className="num font-mono">{CONSTANTS.BIORESERVE_ACRES}</td>
                        <td>acres (80%)</td>
                        <td><EvidenceBadge tier="REPORT" /></td>
                      </tr>
                      <tr>
                        <td className="font-medium text-ink">MAX_CONSTRUCTION_ACRES</td>
                        <td className="num font-mono">{CONSTANTS.MAX_CONSTRUCTION_ACRES}</td>
                        <td>acres (≤20%)</td>
                        <td><EvidenceBadge tier="REPORT" /></td>
                      </tr>
                      <tr>
                        <td className="font-medium text-ink">TREE_HEIGHT_LIMIT_M</td>
                        <td className="num font-mono">{CONSTANTS.TREE_HEIGHT_LIMIT_M}</td>
                        <td>meters (G+2)</td>
                        <td><EvidenceBadge tier="REPORT" /></td>
                      </tr>
                      <tr>
                        <td className="font-medium text-ink">ANNUAL_WATER_CAPACITY_KL</td>
                        <td className="num font-mono">550,000</td>
                        <td>kL / year (550M L)</td>
                        <td><EvidenceBadge tier="REPORT" /></td>
                      </tr>
                      <tr>
                        <td className="font-medium text-ink">GRID_FACTOR</td>
                        <td className="num font-mono">{CONSTANTS.GRID_FACTOR}</td>
                        <td>kgCO₂e / kWh</td>
                        <td><EvidenceBadge tier="REPORT" /></td>
                      </tr>
                      <tr>
                        <td className="font-medium text-ink">BATTERY_EFFICIENCY</td>
                        <td className="num font-mono">88.0%</td>
                        <td>round-trip AC</td>
                        <td><EvidenceBadge tier="ASSUMPTION" /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : activeDialog === "provenance" ? (
                <div className="space-y-4">
                  <p className="text-[12px] text-muted leading-relaxed">
                    To maintain engineering integrity, the platform enforces a strict 7-tier provenance taxonomy. Simulated readings and planning assumptions are never conflated with live meter readings.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-[4px] border border-rule p-3 bg-surface-subtle/30">
                      <div className="flex items-center gap-2 mb-1">
                        <EvidenceBadge tier="MEASURED" />
                        <span className="font-semibold text-ink text-[12px]">Tier 1: Measured</span>
                      </div>
                      <p className="text-[11.5px] text-muted">
                        Physically verified on-site: tree counts (50,000+), water harvested, perimeter boundary, and wildlife observations.
                      </p>
                    </div>
                    <div className="rounded-[4px] border border-rule p-3 bg-surface-subtle/30">
                      <div className="flex items-center gap-2 mb-1">
                        <EvidenceBadge tier="REPORT" />
                        <span className="font-semibold text-ink text-[12px]">Tier 2: Sourced Document</span>
                      </div>
                      <p className="text-[11.5px] text-muted">
                        Dhun Masterplan KPI Report (Rev 2, July 2022), Environmental Design Solutions (EDS) 422-acre building assessment.
                      </p>
                    </div>
                    <div className="rounded-[4px] border border-rule p-3 bg-surface-subtle/30">
                      <div className="flex items-center gap-2 mb-1">
                        <EvidenceBadge tier="ASSUMPTION" />
                        <span className="font-semibold text-ink text-[12px]">Tier 3: Planning Assumption</span>
                      </div>
                      <p className="text-[11.5px] text-muted">
                        Model coefficients including battery storage round-trip efficiency (88%), spirulina raceway power densities, and schedule windows.
                      </p>
                    </div>
                    <div className="rounded-[4px] border border-rule p-3 bg-surface-subtle/30">
                      <div className="flex items-center gap-2 mb-1">
                        <EvidenceBadge tier="SIMULATED" />
                        <span className="font-semibold text-ink text-[12px]">Tier 4: Model Frame</span>
                      </div>
                      <p className="text-[11.5px] text-muted">
                        Hourly load dispatch calculations, marginal emissions curves, and dynamic solar curves prior to gateway meter telemetry.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-[12px] text-muted leading-relaxed">
                    System time configuration, regional grid accounting boundaries, and field station operational preferences.
                  </p>
                  <div className="space-y-3 divide-y divide-rule">
                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <p className="font-semibold text-ink">Clock Standard</p>
                        <p className="text-[11px] text-muted">Indian Standard Time (IST, UTC+05:30) for Jaipur Field Station</p>
                      </div>
                      <span className="font-mono text-[11px] font-semibold text-accent">IST (Fixed)</span>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <p className="font-semibold text-ink">Carbon Accounting Boundary</p>
                        <p className="text-[11px] text-muted">EN 15978 Whole-Life Modules (A1–A5 upfront, B1–B5 maintenance, B6 operational)</p>
                      </div>
                      <span className="font-mono text-[11px] font-semibold text-accent">25-Yr Horizon</span>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <p className="font-semibold text-ink">Logos Basecamp Edge Bridge</p>
                        <p className="text-[11px] text-muted">Port 5174 local telemetry receiver and Codex broadcast daemon</p>
                      </div>
                      <span className="font-mono text-[11px] text-good font-semibold">Active Seam</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-rule bg-surface-subtle px-5 py-3">
              <button
                type="button"
                onClick={() => setActiveDialog(null)}
                className="btn btn-primary btn-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

