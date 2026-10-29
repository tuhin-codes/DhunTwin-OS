/* ============================================================
   DHUN TWIN OS — ADD ASSET GUIDED WORKFLOW
   5-step guided wizard: Identify -> Configure -> Connect ->
   Validate -> Review & Activate. Persists to authoritative
   Asset Registry and synchronizes across all twin workspaces.
   ============================================================ */

import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Layers,
  MapPin,
  ShieldCheck,
  X,
} from "lucide-react";

import type {
  AssetDomain,
  CommissioningStatus,
  EvidenceClassification,
  RegisteredAsset,
  TelemetrySourceType,
} from "./types";
import { useAssetRegistry } from "./AssetRegistryContext";

interface AddAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssetAdded?: (asset: RegisteredAsset) => void;
}

const DOMAINS: AssetDomain[] = [
  "Energy",
  "Water",
  "Buildings",
  "Compute",
  "Ecology",
  "Mobility",
  "Waste",
];

const PARCELS = [
  { id: "p1", name: "Parcel 1 · Protected Bioreserve & Forest Spine" },
  { id: "p2", name: "Parcel 2 · Campus Center & Civic Core" },
  { id: "p3", name: "Parcel 3 · Innovation & Living Lab" },
  { id: "p4", name: "Parcel 4 · Residential Neighborhood & Paseos" },
  { id: "p5", name: "Parcel 5 · Infrastructure & Energy Spine" },
  { id: "p6", name: "Parcel 6 · Ecological Utility Basin" },
  { id: "", name: "Unassigned / Off-site (Will not be placed on map)" },
];

export default function AddAssetModal({
  isOpen,
  onClose,
  onAssetAdded,
}: AddAssetModalProps) {
  const { addAsset, assets } = useAssetRegistry();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Form State
  // Step 1: Identify
  const [name, setName] = useState("");
  const [customId, setCustomId] = useState("");
  const [domain, setDomain] = useState<AssetDomain>("Energy");
  const [type, setType] = useState("");
  const [subtype, setSubtype] = useState("");
  const [description, setDescription] = useState("");
  const [parcelId, setParcelId] = useState("p5");
  const [hasCoordinates, setHasCoordinates] = useState(false);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [canvasX, setCanvasX] = useState("");
  const [canvasY, setCanvasY] = useState("");

  // Step 2: Configure
  const [ratedCapacity, setRatedCapacity] = useState("");
  const [capacityUnit, setCapacityUnit] = useState("kW");
  const [electricalRating, setElectricalRating] = useState("415V 3-phase, 50Hz");
  const [opMin, setOpMin] = useState("");
  const [opMax, setOpMax] = useState("");
  const [alarmMin, setAlarmMin] = useState("");
  const [alarmMax, setAlarmMax] = useState("");
  const [normalMin, setNormalMin] = useState("");
  const [normalMax, setNormalMax] = useState("");
  const [thresholdSource, setThresholdSource] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [maintenanceInterval, setMaintenanceInterval] = useState("90");
  const [channelName, setChannelName] = useState("Active Power");
  const [channelUnit, setChannelUnit] = useState("kW");

  // Domain-specific: Compute
  const [itLoadKw, setItLoadKw] = useState("50");
  const [targetPue, setTargetPue] = useState("1.15");
  const [coolingTopology, setCoolingTopology] = useState("Direct-to-chip liquid cooling");
  const [batchEligible, setBatchEligible] = useState(true);

  // Domain-specific: Carbon
  const [embodiedCarbonT, setEmbodiedCarbonT] = useState("");
  const [includedInCampusMeter, setIncludedInCampusMeter] = useState(true);

  // Step 3: Connect
  const [telemetrySource, setTelemetrySource] = useState<TelemetrySourceType>("simulation");
  const [samplingInterval, setSamplingInterval] = useState("2");
  const [initialReading, setInitialReading] = useState("");
  const [evidenceTier, setEvidenceTier] = useState<EvidenceClassification>("Measured");
  const [sourceDoc, setSourceDoc] = useState("");
  const [responsibleOrg, setResponsibleOrg] = useState("Logos Field Operations");

  // Step 5: Status
  const [status, setStatus] = useState<CommissioningStatus>("Active");
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Auto-generate ID if empty
  const computedId =
    customId.trim() ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") ||
    "new-asset";

  // Step 4 Validations
  const idExists = assets.some(
    (a) => a.id.toLowerCase() === computedId.toLowerCase()
  );
  const isNameValid = name.trim().length >= 3;
  const isTypeValid = type.trim().length >= 2;
  const isCapacityValid =
    !isNaN(parseFloat(ratedCapacity)) && parseFloat(ratedCapacity) >= 0;
  const isUnitValid = capacityUnit.trim().length > 0;

  const numAlarmMin = alarmMin ? parseFloat(alarmMin) : undefined;
  const numAlarmMax = alarmMax ? parseFloat(alarmMax) : undefined;
  const numNormalMin = normalMin ? parseFloat(normalMin) : undefined;
  const numNormalMax = normalMax ? parseFloat(normalMax) : undefined;

  let thresholdError: string | null = null;
  if (numAlarmMin !== undefined && numAlarmMax !== undefined && numAlarmMin >= numAlarmMax) {
    thresholdError = "Alarm Min must be less than Alarm Max.";
  } else if (
    numNormalMin !== undefined &&
    numNormalMax !== undefined &&
    numNormalMin >= numNormalMax
  ) {
    thresholdError = "Normal Min must be less than Normal Max.";
  }

  const isFormValid =
    isNameValid &&
    isTypeValid &&
    isCapacityValid &&
    isUnitValid &&
    !idExists &&
    !thresholdError;

  const handleNext = () => {
    if (step < 5) setStep((s) => (s + 1) as any);
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => (s - 1) as any);
  };

  const handleSubmit = () => {
    setSubmitError(null);
    if (!isFormValid) {
      setSubmitError("Please resolve all validation errors before activating.");
      return;
    }

    const selectedParcel = PARCELS.find((p) => p.id === parcelId);

    const newAsset: RegisteredAsset = {
      id: computedId,
      name: name.trim(),
      type: type.trim(),
      subtype: subtype.trim() || undefined,
      domain,
      description: description.trim() || `${name} operating within the ${domain} domain.`,
      purpose: `${type} for Dhun field station ${domain} infrastructure.`,
      location: {
        parcelId: parcelId || undefined,
        parcelName: selectedParcel?.name || undefined,
        coordinates:
          hasCoordinates && lat && lng
            ? { lat: parseFloat(lat), lng: parseFloat(lng) }
            : undefined,
        mapPosition:
          hasCoordinates && canvasX && canvasY
            ? { x: parseFloat(canvasX), y: parseFloat(canvasY) }
            : undefined,
        hasVerifiedCoordinates: Boolean(
          hasCoordinates && ((lat && lng) || (canvasX && canvasY))
        ),
      },
      commissioningStatus: status,
      installationDate: new Date().toISOString().split("T")[0],
      ratedCapacity: parseFloat(ratedCapacity),
      capacityUnit: capacityUnit.trim(),
      electricalRating: electricalRating.trim() || undefined,
      operatingRange:
        opMin && opMax
          ? {
              min: parseFloat(opMin),
              max: parseFloat(opMax),
              optimalMin: normalMin ? parseFloat(normalMin) : undefined,
              optimalMax: normalMax ? parseFloat(normalMax) : undefined,
              unit: capacityUnit.trim(),
            }
          : undefined,
      manufacturer: manufacturer.trim() || undefined,
      model: model.trim() || undefined,
      serialNumber: serialNumber.trim() || undefined,
      maintenanceIntervalDays: maintenanceInterval
        ? parseInt(maintenanceInterval, 10)
        : undefined,
      lastMaintenanceDate: new Date().toISOString().split("T")[0],
      evidenceClassification: evidenceTier,
      sourceDocument: sourceDoc.trim() || undefined,
      sourceDate: new Date().toISOString().split("T")[0],
      responsibleOrg: responsibleOrg.trim() || "Logos Field Operations",
      verificationStatus:
        evidenceTier === "Measured" ? "verified" : "provisional",
      channels: [
        {
          id: `${computedId}-primary`,
          name: channelName.trim() || "Primary Flow",
          unit: channelUnit.trim() || capacityUnit.trim(),
          dataType: "numeric",
          expectedSamplingIntervalSeconds: parseInt(samplingInterval, 10) || 2,
          source: telemetrySource,
          alertThresholds: {
            normalMin: numNormalMin,
            normalMax: numNormalMax,
            alarmMin: numAlarmMin,
            alarmMax: numAlarmMax,
            thresholdSource: thresholdSource.trim() || "Asset Operating Manual",
            ruleDescription: `${name} operational deviation alert`,
            suggestedAction: "Inspect field telemetry and verify load distribution",
          },
          lastReading:
            initialReading && !isNaN(parseFloat(initialReading))
              ? {
                  assetId: computedId,
                  channelId: `${computedId}-primary`,
                  value: parseFloat(initialReading),
                  unit: channelUnit.trim() || capacityUnit.trim(),
                  timestamp: new Date().toISOString(),
                  source: telemetrySource,
                  quality: "good",
                }
              : undefined,
        },
      ],
      primaryChannelId: `${computedId}-primary`,
      carbonAccounting: {
        embodiedCarbonT: embodiedCarbonT ? parseFloat(embodiedCarbonT) : undefined,
        includedInCampusMeter,
        eligibleForLedger: true,
        calculationMethod: "Asset-level lifecycle attribution",
      },
      computeAttributes:
        domain === "Compute"
          ? {
              itLoadKw: parseFloat(itLoadKw) || 0,
              targetPue: parseFloat(targetPue) || 1.15,
              targetWue: 0.15,
              coolingTopology,
              batchQueueEligible: batchEligible,
            }
          : undefined,
    };

    const res = addAsset(newAsset);
    if (!res.success) {
      setSubmitError(res.error || "Failed to register asset.");
      return;
    }

    if (onAssetAdded) {
      onAssetAdded(newAsset);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-3 md:p-6 backdrop-blur-xs">
      <div className="flex h-full max-h-[720px] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-rule-strong bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rule bg-surface-subtle px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-accent text-white">
              <Layers size={15} />
            </div>
            <div>
              <h2 className="text-[13px] font-semibold text-ink">
                Add Asset to Authoritative Registry
              </h2>
              <p className="font-mono text-[10px] text-muted">
                Step {step} of 5 · Extensible Physical Twin Onboarding
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-quiet btn-sm px-2 text-muted hover:text-ink"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Wizard Progress Steps */}
        <div className="grid grid-cols-5 border-b border-rule bg-surface text-[11px] font-medium">
          {[
            { num: 1, label: "1. Identify" },
            { num: 2, label: "2. Configure" },
            { num: 3, label: "3. Connect" },
            { num: 4, label: "4. Validate" },
            { num: 5, label: "5. Activate" },
          ].map((item) => (
            <div
              key={item.num}
              className={[
                "flex items-center justify-center py-2.5 text-center transition-colors border-r last:border-r-0 border-rule",
                step === item.num
                  ? "bg-accent/10 font-semibold text-accent border-b-2 border-b-accent"
                  : step > item.num
                    ? "bg-surface text-ink-soft"
                    : "bg-surface-subtle/50 text-faint",
              ].join(" ")}
            >
              {item.label}
            </div>
          ))}
        </div>

        {/* Wizard Body */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 text-[12px]">
          {/* STEP 1: IDENTIFY */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="rounded border border-accent/20 bg-accent/5 p-3 text-ink-soft">
                <p className="font-medium text-accent">Asset Identity & Classification</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  Register the physical or ecological asset with its authoritative identifier, engineering domain, and masterplan location.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Asset Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full rounded border border-rule px-3 py-1.5 text-[12px] bg-surface focus:border-accent focus:outline-hidden"
                    placeholder="e.g. North Inverter Station 02"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Asset ID (Unique Slug)
                  </label>
                  <input
                    type="text"
                    className="w-full rounded border border-rule px-3 py-1.5 font-mono text-[11px] bg-surface-subtle focus:border-accent focus:outline-hidden"
                    placeholder={computedId}
                    value={customId}
                    onChange={(e) => setCustomId(e.target.value)}
                  />
                  <span className="text-[10px] text-faint mt-0.5 block">
                    Auto-generated if left empty. Must be unique.
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Domain <span className="text-danger">*</span>
                  </label>
                  <select
                    className="w-full rounded border border-rule px-3 py-1.5 text-[12px] bg-surface focus:border-accent focus:outline-hidden"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value as AssetDomain)}
                  >
                    {DOMAINS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Asset Type <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full rounded border border-rule px-3 py-1.5 text-[12px] bg-surface focus:border-accent focus:outline-hidden"
                    placeholder="e.g. Solar Photovoltaic / Inverter / Pump"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Subtype / Technology
                  </label>
                  <input
                    type="text"
                    className="w-full rounded border border-rule px-3 py-1.5 text-[12px] bg-surface focus:border-accent focus:outline-hidden"
                    placeholder="e.g. String Inverter / Centrifugal / LFP"
                    value={subtype}
                    onChange={(e) => setSubtype(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Associated Site Parcel
                  </label>
                  <select
                    className="w-full rounded border border-rule px-3 py-1.5 text-[12px] bg-surface focus:border-accent focus:outline-hidden"
                    value={parcelId}
                    onChange={(e) => setParcelId(e.target.value)}
                  >
                    {PARCELS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Description & Purpose
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded border border-rule px-3 py-1.5 text-[12px] bg-surface focus:border-accent focus:outline-hidden"
                  placeholder="Operational purpose, connected subsystem, and engineering role."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Coordinates Section */}
              <div className="rounded border border-rule bg-surface-subtle p-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-ink">Geospatial Coordinates</span>
                    <p className="text-[11px] text-muted">
                      Assets without verified coordinates appear in inventory but are NEVER placed at invented map locations.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-[12px] font-medium text-ink">
                    <input
                      type="checkbox"
                      checked={hasCoordinates}
                      onChange={(e) => setHasCoordinates(e.target.checked)}
                      className="rounded border-rule text-accent"
                    />
                    Provide verified coordinates
                  </label>
                </div>

                {hasCoordinates && (
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-rule pt-3">
                    <div>
                      <label className="block text-[10px] uppercase text-muted mb-1">Latitude</label>
                      <input
                        type="text"
                        placeholder="26.7125"
                        className="w-full rounded border border-rule px-2 py-1 text-[11px] font-mono"
                        value={lat}
                        onChange={(e) => setLat(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-muted mb-1">Longitude</label>
                      <input
                        type="text"
                        placeholder="75.8485"
                        className="w-full rounded border border-rule px-2 py-1 text-[11px] font-mono"
                        value={lng}
                        onChange={(e) => setLng(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-muted mb-1">Canvas X (0-800)</label>
                      <input
                        type="number"
                        placeholder="420"
                        className="w-full rounded border border-rule px-2 py-1 text-[11px] font-mono"
                        value={canvasX}
                        onChange={(e) => setCanvasX(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-muted mb-1">Canvas Y (0-500)</label>
                      <input
                        type="number"
                        placeholder="260"
                        className="w-full rounded border border-rule px-2 py-1 text-[11px] font-mono"
                        value={canvasY}
                        onChange={(e) => setCanvasY(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: CONFIGURE */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded border border-accent/20 bg-accent/5 p-3 text-ink-soft">
                <p className="font-medium text-accent">Engineering Ratings & Operating Envelopes</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  Specify rated capacity, electrical ratings, operating limits, and configured alert thresholds.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Rated Capacity <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    className="w-full rounded border border-rule px-3 py-1.5 text-[12px] bg-surface focus:border-accent focus:outline-hidden"
                    placeholder="e.g. 500"
                    value={ratedCapacity}
                    onChange={(e) => setRatedCapacity(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Capacity Unit <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full rounded border border-rule px-3 py-1.5 text-[12px] bg-surface focus:border-accent focus:outline-hidden"
                    placeholder="kW / kWh / kL/day / m²"
                    value={capacityUnit}
                    onChange={(e) => setCapacityUnit(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Electrical Rating
                  </label>
                  <input
                    type="text"
                    className="w-full rounded border border-rule px-3 py-1.5 text-[12px] bg-surface focus:border-accent focus:outline-hidden"
                    placeholder="415V 3-phase, 50Hz"
                    value={electricalRating}
                    onChange={(e) => setElectricalRating(e.target.value)}
                  />
                </div>
              </div>

              {/* Operating Limits and Alert Thresholds */}
              <div className="rounded border border-rule p-3.5 bg-surface-subtle">
                <h3 className="font-semibold text-ink text-[12px] mb-2">
                  Operating Envelope & Alert Thresholds
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase text-danger font-semibold mb-1">
                      Alarm Min (Lower Limit)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 10"
                      className="w-full rounded border border-rule px-2 py-1 text-[11px]"
                      value={alarmMin}
                      onChange={(e) => setAlarmMin(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-accent font-semibold mb-1">
                      Normal Min (Watch)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 50"
                      className="w-full rounded border border-rule px-2 py-1 text-[11px]"
                      value={normalMin}
                      onChange={(e) => setNormalMin(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-accent font-semibold mb-1">
                      Normal Max (Watch)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 400"
                      className="w-full rounded border border-rule px-2 py-1 text-[11px]"
                      value={normalMax}
                      onChange={(e) => setNormalMax(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-danger font-semibold mb-1">
                      Alarm Max (Critical Upper)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 480"
                      className="w-full rounded border border-rule px-2 py-1 text-[11px]"
                      value={alarmMax}
                      onChange={(e) => setAlarmMax(e.target.value)}
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-[10px] uppercase text-muted mb-1">
                    Threshold Source / Standard Reference
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CERC IEGC 2023 Grid Regulations or Manufacturer Spec"
                    className="w-full rounded border border-rule px-2.5 py-1 text-[11px]"
                    value={thresholdSource}
                    onChange={(e) => setThresholdSource(e.target.value)}
                  />
                </div>
              </div>

              {/* Hardware specifications */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-muted mb-1">Manufacturer</label>
                  <input
                    type="text"
                    placeholder="e.g. Schneider Electric"
                    className="w-full rounded border border-rule px-2.5 py-1 text-[11px]"
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-muted mb-1">Model / Part No.</label>
                  <input
                    type="text"
                    placeholder="e.g. Trihal 1250kVA"
                    className="w-full rounded border border-rule px-2.5 py-1 text-[11px]"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-muted mb-1">Serial Number</label>
                  <input
                    type="text"
                    placeholder="e.g. SN-SCH-2026-001"
                    className="w-full rounded border border-rule px-2.5 py-1 text-[11px]"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-muted mb-1">Maintenance Interval (Days)</label>
                  <input
                    type="number"
                    placeholder="90"
                    className="w-full rounded border border-rule px-2.5 py-1 text-[11px]"
                    value={maintenanceInterval}
                    onChange={(e) => setMaintenanceInterval(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-muted mb-1">Operating Min ({capacityUnit})</label>
                  <input
                    type="number"
                    placeholder="e.g. 0"
                    className="w-full rounded border border-rule px-2.5 py-1 text-[11px]"
                    value={opMin}
                    onChange={(e) => setOpMin(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-muted mb-1">Operating Max ({capacityUnit})</label>
                  <input
                    type="number"
                    placeholder="e.g. 500"
                    className="w-full rounded border border-rule px-2.5 py-1 text-[11px]"
                    value={opMax}
                    onChange={(e) => setOpMax(e.target.value)}
                  />
                </div>
              </div>

              {/* Primary Channel Configuration */}
              <div className="rounded border border-rule p-3 bg-surface-subtle">
                <span className="font-semibold text-ink text-[11px] block mb-2">Primary Telemetry Channel</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase text-muted mb-1">Channel Name</label>
                    <input
                      type="text"
                      className="w-full rounded border border-rule px-2.5 py-1 text-[11px]"
                      value={channelName}
                      onChange={(e) => setChannelName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-muted mb-1">Channel Unit</label>
                    <input
                      type="text"
                      className="w-full rounded border border-rule px-2.5 py-1 text-[11px]"
                      value={channelUnit}
                      onChange={(e) => setChannelUnit(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Compute Domain Levers */}
              {domain === "Compute" && (
                <div className="rounded border border-rule p-3.5 bg-accent/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Cpu size={14} className="text-accent" />
                    <span className="font-semibold text-accent text-[12px]">Compute Commons Attributes</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase text-muted mb-1">IT Load (kW)</label>
                      <input
                        type="number"
                        className="w-full rounded border border-rule px-2 py-1 text-[11px]"
                        value={itLoadKw}
                        onChange={(e) => setItLoadKw(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-muted mb-1">Target PUE</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full rounded border border-rule px-2 py-1 text-[11px]"
                        value={targetPue}
                        onChange={(e) => setTargetPue(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center pt-4">
                      <label className="flex items-center gap-2 text-[11px] text-ink cursor-pointer">
                        <input
                          type="checkbox"
                          checked={batchEligible}
                          onChange={(e) => setBatchEligible(e.target.checked)}
                          className="rounded text-accent"
                        />
                        Eligible for Carbon Batch Queue
                      </label>
                    </div>
                    <div className="col-span-3">
                      <label className="block text-[10px] uppercase text-muted mb-1">Cooling Architecture</label>
                      <input
                        type="text"
                        className="w-full rounded border border-rule px-2 py-1 text-[11px]"
                        value={coolingTopology}
                        onChange={(e) => setCoolingTopology(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Capital Embodied Carbon Input */}
              <div className="rounded border border-rule p-3 bg-surface-subtle">
                <label className="block text-[10px] uppercase text-muted mb-1">
                  Upfront Embodied Carbon (Optional tCO₂e)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 120"
                  className="w-full rounded border border-rule px-2.5 py-1 text-[11px]"
                  value={embodiedCarbonT}
                  onChange={(e) => setEmbodiedCarbonT(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* STEP 3: CONNECT */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded border border-accent/20 bg-accent/5 p-3 text-ink-soft">
                <p className="font-medium text-accent">Telemetry Connection & Provenance</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  An asset registered without a physical telemetry source will be marked as Simulated or Stale, never falsely presented as verified live.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">
                  Telemetry Source Adapter
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {[
                    { id: "physical_sensor", title: "Physical Sensor", desc: "Live field instrument with direct telemetry" },
                    { id: "gateway", title: "Field Gateway", desc: "Modbus / MQTT / BACnet aggregator" },
                    { id: "simulation", title: "Simulation Engine", desc: "Deterministic physics model" },
                    { id: "manual_entry", title: "Manual Entry", desc: "Logbook entry or operator inspection" },
                    { id: "imported_data", title: "CSV Data Import", desc: "Batch telemetry dataset" },
                  ].map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => setTelemetrySource(s.id as TelemetrySourceType)}
                      className={[
                        "p-3 rounded border text-left transition-all",
                        telemetrySource === s.id
                          ? "border-accent bg-accent/10 text-ink shadow-xs"
                          : "border-rule bg-surface text-ink-soft hover:bg-surface-subtle",
                      ].join(" ")}
                    >
                      <div className="font-medium text-[12px]">{s.title}</div>
                      <div className="text-[10px] text-muted mt-0.5">{s.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual reading entry */}
              {telemetrySource === "manual_entry" && (
                <div className="rounded border border-rule p-3 bg-surface-subtle">
                  <label className="block text-[11px] font-semibold uppercase text-muted mb-1">
                    Initial Manual Reading Value ({channelUnit || capacityUnit})
                  </label>
                  <input
                    type="number"
                    className="w-full rounded border border-rule px-3 py-1.5 text-[12px]"
                    placeholder="Enter current reading"
                    value={initialReading}
                    onChange={(e) => setInitialReading(e.target.value)}
                  />
                </div>
              )}

              <div className="rounded border border-rule p-3 bg-surface-subtle">
                <label className="block text-[11px] font-semibold uppercase text-muted mb-1">
                  Expected Sampling Interval (Seconds)
                </label>
                <input
                  type="number"
                  className="w-full rounded border border-rule px-3 py-1.5 text-[12px]"
                  value={samplingInterval}
                  onChange={(e) => setSamplingInterval(e.target.value)}
                />
              </div>

              {/* Evidence Provenance Tier */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Evidence Classification
                  </label>
                  <select
                    className="w-full rounded border border-rule px-3 py-1.5 text-[12px] bg-surface"
                    value={evidenceTier}
                    onChange={(e) => setEvidenceTier(e.target.value as EvidenceClassification)}
                  >
                    <option value="Measured">Measured (Calibrated physical meter)</option>
                    <option value="Reported">Reported (Field station logbook / utility bill)</option>
                    <option value="Calculated">Calculated (Derived from engineering equation)</option>
                    <option value="Assumed">Assumed (Stated planning assumption)</option>
                    <option value="Simulated">Simulated (Deterministic twin model output)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Responsible Organization / Engineer
                  </label>
                  <input
                    type="text"
                    className="w-full rounded border border-rule px-3 py-1.5 text-[12px]"
                    value={responsibleOrg}
                    onChange={(e) => setResponsibleOrg(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Source Document / Spec Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. As-Built Drawing SLD-04 or Commissioning Dossier"
                  className="w-full rounded border border-rule px-3 py-1.5 text-[12px]"
                  value={sourceDoc}
                  onChange={(e) => setSourceDoc(e.target.value)}
                />
              </div>

              {/* Carbon Double Counting Safeguard */}
              <div className="rounded border border-rule p-3 bg-surface-subtle flex items-start gap-3">
                <input
                  type="checkbox"
                  id="doubleCountingCheck"
                  checked={includedInCampusMeter}
                  onChange={(e) => setIncludedInCampusMeter(e.target.checked)}
                  className="mt-0.5 rounded text-accent"
                />
                <label htmlFor="doubleCountingCheck" className="text-[11px] text-ink cursor-pointer">
                  <span className="font-medium block">Included in Campus Bulk Substation Meter</span>
                  <span className="text-muted block mt-0.5">
                    When checked, electrical carbon emissions are aggregated under the campus incomer to prevent double-counting in the Carbon Ledger.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* STEP 4: VALIDATE */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded border border-accent/20 bg-accent/5 p-3 text-ink-soft">
                <p className="font-medium text-accent">Automated Engineering Validation Audit</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  Checking required fields, unit consistency, channel bounds, identifier collisions, and boundary criteria.
                </p>
              </div>

              <div className="divide-y divide-rule border border-rule rounded bg-surface">
                {/* Check 1: Name and Type */}
                <div className="flex items-center justify-between p-3">
                  <div>
                    <span className="font-medium text-ink">Asset Identity & Required Fields</span>
                    <p className="text-[11px] text-muted">Name, domain, and equipment type defined.</p>
                  </div>
                  {isNameValid && isTypeValid ? (
                    <span className="flex items-center gap-1.5 text-accent font-medium text-[11px]">
                      <CheckCircle2 size={14} /> Validated
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-danger font-medium text-[11px]">
                      <AlertTriangle size={14} /> Missing required fields
                    </span>
                  )}
                </div>

                {/* Check 2: Identifier collision */}
                <div className="flex items-center justify-between p-3">
                  <div>
                    <span className="font-medium text-ink">Unique Identifier Collision</span>
                    <p className="text-[11px] text-muted">Unique ID in registry: <code className="font-mono">{computedId}</code></p>
                  </div>
                  {!idExists ? (
                    <span className="flex items-center gap-1.5 text-accent font-medium text-[11px]">
                      <CheckCircle2 size={14} /> Unique ID Available
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-danger font-medium text-[11px]">
                      <AlertTriangle size={14} /> ID Already Exists
                    </span>
                  )}
                </div>

                {/* Check 3: Rated Capacity & Units */}
                <div className="flex items-center justify-between p-3">
                  <div>
                    <span className="font-medium text-ink">Rated Capacity & Physical Units</span>
                    <p className="text-[11px] text-muted">Valid non-negative value ({ratedCapacity || "0"} {capacityUnit})</p>
                  </div>
                  {isCapacityValid && isUnitValid ? (
                    <span className="flex items-center gap-1.5 text-accent font-medium text-[11px]">
                      <CheckCircle2 size={14} /> Conforms to Physics
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-danger font-medium text-[11px]">
                      <AlertTriangle size={14} /> Invalid capacity or unit
                    </span>
                  )}
                </div>

                {/* Check 4: Threshold Ordering */}
                <div className="flex items-center justify-between p-3">
                  <div>
                    <span className="font-medium text-ink">Operating Limit Envelopes</span>
                    <p className="text-[11px] text-muted">Alarm min &lt; Normal min &lt; Normal max &lt; Alarm max</p>
                  </div>
                  {!thresholdError ? (
                    <span className="flex items-center gap-1.5 text-accent font-medium text-[11px]">
                      <CheckCircle2 size={14} /> Envelopes Consistent
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-danger font-medium text-[11px]">
                      <AlertTriangle size={14} /> {thresholdError}
                    </span>
                  )}
                </div>

                {/* Check 5: Map Coordinates Integrity */}
                <div className="flex items-center justify-between p-3">
                  <div>
                    <span className="font-medium text-ink">Spatial Mapping Placement</span>
                    <p className="text-[11px] text-muted">
                      {hasCoordinates ? "Coordinates verified — will appear on Masterplan map." : "No coordinates — will list in inventory without fabricated map marker."}
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 text-muted font-medium text-[11px]">
                    <MapPin size={14} /> {hasCoordinates ? "Spatial" : "Non-spatial"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW & ACTIVATE */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="rounded border border-accent/20 bg-accent/5 p-3 text-ink-soft">
                <p className="font-medium text-accent">Review Specifications & Set Operational Status</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  Choose the commissioning status. An asset without verified live telemetry will never be falsely claimed as active live.
                </p>
              </div>

              {/* Summary Card */}
              <div className="rounded border border-rule bg-surface p-4 text-[12px] space-y-3">
                <div className="flex items-center justify-between border-b border-rule pb-2.5">
                  <div>
                    <h3 className="font-semibold text-ink text-[14px]">{name}</h3>
                    <p className="font-mono text-[10px] text-muted">
                      ID: {computedId} · Domain: {domain} · Type: {type}
                    </p>
                  </div>
                  <span className="rounded bg-accent/10 px-2 py-0.5 font-mono text-[10px] uppercase font-semibold text-accent">
                    {evidenceTier}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                  <div>
                    <span className="text-muted block">Rated Capacity</span>
                    <span className="font-semibold text-ink">{ratedCapacity} {capacityUnit}</span>
                  </div>
                  <div>
                    <span className="text-muted block">Telemetry Source</span>
                    <span className="font-semibold text-ink capitalize">{telemetrySource.replace("_", " ")}</span>
                  </div>
                  <div>
                    <span className="text-muted block">Parcel Location</span>
                    <span className="font-semibold text-ink">{PARCELS.find(p => p.id === parcelId)?.name.split("·")[0] || "Unassigned"}</span>
                  </div>
                  <div>
                    <span className="text-muted block">Responsible Org</span>
                    <span className="font-semibold text-ink">{responsibleOrg}</span>
                  </div>
                </div>
              </div>

              {/* Commissioning Status Picker */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">
                  Select Commissioning Status
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  {[
                    { id: "Active", title: "Active", desc: "Operational and monitoring" },
                    { id: "Commissioning", title: "Commissioning", desc: "Under field testing" },
                    { id: "Planned", title: "Planned", desc: "Future phase infrastructure" },
                    { id: "Decommissioned", title: "Decommissioned", desc: "Retired from service" },
                  ].map((st) => (
                    <button
                      type="button"
                      key={st.id}
                      onClick={() => setStatus(st.id as CommissioningStatus)}
                      className={[
                        "p-2.5 rounded border text-left transition-all",
                        status === st.id
                          ? "border-accent bg-accent/10 text-ink shadow-xs"
                          : "border-rule bg-surface text-ink-soft hover:bg-surface-subtle",
                      ].join(" ")}
                    >
                      <div className="font-semibold text-[11px]">{st.title}</div>
                      <div className="text-[9.5px] text-muted mt-0.5">{st.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {submitError && (
                <div className="rounded border border-danger/30 bg-danger/10 p-3 text-danger text-[11px] flex items-center gap-2">
                  <AlertTriangle size={15} />
                  <span>{submitError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="flex items-center justify-between border-t border-rule bg-surface-subtle px-5 py-3">
          <button
            type="button"
            onClick={step === 1 ? onClose : handleBack}
            className="btn btn-sm btn-quiet"
          >
            <ArrowLeft size={13} />
            {step === 1 ? "Cancel" : "Back"}
          </button>

          <div className="flex items-center gap-2">
            {step < 5 ? (
              <button
                type="button"
                onClick={handleNext}
                className="btn btn-sm btn-accent"
              >
                Next
                <ArrowRight size={13} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                className="btn btn-sm btn-accent"
              >
                <ShieldCheck size={14} />
                Save & Register Asset
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
