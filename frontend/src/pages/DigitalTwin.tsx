import { Pause, Play, Plus, Globe, Compass, FlaskConical } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import PageHeader from "../features/dhun/components/PageHeader";
import MetricStrip from "../features/dhun/components/MetricStrip";

import { useTwin } from "../features/dhun/context/useTwin";
import { useAssetRegistry } from "../features/dhun/registry/AssetRegistryContext";
import AssetInventoryTable from "../features/dhun/registry/AssetInventoryTable";
import AssetDetailInspector from "../features/dhun/registry/AssetDetailInspector";
import AddAssetModal from "../features/dhun/registry/AddAssetModal";
import TestLabModal from "../features/dhun/registry/TestLabModal";
import DhunGeographicMap from "../features/dhun/gis/DhunGeographicMap";

import { PHASES } from "../features/dhun/data/phases";
import { istClock } from "../features/dhun/lib/clock";
import { num } from "../features/dhun/lib/format";

import {
  buildActions,
  buildEvents,
} from "../features/dhun/twin/buildFrame";
import { useLiveTwin } from "../features/dhun/twin/useLiveTwin";
import TwinMap from "../features/dhun/twin/TwinMap";
import NodeDetail from "../features/dhun/twin/NodeDetail";
import {
  ActionList,
  AlertLog,
  GatewayCard,
  NodeRegister,
} from "../features/dhun/twin/TwinPanels";

import type { FeedStatus } from "../features/dhun/twin/types";

const FEED: Record<
  FeedStatus,
  { label: string; color: string }
> = {
  simulated: {
    label: "Model feed · no gateway",
    color: "#868279",
  },
  connecting: {
    label: "Gateway connecting",
    color: "#D9A03A",
  },
  live: {
    label: "Gateway live",
    color: "#64A882",
  },
  stale: {
    label: "Gateway stale (>30s) · fallback model",
    color: "#D9A03A",
  },
  offline: {
    label: "Gateway offline · model running",
    color: "#D8624F",
  },
};

export default function DigitalTwin() {
  const { phase } = useTwin();
  const { assets: registeredAssets, getAssetById, recordReading } = useAssetRegistry();

  const {
    frame,
    paused,
    setPaused,
    feed,
    endpoint,
    lastPacketAt,
  } = useLiveTwin(phase);

  const [selectedId, setSelectedId] =
    useState("grid-hub");
  const [mapMode, setMapMode] = useState<"schematic" | "gis">("schematic");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [testLabOpen, setTestLabOpen] = useState(false);

  const [controls, setControls] = useState<
    Record<string, string>
  >({});

  const registeredSelected = getAssetById(selectedId);

  const selected =
    frame.nodes.find(
      (node) => node.id === selectedId
    ) ?? frame.nodes[0];

  // Continuous telemetry stream to central registry engine
  useEffect(() => {
    for (const node of frame.nodes) {
      for (const m of node.metrics) {
        recordReading({
          assetId: node.id,
          channelId: `${node.id}-${m.key}`,
          value: m.value,
          unit: m.unit,
          source: m.live ? "gateway" : "simulation",
        });
      }
    }
  }, [frame, recordReading]);

  const events = useMemo(
    () => buildEvents(frame),
    [frame]
  );

  const actions = useMemo(
    () => buildActions(phase, frame.at),
    [phase, frame.at]
  );

  const feedState = FEED[feed];

  const channelTotal = frame.nodes.reduce(
    (sum, node) => sum + node.plannedChannels,
    0
  );

  const liveChannels = frame.nodes.reduce(
    (sum, node) =>
      sum +
      node.metrics.filter((metric) => metric.live)
        .length,
    0
  );

  return (
    <div className="sheet">
      <PageHeader
        index="02 · Digital Twin"
        title="Digital Twin & Telemetry Inventory"
        lede="Instrumented asset topology on the Chak Gulabpura site, each with a physical device ID, gateway binding and telemetry channels. Model frames run deterministically with automatic fallback when gateway packets are stale."
        aside={
          <>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-faint">
              {PHASES[phase].label}
            </p>

            <p className="mt-1 flex items-center gap-2 text-[11.5px] text-ink-soft md:justify-end">
              <span
                className="status-dot"
                style={{
                  background: feedState.color,
                }}
                aria-hidden="true"
              />
              {feedState.label}
            </p>

            <p className="tabular font-mono text-[10px] text-faint">
              Frame {istClock(frame.at)} IST ·{" "}
              {paused ? "paused" : "2 s clock"}
            </p>

            <div className="mt-1.5 flex items-center gap-2 md:justify-end">
              <button
                type="button"
                className="btn btn-sm"
                aria-pressed={paused}
                onClick={() => setPaused(!paused)}
              >
                {paused ? (
                  <Play size={12} />
                ) : (
                  <Pause size={12} />
                )}
                {paused ? "Resume frames" : "Pause frames"}
              </button>

              <button
                type="button"
                className="btn btn-sm flex items-center gap-1 border border-rule bg-surface text-ink hover:bg-surface-subtle"
                onClick={() => setTestLabOpen(true)}
              >
                <FlaskConical size={12} className="text-[#256D85]" />
                Test Lab
              </button>

              <button
                type="button"
                className="btn btn-sm btn-accent"
                onClick={() => setAddModalOpen(true)}
              >
                <Plus size={12} />
                Add Asset
              </button>
            </div>
          </>
        }
      />

      <MetricStrip
        metrics={[
          {
            label: "Assets online",
            value: `${frame.online}/${frame.nodes.length}`,
            note:
              frame.planned > 0
                ? `${frame.planned} planned for a later phase.`
                : "Every asset is commissioned in this phase.",
            tone:
              frame.planned > 0 ? "warn" : "good",
            domain: "forest",
          },
          {
            label: "Instrument channels",
            value: `${num(frame.sensors)}/${num(
              channelTotal
            )}`,
            note:
              liveChannels > 0
                ? `${liveChannels} overridden by gateway packets.`
                : "Model channels. A gateway can override any key.",
            domain: "energy",
          },
          {
            label: "Assets in alarm",
            value: num(frame.alarms),
            note:
              frame.alarms > 0
                ? "At least one channel is outside its alarm band."
                : "No channel outside its alarm band.",
            tone:
              frame.alarms > 0 ? "danger" : "good",
            domain: "alert",
          },
          {
            label: "Assets on watch",
            value: num(frame.watches),
            note:
              frame.watches > 0
                ? "Outside normal band, inside alarm band."
                : "No channel outside its normal band.",
            tone:
              frame.watches > 0 ? "warn" : "default",
            domain: "energy",
          },
        ]}
      />

      <div className="split grid-cols-1 xl:grid-cols-12">
        <div className="xl:col-span-8">
          {/* Map View Mode Switcher */}
          <div className="flex items-center justify-between border-b border-rule bg-surface px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted font-bold">
                Map View:
              </span>
              <div className="inline-flex rounded-md border border-rule bg-surface-subtle p-0.5 shadow-xs">
                <button
                  type="button"
                  onClick={() => setMapMode("schematic")}
                  className={`flex items-center gap-1.5 px-3 py-1 text-[12px] font-medium rounded transition-all cursor-pointer ${
                    mapMode === "schematic"
                      ? "bg-[#173D32] text-white shadow-xs font-semibold"
                      : "text-muted hover:text-ink hover:bg-gray-100"
                  }`}
                >
                  <Compass size={13} />
                  <span>Instrument Flow Topology</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMapMode("gis")}
                  className={`flex items-center gap-1.5 px-3 py-1 text-[12px] font-medium rounded transition-all cursor-pointer ${
                    mapMode === "gis"
                      ? "bg-[#173D32] text-white shadow-xs font-semibold"
                      : "text-muted hover:text-ink hover:bg-gray-100"
                  }`}
                >
                  <Globe size={13} />
                  <span>Real Geographic GIS Map (WGS 84)</span>
                </button>
              </div>
            </div>

            <div className="font-mono text-[11px] text-muted hidden sm:block">
              {mapMode === "gis" ? "MapLibre GL JS · 26.719597° N, 75.593443° E" : "Twin Node Status Graph"}
            </div>
          </div>

          {mapMode === "gis" ? (
            <DhunGeographicMap
              registeredAssets={registeredAssets}
              selectedAssetId={selectedId}
              onSelectAsset={setSelectedId}
              height="580px"
            />
          ) : (
            <TwinMap
              nodes={frame.nodes}
              selectedId={selected?.id ?? null}
              onSelect={setSelectedId}
              paused={paused}
            />
          )}
        </div>

        <div className="xl:col-span-4">
          {registeredSelected ? (
            <AssetDetailInspector
              asset={registeredSelected}
              onClose={
                selectedId === "grid-hub"
                  ? undefined
                  : () => setSelectedId("grid-hub")
              }
            />
          ) : selected ? (
            <NodeDetail
              node={selected}
              at={frame.at}
              controls={controls}
              onControl={(key, value) =>
                setControls((current) => ({
                  ...current,
                  [`${selected.id}:${key}`]: value,
                }))
              }
            />
          ) : null}
        </div>
      </div>

      {/* Authoritative Central Asset Inventory Table (Section 4.A) */}
      <AssetInventoryTable
        onSelectAsset={(asset) => setSelectedId(asset.id)}
        selectedAssetId={selectedId}
        onOpenAddModal={() => setAddModalOpen(true)}
        onOpenTestLab={() => setTestLabOpen(true)}
      />

      <div className="split grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        <NodeRegister
          nodes={frame.nodes}
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
        />

        <AlertLog events={events} />

        <div className="md:col-span-2 xl:col-span-1">
          <ActionList actions={actions} />
        </div>
      </div>

      <GatewayCard
        feed={feed}
        endpoint={endpoint}
        channels={liveChannels}
        lastPacketAt={lastPacketAt}
        paused={paused}
      />

      <AddAssetModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAssetAdded={(newAsset) => setSelectedId(newAsset.id)}
      />

      <TestLabModal
        isOpen={testLabOpen}
        onClose={() => setTestLabOpen(false)}
        onSelectAsset={(asset) => setSelectedId(asset.id)}
      />
    </div>
  );
}
