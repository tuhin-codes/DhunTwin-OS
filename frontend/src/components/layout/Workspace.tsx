import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import AppRoutes from "../../routes/AppRoutes";

export default function Workspace() {
  const year = new Date().getFullYear();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // Scroll to top on navigation to prevent stale scroll positions
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [location.pathname]);

  return (
    <main
      ref={mainRef}
      className="min-w-0 flex-1 overflow-y-auto bg-paper min-h-0"
    >
      <div className="mx-auto flex min-h-full w-full max-w-[1480px] flex-col px-3 py-4 md:px-5 md:py-5">
        <div className="min-w-0 flex-1">
          <AppRoutes />
        </div>

        <footer className="mt-8 shrink-0 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-rule pt-4 text-[11px] text-muted">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink">Dhun Twin OS</span>
            <span className="text-rule-strong">·</span>
            <span>Deterministic Physical Engine</span>
            <span className="text-rule-strong">·</span>
            <span className="font-mono text-[10px] text-accent font-medium">Logos × ZuGrama Field Station</span>
          </div>
          <p className="tabular font-mono text-[10px] text-faint">© {year} All Rights Reserved</p>
        </footer>
      </div>
    </main>
  );
}
