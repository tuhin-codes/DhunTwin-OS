/* ============================================================
   DHUN TWIN OS — ASSET REGISTRY CONTEXT & HOOK
   Provides authoritative asset inventory, persistence, live
   telemetry state, and alert streaming to all workspaces.
   ============================================================ */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type {
  ActiveAlert,
  AssetDomain,
  AssetFilterOptions,
  OperationalState,
  RegisteredAsset,
  TelemetryReading,
  TelemetrySourceType,
} from "./types";

import { LocalAssetRepository } from "./AssetRepository";
import { telemetryEngine } from "./telemetryEngine";
import { alertEngine } from "./alertEngine";
import { generateTestDataset, benchmarkRegistryPerformance } from "./testLab";

export interface AssetRegistryContextValue {
  assets: RegisteredAsset[];
  alerts: ActiveAlert[];
  selectedAsset: RegisteredAsset | null;
  setSelectedAsset: (asset: RegisteredAsset | null) => void;
  getAssetById: (id: string) => RegisteredAsset | undefined;
  addAsset: (asset: RegisteredAsset) => { success: boolean; error?: string };
  updateAsset: (asset: RegisteredAsset) => { success: boolean; error?: string };
  deleteAsset: (id: string) => boolean;
  resetDefaults: () => void;
  exportJson: () => string;
  importJson: (json: string) => { success: boolean; count?: number; error?: string };
  recordReading: (params: {
    assetId: string;
    channelId: string;
    value: number;
    unit?: string;
    timestamp?: string;
    source: TelemetrySourceType;
  }) => { success: boolean; reading?: TelemetryReading; error?: string };
  importCsvReadings: (csvText: string, assetId: string) => { success: boolean; importedCount: number; errors: string[] };
  getReading: (assetId: string, channelId: string) => TelemetryReading | undefined;
  getHistory: (assetId: string, channelId: string) => TelemetryReading[];
  getOperationalState: (asset: RegisteredAsset) => OperationalState;
  filterAssets: (options: AssetFilterOptions) => RegisteredAsset[];

  // Dynamic Scale & Metrics (Part 4)
  totalCount: number;
  activeCount: number;
  liveCount: number;
  simulatedCount: number;
  staleCount: number;
  commissioningCount: number;
  alertingCount: number;
  testAssetCount: number;

  // Test Lab Simulation (Part 5)
  isTestModeActive: boolean;
  testBenchmark: {
    datasetSize: number;
    generationTimeMs: number;
    filterTimeMs: number;
    searchTimeMs: number;
    sortTimeMs: number;
    memoryKb: number;
  } | null;
  loadTestScenario: (count: number, domain?: string) => void;
  purgeTestAssets: () => number;
}

const AssetRegistryContext = createContext<AssetRegistryContextValue | null>(null);

export function AssetRegistryProvider({ children }: { children: ReactNode }) {
  const [repo] = useState(() => new LocalAssetRepository());
  const [assets, setAssets] = useState<RegisteredAsset[]>(() => repo.getAll());
  const [selectedAsset, setSelectedAsset] = useState<RegisteredAsset | null>(null);
  const [tick, setTick] = useState(0);

  const [testBenchmark, setTestBenchmark] = useState<{
    datasetSize: number;
    generationTimeMs: number;
    filterTimeMs: number;
    searchTimeMs: number;
    sortTimeMs: number;
    memoryKb: number;
  } | null>(null);

  // Reload assets from repository
  const refreshAssets = useCallback(() => {
    setAssets([...repo.getAll()]);
  }, [repo]);

  // Periodic heartbeat tick (every 3 seconds) to refresh data quality and check alerts
  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
    }, 3000);
    return () => window.clearInterval(id);
  }, []);

  const getReading = useCallback(
    (assetId: string, channelId: string) => telemetryEngine.getReading(assetId, channelId),
    []
  );

  const getHistory = useCallback(
    (assetId: string, channelId: string) => telemetryEngine.getHistory(assetId, channelId),
    []
  );

  const getOperationalState = useCallback(
    (asset: RegisteredAsset) => telemetryEngine.determineOperationalState(asset),
    []
  );

  // Compute active alerts dynamically
  const alerts = useMemo(() => {
    return alertEngine.evaluateAll(assets, getReading);
  }, [assets, getReading, tick]);

  // Dynamic asset counts (Part 4.1) derived directly from registry records
  const totalCount = assets.length;

  const activeCount = useMemo(() => {
    return assets.filter(
      (a) => a.lifecycleStatus === "Active" || (a.commissioningStatus as string) === "Active"
    ).length;
  }, [assets]);

  const liveCount = useMemo(() => {
    return assets.filter(
      (a) => a.monitoringMode === "Live" || getOperationalState(a) === "active_verified"
    ).length;
  }, [assets, getOperationalState]);

  const simulatedCount = useMemo(() => {
    return assets.filter(
      (a) =>
        a.monitoringMode === "Simulated" ||
        getOperationalState(a) === "simulated" ||
        a.channels.some((c) => c.source === "simulation")
    ).length;
  }, [assets, getOperationalState]);

  const staleCount = useMemo(() => {
    return assets.filter(
      (a) =>
        a.monitoringMode === "Stale" ||
        a.monitoringMode === "Disconnected" ||
        getOperationalState(a) === "stale"
    ).length;
  }, [assets, getOperationalState]);

  const commissioningCount = useMemo(() => {
    return assets.filter(
      (a) =>
        a.lifecycleStatus === "Commissioning" ||
        (a.commissioningStatus as string) === "Commissioning" ||
        getOperationalState(a) === "commissioning"
    ).length;
  }, [assets, getOperationalState]);

  const alertingCount = useMemo(() => {
    const assetIdsWithAlerts = new Set(alerts.map((al) => al.assetId.toLowerCase()));
    return assets.filter((a) => assetIdsWithAlerts.has(a.id.toLowerCase())).length;
  }, [assets, alerts]);

  const testAssetCount = useMemo(() => {
    return assets.filter((a) => a.isTestAsset).length;
  }, [assets]);

  const isTestModeActive = testAssetCount > 0;

  // Test Lab simulation loader (Part 5.1 & 5.2)
  const loadTestScenario = useCallback(
    (count: number, domain?: string) => {
      if (count === 0) {
        repo.setAssets([]);
        refreshAssets();
        setSelectedAsset(null);
        setTestBenchmark({
          datasetSize: 0,
          generationTimeMs: 0.1,
          filterTimeMs: 0.1,
          searchTimeMs: 0.1,
          sortTimeMs: 0.1,
          memoryKb: 0,
        });
        return;
      }

      const { assets: testAssets, durationMs: genTime } = generateTestDataset(
        count,
        domain as AssetDomain
      );

      // Measure search, filter, and sort benchmarks across the generated dataset
      const bench = benchmarkRegistryPerformance(testAssets);
      setTestBenchmark({
        datasetSize: count,
        generationTimeMs: genTime,
        filterTimeMs: bench.filterTimeMs,
        searchTimeMs: bench.searchTimeMs,
        sortTimeMs: bench.sortTimeMs,
        memoryKb: bench.estimatedMemoryKb,
      });

      // Ingest sample telemetry for the first batch so inspector views display live data immediately
      const sampleBatch = testAssets.slice(0, Math.min(100, testAssets.length));
      for (const a of sampleBatch) {
        for (const ch of a.channels) {
          if (ch.lastReading) {
            telemetryEngine.ingest({
              assetId: a.id,
              channelId: ch.id,
              value: ch.lastReading.value,
              unit: ch.unit,
              source: "simulation",
              timestamp: ch.lastReading.timestamp,
            });
          }
        }
      }

      repo.setAssets(testAssets);
      refreshAssets();
      setSelectedAsset(testAssets[0] || null);
    },
    [repo, refreshAssets]
  );

  const purgeTestAssets = useCallback(() => {
    const removedCount = repo.purgeTestAssets();
    refreshAssets();
    setSelectedAsset(null);
    setTestBenchmark(null);
    return removedCount;
  }, [repo, refreshAssets]);

  const addAsset = useCallback(
    (asset: RegisteredAsset) => {
      const res = repo.add(asset);
      if (res.success) {
        refreshAssets();
      }
      return res;
    },
    [repo, refreshAssets]
  );

  const updateAsset = useCallback(
    (asset: RegisteredAsset) => {
      const res = repo.update(asset);
      if (res.success) {
        refreshAssets();
      }
      return res;
    },
    [repo, refreshAssets]
  );

  const deleteAsset = useCallback(
    (id: string) => {
      const res = repo.delete(id);
      if (res) {
        refreshAssets();
        if (selectedAsset?.id === id) {
          setSelectedAsset(null);
        }
      }
      return res;
    },
    [repo, refreshAssets, selectedAsset]
  );

  const resetDefaults = useCallback(() => {
    repo.resetToDefaults();
    refreshAssets();
    setSelectedAsset(null);
    setTestBenchmark(null);
  }, [repo, refreshAssets]);

  const exportJson = useCallback(() => repo.exportJson(), [repo]);

  const importJson = useCallback(
    (json: string) => {
      const res = repo.importJson(json);
      if (res.success) {
        refreshAssets();
      }
      return res;
    },
    [repo, refreshAssets]
  );

  const recordReading = useCallback(
    (params: {
      assetId: string;
      channelId: string;
      value: number;
      unit?: string;
      timestamp?: string;
      source: TelemetrySourceType;
    }) => {
      const res = telemetryEngine.ingest(params);
      if (res.success) {
        setTick((t) => t + 1);
      }
      return res;
    },
    []
  );

  const importCsvReadings = useCallback(
    (csvText: string, assetId: string) => {
      const res = telemetryEngine.parseCsvReadings(csvText, assetId);
      if (res.success) {
        setTick((t) => t + 1);
      }
      return res;
    },
    []
  );

  const getAssetById = useCallback(
    (id: string) => {
      return assets.find((a) => a.id.toLowerCase() === id.toLowerCase());
    },
    [assets]
  );

  const filterAssets = useCallback(
    (options: AssetFilterOptions) => {
      const query = (options.searchQuery || "").trim().toLowerCase();

      return assets.filter((asset) => {
        // Text search across Name, ID, Type, Subtype, Domain, Parcel, Manufacturer, Model
        if (query) {
          const matchName = asset.name.toLowerCase().includes(query);
          const matchId = asset.id.toLowerCase().includes(query);
          const matchType = asset.type.toLowerCase().includes(query);
          const matchSubtype = asset.assetSubtype?.toLowerCase().includes(query) ?? false;
          const matchDomain = asset.domain.toLowerCase().includes(query);
          const matchParcel = asset.location.parcelName?.toLowerCase().includes(query) ?? false;
          const matchMfr = asset.manufacturer?.toLowerCase().includes(query) ?? false;
          const matchModel = asset.model?.toLowerCase().includes(query) ?? false;
          if (
            !matchName &&
            !matchId &&
            !matchType &&
            !matchSubtype &&
            !matchDomain &&
            !matchParcel &&
            !matchMfr &&
            !matchModel
          ) {
            return false;
          }
        }

        // Domain filter
        if (options.domain && options.domain !== "all" && asset.domain !== options.domain) {
          return false;
        }

        // Lifecycle / Commissioning status filter
        if (options.status && options.status !== "all") {
          const matchesLifecycle = asset.lifecycleStatus === options.status;
          const matchesComm = asset.commissioningStatus === options.status;
          if (!matchesLifecycle && !matchesComm) {
            return false;
          }
        }

        // Operational State filter
        if (options.operationalState && options.operationalState !== "all") {
          const state = getOperationalState(asset);
          if (state !== options.operationalState) {
            return false;
          }
        }

        // Telemetry Source filter
        if (options.telemetrySource && options.telemetrySource !== "all") {
          const hasSource = asset.channels.some((ch) => ch.source === options.telemetrySource);
          if (!hasSource) return false;
        }

        // Alert filter
        if (options.alertSeverity && options.alertSeverity !== "all") {
          const assetAlerts = alertEngine.getAlertForAsset(asset.id);
          const hasSeverity = assetAlerts.some((a) => a.severity === options.alertSeverity);
          if (!hasSeverity) return false;
        }

        // Coordinates filter
        if (options.hasCoordinatesOnly && !asset.location.hasVerifiedCoordinates) {
          return false;
        }

        return true;
      });
    },
    [assets, getOperationalState]
  );

  const value = useMemo<AssetRegistryContextValue>(
    () => ({
      assets,
      alerts,
      selectedAsset,
      setSelectedAsset,
      getAssetById,
      addAsset,
      updateAsset,
      deleteAsset,
      resetDefaults,
      exportJson,
      importJson,
      recordReading,
      importCsvReadings,
      getReading,
      getHistory,
      getOperationalState,
      filterAssets,

      // Dynamic counts
      totalCount,
      activeCount,
      liveCount,
      simulatedCount,
      staleCount,
      commissioningCount,
      alertingCount,
      testAssetCount,

      // Test Lab
      isTestModeActive,
      testBenchmark,
      loadTestScenario,
      purgeTestAssets,
    }),
    [
      assets,
      alerts,
      selectedAsset,
      getAssetById,
      addAsset,
      updateAsset,
      deleteAsset,
      resetDefaults,
      exportJson,
      importJson,
      recordReading,
      importCsvReadings,
      getReading,
      getHistory,
      getOperationalState,
      filterAssets,
      totalCount,
      activeCount,
      liveCount,
      simulatedCount,
      staleCount,
      commissioningCount,
      alertingCount,
      testAssetCount,
      isTestModeActive,
      testBenchmark,
      loadTestScenario,
      purgeTestAssets,
    ]
  );

  return (
    <AssetRegistryContext.Provider value={value}>
      {children}
    </AssetRegistryContext.Provider>
  );
}

export function useAssetRegistry(): AssetRegistryContextValue {
  const ctx = useContext(AssetRegistryContext);
  if (!ctx) {
    throw new Error("useAssetRegistry must be used within an AssetRegistryProvider");
  }
  return ctx;
}
