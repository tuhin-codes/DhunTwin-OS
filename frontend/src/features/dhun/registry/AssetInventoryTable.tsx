/* ============================================================
   DHUN TWIN OS — DYNAMIC ASSET INVENTORY TABLE
   Searchable, filterable authoritative table powered by central
   Asset Registry. Adding an asset automatically populates here
   without hardcoding.
   ============================================================ */

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FlaskConical,
  Plus,
  Search,
} from "lucide-react";

import type {
  AlertSeverity,
  AssetDomain,
  CommissioningStatus,
  OperationalState,
  RegisteredAsset,
  TelemetrySourceType,
} from "./types";
import { useAssetRegistry } from "./AssetRegistryContext";
import { istTime } from "../lib/clock";

interface AssetInventoryTableProps {
  onSelectAsset: (asset: RegisteredAsset) => void;
  selectedAssetId?: string;
  onOpenAddModal?: () => void;
  onOpenTestLab?: () => void;
}

type SortColumn = "name" | "id" | "domain" | "state" | "reading" | "alerts";
type SortDirection = "asc" | "desc";

const DOMAINS: (AssetDomain | "all")[] = [
  "all",
  "Energy",
  "Water",
  "Buildings",
  "Compute",
  "Ecology",
  "Mobility",
  "Waste",
];

const STATUSES: (CommissioningStatus | "all")[] = [
  "all",
  "Active",
  "Commissioning",
  "Planned",
  "Decommissioned",
];

const DOMAIN_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Energy: { bg: "bg-[#F8E7C8]", text: "text-[#6B4706]", border: "border-[#EED7AA]" },
  Water: { bg: "bg-[#DCEAF5]", text: "text-[#103E66]", border: "border-[#C0DAEC]" },
  Ecology: { bg: "bg-[#DCECE3]", text: "text-[#12482E]", border: "border-[#C5DFD0]" },
  Compute: { bg: "bg-[#E9E4F4]", text: "text-[#3C2B6A]", border: "border-[#D7CEEA]" },
  Buildings: { bg: "bg-[#EEF2EE]", text: "text-[#19231E]", border: "border-[#D8DDD5]" },
  Mobility: { bg: "bg-[#E8F0EA]", text: "text-[#173D32]", border: "border-[#CDE0D2]" },
  Waste: { bg: "bg-[#F8FAF6]", text: "text-[#4B5B52]", border: "border-[#D8DDD5]" },
};

export default function AssetInventoryTable({
  onSelectAsset,
  selectedAssetId,
  onOpenAddModal,
  onOpenTestLab,
}: AssetInventoryTableProps) {
  const {
    filterAssets,
    getReading,
    getOperationalState,
    alerts,
    totalCount,
    activeCount,
    liveCount,
    simulatedCount,
    staleCount,
    commissioningCount,
    alertingCount,
    testAssetCount,
    isTestModeActive,
    purgeTestAssets,
  } = useAssetRegistry();

  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState<AssetDomain | "all">("all");
  const [statusFilter, setStatusFilter] = useState<CommissioningStatus | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<TelemetrySourceType | "all">("all");
  const [alertFilter, setAlertFilter] = useState<AlertSeverity | "all">("all");

  // Sorting
  const [sortCol, setSortCol] = useState<SortColumn>("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filtered = useMemo(() => {
    return filterAssets({
      searchQuery: search,
      domain: domainFilter,
      status: statusFilter,
      telemetrySource: sourceFilter,
      alertSeverity: alertFilter,
    });
  }, [filterAssets, search, domainFilter, statusFilter, sourceFilter, alertFilter]);

  // Full dataset sorting across all records
  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "id":
          cmp = a.id.localeCompare(b.id);
          break;
        case "domain":
          cmp = a.domain.localeCompare(b.domain);
          break;
        case "state":
          cmp = getOperationalState(a).localeCompare(getOperationalState(b));
          break;
        case "reading": {
          const primA = a.channels.find((c) => c.id === a.primaryChannelId) || a.channels[0];
          const primB = b.channels.find((c) => c.id === b.primaryChannelId) || b.channels[0];
          const valA = primA ? (getReading(a.id, primA.id)?.value ?? primA.lastReading?.value ?? -999999) : -999999;
          const valB = primB ? (getReading(b.id, primB.id)?.value ?? primB.lastReading?.value ?? -999999) : -999999;
          cmp = valA - valB;
          break;
        }
        case "alerts": {
          const alA = alerts.filter((al) => al.assetId.toLowerCase() === a.id.toLowerCase()).length;
          const alB = alerts.filter((al) => al.assetId.toLowerCase() === b.id.toLowerCase()).length;
          cmp = alA - alB;
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortCol, sortDir, getOperationalState, getReading, alerts]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, sorted.length);
  const paginatedAssets = sorted.slice(startIndex, endIndex);

  const toggleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const stateLabels: Record<
    OperationalState,
    { label: string; dot: string; text: string; bg: string }
  > = {
    planned: { label: "Planned", dot: "bg-[#73847B]", text: "text-muted", bg: "bg-[#EEF2EE]" },
    commissioning: { label: "Commissioning", dot: "bg-[#D9A03A]", text: "text-[#6B4706]", bg: "bg-[#F8E7C8]" },
    active_verified: { label: "Verified Live", dot: "bg-[#2E7D5B]", text: "text-[#12482E]", bg: "bg-[#DCECE3]" },
    active_manual: { label: "Manual / Imported", dot: "bg-[#256D85]", text: "text-[#103E66]", bg: "bg-[#DCEAF5]" },
    simulated: { label: "Simulated Model", dot: "bg-[#73847B]", text: "text-muted", bg: "bg-[#EEF2EE]" },
    stale: { label: "Stale (>45s)", dot: "bg-[#D9A03A]", text: "text-[#6B4706]", bg: "bg-[#F8E7C8]" },
    decommissioned: { label: "Decommissioned", dot: "bg-[#C53B27]", text: "text-[#732117]", bg: "bg-[#F5DEDA]" },
  };

  return (
    <section className="panel overflow-hidden">
      {/* Dynamic Asset Counts Summary Strip (Part 4.1) */}
      <div className="border-b border-rule bg-surface-subtle/50 px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[12px] font-mono">
            <span className="font-semibold text-ink uppercase text-[11px] tracking-wide mr-1">
              Registry Status:
            </span>
            <span
              onClick={() => {
                setStatusFilter("all");
                setAlertFilter("all");
              }}
              className="cursor-pointer rounded border border-rule bg-surface px-2.5 py-1 text-ink font-semibold hover:border-accent transition-colors"
              title="Total registered assets"
            >
              Total: <strong className="text-ink">{totalCount}</strong>
            </span>
            <span
              onClick={() => setStatusFilter("Active")}
              className="cursor-pointer rounded border border-[#C5DFD0] bg-[#DCECE3] px-2.5 py-1 text-[#12482E] font-semibold hover:opacity-80 transition-opacity"
              title="Assets in Active lifecycle status"
            >
              Active: <strong>{activeCount}</strong>
            </span>
            <span
              className="rounded border border-[#C0DAEC] bg-[#DCEAF5] px-2.5 py-1 text-[#103E66] font-semibold"
              title="Assets with live gateway/sensor telemetry"
            >
              Live Telemetry: <strong>{liveCount}</strong>
            </span>
            <span
              className="rounded border border-rule bg-surface px-2.5 py-1 text-muted font-medium"
              title="Assets in simulated monitoring mode"
            >
              Simulated: <strong>{simulatedCount}</strong>
            </span>
            <span
              className={`rounded border px-2.5 py-1 font-semibold ${
                staleCount > 0
                  ? "border-[#EED7AA] bg-[#F8E7C8] text-[#6B4706]"
                  : "border-rule bg-surface text-muted"
              }`}
              title="Assets with stale readings (>45s) or disconnected"
            >
              Stale / Disc: <strong>{staleCount}</strong>
            </span>
            <span
              onClick={() => setStatusFilter("Commissioning")}
              className="cursor-pointer rounded border border-[#EED7AA] bg-[#F8E7C8] px-2.5 py-1 text-[#6B4706] font-semibold"
              title="Assets under commissioning"
            >
              Commissioning: <strong>{commissioningCount}</strong>
            </span>
            <span
              onClick={() => setAlertFilter("alarm")}
              className={`cursor-pointer rounded border px-2.5 py-1 font-semibold transition-colors ${
                alertingCount > 0
                  ? "border-[#EAC2BA] bg-[#F5DEDA] text-[#732117] animate-pulse"
                  : "border-rule bg-surface text-muted"
              }`}
              title="Assets with active threshold alarms"
            >
              Active Alerts: <strong>{alertingCount}</strong>
            </span>
          </div>

          {/* Test Lab indicator & purge action */}
          {isTestModeActive && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-[#6B4706] bg-[#F8E7C8] border border-[#EED7AA] px-2.5 py-0.5 rounded">
                <FlaskConical size={12} />
                <span>Test Mode Active ({testAssetCount} test records)</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Purge all test assets and return to production seed data?")) {
                    purgeTestAssets();
                  }
                }}
                className="btn btn-sm text-[11px] font-mono py-1 px-2 border-rule bg-surface text-[#732117] hover:bg-[#F5DEDA]"
                title="Safely remove all test records without affecting real assets"
              >
                Purge Test Data
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Header and Actions */}
      <div className="panel-head py-3.5 px-6">
        <div>
          <h2 className="t-title text-[18.5px] font-semibold text-ink">
            Authoritative Asset Inventory
          </h2>
          <p className="font-mono text-[11.5px] text-muted font-medium mt-0.5">
            {filtered.length} of {totalCount} assets match filter criteria · Showing {sorted.length > 0 ? startIndex + 1 : 0}–{endIndex}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenTestLab && (
            <button
              type="button"
              onClick={onOpenTestLab}
              className="btn btn-sm flex items-center gap-1.5 border border-rule bg-surface text-ink hover:bg-surface-subtle font-mono text-[12px]"
            >
              <FlaskConical size={14} className="text-[#256D85]" />
              <span>Test Lab</span>
            </button>
          )}

          {onOpenAddModal && (
            <button
              type="button"
              onClick={onOpenAddModal}
              className="btn btn-sm btn-primary flex items-center gap-1.5"
            >
              <Plus size={15} />
              <span>Add Asset</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="border-b border-rule bg-surface-subtle/80 p-4 space-y-3 text-[13px]">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search box across Name, ID, Domain, Parcel, Mfr, Model */}
          <div className="relative min-w-[240px] flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              placeholder="Search assets by name, ID, type, subtype, or parcel..."
              className="w-full rounded-[5px] border border-rule bg-surface pl-9 pr-3.5 py-2 text-[13.5px] text-ink focus:border-accent focus:outline-hidden"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Domain Filter */}
          <select
            className="rounded-[5px] border border-rule bg-surface px-3 py-2 text-[13px] text-ink font-medium focus:border-accent focus:outline-hidden"
            value={domainFilter}
            onChange={(e) => {
              setDomainFilter(e.target.value as any);
              setCurrentPage(1);
            }}
          >
            {DOMAINS.map((d) => (
              <option key={d} value={d}>
                Domain: {d === "all" ? "All Domains" : d}
              </option>
            ))}
          </select>

          {/* Lifecycle Status Filter */}
          <select
            className="rounded-[5px] border border-rule bg-surface px-3 py-2 text-[13px] text-ink font-medium focus:border-accent focus:outline-hidden"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setCurrentPage(1);
            }}
          >
            {STATUSES.map((st) => (
              <option key={st} value={st}>
                Lifecycle: {st === "all" ? "All States" : st}
              </option>
            ))}
          </select>

          {/* Telemetry Source Filter */}
          <select
            className="rounded-[5px] border border-rule bg-surface px-3 py-2 text-[13px] text-ink font-medium focus:border-accent focus:outline-hidden"
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value as any);
              setCurrentPage(1);
            }}
          >
            <option value="all">Source: All</option>
            <option value="physical_sensor">Physical Sensor</option>
            <option value="gateway">Gateway</option>
            <option value="simulation">Simulation</option>
            <option value="manual_entry">Manual Entry</option>
            <option value="imported_data">Imported Data</option>
          </select>

          {/* Alert Filter */}
          <select
            className="rounded-[5px] border border-rule bg-surface px-3 py-2 text-[13px] text-ink font-medium focus:border-accent focus:outline-hidden"
            value={alertFilter}
            onChange={(e) => {
              setAlertFilter(e.target.value as any);
              setCurrentPage(1);
            }}
          >
            <option value="all">Alerts: All</option>
            <option value="alarm">Critical Alarms</option>
            <option value="watch">Watch Warnings</option>
            <option value="stale">Stale Telemetry</option>
          </select>

          {/* Page size picker */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="font-mono text-[11.5px] text-muted">Rows:</span>
            <select
              className="rounded-[5px] border border-rule bg-surface px-2 py-1.5 text-[12.5px] text-ink font-mono focus:border-accent focus:outline-hidden"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Body with Sortable Headers */}
      <div className="overflow-x-auto">
        <table className="data-table">
          <caption className="sr-only">
            Authoritative dynamic asset registry table with multi-column sorting and pagination
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="cursor-pointer select-none hover:bg-surface-subtle"
                onClick={() => toggleSort("name")}
              >
                <div className="flex items-center gap-1.5">
                  <span>Asset & Identifier</span>
                  {sortCol === "name" ? (
                    sortDir === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                  ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                  )}
                </div>
              </th>

              <th
                scope="col"
                className="cursor-pointer select-none hover:bg-surface-subtle"
                onClick={() => toggleSort("domain")}
              >
                <div className="flex items-center gap-1.5">
                  <span>Domain & Location</span>
                  {sortCol === "domain" ? (
                    sortDir === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                  ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                  )}
                </div>
              </th>

              <th
                scope="col"
                className="cursor-pointer select-none hover:bg-surface-subtle"
                onClick={() => toggleSort("state")}
              >
                <div className="flex items-center gap-1.5">
                  <span>Operational State</span>
                  {sortCol === "state" ? (
                    sortDir === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                  ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                  )}
                </div>
              </th>

              <th
                scope="col"
                className="text-right cursor-pointer select-none hover:bg-surface-subtle"
                onClick={() => toggleSort("reading")}
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Primary Reading</span>
                  {sortCol === "reading" ? (
                    sortDir === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                  ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                  )}
                </div>
              </th>

              <th scope="col">Data Freshness</th>
              <th scope="col">Evidence</th>

              <th
                scope="col"
                className="cursor-pointer select-none hover:bg-surface-subtle"
                onClick={() => toggleSort("alerts")}
              >
                <div className="flex items-center gap-1.5">
                  <span>Alerts</span>
                  {sortCol === "alerts" ? (
                    sortDir === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                  ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedAssets.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12">
                  <div className="max-w-md mx-auto text-center space-y-3">
                    <p className="text-ink font-semibold text-[15px]">
                      {totalCount === 0
                        ? "No physical assets registered in Dhun Twin OS"
                        : "No assets match current filter criteria"}
                    </p>
                    <p className="text-muted text-[13px]">
                      {totalCount === 0
                        ? "The registry is currently empty. You can register real hardware or launch the test lab to generate simulated infrastructure."
                        : "Try adjusting your search terms or clearing the active filters."}
                    </p>
                    <div className="flex justify-center gap-3 pt-2">
                      {totalCount === 0 && onOpenAddModal && (
                        <button
                          type="button"
                          onClick={onOpenAddModal}
                          className="btn btn-sm btn-primary flex items-center gap-1.5"
                        >
                          <Plus size={14} />
                          <span>Add First Asset</span>
                        </button>
                      )}
                      {onOpenTestLab && (
                        <button
                          type="button"
                          onClick={onOpenTestLab}
                          className="btn btn-sm border border-rule bg-surface text-ink hover:bg-surface-subtle flex items-center gap-1.5"
                        >
                          <FlaskConical size={14} className="text-[#256D85]" />
                          <span>Open Test Lab</span>
                        </button>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedAssets.map((asset) => {
                const isSelected = selectedAssetId === asset.id;
                const opState = getOperationalState(asset);
                const badge = stateLabels[opState] || stateLabels.simulated;
                const domain = DOMAIN_STYLES[asset.domain] || DOMAIN_STYLES.Energy;

                const primary =
                  asset.channels.find((ch) => ch.id === asset.primaryChannelId) ||
                  asset.channels[0];

                const reading = primary
                  ? getReading(asset.id, primary.id) || primary.lastReading
                  : undefined;

                const assetAlerts = alerts.filter(
                  (a) => a.assetId.toLowerCase() === asset.id.toLowerCase()
                );

                return (
                  <tr
                    key={asset.id}
                    onClick={() => onSelectAsset(asset)}
                    className={[
                      "cursor-pointer transition-colors",
                      isSelected
                        ? "bg-[#E8F0EA] border-l-4 border-l-[#173D32]"
                        : "hover:bg-[#F8FAF7]",
                      asset.isTestAsset ? "opacity-95" : "",
                    ].join(" ")}
                  >
                    <td className="px-4 py-3.5">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-ink text-[14px]">
                            {asset.name}
                          </span>
                          {asset.isTestAsset && (
                            <span className="font-mono text-[9.5px] uppercase font-bold text-[#6B4706] bg-[#F8E7C8] px-1.5 py-0.2 rounded border border-[#EED7AA]">
                              TEST
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[11px] text-muted">
                          {asset.id} · {asset.type}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block rounded px-2 py-0.5 font-mono text-[10.5px] font-bold uppercase border ${domain.bg} ${domain.text} ${domain.border}`}
                        >
                          {asset.domain}
                        </span>
                        <span className="font-mono text-[11px] text-muted truncate max-w-[140px]">
                          {asset.location.parcelName?.split("·")[0] || "Unassigned"}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold px-2 py-0.5 rounded ${badge.bg} ${badge.text}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${badge.dot}`} />
                        <span>{badge.label}</span>
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right tabular font-mono">
                      {reading ? (
                        <span>
                          <strong className="text-ink font-semibold text-[14.5px]">
                            {reading.value.toFixed(1)}
                          </strong>{" "}
                          <span className="text-[11.5px] text-muted">{primary?.unit}</span>
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="font-mono text-[11.5px] text-muted">
                        {reading ? istTime(new Date(reading.timestamp)) : "No reading"}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="font-mono text-[11px] uppercase font-semibold rounded bg-surface-subtle px-2 py-0.5 text-muted border border-rule">
                        {asset.evidenceClassification}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      {assetAlerts.length > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#732117] bg-[#F5DEDA] px-2 py-0.5 rounded border border-[#EAC2BA]">
                          <AlertTriangle size={13} />
                          {assetAlerts.length} Active
                        </span>
                      ) : (
                        <span className="text-[11.5px] text-[#12482E] flex items-center gap-1 font-semibold">
                          <CheckCircle2 size={13} /> Nominal
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls (Part 4.2) */}
      {sorted.length > 0 && (
        <div className="border-t border-rule bg-surface-subtle/50 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-[13px]">
          <div className="font-mono text-[11.5px] text-muted">
            Showing <strong className="text-ink">{startIndex + 1}</strong> to{" "}
            <strong className="text-ink">{endIndex}</strong> of{" "}
            <strong className="text-ink">{sorted.length}</strong> filtered records
            {sorted.length < totalCount && ` (from ${totalCount} total)`}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage <= 1}
              className="p-1.5 rounded border border-rule bg-surface text-ink disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface-subtle"
              title="First Page"
            >
              <ChevronsLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
              className="p-1.5 rounded border border-rule bg-surface text-ink disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface-subtle"
              title="Previous Page"
            >
              <ChevronLeft size={15} />
            </button>

            <span className="font-mono text-[12px] text-ink font-semibold px-2">
              Page {safeCurrentPage} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="p-1.5 rounded border border-rule bg-surface text-ink disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface-subtle"
              title="Next Page"
            >
              <ChevronRight size={15} />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage >= totalPages}
              className="p-1.5 rounded border border-rule bg-surface text-ink disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface-subtle"
              title="Last Page"
            >
              <ChevronsRight size={15} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
