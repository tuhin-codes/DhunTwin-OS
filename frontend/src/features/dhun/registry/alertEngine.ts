/* ============================================================
   DHUN TWIN OS — CONFIGURABLE ALERT ENGINE
   Evaluates real and modelled channel readings against asset
   rules with hysteresis, persistence tracking, and clear distinction
   between operating limits and regulatory constraints.
   ============================================================ */

import type {
  ActiveAlert,
  RegisteredAsset,
  RegisteredChannel,
  TelemetryReading,
} from "./types";
import {
  TREE_HEIGHT_LIMIT_M,
  MAX_CONSTRUCTION_ACRES,
  BIORESERVE_ACRES,
  ANNUAL_WATER_CAPACITY_KL,
} from "../data/constants";

export const REGULATORY_LIMITS = {
  MAX_BUILDING_HEIGHT_METERS: TREE_HEIGHT_LIMIT_M,
  MAX_CAMPUS_CONSTRUCTION_ACRES: MAX_CONSTRUCTION_ACRES,
  BIORESERVE_MIN_ACRES: BIORESERVE_ACRES,
  MAX_ANNUAL_WATER_WITHDRAWAL_KL: ANNUAL_WATER_CAPACITY_KL,
};

export function isAlertSuppressedByHysteresis(
  val: number,
  threshold: number,
  deadbandRatio: number,
  priorAlarmActive: boolean
): boolean {
  if (!priorAlarmActive) return false;
  const clearingBound = threshold * (1 - deadbandRatio);
  return val >= clearingBound;
}

export function evaluateAssetAlerts(
  asset: RegisteredAsset,
  readings: Record<string, TelemetryReading>
): ActiveAlert[] {
  const engine = new AlertEngine();
  const alerts: ActiveAlert[] = [];
  for (const ch of asset.channels) {
    const reading = readings[ch.id] || ch.lastReading;
    const alert = engine.evaluateChannel(asset, ch, reading);
    if (alert) {
      alerts.push(alert);
    }
  }
  return alerts;
}

export class AlertEngine {
  private activeAlerts: Map<string, ActiveAlert> = new Map();

  private ruleKey(assetId: string, channelId: string): string {
    return `${assetId.toLowerCase()}::${channelId.toLowerCase()}`;
  }

  /**
   * Evaluate an asset channel against its configured alert rules
   */
  public evaluateChannel(
    asset: RegisteredAsset,
    channel: RegisteredChannel,
    reading?: TelemetryReading
  ): ActiveAlert | null {
    const key = this.ruleKey(asset.id, channel.id);

    // 1. Uncommissioned Check
    if (asset.commissioningStatus === "Planned" || asset.commissioningStatus === "Decommissioned") {
      this.activeAlerts.delete(key);
      return null;
    }

    // 2. Missing or Stale Data Check
    if (!reading) {
      if (asset.commissioningStatus === "Active" && channel.source !== "simulation") {
        const staleAlert: ActiveAlert = {
          id: `alert-stale-${key}`,
          assetId: asset.id,
          assetName: asset.name,
          channelId: channel.id,
          channelName: channel.name,
          observedValue: 0,
          unit: channel.unit,
          threshold: 0,
          thresholdType: "min",
          thresholdSource: "System Heartbeat Monitor",
          severity: "stale",
          detectionTimestamp: new Date().toISOString(),
          dataQuality: "stale",
          explanation: `No telemetry packets received for ${channel.name}. Telemetry channel is disconnected or unconfigured.`,
          suggestedAction: "Check gateway physical connectivity and field sensor power supply.",
          isRegulatory: false,
        };
        this.activeAlerts.set(key, staleAlert);
        return staleAlert;
      }
      this.activeAlerts.delete(key);
      return null;
    }

    const rules = channel.alertThresholds;
    if (!rules) {
      this.activeAlerts.delete(key);
      return null;
    }

    const val = reading.value;
    const hysteresis = rules.hysteresis || 0;
    const existing = this.activeAlerts.get(key);

    // Check Alarm Max
    if (rules.alarmMax !== undefined && val > rules.alarmMax) {
      const alert: ActiveAlert = {
        id: `alert-alarm-max-${key}`,
        assetId: asset.id,
        assetName: asset.name,
        channelId: channel.id,
        channelName: channel.name,
        observedValue: val,
        unit: channel.unit,
        threshold: rules.alarmMax,
        thresholdType: "max",
        thresholdSource: rules.thresholdSource || "Engineering Limit Specification",
        severity: "alarm",
        detectionTimestamp: existing?.detectionTimestamp || new Date().toISOString(),
        dataQuality: reading.quality,
        explanation: rules.ruleDescription || `Observed ${val} ${channel.unit} exceeds critical upper alarm ceiling (${rules.alarmMax} ${channel.unit}).`,
        suggestedAction: rules.suggestedAction || "Inspect equipment immediately and shed demand.",
        isRegulatory: Boolean(rules.thresholdSource?.toLowerCase().includes("cerc") || rules.thresholdSource?.toLowerCase().includes("cpcb")),
      };
      this.activeAlerts.set(key, alert);
      return alert;
    }

    // Check Alarm Min
    if (rules.alarmMin !== undefined && val < rules.alarmMin) {
      const alert: ActiveAlert = {
        id: `alert-alarm-min-${key}`,
        assetId: asset.id,
        assetName: asset.name,
        channelId: channel.id,
        channelName: channel.name,
        observedValue: val,
        unit: channel.unit,
        threshold: rules.alarmMin,
        thresholdType: "min",
        thresholdSource: rules.thresholdSource || "Engineering Limit Specification",
        severity: "alarm",
        detectionTimestamp: existing?.detectionTimestamp || new Date().toISOString(),
        dataQuality: reading.quality,
        explanation: rules.ruleDescription || `Observed ${val} ${channel.unit} dropped below critical minimum operating threshold (${rules.alarmMin} ${channel.unit}).`,
        suggestedAction: rules.suggestedAction || "Initiate auxiliary supply or check system pressure/charge.",
        isRegulatory: Boolean(rules.thresholdSource?.toLowerCase().includes("cerc") || rules.thresholdSource?.toLowerCase().includes("cpcb")),
      };
      this.activeAlerts.set(key, alert);
      return alert;
    }

    // Check Watch Max
    if (rules.normalMax !== undefined && val > rules.normalMax) {
      // Hysteresis clearing check
      if (existing && existing.severity === "alarm" && val > rules.normalMax - hysteresis) {
        // Keep existing alarm until fully below hysteresis bound
        return existing;
      }

      const alert: ActiveAlert = {
        id: `alert-watch-max-${key}`,
        assetId: asset.id,
        assetName: asset.name,
        channelId: channel.id,
        channelName: channel.name,
        observedValue: val,
        unit: channel.unit,
        threshold: rules.normalMax,
        thresholdType: "max",
        thresholdSource: rules.thresholdSource || "Operational Envelope Guideline",
        severity: "watch",
        detectionTimestamp: existing?.detectionTimestamp || new Date().toISOString(),
        dataQuality: reading.quality,
        explanation: rules.ruleDescription || `Observed ${val} ${channel.unit} is outside normal envelope band (${rules.normalMax} ${channel.unit}).`,
        suggestedAction: rules.suggestedAction || "Monitor trend for persistent deviation.",
        isRegulatory: false,
      };
      this.activeAlerts.set(key, alert);
      return alert;
    }

    // Check Watch Min
    if (rules.normalMin !== undefined && val < rules.normalMin) {
      if (existing && existing.severity === "alarm" && val < rules.normalMin + hysteresis) {
        return existing;
      }

      const alert: ActiveAlert = {
        id: `alert-watch-min-${key}`,
        assetId: asset.id,
        assetName: asset.name,
        channelId: channel.id,
        channelName: channel.name,
        observedValue: val,
        unit: channel.unit,
        threshold: rules.normalMin,
        thresholdType: "min",
        thresholdSource: rules.thresholdSource || "Operational Envelope Guideline",
        severity: "watch",
        detectionTimestamp: existing?.detectionTimestamp || new Date().toISOString(),
        dataQuality: reading.quality,
        explanation: rules.ruleDescription || `Observed ${val} ${channel.unit} is below normal lower band (${rules.normalMin} ${channel.unit}).`,
        suggestedAction: rules.suggestedAction || "Monitor trend and verify sensor calibration.",
        isRegulatory: false,
      };
      this.activeAlerts.set(key, alert);
      return alert;
    }

    // Within normal band: clear alert
    this.activeAlerts.delete(key);
    return null;
  }

  /**
   * Evaluate all registered assets and return all active alerts
   */
  public evaluateAll(
    assets: RegisteredAsset[],
    getReading: (assetId: string, channelId: string) => TelemetryReading | undefined
  ): ActiveAlert[] {
    const results: ActiveAlert[] = [];

    for (const asset of assets) {
      for (const channel of asset.channels) {
        const reading = getReading(asset.id, channel.id) || channel.lastReading;
        const alert = this.evaluateChannel(asset, channel, reading);
        if (alert) {
          results.push(alert);
        }
      }
    }

    return results;
  }

  public getActiveAlerts(): ActiveAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  public getAlertForAsset(assetId: string): ActiveAlert[] {
    return Array.from(this.activeAlerts.values()).filter(
      (a) => a.assetId.toLowerCase() === assetId.toLowerCase()
    );
  }
}

export const alertEngine = new AlertEngine();
