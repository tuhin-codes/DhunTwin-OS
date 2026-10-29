/* ============================================================
   DHUN TWIN OS — CAMPUS MASTERPLAN SHOWCASE WORKSPACE
   Spatial-first environmental intelligence for the Dhun Field Station
   in Chak Gulabpura, Rajasthan. Integrates MapLibre GIS, Phase One
   zoning, blue-green infrastructure, Dhun Loop mobility spine,
   contextual spatial inspection, and digital-twin asset telemetry.
   ============================================================ */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Globe,
  Compass,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Activity,
  Zap,
} from "lucide-react";

import PageHeader from "../features/dhun/components/PageHeader";
import MetricStrip from "../features/dhun/components/MetricStrip";
import CampusMap from "../features/dhun/components/CampusMap";
import DhunGeographicMap, { type MapFeatureSelection } from "../features/dhun/gis/DhunGeographicMap";
import EvidenceBadge from "../features/dhun/components/EvidenceBadge";
import StatusMark from "../features/dhun/components/StatusMark";
import ZoneTable from "../features/dhun/components/ZoneTable";
import MasterplanFeatureInspector from "../features/dhun/components/MasterplanFeatureInspector";
import MasterplanReferenceModal from "../features/dhun/components/MasterplanReferenceModal";

import { useTwin } from "../features/dhun/context/useTwin";
import { useAssetRegistry } from "../features/dhun/registry/AssetRegistryContext";
import AddAssetModal from "../features/dhun/registry/AddAssetModal";
import AssetDetailInspector from "../features/dhun/registry/AssetDetailInspector";

import { ZONES } from "../features/dhun/data/zones";
import {
  topPressure,
  zoneLevel,
  zonePressures,
} from "../features/dhun/engine/zoneStatus";
import { landscapeWaterKlYr } from "../features/dhun/engine/simulation";
import { PHASES } from "../features/dhun/data/phases";
import { GRID_FACTOR } from "../features/dhun/data/constants";
import { istTime } from "../features/dhun/lib/clock";
import { num, percent, tonnes } from "../features/dhun/lib/format";

export default function Campus() {
  const { snapshot, now, phase } = useTwin();
  const { summary, assets } = snapshot;
  const { assets: registeredAssets, getAssetById } = useAssetRegistry();

  const [selectedId, setSelectedId] = useState<string>("grid-hub");
  const [selectedFeature, setSelectedFeature] = useState<MapFeatureSelection | null>(null);
  const [mapMode, setMapMode] = useState<"gis" | "schematic">("gis");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [operationalPanelOpen, setOperationalPanelOpen] = useState(true);

  const registeredSelected = selectedId ? getAssetById(selectedId) : undefined;

  const pressures = useMemo(
    () => zonePressures(summary, assets),
    [summary, assets]
  );

  const issues = useMemo(
    () =>
      ZONES.map((zone) => {
        const level = zoneLevel(pressures[zone.id]);

        return {
          zone,
          level,
          reason: topPressure(
            pressures[zone.id],
            level
          ).text,
          asset: assets.find(
            (item) => item.id === zone.anchorAsset
          ),
        };
      }).filter((issue) => issue.level !== "healthy")
        .sort((a, b) =>
          a.level === b.level
            ? 0
            : a.level === "attention"
              ? -1
              : 1
        ),
    [pressures, assets]
  );

  const attentionCount = issues.filter(
    (issue) => issue.level === "attention"
  ).length;

  const watchCount = issues.length - attentionCount;

  const netT = summary.netCarbonKgDay / 1000;

  const waterTotalKlDay =
    summary.waterKlDay +
    landscapeWaterKlYr(phase) / 365;

  return (
    <div className="sheet">
      {/* Compact Masterplan Header */}
      <PageHeader
        index="01 · Masterplan"
        title="Campus Masterplan & Spatial Twin"
        lede="Spatial environmental intelligence for Dhun's 500-acre masterplan in Chak Gulabpura, Rajasthan. Integrates verified cadastral zoning, 400-acre bioreserve core, 6m Dhun Loop, and real-time physical twin instrumentation."
        aside={
          <>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-accent font-bold px-2 py-0.5 rounded bg-accent-tint border border-accent/20">
                {PHASES[phase].label}
              </span>
              <span className="tabular font-mono text-[11px] text-ink font-semibold">
                {num(summary.population)} residents
              </span>
            </div>
            <p className="tabular font-mono text-[10px] text-muted mt-1">
              Model timestamp: {istTime(now)} IST · 26.719597° N, 75.593443° E
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Link
                to="/energy"
                className="btn btn-sm btn-outline text-[11.5px] flex items-center gap-1.5 py-1 px-2.5 text-[#234638] border-[#234638]/40 hover:bg-[#E5EBDD] cursor-pointer"
                title="View utility bill evidence and campus baseline calibration"
              >
                <Zap size={13} className="text-[#234638]" />
                Energy & Bills
              </Link>
              <button
                type="button"
                onClick={() => setArchiveModalOpen(true)}
                className="btn btn-sm btn-outline text-[11.5px] flex items-center gap-1.5 py-1 px-2.5 text-[#234638] border-[#234638]/40 hover:bg-[#E5EBDD] cursor-pointer"
                title="View authentic Dhun masterplan reference sheets"
              >
                <ImageIcon size={13} className="text-[#234638]" />
                Masterplan Archive
              </button>
              <button
                type="button"
                onClick={() => setAddModalOpen(true)}
                className="btn btn-sm btn-accent text-[11.5px] flex items-center gap-1.5 py-1 px-2.5 cursor-pointer"
              >
                <Plus size={13} />
                Add Asset
              </button>
            </div>
          </>
        }
      />

      {/* Planning Envelopes & Key Spatial Benchmarks Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule bg-surface px-6 py-2.5 text-[12.5px] text-ink-soft">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-[4px] bg-[#E5EBDD] px-2 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#234638] border border-[#234638]/20">
            Dhun Spatial Covenants
          </span>
          <span className="font-semibold text-ink">
            500 acres concession · 400-acre bioreserve (80%) · ≤100-acre construction ceiling (≤20%) · 12m height limit
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px] text-muted">
          <span>Surveyed Cluster Schedule: 422.01 ac</span>
          <span className="text-rule-strong">|</span>
          <span>Outer Buffer: 77.99 ac (Unreconciled by design)</span>
        </div>
      </div>

      {/* Main Spatial Twin Workspace: Map Centerpiece + Contextual Feature Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 flex-1 border-b border-rule bg-surface min-h-[660px]">
        {/* Spatial Map Canvas */}
        <div className="xl:col-span-8 flex flex-col border-b xl:border-b-0 xl:border-r border-rule min-h-[580px]">
          {/* Spatial View Mode Switcher & Quick Anchor Bookmarks */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule bg-surface-subtle px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted font-bold">
                Map View:
              </span>
              <div className="inline-flex rounded-md border border-rule bg-white p-0.5 shadow-xs">
                <button
                  type="button"
                  onClick={() => setMapMode("gis")}
                  className={`flex items-center gap-1.5 px-3 py-1 text-[12px] font-medium rounded transition-all cursor-pointer ${
                    mapMode === "gis"
                      ? "bg-[#234638] text-white shadow-xs font-semibold"
                      : "text-muted hover:text-ink hover:bg-gray-100"
                  }`}
                >
                  <Globe size={13} />
                  <span>Real GIS Map (WGS 84)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMapMode("schematic")}
                  className={`flex items-center gap-1.5 px-3 py-1 text-[12px] font-medium rounded transition-all cursor-pointer ${
                    mapMode === "schematic"
                      ? "bg-[#234638] text-white shadow-xs font-semibold"
                      : "text-muted hover:text-ink hover:bg-gray-100"
                  }`}
                >
                  <Compass size={13} />
                  <span>Schematic Topology</span>
                </button>
              </div>
            </div>

            {/* Quick Feature Jump Presets */}
            <div className="hidden sm:flex items-center gap-1.5 font-mono text-[10.5px]">
              <span className="text-muted font-bold uppercase mr-1">Anchors:</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedFeature({
                    id: "phase-1-zoning",
                    name: "Phase One Development Parcels",
                    category: "Masterplan and Neighbourhoods",
                    source: "Dhun Phase One Plan Reference Sheet",
                    areaSqm: 261662,
                    areaAcres: 64.66,
                    properties: {
                      note: "Zoning includes Residential (59,288 m²), Tourism (99,749 m²), Institutional (30,458 m²), Facilities (46,834 m²).",
                    },
                  });
                  setSelectedId("");
                }}
                className="px-2 py-0.5 rounded bg-white border border-rule hover:border-accent text-ink hover:text-accent cursor-pointer"
              >
                Phase 1 (261k m²)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedFeature({
                    id: "dhun-loop-spine",
                    name: "The Dhun Loop",
                    category: "Masterplan and Neighbourhoods",
                    source: "Dhun Mobility Masterplan Sheet Reference",
                    properties: {
                      widthMeters: 6,
                      speedLimitKmh: 15,
                      note: "Unifying 6m mobility spine connecting all clusters with zero-emission transit, cycles, and shaded walkways.",
                    },
                  });
                  setSelectedId("");
                }}
                className="px-2 py-0.5 rounded bg-white border border-rule hover:border-accent text-ink hover:text-accent cursor-pointer"
              >
                Dhun Loop (6m)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedFeature({
                    id: "bioreserve-core",
                    name: "400-Acre Protected Bioreserve Target",
                    category: "Landscape and Ecology",
                    source: "Dhun Masterplan Ecological Covenant",
                    areaAcres: 400.0,
                    areaSqm: 1618742,
                    properties: {
                      note: "Inviolable ecological restoration corridor across the northern and western watershed (80% site envelope).",
                    },
                  });
                  setSelectedId("");
                }}
                className="px-2 py-0.5 rounded bg-white border border-rule hover:border-accent text-ink hover:text-accent cursor-pointer"
              >
                Bioreserve (400 ac)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedFeature({
                    id: "water-bodies-basins",
                    name: "Water Bodies & Retention Basins (P1–P6)",
                    category: "Water Systems",
                    source: "EDS KPI Report Rev 2 (Page 7-8)",
                    areaAcres: 32.12,
                    areaSqm: 130000,
                    properties: {
                      note: "Continuous blue-green retention ponds capturing 306,760 kL annual monsoon yield.",
                    },
                  });
                  setSelectedId("");
                }}
                className="px-2 py-0.5 rounded bg-white border border-rule hover:border-accent text-ink hover:text-accent cursor-pointer"
              >
                Ponds P1–P6
              </button>
            </div>
          </div>

          {/* Interactive Map Component */}
          <div className="flex-1 w-full relative">
            {mapMode === "gis" ? (
              <DhunGeographicMap
                registeredAssets={registeredAssets}
                selectedAssetId={selectedId}
                onSelectAsset={(id) => {
                  setSelectedId(id);
                  setSelectedFeature(null);
                }}
                onSelectFeature={(feat) => {
                  setSelectedFeature(feat);
                  setSelectedId("");
                }}
                height="620px"
              />
            ) : (
              <CampusMap
                assets={assets}
                summary={summary}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id);
                  setSelectedFeature(null);
                }}
                registeredAssets={registeredAssets}
              />
            )}
          </div>
        </div>

        {/* Right Contextual Feature Inspector */}
        <div className="xl:col-span-4 flex flex-col bg-surface overflow-hidden">
          {registeredSelected ? (
            <AssetDetailInspector
              asset={registeredSelected}
              onClose={() => setSelectedId("")}
            />
          ) : (
            <MasterplanFeatureInspector
              feature={selectedFeature}
              onClose={() => setSelectedFeature(null)}
              onSelectAsset={(id) => {
                setSelectedId(id);
                setSelectedFeature(null);
              }}
              onOpenArchiveModal={() => setArchiveModalOpen(true)}
            />
          )}
        </div>
      </div>

      {/* Operational Vitals & Environmental Exceptions Bar (Collapsible) */}
      <div className="border-b border-rule bg-surface">
        <div className="flex items-center justify-between px-6 py-2.5 bg-surface-subtle border-b border-rule text-[13px]">
          <div className="flex items-center gap-2.5">
            <Activity size={15} className="text-accent" />
            <h3 className="font-bold text-ink text-[14px]">
              Live Operational Intelligence & Environmental Balance
            </h3>
            <span className="tabular font-mono text-[11px] text-muted">
              ({num(summary.builtM2)} m² built · {PHASES[phase].label})
            </span>
          </div>

          <button
            type="button"
            onClick={() => setOperationalPanelOpen((open) => !open)}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-accent hover:text-accent-hover cursor-pointer"
          >
            <span>{operationalPanelOpen ? "Collapse Operational Panels" : "Expand Operational Panels"}</span>
            {operationalPanelOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Metric Strip always visible */}
        <MetricStrip
          metrics={[
            {
              label: "Net carbon balance",
              value: `${netT > 0 ? "+" : "−"}${num(Math.abs(netT), 1)}`,
              unit: "tCO₂e/day",
              note:
                netT > 0
                  ? "Emissions exceed the 124-acre afforestation sink."
                  : "Living biomass sink exceeds daily operational emissions.",
              tone: netT > 0 ? "danger" : "good",
              domain: "ecology",
            },
            {
              label: "Renewable coverage",
              value: percent(summary.renewableShare),
              note:
                summary.solarKw > 0.01
                  ? `${num(summary.solarKw)} kW current solar array output.`
                  : PHASES[phase].solarKwp > 0
                    ? `${num(PHASES[phase].solarKwp)} kWp installed; dormant at night.`
                    : "No on-site generation in this baseline phase.",
              tone:
                summary.renewableShare >= 0.5
                  ? "good"
                  : summary.renewableShare > 0
                    ? "warn"
                    : "danger",
              domain: "energy",
            },
            {
              label: "Water withdrawal",
              value: num(waterTotalKlDay, 0),
              unit: "kL/day",
              note: "Domestic demand plus 308,000 m² green landscape.",
              tone:
                waterTotalKlDay * 365 > summary.waterHarvestKlYr
                  ? "danger"
                  : "default",
              domain: "water",
            },
            {
              label: "Protected biomass stock",
              value: tonnes(summary.standingStockT),
              unit: "tCO₂e",
              note: "Living carbon stock across 300,000 trees at buildout.",
              domain: "forest",
            },
          ]}
        />

        {operationalPanelOpen && (
          <div className="animate-fadeIn">
            {/* Four Strategic Questions Executive Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 border-b border-rule bg-surface text-[14px]">
              {/* Q1: Operational State */}
              <div className="border-b md:border-b-0 md:border-r border-rule p-5 bg-[#EEF2EE]/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent font-bold">
                    01 · Operational State
                  </span>
                  <EvidenceBadge tier="SIMULATED" />
                </div>
                <p className="text-[15.5px] font-semibold text-ink leading-snug">
                  {netT > 0
                    ? `Gross net emission of ${num(Math.abs(netT), 1)} tCO₂e/day`
                    : `Carbon sink surplus of ${num(Math.abs(netT), 1)} tCO₂e/day`}
                </p>
                <p className="mt-1.5 text-[13px] text-muted leading-relaxed">
                  {summary.solarKw > 0
                    ? `${percent(summary.renewableShare)} clean solar powering site loads (${num(summary.solarKw)} kW array output).`
                    : `Night period. Campus drawing ${num(summary.gridKw)} kW from regional grid (${GRID_FACTOR} kg/kWh).`}
                </p>
              </div>

              {/* Q2: Environmental Thresholds */}
              <div className="border-b md:border-b-0 xl:border-r border-rule p-5 bg-[#F5DEDA]/25">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-danger font-bold">
                    02 · Environmental Thresholds
                  </span>
                  <span className="tabular font-mono text-[11.5px] font-semibold text-danger">
                    {attentionCount} urgent · {watchCount} watch
                  </span>
                </div>
                <p className="text-[15.5px] font-semibold text-ink leading-snug">
                  {attentionCount > 0
                    ? `${attentionCount} zone exceeds planning boundary`
                    : watchCount > 0
                      ? `${watchCount} zones approaching threshold`
                      : "All zones operating within limits"}
                </p>
                <p className="mt-1.5 text-[13px] text-muted leading-relaxed">
                  {issues.length > 0
                    ? `${issues[0].zone.name}: ${issues[0].reason}`
                    : "Water harvest and energy constraints are satisfied."}
                </p>
              </div>

              {/* Q3: Demand Aggregation */}
              <div className="border-b md:border-b-0 md:border-r border-rule p-5 bg-[#E9E4F4]/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#8679A9] font-bold">
                    03 · Demand Aggregation
                  </span>
                  <span className="font-mono text-[11px] text-muted font-medium">3 Workstreams</span>
                </div>
                <p className="text-[15.5px] font-semibold text-ink leading-snug">
                  Campus ({num(summary.workstreamCampusKw, 0)} kW) + Compute ({num(summary.workstreamComputeKw, 0)} kW)
                </p>
                <p className="mt-1.5 text-[13px] text-muted leading-relaxed">
                  Spirulina pilot draws {num(summary.workstreamSpirulinaKw, 1)} kW. Daily total: {num(summary.demandKwhDay, 0)} kWh/day across all 3 streams.
                </p>
              </div>

              {/* Q4: Dispatch Decision */}
              <div className="p-5 bg-[#E8F0EA]/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent font-bold">
                    04 · Dispatch Decision
                  </span>
                  <span className="status-dot status-healthy" />
                </div>
                <p className="text-[15.5px] font-semibold text-ink leading-snug">
                  {summary.solarKw > 50
                    ? "Dispatch compute queue to absorb midday solar"
                    : "Enable battery discharge to clip evening grid peak"}
                </p>
                <div className="mt-2.5 flex items-center gap-3">
                  <Link
                    to="/compute"
                    className="text-[12.5px] font-semibold text-accent underline hover:text-accent-hover"
                  >
                    Tune compute window →
                  </Link>
                  <span className="text-rule-strong">·</span>
                  <Link
                    to="/scenarios"
                    className="text-[12.5px] font-semibold text-accent underline hover:text-accent-hover"
                  >
                    Simulate storage →
                  </Link>
                </div>
              </div>
            </div>

            {/* Three Workstreams Ribbon */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-b border-rule bg-surface text-[13.5px]">
              <div className="flex items-center justify-between border-b md:border-b-0 md:border-r border-rule px-6 py-3 border-l-4 border-l-[#234638] bg-[#EEF2EE]/30">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#234638] font-bold">Stream 1</span>
                  <span className="text-ink font-semibold">Campus & Construction</span>
                </div>
                <span className="font-mono text-ink tabular text-[12.5px] font-semibold">
                  {num(summary.workstreamCampusKw, 1)} kW · {num(summary.workstreamCampusKwhDay, 0)} kWh/d
                </span>
              </div>
              <div className="flex items-center justify-between border-b md:border-b-0 md:border-r border-rule px-6 py-3 border-l-4 border-l-[#8679A9] bg-[#E9E4F4]/20">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#8679A9] font-bold">Stream 2</span>
                  <span className="text-ink font-semibold">Compute Commons</span>
                </div>
                <span className="font-mono text-ink tabular text-[12.5px] font-semibold">
                  {num(summary.workstreamComputeKw, 1)} kW · {num(summary.workstreamComputeKwhDay, 0)} kWh/d
                </span>
              </div>
              <div className="flex items-center justify-between px-6 py-3 border-l-4 border-l-[#15372D] bg-[#DCECE3]/20">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#15372D] font-bold">Stream 3</span>
                  <span className="text-ink font-semibold">Spirulina Pilot</span>
                </div>
                <span className="font-mono text-ink tabular text-[12.5px] font-semibold">
                  {num(summary.workstreamSpirulinaKw, 1)} kW · {num(summary.workstreamSpirulinaKwhDay, 0)} kWh/d
                </span>
              </div>
            </div>

            {/* Zone Capacity & Pressure Table */}
            <div className="p-6 bg-surface">
              <ZoneTable
                summary={summary}
                assets={assets}
              />
            </div>
          </div>
        )}
      </div>

      {/* Asset Directory Table */}
      <section className="panel mt-6">
        <div className="panel-head py-3.5 px-6">
          <div className="flex items-center gap-3">
            <h2 className="t-title text-[18.5px] font-semibold text-ink">
              Campus Asset Directory & Instrumentation Status
            </h2>
          </div>
          <span className="tabular font-mono text-[12px] text-muted font-medium">
            {assets.length} Monitored Assets · {registeredAssets.length} Registered in Central Inventory
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <caption className="sr-only">
              Asset register with modelled load and carbon
            </caption>
            <thead>
              <tr>
                <th scope="col">Asset Name & Node</th>
                <th scope="col">Status</th>
                <th scope="col" className="num">
                  Active Load
                </th>
                <th scope="col" className="num">
                  Carbon Balance
                </th>
                <th scope="col">
                  Evidence Tier
                </th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr
                  key={asset.id}
                  className="is-interactive"
                  aria-selected={
                    asset.id === selectedId
                  }
                  onClick={() => {
                    setSelectedId(asset.id);
                    setSelectedFeature(null);
                  }}
                >
                  <th
                    scope="row"
                    className="px-4 py-3.5 text-left font-semibold text-ink text-[14px]"
                  >
                    {asset.name} ({asset.short})
                  </th>
                  <td className="px-4 py-3.5">
                    <StatusMark status={asset.status} />
                  </td>
                  <td className="px-4 py-3.5 num text-ink font-mono font-medium text-[13.5px]">
                    {asset.powerKw === 0
                      ? "—"
                      : `${num(Math.abs(asset.powerKw), 1)} kW`}
                  </td>
                  <td className="px-4 py-3.5 num text-ink font-mono font-medium text-[13.5px]">
                    {asset.carbonKgDay === 0
                      ? "—"
                      : `${asset.carbonKgDay < 0 ? "−" : ""}${num(
                          Math.abs(
                            asset.carbonKgDay
                          ),
                          0
                        )} kg/d`}
                  </td>
                  <td className="px-4 py-3.5">
                    <EvidenceBadge
                      tier={asset.evidence}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Evidence Provenance Architecture */}
      <section className="panel">
        <div className="panel-head py-3.5 px-6">
          <h2 className="t-title text-[18.5px] font-semibold text-ink">
            Evidence Provenance Architecture
          </h2>
          <span className="text-[12px] text-muted font-medium">
            Verified Field Records vs Model Assumptions
          </span>
        </div>

        <div className="split grid-cols-1 md:grid-cols-3">
          <div className="p-5 bg-surface">
            <EvidenceBadge tier="MEASURED" />
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-soft">
              Tree count (50,000+), harvested water volumes, protected perimeter, avian species and geo-boundary.
            </p>
          </div>

          <div className="p-5 bg-surface">
            <EvidenceBadge tier="REPORT" />
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-soft">
              CEA grid emission factors, Jaipur solar yield (1,547 kWh/kWp), EPI benchmarks (35–47 kWh/m²), built area.
            </p>
          </div>

          <div className="p-5 bg-surface">
            <EvidenceBadge tier="SIMULATED" />
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-soft">
              Hourly dispatch curves, marginal carbon curves, battery state of charge, soil sequestration and zone verdicts.
            </p>
          </div>
        </div>
      </section>

      {/* Add Physical Asset Modal */}
      <AddAssetModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAssetAdded={(newAsset) => {
          setSelectedId(newAsset.id);
          setSelectedFeature(null);
        }}
      />

      {/* Masterplan Reference Drawings Modal */}
      <MasterplanReferenceModal
        isOpen={archiveModalOpen}
        onClose={() => setArchiveModalOpen(false)}
      />
    </div>
  );
}
