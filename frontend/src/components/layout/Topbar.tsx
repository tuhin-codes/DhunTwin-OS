import { Menu } from "lucide-react";

import { useEffect } from "react";

import { useLocation } from "react-router-dom";

import type { PhaseId } from "../../features/dhun/types";
import { PHASES, PHASE_ORDER } from "../../features/dhun/data/phases";
import { useTwin } from "../../features/dhun/context/useTwin";
import { istDate, istTime } from "../../features/dhun/lib/clock";

interface TopbarProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMobileSidebar: () => void;
}

const PAGE: Record<string, string> = {
  "/": "Campus Masterplan",
  "/twin": "Digital Twin",
  "/ledger": "Carbon Ledger",
  "/scenarios": "Scenario Cockpit",
  "/compute": "Compute Commons",
  "/energy": "Energy Intelligence & Bills",
};

const PHASE_LABEL: Record<PhaseId, string> = {
  today: "Today (140 res)",
  phase1: "Phase 1 (900 res)",
  buildout: "Full Build-out (11,847 res)",
};

export default function Topbar({
  onOpenMobileSidebar,
}: TopbarProps) {
  const location = useLocation();
  const { phase, setPhase, now } = useTwin();

  const title =
    PAGE[location.pathname] ?? "Page not found";

  useEffect(() => {
    document.title = `${title} · Dhun Twin OS`;
  }, [title]);

  return (
    <header className="z-30 flex h-[60px] shrink-0 items-center justify-between gap-3 border-b border-rule bg-surface px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="btn btn-quiet btn-sm -ml-1.5 px-2 lg:hidden text-ink-soft hover:text-ink"
          onClick={onOpenMobileSidebar}
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>

        <div className="flex min-w-0 items-center gap-3 text-[13px]">
          <span className="font-mono uppercase tracking-[0.14em] text-accent font-bold text-[11px]">
            Dhun Field Station
          </span>
          <span
            className="h-4 w-px bg-rule-strong"
            aria-hidden="true"
          />
          <span className="truncate font-semibold text-ink text-[15.5px]">
            {title}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <div
          className="seg hidden sm:inline-flex p-1"
          role="group"
          aria-label="Development phase"
        >
          {PHASE_ORDER.map((id: PhaseId) => (
            <button
              key={id}
              type="button"
              className="seg-item h-[28px] px-3 text-[13px] font-medium"
              aria-pressed={phase === id}
              onClick={() => setPhase(id)}
              title={PHASES[id].description}
            >
              {PHASE_LABEL[id]}
            </button>
          ))}
        </div>

        <label className="sm:hidden">
          <span className="sr-only">
            Development phase
          </span>
          <select
            className="h-9 rounded-[5px] border border-rule-strong bg-surface px-2.5 text-[13px] font-medium text-ink-soft shadow-xs"
            value={phase}
            onChange={(event) =>
              setPhase(event.target.value as PhaseId)
            }
            aria-label="Development phase"
          >
            {PHASE_ORDER.map((id: PhaseId) => (
              <option key={id} value={id}>
                {PHASE_LABEL[id]}
              </option>
            ))}
          </select>
        </label>

        <div className="hidden h-5 w-px bg-rule-strong sm:block" />

        <div className="hidden text-right sm:block">
          <p className="tabular font-mono text-[12px] font-bold leading-tight text-ink">
            {istTime(now)}
            <span className="ml-1 text-[10px] font-medium text-muted">
              IST
            </span>
          </p>
          <p className="font-mono text-[10.5px] leading-tight text-muted">
            {istDate(now)}
          </p>
        </div>

        <span
          className="tier tier-simulated hidden lg:inline-flex text-[10.5px] px-2 py-0.5"
          title="Flows are produced by the twin's deterministic model. Edge gateway seam open on port 5174."
        >
          Model Frame
        </span>
      </div>
    </header>
  );
}

