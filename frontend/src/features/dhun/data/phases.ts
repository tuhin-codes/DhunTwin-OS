import type { PhaseId } from "../types";

/* ============================================================
   PHASES
   Three states from the field-station master document:
   today, Phase 1 (school + R1), and full build-out.
   ============================================================ */

export interface PhaseConfig {
  id: PhaseId;
  label: string;
  short: string;
  description: string;
  population: number;
  builtM2: number;
  epi: number;
  solarKwp: number;
  computeKw: number;
  computePue: number;
  spirulinaKw: number;
  stpKlDay: number;
  organicTDay: number;
  harvestKlYr: number;
  forestAcres: number;
  treeCount: number;
}

export const PHASES: Record<PhaseId, PhaseConfig> = {
  today: {
    id: "today",
    label: "Today · 2026",
    short: "2026",
    description:
      "Field station operating. School under construction, no solar farm yet, compute is a single workstation, spirulina pilot raceway active.",
    population: 140,
    builtM2: 6000,
    epi: 55,
    solarKwp: 0,
    computeKw: 1.2,
    computePue: 1.6,
    spirulinaKw: 1.5,
    stpKlDay: 12,
    organicTDay: 0.05,
    harvestKlYr: 12000,
    forestAcres: 35,
    treeCount: 50000,
  },

  phase1: {
    id: "phase1",
    label: "Phase 1 · 2029",
    short: "2029",
    description:
      "R1 residences and the 7-acre school complete. 420 kWp rooftop solar, shared 8-GPU compute node, expanded spirulina cultivation.",
    population: 900,
    builtM2: 72000,
    epi: 47.1,
    solarKwp: 420,
    computeKw: 10,
    computePue: 1.45,
    spirulinaKw: 4.6,
    stpKlDay: 70,
    organicTDay: 0.12,
    harvestKlYr: 40000,
    forestAcres: 70,
    treeCount: 140000,
  },

  buildout: {
    id: "buildout",
    label: "Build-out · 2035",
    short: "2035",
    description:
      "Full masterplan: 11,847 residents, 650,558 m² built, 16,816 kWp solar, flagship compute commons, commercial biomass facility.",
    population: 11847,
    builtM2: 650558,
    epi: 47.1,
    solarKwp: 16816,
    computeKw: 28,
    computePue: 1.45,
    spirulinaKw: 15.5,
    stpKlDay: 832,
    organicTDay: 1.52,
    harvestKlYr: 306760,
    forestAcres: 124,
    treeCount: 300000,
  },
};

export const PHASE_ORDER: PhaseId[] = [
  "today",
  "phase1",
  "buildout",
];

/* Calendar year each phase is planned to open. */
export const PHASE_START_YEAR: Record<
  PhaseId,
  number
> = {
  today: 2026,
  phase1: 2029,
  buildout: 2035,
};

/* Monthly solar seasonality for Jaipur — planning assumption */
export const MONTH_FACTOR = [
  0.88, 0.95, 1.02, 1.08, 1.1, 1.02,
  0.88, 0.86, 0.92, 0.98, 0.92, 0.86,
];
