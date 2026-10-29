/* ============================================================
   DHUN TWIN OS — MASTERPLAN FEATURE INSPECTOR
   Contextual right-hand spatial inspector for selected masterplan
   zones, Phase One parcels, Dhun Loop, ecological thickets,
   water bodies, and associated digital-twin physical assets.
   ============================================================ */

import { useState } from "react";
import {
  MapPin,
  Compass,
  ArrowRight,
  Sparkles,
  Layers,
  Activity,
  Info,
  X,
} from "lucide-react";

import type { MapFeatureSelection } from "../gis/DhunGeographicMap";
import { DHUN_FIRST_PRINCIPLES } from "../gis/dhunGeoData";
import { useAssetRegistry } from "../registry/AssetRegistryContext";

interface MasterplanFeatureInspectorProps {
  feature: MapFeatureSelection | null;
  onClose: () => void;
  onSelectAsset?: (assetId: string) => void;
  onOpenArchiveModal?: () => void;
}

export default function MasterplanFeatureInspector({
  feature,
  onClose,
  onSelectAsset,
  onOpenArchiveModal,
}: MasterplanFeatureInspectorProps) {
  const { assets: registeredAssets } = useAssetRegistry();
  const [activePrincipleId, setActivePrincipleId] = useState<string | null>(null);

  if (!feature) {
    return (
      <aside className="w-full flex flex-col h-full bg-[#FFFDF8] border-l border-[#DCDDD2] text-[#202923]">
        <div className="p-4 border-b border-[#DCDDD2] bg-[#F4F2EA]/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass size={16} className="text-[#234638]" />
            <h3 className="font-semibold text-[14.5px] text-[#202923]">Masterplan Spatial Context</h3>
          </div>
          <span className="font-mono text-[10px] uppercase font-bold text-[#234638] bg-[#E5EBDD] px-2 py-0.5 rounded">
            500 Ac Concession
          </span>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-[13px] flex-1">
          {/* Core Masterplan Principles Card */}
          <div className="p-3.5 bg-white border border-[#DCDDD2] rounded-lg shadow-2xs">
            <h4 className="font-bold text-[13.5px] text-[#202923] mb-1 flex items-center gap-1.5">
              <Sparkles size={14} className="text-[#D9A441]" />
              The Five Key Moves
            </h4>
            <p className="text-[12px] text-[#68736C] leading-relaxed mb-3">
              Spatial organising framework of the Dhun Field Station in Chak Gulabpura, Rajasthan:
            </p>
            <ul className="space-y-2 text-[12px]">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#315D78] mt-1.5 shrink-0" />
                <span>
                  <strong className="text-[#202923]">1. Water First:</strong> Continuous blue-green catchment swales & 6 retention bodies storing monsoon yield.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#234638] mt-1.5 shrink-0" />
                <span>
                  <strong className="text-[#202923]">2. Connected Bioreserve:</strong> 400 acres (80%) inviolable ecological restoration core.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D9A441] mt-1.5 shrink-0" />
                <span>
                  <strong className="text-[#202923]">3. The Dhun Loop:</strong> 6m unifying mobility spine limited to 15 km/h zero-emissions transit.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C78F68] mt-1.5 shrink-0" />
                <span>
                  <strong className="text-[#202923]">4. Neighbourhoods & Anchors:</strong> Walkable residential clusters R1–R13 with local courtyards.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#A8B996] mt-1.5 shrink-0" />
                <span>
                  <strong className="text-[#202923]">5. Green Fingers:</strong> Radiating biophilic links bridging residences to the wild bioreserve.
                </span>
              </li>
            </ul>
          </div>

          {/* Statutory Envelope Metrics */}
          <div className="p-3.5 bg-[#F4F2EA]/40 border border-[#DCDDD2] rounded-lg">
            <div className="font-mono text-[10.5px] uppercase font-bold text-[#68736C] mb-2">
              Statutory Planning Ceilings
            </div>
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <div className="bg-white p-2 rounded border border-[#DCDDD2]">
                <div className="text-[#68736C] text-[11px]">Bioreserve Envelope</div>
                <div className="font-bold text-[#234638] text-[14px]">400.00 ac</div>
                <div className="font-mono text-[10px] text-[#68736C]">80.0% of site</div>
              </div>
              <div className="bg-white p-2 rounded border border-[#DCDDD2]">
                <div className="text-[#68736C] text-[11px]">Construction Limit</div>
                <div className="font-bold text-[#C78F68] text-[14px]">≤100.00 ac</div>
                <div className="font-mono text-[10px] text-[#68736C]">≤20.0% ceiling</div>
              </div>
              <div className="bg-white p-2 rounded border border-[#DCDDD2]">
                <div className="text-[#68736C] text-[11px]">Surveyed Area Sheet</div>
                <div className="font-bold text-[#315D78] text-[14px]">422.01 ac</div>
                <div className="font-mono text-[10px] text-[#68736C]">EDS Rev 2 (Page 10)</div>
              </div>
              <div className="bg-white p-2 rounded border border-[#DCDDD2]">
                <div className="text-[#68736C] text-[11px]">Outer Buffer Reserve</div>
                <div className="font-bold text-[#202923] text-[14px]">77.99 ac</div>
                <div className="font-mono text-[10px] text-[#68736C]">Unreconciled by design</div>
              </div>
            </div>
          </div>

          {/* Quick Selection Prompt */}
          <div className="p-3 bg-white border border-[#DCDDD2] rounded-lg text-center">
            <Info size={16} className="text-[#234638] mx-auto mb-1.5" />
            <p className="text-[12px] font-medium text-[#202923]">
              Click any parcel, the Dhun Loop, water bodies, or registered markers on the map to inspect spatial properties.
            </p>
            {onOpenArchiveModal && (
              <button
                type="button"
                onClick={onOpenArchiveModal}
                className="btn btn-sm btn-outline mt-2.5 w-full text-[11.5px] flex items-center justify-center gap-1.5"
              >
                <Layers size={13} />
                Open Masterplan Reference Archive
              </button>
            )}
          </div>
        </div>
      </aside>
    );
  }

  // Find associated registered physical assets located in or serving this parcel
  const associatedAssets = registeredAssets.filter((asset) => {
    const loc = asset.location?.parcelName || "";
    const featureName = feature.name || "";
    return (
      loc.toLowerCase().includes(featureName.toLowerCase()) ||
      featureName.toLowerCase().includes(loc.toLowerCase()) ||
      (feature.properties?.domain && asset.domain.toLowerCase() === feature.properties.domain.toLowerCase())
    );
  });

  // Find relevant First Principles based on classification
  const relevantPrinciples = DHUN_FIRST_PRINCIPLES.filter((p) => {
    const cat = (feature.category || "").toLowerCase();
    if (cat.includes("water")) return p.id === "p1" || p.id === "p9";
    if (cat.includes("energy")) return p.id === "p2" || p.id === "p11";
    if (cat.includes("residential") || cat.includes("typology")) return p.id === "p3" || p.id === "p8" || p.id === "p14";
    if (cat.includes("ecology") || cat.includes("bioreserve") || cat.includes("thicket")) return p.id === "p5" || p.id === "p12";
    if (cat.includes("mobility") || cat.includes("loop")) return p.id === "p2" || p.id === "p8" || p.id === "p10";
    return p.id === "p1" || p.id === "p3" || p.id === "p5" || p.id === "p12";
  });

  return (
    <aside className="w-full flex flex-col h-full bg-[#FFFDF8] border-l border-[#DCDDD2] text-[#202923] animate-fadeIn">
      {/* Header */}
      <div className="p-4 border-b border-[#DCDDD2] bg-[#F4F2EA]/70 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin size={16} className="text-[#234638] shrink-0" />
          <div className="min-w-0">
            <span className="font-mono text-[9.5px] uppercase font-bold text-[#68736C] tracking-wider block">
              {feature.category || "Masterplan Zone"}
            </span>
            <h3 className="font-bold text-[15px] text-[#202923] truncate leading-tight">
              {feature.name || "Selected Spatial Feature"}
            </h3>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[#68736C] hover:text-[#202923] p-1 rounded hover:bg-gray-200/50 cursor-pointer"
          aria-label="Close inspector"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-4 overflow-y-auto space-y-4 text-[13px] flex-1">
        {/* Metric & Area Schedule Badge */}
        <div className="p-3.5 bg-white border border-[#DCDDD2] rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-[11px] text-[#68736C] mb-1.5 font-mono">
            <span>Spatial Allocation</span>
            <span className="bg-[#E5EBDD] text-[#234638] font-bold px-1.5 py-0.2 rounded text-[10px]">
              {feature.source || "Approved Masterplan Schedule"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2">
            {feature.areaSqm ? (
              <div className="bg-[#F4F2EA]/40 p-2.5 rounded border border-[#DCDDD2]">
                <div className="text-[10.5px] uppercase text-[#68736C] font-mono font-medium">Area (m²)</div>
                <div className="font-mono text-[16px] font-bold text-[#202923] mt-0.5">
                  {feature.areaSqm.toLocaleString()} <span className="text-[11px] font-normal text-[#68736C]">m²</span>
                </div>
              </div>
            ) : null}

            {feature.areaAcres ? (
              <div className="bg-[#F4F2EA]/40 p-2.5 rounded border border-[#DCDDD2]">
                <div className="text-[10.5px] uppercase text-[#68736C] font-mono font-medium">Area (Acres)</div>
                <div className="font-mono text-[16px] font-bold text-[#234638] mt-0.5">
                  {feature.areaAcres.toFixed(2)} <span className="text-[11px] font-normal text-[#68736C]">ac</span>
                </div>
              </div>
            ) : null}

            {feature.properties?.widthMeters ? (
              <div className="bg-[#F4F2EA]/40 p-2.5 rounded border border-[#DCDDD2]">
                <div className="text-[10.5px] uppercase text-[#68736C] font-mono font-medium">Corridor Width</div>
                <div className="font-mono text-[16px] font-bold text-[#D9A441] mt-0.5">
                  {feature.properties.widthMeters} <span className="text-[11px] font-normal text-[#68736C]">m</span>
                </div>
              </div>
            ) : null}

            {feature.properties?.speedLimitKmh ? (
              <div className="bg-[#F4F2EA]/40 p-2.5 rounded border border-[#DCDDD2]">
                <div className="text-[10.5px] uppercase text-[#68736C] font-mono font-medium">Speed Limit</div>
                <div className="font-mono text-[16px] font-bold text-[#234638] mt-0.5">
                  {feature.properties.speedLimitKmh} <span className="text-[11px] font-normal text-[#68736C]">km/h</span>
                </div>
              </div>
            ) : null}
          </div>

          {feature.properties?.note && (
            <p className="mt-2 text-[12px] text-[#68736C] italic border-t border-[#DCDDD2]/60 pt-2">
              {feature.properties.note}
            </p>
          )}
        </div>

        {/* First Principles Alignment */}
        {relevantPrinciples.length > 0 && (
          <div className="p-3.5 bg-white border border-[#DCDDD2] rounded-lg shadow-2xs">
            <h4 className="font-bold text-[13px] text-[#202923] mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-[#234638]" />
                Aligned Dhun First Principles
              </span>
              <span className="font-mono text-[10px] text-[#68736C]">
                {relevantPrinciples.length} Principles
              </span>
            </h4>

            <div className="space-y-2">
              {relevantPrinciples.map((p) => {
                const isSelected = activePrincipleId === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setActivePrincipleId(isSelected ? null : p.id)}
                    className={`p-2 rounded border transition-all cursor-pointer text-[12px] ${
                      isSelected
                        ? "bg-[#E5EBDD] border-[#234638] text-[#15372D]"
                        : "bg-[#F4F2EA]/40 border-[#DCDDD2] text-[#202923] hover:border-[#234638]/50"
                    }`}
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span>{p.name}</span>
                      <span className="font-mono text-[9.5px] text-[#68736C] uppercase">{p.category}</span>
                    </div>
                    {isSelected && (
                      <p className="mt-1.5 text-[11.5px] text-[#202923] leading-relaxed pt-1 border-t border-[#234638]/20">
                        {p.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Associated Registered Physical Assets */}
        <div className="p-3.5 bg-white border border-[#DCDDD2] rounded-lg shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-bold text-[13px] text-[#202923] flex items-center gap-1.5">
              <Activity size={14} className="text-[#234638]" />
              Digital Twin Assets ({associatedAssets.length})
            </h4>
            <span className="font-mono text-[10px] text-[#68736C]">
              Real-time Instrumentation
            </span>
          </div>

          {associatedAssets.length === 0 ? (
            <p className="text-[12px] text-[#68736C] italic py-1">
              No registered sensors or meters are currently pinned inside this immediate boundary. Additional edge nodes may be commissioned in future phases.
            </p>
          ) : (
            <div className="divide-y divide-[#DCDDD2] border border-[#DCDDD2] rounded">
              {associatedAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="p-2.5 hover:bg-[#F4F2EA]/60 flex items-center justify-between transition-colors cursor-pointer"
                  onClick={() => onSelectAsset?.(asset.id)}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-[12.5px] text-[#202923] truncate">
                      {asset.name}
                    </div>
                    <div className="font-mono text-[10.5px] text-[#68736C]">
                      {asset.id} · {asset.domain}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-[#234638] font-semibold text-[11px] flex items-center gap-1 hover:underline shrink-0"
                  >
                    <span>Inspect</span>
                    <ArrowRight size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reference Sheet Link */}
        {onOpenArchiveModal && (
          <button
            type="button"
            onClick={onOpenArchiveModal}
            className="w-full btn btn-sm btn-outline flex items-center justify-center gap-2 py-2 text-[12px] text-[#234638] hover:bg-[#E5EBDD]"
          >
            <Layers size={13} />
            <span>View Reference Drawing in Masterplan Archive →</span>
          </button>
        )}
      </div>
    </aside>
  );
}
