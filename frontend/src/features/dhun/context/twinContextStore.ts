import { createContext } from "react";

import type {
  PhaseId,
  TwinSnapshot,
} from "../types";

export interface TwinContextValue {
  phase: PhaseId;
  setPhase: (phase: PhaseId) => void;
  now: Date;
  snapshot: TwinSnapshot;
}

export const TwinContext = createContext<
  TwinContextValue | undefined
>(undefined);
