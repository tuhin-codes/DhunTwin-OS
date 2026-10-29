/* ============================================================
   DHUN TWIN OS — DOMAIN TYPES
   ============================================================ */

export type EvidenceTier =
  | "MEASURED"
  | "REPORT"
  | "ASSUMPTION"
  | "SIMULATED";

export type ZoneId =
  | "bioreserve"
  | "energy"
  | "water"
  | "built"
  | "waste"
  | "compute";

export type AssetStatus =
  | "healthy"
  | "watch"
  | "attention";

export type PhaseId =
  | "today"
  | "phase1"
  | "buildout";

export interface AssetMetric {
  label: string;
  value: string;
  unit?: string;
  tier: EvidenceTier;
}

export interface DhunAsset {
  id: string;
  name: string;
  short: string;
  zone: ZoneId;
  icon: string;
  status: AssetStatus;

  /* Site-plan position in the 800 x 500 twin canvas */
  x: number;
  y: number;

  /* Live-ish flows */
  powerKw: number;
  energyKwhDay: number;
  carbonKgDay: number;
  waterKlDay: number;
  carbonShare: number;

  headlineValue: string;
  headlineLabel: string;

  metrics: AssetMetric[];
  note: string;
  evidence: EvidenceTier;
}

export interface TwinSummary {
  phase: PhaseId;
  clock: Date;

  population: number;
  builtM2: number;

  demandKw: number;
  solarKw: number;
  gridKw: number;
  batterySoc: number;

  /* Three Distinct Demand Workstreams */
  workstreamCampusKw: number;
  workstreamCampusKwhDay: number;
  workstreamComputeKw: number;
  workstreamComputeKwhDay: number;
  workstreamSpirulinaKw: number;
  workstreamSpirulinaKwhDay: number;

  renewableShare: number;
  gridIntensity: number;

  demandKwhDay: number;
  solarKwhDay: number;
  gridKwhDay: number;

  carbonKgDay: number;
  sequestrationKgDay: number;
  netCarbonKgDay: number;

  waterKlDay: number;
  waterHarvestKlYr: number;
  standingStockT: number;

  perCapitaT: number;
  targetPerCapitaT: number;
}

export interface TwinSnapshot {
  summary: TwinSummary;
  assets: DhunAsset[];
}

/* ============================================================
   LEDGER
   ============================================================ */

export interface LedgerLine {
  key: string;
  label: string;
  detail: string;
  valueT: number;
  tier: EvidenceTier;
  tone: "emit" | "sink" | "neutral";
}

export interface Ledger {
  phase: PhaseId;
  lines: LedgerLine[];

  upfrontT: number;
  useEmbodiedT: number;
  operationalT: number;
  sinkT: number;

  netOperationalT: number;
  wholeLifeT: number;

  perCapitaT: number;
  /* Gross Scope 1+2 per resident: the basis of the published
     target, with no sequestration credit. */
  operationalPerCapitaT: number;
  targetPerCapitaT: number;
  annualBudgetT: number;

  upfrontAmortisedT: number;
  upfrontVsBudget: number;

  yearsToOffsetUpfront: number | null;

  population: number;
  builtM2: number;
}

/* ============================================================
   SCENARIOS
   ============================================================ */

export type ComputeOption =
  | "none"
  | "workstation"
  | "server"
  | "flagship";

export type CoolingType =
  | "dry"
  | "evaporative";

export interface ScenarioInputs {
  solarKwp: number;
  epi: number;
  batteryMwh: number;
  gridFactor: number;
  forestAcres: number;
  compute: ComputeOption;
  cooling: CoolingType;
}

export interface ScenarioResult {
  demandKwhYr: number;
  solarKwhYr: number;
  gridKwhYr: number;

  renewableShare: number;
  residualT: number;
  sinkT: number;
  netT: number;

  perCapitaT: number;
  targetPerCapitaT: number;

  waterKlYr: number;
  lcoeInrPerKwh: number | null;
  upfrontT: number;
  yearsToOffset: number | null;
  paybackYear: number | null;
  offsetBy2050: boolean;

  capexCr: number;
}

/* ============================================================
   COMPUTE
   ============================================================ */

export interface ComputeJob {
  id: string;
  model: string;
  tokensM: number;
  window: string;
  priority: "High" | "Normal" | "Batch";
}

export interface ComputeWindow {
  hour: number;
  label: string;
  intensity: number;
  solarKw: number;
}

export interface JobCarbon {
  runNow: number;
  bestWindow: number;
  saving: number;
  savingPercent: number;
  bestLabel: string;
}
