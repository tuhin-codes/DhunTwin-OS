/* ============================================================
   DHUN TWIN OS — UNIVERSAL ASSET DETAIL INSPECTOR
   Authoritative, shared detail view for all physical, ecological,
   and compute infrastructure. Displays engineering specs, live/last
   readings, operating envelopes, alert log, evidence provenance,
   and maintenance schedule.
   ============================================================ */

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  X,
} from "lucide-react";

import type { RegisteredAsset } from "./types";
import { useAssetRegistry } from "./AssetRegistryContext";
import { istTime } from "../lib/clock";

interface AssetDetailInspectorProps {
  asset: RegisteredAsset;
  onClose?: () => void;
}

const DOMAIN_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Energy: { bg: "bg-[#F8E7C8]", text: "text-[#6B4706]", border: "border-[#EED7AA]" },
  Water: { bg: "bg-[#DCEAF5]", text: "text-[#103E66]", border: "border-[#C0DAEC]" },
  Ecology: { bg: "bg-[#DCECE3]", text: "text-[#12482E]", border: "border-[#C5DFD0]" },
  Compute: { bg: "bg-[#E9E4F4]", text: "text-[#3C2B6A]", border: "border-[#D7CEEA]" },
  Buildings: { bg: "bg-[#EEF2EE]", text: "text-[#19231E]", border: "border-[#D8DDD5]" },
  Mobility: { bg: "bg-[#E8F0EA]", text: "text-[#173D32]", border: "border-[#CDE0D2]" },
  Waste: { bg: "bg-[#F8FAF6]", text: "text-[#4B5B52]", border: "border-[#D8DDD5]" },
};

export default function AssetDetailInspector({
  asset,
  onClose,
}: AssetDetailInspectorProps) {
  const { getReading, getHistory, getOperationalState, alerts, recordReading } =
    useAssetRegistry();

  const [activeTab, setActiveTab] = useState<
    "telemetry" | "specifications" | "alerts" | "provenance"
  >("telemetry");

  const [manualInput, setManualInput] = useState("");

  const state = getOperationalState(asset);
  const assetAlerts = alerts.filter(
    (a) => a.assetId.toLowerCase() === asset.id.toLowerCase()
  );

  const primaryChannel =
    asset.channels.find((ch) => ch.id === asset.primaryChannelId) ||
    asset.channels[0];

  const currentReading = primaryChannel
    ? getReading(asset.id, primaryChannel.id) || primaryChannel.lastReading
    : undefined;

  const history = primaryChannel
    ? getHistory(asset.id, primaryChannel.id)
    : [];

  const handleRecordManual = () => {
    if (!primaryChannel || !manualInput || isNaN(parseFloat(manualInput))) return;
    recordReading({
      assetId: asset.id,
      channelId: primaryChannel.id,
      value: parseFloat(manualInput),
      unit: primaryChannel.unit,
      source: "manual_entry",
    });
    setManualInput("");
  };

  const stateLabels: Record<
    string,
    { label: string; bg: string; text: string }
  > = {
    planned: { label: "Planned Infrastructure", bg: "bg-[#EEF2EE]", text: "text-muted" },
    commissioning: { label: "Field Commissioning", bg: "bg-[#F8E7C8]", text: "text-[#6B4706]" },
    active_verified: { label: "Active · Verified Telemetry", bg: "bg-[#DCECE3]", text: "text-[#12482E]" },
    active_manual: { label: "Active · Manual / Imported", bg: "bg-[#DCEAF5]", text: "text-[#103E66]" },
    simulated: { label: "Simulated Model", bg: "bg-[#EEF2EE]", text: "text-muted" },
    stale: { label: "Telemetry Stale (>45s)", bg: "bg-[#F8E7C8]", text: "text-[#6B4706]" },
    decommissioned: { label: "Decommissioned", bg: "bg-[#F5DEDA]", text: "text-[#732117]" },
  };

  const badge = stateLabels[state] || stateLabels.simulated;
  const domainStyle = DOMAIN_STYLES[asset.domain] || DOMAIN_STYLES.Energy;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[8px] border border-rule bg-surface text-[14px] shadow-sm">
      {/* Header */}
      <div className="border-b border-rule bg-surface-subtle/80 p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`inline-block rounded-[4px] px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider font-bold border ${domainStyle.bg} ${domainStyle.text} ${domainStyle.border}`}>
                {asset.domain}
              </span>
              <span className="text-rule-strong">·</span>
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted font-medium">
                {asset.type}
              </span>
            </div>
            <h2 className="mt-1.5 truncate text-[17px] font-semibold text-ink">
              {asset.name}
            </h2>
            <p className="mt-0.5 font-mono text-[11.5px] text-muted">
              ID: <span className="text-ink font-medium">{asset.id}</span> {asset.systemRelationship ? `· ${asset.systemRelationship}` : ""}
            </p>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="btn btn-quiet btn-sm px-2 text-muted hover:text-ink"
              aria-label="Close inspector"
            >
              <X size={17} />
            </button>
          )}
        </div>

        {/* Status Strip */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-[4px] px-2.5 py-1 font-mono text-[11px] font-semibold ${badge.bg} ${badge.text}`}
          >
            <span className="h-2 w-2 rounded-full bg-current" />
            {badge.label}
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-[4px] bg-surface px-2.5 py-1 font-mono text-[11px] text-muted border border-rule">
            <ShieldCheck size={13} className="text-accent" />
            {asset.evidenceClassification}
          </span>

          {asset.location.hasVerifiedCoordinates ? (
            <span className="inline-flex items-center gap-1.5 rounded-[4px] bg-surface px-2.5 py-1 font-mono text-[11px] text-muted border border-rule">
              <MapPin size={13} className="text-accent" />
              {asset.location.parcelName?.split("·")[0] || "Mapped"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-[4px] bg-surface px-2.5 py-1 font-mono text-[11px] text-faint border border-rule">
              Non-spatial (No Invented Coords)
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-rule bg-surface font-mono text-[12.5px]">
        {[
          { id: "telemetry", label: "Telemetry" },
          { id: "specifications", label: "Specifications" },
          { id: "alerts", label: `Alerts (${assetAlerts.length})` },
          { id: "provenance", label: "Provenance" },
        ].map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={[
              "flex-1 py-2.5 text-center transition-colors border-r last:border-r-0 border-rule font-medium",
              activeTab === tab.id
                ? "bg-accent-tint font-bold text-accent border-b-2 border-b-accent"
                : "text-muted hover:bg-surface-subtle hover:text-ink",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4">
        {/* TAB 1: TELEMETRY & ENVELOPES */}
        {activeTab === "telemetry" && (
          <div className="space-y-4">
            {/* Primary KPI Card */}
            <div className="rounded-[6px] border border-rule bg-surface-subtle/60 p-4">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[11.5px] uppercase tracking-wider text-muted font-semibold">
                  {primaryChannel?.name || "Primary Metric"}
                </span>
                <span className="font-mono text-[11px] text-faint">
                  Source: {primaryChannel?.source || "unconfigured"}
                </span>
              </div>

              <div className="mt-2 flex items-baseline gap-2.5">
                <span className="tabular font-sans text-[32px] md:text-[36px] font-semibold leading-tight text-ink">
                  {currentReading ? currentReading.value.toFixed(1) : "—"}
                </span>
                <span className="text-[14px] font-medium text-muted">
                  {primaryChannel?.unit || asset.capacityUnit}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between text-[12px] text-muted border-t border-rule/70 pt-2.5">
                <span>
                  Last observed:{" "}
                  <strong className="text-ink font-semibold">
                    {currentReading
                      ? istTime(new Date(currentReading.timestamp))
                      : "No reading"}
                  </strong>
                </span>
                <span
                  className={
                    currentReading?.quality === "good"
                      ? "text-[#12482E] font-semibold"
                      : "text-[#6B4706] font-semibold"
                  }
                >
                  Quality: {currentReading?.quality || "unverified"}
                </span>
              </div>
            </div>

            {/* Operating Envelopes Bar */}
            {primaryChannel?.alertThresholds && (
              <div className="rounded-[6px] border border-rule p-4 bg-surface">
                <div className="flex items-center justify-between text-[13px] mb-2">
                  <span className="font-semibold text-ink">Configured Operating Band</span>
                  <span className="font-mono text-[11px] text-muted">
                    {primaryChannel.alertThresholds.thresholdSource}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between font-mono text-[11px] text-muted">
                    <span>Alarm: {primaryChannel.alertThresholds.alarmMin ?? "—"}</span>
                    <span>Normal: {primaryChannel.alertThresholds.normalMin ?? "—"}</span>
                    <span>Normal: {primaryChannel.alertThresholds.normalMax ?? "—"}</span>
                    <span>Alarm: {primaryChannel.alertThresholds.alarmMax ?? "—"}</span>
                  </div>

                  {/* Range Track */}
                  <div className="relative h-2.5 w-full rounded-full bg-rule overflow-hidden">
                    <div
                      className="absolute inset-y-0 bg-[#2E7D5B] rounded-full opacity-80"
                      style={{ left: "20%", right: "20%" }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Historical Readings Timeline / Mini-chart */}
            <div className="rounded-[6px] border border-rule p-4 bg-surface">
              <div className="flex items-center justify-between mb-2.5">
                <span className="font-semibold text-ink text-[13px]">
                  Recent Trend ({history.length || 0} Frames Recorded)
                </span>
                <span className="font-mono text-[11px] text-faint">2s Heartbeat</span>
              </div>

              {history.length > 0 ? (
                <div className="flex h-14 items-end gap-1 overflow-hidden pt-2">
                  {history.slice(-28).map((pt, idx) => {
                    const min = primaryChannel?.alertThresholds?.alarmMin ?? 0;
                    const max = primaryChannel?.alertThresholds?.alarmMax ?? (asset.ratedCapacity || 100);
                    const pct = Math.min(100, Math.max(12, ((pt.value - min) / (max - min || 1)) * 100));
                    return (
                      <div
                        key={idx}
                        className="flex-1 bg-accent/70 hover:bg-accent rounded-xs transition-all"
                        style={{ height: `${pct}%` }}
                        title={`${pt.value} ${pt.unit} at ${istTime(new Date(pt.timestamp))}`}
                      />
                    );
                  })}
                </div>
              ) : (
                <p className="text-[12.5px] text-muted py-2">
                  No historical trend available. Ingesting live frames or manual entries will plot automatically.
                </p>
              )}
            </div>

            {/* Manual Entry Quick Action */}
            <div className="rounded-[6px] border border-rule p-3.5 bg-surface-subtle/70">
              <span className="block font-semibold text-ink text-[13px] mb-1.5">
                Log Manual Sensor Reading
              </span>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder={`Value in ${primaryChannel?.unit || asset.capacityUnit}`}
                  className="flex-1 rounded border border-rule bg-surface px-3 py-1.5 text-[13px] text-ink"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleRecordManual}
                  className="btn btn-sm btn-primary"
                >
                  Log Reading
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SPECIFICATIONS */}
        {activeTab === "specifications" && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-[6px] border border-rule p-4 bg-surface text-[13.5px]">
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-wider text-muted font-semibold">Rated Capacity</dt>
                <dd className="tabular font-semibold text-ink mt-0.5">
                  {asset.ratedCapacity} {asset.capacityUnit}
                </dd>
              </div>

              <div>
                <dt className="font-mono text-[11px] uppercase tracking-wider text-muted font-semibold">Electrical Rating</dt>
                <dd className="font-semibold text-ink mt-0.5">
                  {asset.electricalRating || "Unrated"}
                </dd>
              </div>

              <div>
                <dt className="font-mono text-[11px] uppercase tracking-wider text-muted font-semibold">Manufacturer</dt>
                <dd className="font-semibold text-ink mt-0.5">
                  {asset.manufacturer || "Explicitly Unknown"}
                </dd>
              </div>

              <div>
                <dt className="font-mono text-[11px] uppercase tracking-wider text-muted font-semibold">Model / Part No</dt>
                <dd className="font-semibold text-ink mt-0.5">
                  {asset.model || "Explicitly Unknown"}
                </dd>
              </div>

              <div>
                <dt className="font-mono text-[11px] uppercase tracking-wider text-muted font-semibold">Maintenance Cycle</dt>
                <dd className="font-semibold text-ink mt-0.5">
                  Every {asset.maintenanceIntervalDays || 90} days
                </dd>
              </div>

              <div>
                <dt className="font-mono text-[11px] uppercase tracking-wider text-muted font-semibold">Last Serviced</dt>
                <dd className="font-semibold text-ink mt-0.5">
                  {asset.lastMaintenanceDate || "Commissioning Baseline"}
                </dd>
              </div>
            </dl>

            {/* Compute Attributes if applicable */}
            {asset.computeAttributes && (
              <div className="rounded-[6px] border border-[#D7CEEA] p-4 bg-[#E9E4F4]/30">
                <span className="font-semibold text-[#3C2B6A] text-[13.5px] block mb-2.5">
                  Compute Commons Cluster Specification
                </span>
                <dl className="grid grid-cols-2 gap-3 text-[13px]">
                  <div>
                    <dt className="text-muted">IT Load Capacity</dt>
                    <dd className="font-semibold text-ink">{asset.computeAttributes.itLoadKw} kW</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Target PUE</dt>
                    <dd className="font-semibold text-ink">{asset.computeAttributes.targetPue}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted">Cooling Architecture</dt>
                    <dd className="font-semibold text-ink">{asset.computeAttributes.coolingTopology}</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ALERTS */}
        {activeTab === "alerts" && (
          <div className="space-y-3">
            {assetAlerts.length === 0 ? (
              <div className="rounded-[6px] border border-rule p-8 text-center text-muted bg-surface">
                <CheckCircle2 size={28} className="mx-auto text-accent mb-2.5" />
                <p className="font-semibold text-[15px] text-ink">Operating Within Nominal Envelope</p>
                <p className="text-[12.5px] mt-1 text-muted">No active alarms or watch state excursions detected on this asset.</p>
              </div>
            ) : (
              assetAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={[
                    "rounded-[6px] border p-3.5 space-y-2",
                    alert.severity === "alarm"
                      ? "border-[#EAC2BA] bg-[#F5DEDA]/40 text-ink"
                      : "border-[#EED7AA] bg-[#F8E7C8]/40 text-ink",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[13.5px] flex items-center gap-2">
                      <AlertTriangle size={15} className={alert.severity === "alarm" ? "text-danger" : "text-warn"} />
                      {alert.channelName} · {alert.severity.toUpperCase()}
                    </span>
                    <span className="font-mono text-[11px] text-muted font-medium">
                      {istTime(new Date(alert.detectionTimestamp))}
                    </span>
                  </div>
                  <p className="text-[12.5px] text-ink-soft leading-relaxed">{alert.explanation}</p>
                  <div className="rounded bg-surface p-2.5 border border-rule text-[12px]">
                    <span className="font-semibold text-accent block mb-0.5">Suggested Action:</span>
                    <span className="text-muted">{alert.suggestedAction}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 4: PROVENANCE */}
        {activeTab === "provenance" && (
          <div className="space-y-3.5">
            <div className="rounded-[6px] border border-rule p-4 bg-surface text-[13px] space-y-3">
              <div>
                <span className="text-muted block font-mono text-[11px] uppercase font-semibold">Evidence Classification</span>
                <span className="font-semibold text-ink text-[14px]">{asset.evidenceClassification}</span>
              </div>
              <div>
                <span className="text-muted block font-mono text-[11px] uppercase font-semibold">Source Document</span>
                <span className="font-semibold text-ink">{asset.sourceDocument || "Unspecified Field Record"}</span>
              </div>
              <div>
                <span className="text-muted block font-mono text-[11px] uppercase font-semibold">Responsible Organization</span>
                <span className="font-semibold text-ink">{asset.responsibleOrg || "Logos Field Operations"}</span>
              </div>
              <div>
                <span className="text-muted block font-mono text-[11px] uppercase font-semibold">Verification Status</span>
                <span className="font-semibold text-ink capitalize">{asset.verificationStatus}</span>
              </div>
              {asset.uncertaintyNotes && (
                <div>
                  <span className="text-muted block font-mono text-[11px] uppercase font-semibold">Uncertainty Notes</span>
                  <span className="text-ink italic">{asset.uncertaintyNotes}</span>
                </div>
              )}
            </div>

            {asset.carbonAccounting && (
              <div className="rounded-[6px] border border-rule p-3.5 bg-surface-subtle text-[12.5px]">
                <span className="font-semibold text-ink block mb-1">Carbon Accounting Integrity</span>
                <p className="text-muted leading-relaxed">
                  {asset.carbonAccounting.includedInCampusMeter
                    ? "Emissions aggregated at campus bulk meter — double counting prevention active."
                    : "Standalone asset-level accounting line."}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
