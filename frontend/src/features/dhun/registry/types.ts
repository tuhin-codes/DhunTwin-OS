/* ============================================================
   DHUN TWIN OS — CENTRAL ASSET REGISTRY TYPES
   Authoritative schema for all campus physical infrastructure,
   telemetry channels, operating envelopes, alert rules and
   evidence provenance.
   ============================================================ */

export type AssetDomain =
  | "Energy"
  | "Water"
  | "Buildings"
  | "Compute"
  | "Ecology"
  | "Mobility"
  | "Waste";

export type LifecycleStatus =
  | "Planned"
  | "Commissioning"
  | "Active"
  | "Maintenance"
  | "Decommissioned";

export type CommissioningStatus = LifecycleStatus;

export type ConnectivityStatus =
  | "Connected"
  | "Disconnected"
  | "Intermittent"
  | "Unknown";

export type MonitoringMode =
  | "Live"
  | "Manual"
  | "Imported"
  | "Simulated"
  | "Stale"
  | "Disconnected"
  | "Uncommissioned"
  | "Unavailable";

export type TelemetrySourceType =
  | "physical_sensor"
  | "gateway"
  | "manual_entry"
  | "imported_data"
  | "simulation";

export type OperationalState =
  | "planned"
  | "commissioning"
  | "active_verified"
  | "active_manual"
  | "simulated"
  | "stale"
  | "decommissioned";

export type EvidenceClassification =
  | "Measured"
  | "Reported"
  | "Calculated"
  | "Assumed"
  | "Simulated";

export type VerificationStatus =
  | "verified"
  | "provisional"
  | "unverified";

export type DataQuality =
  | "good"
  | "degraded"
  | "stale"
  | "invalid";

export type ThresholdClassification =
  | "Manufacturer-specified"
  | "Engineering-design limit"
  | "Regulatory requirement"
  | "Project-defined operational target"
  | "Provisional test threshold"
  | "Not configured";

export type AlertSeverity =
  | "normal"
  | "watch"
  | "alarm"
  | "stale"
  | "uncommissioned";

export type AlertCategory =
  | "operating_alarm"
  | "data_quality"
  | "connectivity"
  | "planning_warning"
  | "regulatory_compliance";

/* Common Telemetry Reading */
export interface TelemetryReading {
  assetId: string;
  channelId: string;
  value: number;
  unit: string;
  timestamp: string; // ISO 8601 string in UTC, formatted to IST in UI
  source: TelemetrySourceType;
  quality: DataQuality;
  raw?: number;
  notes?: string;
}

/* Alert Rule Definition */
export interface ChannelAlertRule {
  normalMin?: number;
  normalMax?: number;
  alarmMin?: number;
  alarmMax?: number;
  hysteresis?: number; // Tolerance before clearing
  persistenceSeconds?: number; // Seconds before alarm triggers
  ruleDescription?: string;
  suggestedAction?: string;
  thresholdSource?: string;
  thresholdClassification?: ThresholdClassification;
  isRegulatory?: boolean;
}

/* Standardized Measurement Channel Schema */
export interface RegisteredChannel {
  id: string; // channel identifier (e.g. 'active-power')
  channelId?: string; // alias for id
  assetId?: string;
  channelType?: string; // e.g. 'power', 'energy', 'flow_rate', 'temperature'
  name: string;
  displayName?: string; // alias for name
  unit: string;
  dataType: "numeric" | "boolean" | "string";
  expectedSamplingIntervalSeconds: number;
  source: TelemetrySourceType;
  sourceEndpoint?: string;
  validRange?: { min: number; max: number };
  warningThreshold?: number;
  criticalThreshold?: number;
  thresholdSource?: string;
  thresholdClassification?: ThresholdClassification;
  evidenceClassification?: EvidenceClassification;
  lastReading?: TelemetryReading;
  alertThresholds?: ChannelAlertRule;
  calibrationDate?: string;
  calibrationInfo?: string;
  history?: { timestamp: string; value: number }[];
}

/* Active Alert Structure */
export interface ActiveAlert {
  id: string;
  assetId: string;
  assetName: string;
  channelId: string;
  channelName: string;
  observedValue: number;
  unit: string;
  threshold: number;
  thresholdType: "min" | "max";
  thresholdSource: string;
  thresholdClassification?: ThresholdClassification;
  severity: AlertSeverity;
  category?: AlertCategory;
  detectionTimestamp: string;
  dataQuality: DataQuality;
  explanation: string;
  suggestedAction: string;
  isRegulatory: boolean;
  status?: "active" | "acknowledged" | "resolved";
  resolvedAt?: string;
  resolutionNotes?: string;
}

/* Master Asset Schema */
export interface RegisteredAsset {
  /* 1. Identity and Classification */
  id: string; // Stable unique ID (e.g. 'solar-array-01')
  assetId?: string; // Standard alias for id
  name: string; // Human readable name
  type: string; // e.g. 'Solar Photovoltaic', 'BESS Battery', 'Air-cooled Rack'
  assetType?: string; // Standard alias for type
  subtype?: string; // e.g. 'Bifacial Mono-PERC', 'LFP Battery'
  assetSubtype?: string; // Standard alias for subtype
  domain: AssetDomain;
  description: string;
  purpose?: string;
  parentId?: string; // Relationship to parent asset/cluster
  parentAssetId?: string; // Standard alias for parentId
  systemRelationship?: string; // e.g. 'Feeds Campus Central Inverter'

  /* Physical Location */
  location: {
    parcelId?: string; // e.g. 'p1', 'p2', 'p3', 'p4', 'p5', 'p6'
    parcelName?: string;
    locationId?: string;
    coordinates?: { lat: number; lng: number }; // True geographic coordinates
    mapPosition?: { x: number; y: number }; // Visual 800x500 canvas coordinates IF verified
    hasVerifiedCoordinates: boolean; // Strictly true only if coordinates exist; NEVER invent map positions
  };

  /* Lifecycle, Connectivity & Monitoring Modes */
  lifecycleStatus?: LifecycleStatus;
  commissioningStatus: CommissioningStatus; // Backwards compatible with existing code
  connectivityStatus?: ConnectivityStatus;
  monitoringMode?: MonitoringMode;
  installationDate?: string;
  commissionedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  lastSeenAt?: string;

  /* Test Lab Metadata */
  isTestAsset?: boolean; // Set true for Test Lab generated assets to isolate from production
  testDatasetId?: string;

  /* 2. Engineering Specification */
  ratedCapacity: number;
  capacityUnit: string; // e.g. 'kW', 'kWh', 'kL/day', 'm²', 'TFLOPS'
  electricalRating?: string; // e.g. '415V 3-phase, 50Hz', '48V DC'
  operatingRange?: {
    min: number;
    max: number;
    optimalMin?: number;
    optimalMax?: number;
    unit: string;
  };
  limits?: {
    minLimit: number;
    maxLimit: number;
  };
  specifications?: Record<string, string | number>;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  maintenanceIntervalDays?: number;
  lastMaintenanceDate?: string;

  /* 3. Telemetry Configuration */
  channels: RegisteredChannel[];
  primaryChannelId?: string;

  /* 4. Evidence and Provenance */
  evidenceClassification: EvidenceClassification;
  sourceDocument?: string;
  sourceDate?: string;
  calculationMethod?: string;
  responsibleOrg?: string; // e.g. 'Logos Field Engineering', 'ZuGrama Operations'
  verificationStatus: VerificationStatus;
  uncertaintyNotes?: string;

  /* 5. Carbon and Resource Accounting */
  carbonAccounting?: {
    embodiedCarbonT?: number; // Upfront capital carbon
    emissionFactor?: number; // kgCO2e per unit
    reportingPeriod?: string;
    calculationMethod?: string;
    includedInCampusMeter: boolean; // Prevent double-counting when already included in campus meter
    exclusionReason?: string;
    eligibleForLedger: boolean;
  };

  /* 6. Compute-Specific Attributes */
  computeAttributes?: {
    itLoadKw: number;
    targetPue: number;
    targetWue: number; // Water usage effectiveness L/kWh
    coolingTopology: string; // e.g. 'Direct-to-chip liquid cooling + dry cooler'
    batchQueueEligible: boolean;
    serverCount?: number;
    rackDensityKw?: number;
  };
}

/* Filter options for Asset Inventory */
export interface AssetFilterOptions {
  searchQuery: string;
  domain?: AssetDomain | "all";
  status?: CommissioningStatus | "all";
  lifecycleStatus?: LifecycleStatus | "all";
  connectivityStatus?: ConnectivityStatus | "all";
  monitoringMode?: MonitoringMode | "all";
  operationalState?: OperationalState | "all";
  telemetrySource?: TelemetrySourceType | "all";
  alertSeverity?: AlertSeverity | "all";
  hasCoordinatesOnly?: boolean;
  includeTestAssets?: boolean;
}
