import type {
  ComputeJob,
  ComputeWindow,
  JobCarbon,
  PhaseId,
} from "../types";

import { GRID_FACTOR, SOLAR_PEAK_FACTOR } from "../data/constants";
import { PHASES } from "../data/phases";
import { clamp, gridIntensity, solarShape } from "./simulation";

/* ============================================================
   CARBON-AWARE COMPUTE
   A batch job is the only load on a campus that can be moved in
   time for free. This module prices that decision.
   ============================================================ */

/* Planning figure for a 70B-class model on efficient
   accelerators, including idle overhead. Assumption, not a
   vendor datasheet. */
export const KWH_PER_MILLION_TOKENS = 0.34;

/* Effective marginal intensity seen by an on-site consumer.
   Grid intensity is discounted by whatever the campus solar
   array is producing in that hour. */
export function marginalIntensity(
  phase: PhaseId,
  hour: number
): number {
  const config = PHASES[phase];
  const f = hour / 24;

  const demandKw =
    (config.builtM2 * config.epi) / 8760 +
    config.computeKw * config.computePue +
    config.stpKlDay * 0.5 / 24 +
    ((config.population * 78) / 1000) * 0.4 / 24 +
    1;

  const solarKw =
    config.solarKwp *
    SOLAR_PEAK_FACTOR *
    solarShape(f);

  const renewableShare = clamp(
    solarKw / Math.max(1, demandKw),
    0,
    1
  );

  return (
    GRID_FACTOR *
    1000 *
    gridIntensity(f) *
    (1 - renewableShare)
  );
}

export function computeWindows(
  phase: PhaseId
): ComputeWindow[] {
  const config = PHASES[phase];

  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}:00`,
    intensity: marginalIntensity(phase, hour),
    solarKw:
      config.solarKwp *
      SOLAR_PEAK_FACTOR *
      solarShape(hour / 24),
  }));
}

const QUEUE: ComputeJob[] = [
  {
    id: "job-4412",
    model: "Llama-3.1 70B · batch infer",
    tokensM: 840,
    window: "22:00–02:00",
    priority: "Batch",
  },
  {
    id: "job-4413",
    model: "Whisper large · 1,200 hr audio",
    tokensM: 260,
    window: "01:00–04:00",
    priority: "Batch",
  },
  {
    id: "job-4414",
    model: "Embedding refresh · campus corpus",
    tokensM: 1800,
    window: "02:00–05:00",
    priority: "Normal",
  },
  {
    id: "job-4415",
    model: "SDXL fine-tune · 8 epochs",
    tokensM: 120,
    window: "Tonight",
    priority: "High",
  },
];

export function computeQueue(): ComputeJob[] {
  return QUEUE;
}

export function jobEnergyKwh(
  phase: PhaseId,
  job: ComputeJob
): number {
  return (
    job.tokensM *
    KWH_PER_MILLION_TOKENS *
    PHASES[phase].computePue
  );
}

export function jobCarbon(
  phase: PhaseId,
  job: ComputeJob,
  nowHour: number
): JobCarbon {
  const energy = jobEnergyKwh(phase, job);

  const runNow =
    (energy * marginalIntensity(phase, nowHour)) /
    1000;

  /* Only hours still ahead in the day are schedulable. */
  const candidates = Array.from(
    { length: 24 },
    (_, offset) => (nowHour + offset + 1) % 24
  );

  let bestHour = candidates[0];
  let bestValue = Number.POSITIVE_INFINITY;

  for (const hour of candidates) {
    const value = marginalIntensity(phase, hour);

    if (value < bestValue) {
      bestValue = value;
      bestHour = hour;
    }
  }

  const bestWindow = (energy * bestValue) / 1000;

  const saving = Math.max(0, runNow - bestWindow);

  return {
    runNow,
    bestWindow,
    saving,
    savingPercent:
      runNow > 0 ? (saving / runNow) * 100 : 0,
    bestLabel: `${String(bestHour).padStart(2, "0")}:00`,
  };
}
