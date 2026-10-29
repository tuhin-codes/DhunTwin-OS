/* ============================================================
   DHUN TWIN OS — REUSABLE TELEMETRY ARCHITECTURE
   Unified telemetry ingestion, validation, stale-state monitor,
   and source adapters (physical sensor, gateway, manual, CSV,
   and simulation).
   ============================================================ */

import type {
  DataQuality,
  OperationalState,
  RegisteredAsset,
  TelemetryReading,
  TelemetrySourceType,
} from "./types";

export const DEFAULT_STALE_THRESHOLD_SECONDS = 45;

export interface IngestReadingParams {
  assetId: string;
  channelId: string;
  value: number;
  unit?: string;
  timestamp?: string | number | Date;
  source: TelemetrySourceType;
  notes?: string;
}

export function validateTelemetryReading(reading: TelemetryReading): { valid: boolean; error?: string } {
  if (!reading.assetId || !reading.channelId) {
    return { valid: false, error: "Asset ID and Channel ID are mandatory." };
  }
  if (typeof reading.value !== "number" || isNaN(reading.value) || !isFinite(reading.value)) {
    return { valid: false, error: "Reading value must be a valid finite number." };
  }
  if (!reading.timestamp) {
    return { valid: false, error: "Timestamp is required." };
  }
  return { valid: true };
}

export function detectStaleTelemetry(
  timestamp: string | number | Date,
  thresholdSeconds = DEFAULT_STALE_THRESHOLD_SECONDS
): boolean {
  const tsMs = typeof timestamp === "number" ? timestamp : new Date(timestamp).getTime();
  if (isNaN(tsMs)) return true;
  return (Date.now() - tsMs) / 1000 > thresholdSeconds;
}

export function evaluateReadingQuality(
  value: number,
  expectedMin?: number,
  expectedMax?: number,
  timestamp?: string,
  staleThreshold = DEFAULT_STALE_THRESHOLD_SECONDS
): "VALID" | "OUT_OF_RANGE" | "STALE" | "SUSPECT" {
  if (timestamp && detectStaleTelemetry(timestamp, staleThreshold)) {
    return "STALE";
  }
  if (expectedMin !== undefined && value < expectedMin) {
    return "OUT_OF_RANGE";
  }
  if (expectedMax !== undefined && value > expectedMax) {
    return "OUT_OF_RANGE";
  }
  return "VALID";
}

export function parseTelemetryCsv(csvText: string): TelemetryReading[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const assetIdx = headers.findIndex((h) => h === "assetid" || h === "asset");
  const channelIdx = headers.findIndex((h) => h === "channelid" || h === "channel");
  const valueIdx = headers.findIndex((h) => h === "value" || h === "reading");
  const unitIdx = headers.findIndex((h) => h === "unit");
  const timeIdx = headers.findIndex((h) => h === "timestamp" || h === "time");
  const sourceIdx = headers.findIndex((h) => h === "source");

  const results: TelemetryReading[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const val = parseFloat(cols[valueIdx]);
    if (isNaN(val)) continue;
    results.push({
      assetId: assetIdx !== -1 ? cols[assetIdx] : "",
      channelId: channelIdx !== -1 ? cols[channelIdx] : "",
      value: val,
      unit: unitIdx !== -1 ? cols[unitIdx] : "",
      timestamp: timeIdx !== -1 ? cols[timeIdx] : new Date().toISOString(),
      source: (sourceIdx !== -1 ? cols[sourceIdx] : "imported_data") as TelemetrySourceType,
      quality: "good",
    });
  }
  return results;
}

export class TelemetryEngine {
  private staleThresholdSeconds: number;
  private readingsCache: Map<string, TelemetryReading> = new Map();
  private historyCache: Map<string, TelemetryReading[]> = new Map();
  private maxHistoryPerChannel = 60;

  constructor(staleThresholdSeconds = DEFAULT_STALE_THRESHOLD_SECONDS) {
    this.staleThresholdSeconds = staleThresholdSeconds;
  }

  private channelKey(assetId: string, channelId: string): string {
    return `${assetId.toLowerCase()}:${channelId.toLowerCase()}`;
  }

  /**
   * Validate and ingest a raw telemetry reading
   */
  public ingest(params: IngestReadingParams): { success: boolean; reading?: TelemetryReading; error?: string } {
    const { assetId, channelId, value, unit, source, notes } = params;

    // 1. Value validation
    if (typeof value !== "number" || isNaN(value) || !isFinite(value)) {
      return { success: false, error: "Reading value must be a valid finite number." };
    }

    // 2. Timestamp validation
    let validTimestamp: string;
    let timestampMs: number;
    try {
      if (!params.timestamp) {
        timestampMs = Date.now();
      } else if (typeof params.timestamp === "number") {
        timestampMs = params.timestamp;
      } else if (params.timestamp instanceof Date) {
        timestampMs = params.timestamp.getTime();
      } else {
        timestampMs = new Date(params.timestamp).getTime();
      }

      if (isNaN(timestampMs) || timestampMs <= 0) {
        timestampMs = Date.now();
      }
      validTimestamp = new Date(timestampMs).toISOString();
    } catch {
      timestampMs = Date.now();
      validTimestamp = new Date(timestampMs).toISOString();
    }

    // Reject future timestamps exceeding 5 minutes clock skew
    if (timestampMs > Date.now() + 300000) {
      return { success: false, error: "Reading timestamp cannot be more than 5 minutes in the future." };
    }

    // 3. Duplicate detection
    const key = this.channelKey(assetId, channelId);
    const existing = this.readingsCache.get(key);
    if (existing && existing.timestamp === validTimestamp && existing.value === value) {
      // Duplicate reading detected - return existing without re-appending to history
      return { success: true, reading: existing };
    }

    // 4. Data Quality classification
    const ageSeconds = (Date.now() - timestampMs) / 1000;
    let quality: DataQuality = "good";

    if (ageSeconds > this.staleThresholdSeconds) {
      quality = "stale";
    }

    const reading: TelemetryReading = {
      assetId,
      channelId,
      value,
      unit: unit || "",
      timestamp: validTimestamp,
      source,
      quality,
      raw: value,
      notes,
    };

    // Update current cache
    this.readingsCache.set(key, reading);

    // Update history cache
    const currentHistory = this.historyCache.get(key) || [];
    const updatedHistory = [...currentHistory, reading].slice(-this.maxHistoryPerChannel);
    this.historyCache.set(key, updatedHistory);

    return { success: true, reading };
  }

  /**
   * Retrieve the last known reading for a given channel
   */
  public getReading(assetId: string, channelId: string): TelemetryReading | undefined {
    const key = this.channelKey(assetId, channelId);
    const reading = this.readingsCache.get(key);
    if (!reading) return undefined;

    // Dynamically check freshness on read
    const readingTime = new Date(reading.timestamp).getTime();
    const ageSeconds = (Date.now() - readingTime) / 1000;
    if (ageSeconds > this.staleThresholdSeconds && reading.quality === "good") {
      reading.quality = "stale";
    }

    return reading;
  }

  /**
   * Retrieve channel history
   */
  public getHistory(assetId: string, channelId: string): TelemetryReading[] {
    const key = this.channelKey(assetId, channelId);
    return this.historyCache.get(key) || [];
  }

  /**
   * Determine authoritative operational state for an asset
   */
  public determineOperationalState(asset: RegisteredAsset): OperationalState {
    if (asset.commissioningStatus === "Planned") {
      return "planned";
    }
    if (asset.commissioningStatus === "Commissioning") {
      return "commissioning";
    }
    if (asset.commissioningStatus === "Decommissioned") {
      return "decommissioned";
    }

    // Asset is Active - verify data source
    const primaryChannel = asset.channels.find((ch) => ch.id === asset.primaryChannelId) || asset.channels[0];
    if (!primaryChannel) {
      return "simulated";
    }

    const latest = this.getReading(asset.id, primaryChannel.id) || primaryChannel.lastReading;

    if (!latest) {
      if (primaryChannel.source === "simulation") return "simulated";
      return "stale";
    }

    const ageSeconds = (Date.now() - new Date(latest.timestamp).getTime()) / 1000;
    if (ageSeconds > this.staleThresholdSeconds) {
      return "stale";
    }

    if (latest.source === "physical_sensor" || latest.source === "gateway") {
      return "active_verified";
    }

    if (latest.source === "manual_entry" || latest.source === "imported_data") {
      return "active_manual";
    }

    return "simulated";
  }

  /**
   * CSV Import Adapter: parse CSV lines into validated telemetry readings
   */
  public parseCsvReadings(
    csvText: string,
    assetId: string
  ): { success: boolean; importedCount: number; errors: string[] } {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) {
      return { success: false, importedCount: 0, errors: ["CSV file must contain a header and at least one data row."] };
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const channelIdx = headers.findIndex((h) => h === "channel" || h === "channelid" || h === "metric");
    const valueIdx = headers.findIndex((h) => h === "value" || h === "reading");
    const timeIdx = headers.findIndex((h) => h === "time" || h === "timestamp" || h === "date");
    const unitIdx = headers.findIndex((h) => h === "unit");

    if (channelIdx === -1 || valueIdx === -1) {
      return {
        success: false,
        importedCount: 0,
        errors: ["CSV header must include 'channel' (or 'metric') and 'value' columns."],
      };
    }

    let importedCount = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(",").map((c) => c.trim());
      const channelId = cols[channelIdx];
      const numVal = parseFloat(cols[valueIdx]);
      const timestamp = timeIdx !== -1 ? cols[timeIdx] : undefined;
      const unit = unitIdx !== -1 ? cols[unitIdx] : undefined;

      if (!channelId || isNaN(numVal)) {
        errors.push(`Row ${i + 1}: Invalid channel name or numeric value.`);
        continue;
      }

      const res = this.ingest({
        assetId,
        channelId,
        value: numVal,
        unit,
        timestamp,
        source: "imported_data",
      });

      if (res.success) {
        importedCount++;
      } else {
        errors.push(`Row ${i + 1}: ${res.error}`);
      }
    }

    return {
      success: importedCount > 0,
      importedCount,
      errors,
    };
  }
}

export const telemetryEngine = new TelemetryEngine();
