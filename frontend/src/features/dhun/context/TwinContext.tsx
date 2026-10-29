import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { PhaseId } from "../types";
import { buildTwin } from "../engine/simulation";
import { nowIST } from "../lib/clock";
import { TwinContext } from "./twinContextStore";

/* One clock for the whole app. Recomputed every 30 seconds so
   the campus reads as live without hammering the browser. */
const TICK_MS = 30000;

export function TwinProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [phase, setPhase] =
    useState<PhaseId>("today");

  const [now, setNow] = useState<Date>(() =>
    nowIST()
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(nowIST());
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, []);

  const snapshot = useMemo(
    () => buildTwin(phase, now),
    [phase, now]
  );

  const value = useMemo(
    () => ({ phase, setPhase, now, snapshot }),
    [phase, now, snapshot]
  );

  return (
    <TwinContext.Provider value={value}>
      {children}
    </TwinContext.Provider>
  );
}
