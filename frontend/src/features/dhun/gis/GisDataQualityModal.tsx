/* ============================================================
   DHUN TWIN OS — GIS DATA QUALITY & LAYER PROVENANCE MODAL
   Displays comprehensive metadata, coordinate reference systems,
   survey authorities, and the 500ac vs 422.01ac reconciliation report.
   ============================================================ */

import { useState } from "react";
import {
  CheckCircle2,
  Database,
  Layers,
  MapPin,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";

import {
  BOUNDARY_RECONCILIATION,
  GIS_LAYERS_REGISTRY,
} from "./gisMetadata";
import type { GisVerificationStatus } from "./types";
import { useAssetRegistry } from "../registry/AssetRegistryContext";

interface GisDataQualityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GisDataQualityModal({
  isOpen,
  onClose,
}: GisDataQualityModalProps) {
  const { assets } = useAssetRegistry();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  if (!isOpen) return null;

  const mappedAssets = assets.filter(
    (a) => a.location?.hasVerifiedCoordinates && a.location.coordinates
  );
  const unmappedAssets = assets.filter(
    (a) => !a.location?.hasVerifiedCoordinates || !a.location.coordinates
  );

  const filteredLayers = GIS_LAYERS_REGISTRY.filter((layer) => {
    const matchesSearch =
      layer.name.toLowerCase().includes(search.toLowerCase()) ||
      layer.sourceDocument.toLowerCase().includes(search.toLowerCase()) ||
      layer.category.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      filterStatus === "all" || layer.verificationStatus === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const statusStyles: Record<
    GisVerificationStatus,
    { bg: string; text: string; border: string }
  > = {
    "Verified source": {
      bg: "bg-[#DCECE3]",
      text: "text-[#12482E]",
      border: "border-[#C5DFD0]",
    },
    "Imported, not verified": {
      bg: "bg-[#DCEAF5]",
      text: "text-[#103E66]",
      border: "border-[#C0DAEC]",
    },
    Provisional: {
      bg: "bg-[#F8E7C8]",
      text: "text-[#6B4706]",
      border: "border-[#EED7AA]",
    },
    "Missing source": {
      bg: "bg-[#F5DEDA]",
      text: "text-[#732117]",
      border: "border-[#EAC2BA]",
    },
    Superseded: {
      bg: "bg-[#EEF2EE]",
      text: "text-muted",
      border: "border-rule",
    },
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gis-data-quality-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-lg border border-rule bg-surface shadow-2xl overflow-hidden text-[13px]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-rule bg-[#173D32] px-6 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <Layers size={20} className="text-[#64A882]" />
            <div>
              <h2
                id="gis-data-quality-title"
                className="text-[17px] font-semibold tracking-wide"
              >
                Dhun Field Station — GIS Data Quality & Layer Provenance
              </h2>
              <p className="font-mono text-[11px] text-white/70">
                Spatial coordinate reference systems · Cadastral source documentation · Boundary reconciliation
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Boundary Reconciliation Report (Section 5 Requirement) */}
          <section className="panel p-5 bg-[#EEF2EE]/40 border-l-4 border-l-[#173D32] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-[#12482E]" />
                <h3 className="text-[15.5px] font-semibold text-ink">
                  Boundary Area Reconciliation: 500 Acres vs 422.01 Acres
                </h3>
              </div>
              <span className="font-mono text-[11px] uppercase font-bold text-[#6B4706] bg-[#F8E7C8] border border-[#EED7AA] px-2.5 py-0.5 rounded">
                {BOUNDARY_RECONCILIATION.reconciliationStatus}
              </span>
            </div>

            <p className="text-[13px] text-ink leading-relaxed">
              {BOUNDARY_RECONCILIATION.explanation}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1 text-[12px] font-mono">
              <div className="rounded border border-rule bg-surface p-2.5">
                <span className="text-muted block text-[10.5px] uppercase">
                  Stated Project Area
                </span>
                <strong className="text-ink text-[14px]">
                  {BOUNDARY_RECONCILIATION.statedProjectAreaAcres.toFixed(1)} acres
                </strong>{" "}
                <span className="text-muted">(2,023,428 m²)</span>
              </div>

              <div className="rounded border border-[#C0DAEC] bg-[#DCEAF5]/50 p-2.5">
                <span className="text-[#103E66] block text-[10.5px] uppercase font-bold">
                  Surveyed Cluster Area
                </span>
                <strong className="text-[#103E66] text-[14px]">
                  {BOUNDARY_RECONCILIATION.surveyedClusterAreaAcres.toFixed(2)} acres
                </strong>{" "}
                <span className="text-[#103E66]">(1,707,800 m²)</span>
              </div>

              <div className="rounded border border-[#EED7AA] bg-[#F8E7C8]/50 p-2.5">
                <span className="text-[#6B4706] block text-[10.5px] uppercase font-bold">
                  Outer Buffer Difference
                </span>
                <strong className="text-[#6B4706] text-[14px]">
                  +{BOUNDARY_RECONCILIATION.differenceAcres.toFixed(2)} acres
                </strong>{" "}
                <span className="text-[#6B4706]">
                  ({BOUNDARY_RECONCILIATION.differencePercentage}%)
                </span>
              </div>

              <div className="rounded border border-rule bg-surface p-2.5">
                <span className="text-muted block text-[10.5px] uppercase">
                  Coordinate Reference System
                </span>
                <span className="text-ink font-semibold truncate block">
                  EPSG:4326 (WGS 84)
                </span>
                <span className="text-[10px] text-muted">UTM Zone 43N projected</span>
              </div>
            </div>

            <div className="text-[11.5px] text-muted space-y-1 pt-1 font-mono">
              <div>
                <strong>Primary Survey Source:</strong> {BOUNDARY_RECONCILIATION.sourceDocumentSurvey}
              </div>
              <div>
                <strong>Concession Baseline:</strong> {BOUNDARY_RECONCILIATION.sourceDocumentMasterplan}
              </div>
            </div>
          </section>

          {/* Section 2: Asset Geographic Registration Summary */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded border border-[#C5DFD0] bg-[#DCECE3]/30 p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <CheckCircle2 size={16} className="text-[#12482E]" />
                <h4 className="font-semibold text-ink text-[14px]">
                  Geographically Mapped Assets ({mappedAssets.length})
                </h4>
              </div>
              <p className="text-[12px] text-muted mb-2">
                Assets with verified survey coordinates plotted accurately on the map.
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {mappedAssets.map((a) => (
                  <span
                    key={a.id}
                    className="font-mono text-[10.5px] bg-white border border-[#C5DFD0] px-2 py-0.5 rounded text-ink"
                  >
                    {a.name} ({a.location?.coordinates?.lat.toFixed(4)}, {a.location?.coordinates?.lng.toFixed(4)})
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded border border-rule bg-surface-subtle p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <MapPin size={16} className="text-muted" />
                <h4 className="font-semibold text-ink text-[14px]">
                  Unmapped Assets ({unmappedAssets.length})
                </h4>
              </div>
              <p className="text-[12px] text-muted mb-2">
                Assets pending field GPS survey. Retained in registry with zero invented coordinates.
              </p>
              {unmappedAssets.length === 0 ? (
                <span className="text-[12px] text-[#12482E] font-medium">
                  ✓ All registered assets have verified coordinates.
                </span>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {unmappedAssets.map((a) => (
                    <span
                      key={a.id}
                      className="font-mono text-[10.5px] bg-white border border-rule px-2 py-0.5 rounded text-muted"
                    >
                      {a.name} ({a.id}) · Unmapped
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Section 3: Traceable Layer Metadata Table */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-semibold text-ink flex items-center gap-2">
                  <Database size={16} className="text-accent" />
                  <span>Authoritative GIS Layer Provenance Schedule</span>
                </h3>
                <p className="text-[12px] text-muted mt-0.5">
                  Complete technical specification for all active spatial vectors and raster basemaps.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative min-w-[200px]">
                  <Search
                    size={13}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <input
                    type="text"
                    placeholder="Search layers..."
                    className="w-full rounded border border-rule bg-surface pl-8 pr-2.5 py-1 text-[12px] text-ink focus:border-accent focus:outline-hidden"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <select
                  className="rounded border border-rule bg-surface px-2.5 py-1 text-[12px] text-ink font-medium focus:border-accent focus:outline-hidden"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">All Verification Tiers</option>
                  <option value="Verified source">Verified Source</option>
                  <option value="Provisional">Provisional</option>
                  <option value="Imported, not verified">Imported, Not Verified</option>
                </select>
              </div>
            </div>

            <div className="border border-rule rounded overflow-hidden">
              <table className="w-full text-left text-[12.5px]">
                <thead className="bg-surface-subtle border-b border-rule font-mono text-[11px] text-muted uppercase">
                  <tr>
                    <th className="py-2.5 px-3.5">Layer Name & Category</th>
                    <th className="py-2.5 px-3.5">Source Document & Authority</th>
                    <th className="py-2.5 px-3.5">Survey Date</th>
                    <th className="py-2.5 px-3.5">CRS & Type</th>
                    <th className="py-2.5 px-3.5">Area / Features</th>
                    <th className="py-2.5 px-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule font-mono text-[12px]">
                  {filteredLayers.map((layer) => {
                    const st = statusStyles[layer.verificationStatus];
                    return (
                      <tr key={layer.id} className="hover:bg-surface-subtle/50">
                        <td className="py-2.5 px-3.5 font-sans">
                          <strong className="text-ink block text-[13px]">
                            {layer.name}
                          </strong>
                          <span className="font-mono text-[10.5px] text-muted">
                            {layer.category}
                          </span>
                        </td>

                        <td className="py-2.5 px-3.5 font-sans">
                          <span className="text-ink block leading-snug">
                            {layer.sourceDocument}
                          </span>
                          <span className="font-mono text-[10.5px] text-muted">
                            {layer.sourceAuthority}
                          </span>
                        </td>

                        <td className="py-2.5 px-3.5 text-muted">
                          {layer.surveyDate}
                        </td>

                        <td className="py-2.5 px-3.5">
                          <span className="text-ink block">{layer.crs}</span>
                          <span className="text-muted text-[10.5px]">
                            {layer.geometryType}
                          </span>
                        </td>

                        <td className="py-2.5 px-3.5">
                          {layer.areaAcres ? (
                            <span>
                              <strong>{layer.areaAcres.toFixed(1)}</strong> ac{" "}
                              <span className="text-muted">
                                ({layer.areaSqm?.toLocaleString()} m²)
                              </span>
                            </span>
                          ) : (
                            <span>{layer.featureCount} features</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10.5px] font-semibold uppercase border ${st.bg} ${st.text} ${st.border}`}
                          >
                            {layer.verificationStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-rule bg-surface-subtle px-6 py-3.5 flex items-center justify-between">
          <div className="font-mono text-[11.5px] text-muted">
            Anchored to Chak Gulabpura, Rajasthan (26.719597° N, 75.593443° E) · EPSG:4326
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-sm btn-primary"
          >
            Close Provenance Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
