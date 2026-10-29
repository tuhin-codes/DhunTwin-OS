/* ============================================================
   DHUN TWIN OS — REAL GEOGRAPHIC MAP & GIS INTEGRATION
   MapLibre GL JS engine with real WGS84 geographic coordinates,
   legitimate basemaps (Satellite, Standard/Streets, Topo),
   independent GIS layer management, spatial geodesic measurement,
   and integrated Digital Twin asset registry.
   ============================================================ */

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Layers,
  Ruler,
  Maximize2,
  FileText,
  AlertTriangle,
  RotateCcw,
  Crosshair,
  ChevronDown,
  Image as ImageIcon,
} from "lucide-react";

import type { FeatureCollection, Feature } from "geojson";
import type { BasemapStyle, GisLayerId, SpatialMeasurementMode, MeasurementPoint } from "./types";
import {
  DHUN_SITE_CENTER,
  DHUN_DEFAULT_ZOOM,
  PROPERTY_BOUNDARY_500AC,
  SURVEYED_BOUNDARY_422AC,
  BIORESERVE_ENVELOPE_400AC,
  CONSTRUCTION_ENVELOPE_100AC,
  WATER_BODIES_GEOJSON,
  GREEN_ECOLOGY_GEOJSON,
  UTILITIES_INFRASTRUCTURE_GEOJSON,
  RESIDENTIAL_CLUSTERS_GEOJSON,
  ACCESS_CIRCULATION_GEOJSON,
  CONTOURS_GEOJSON,
  DHUN_LOOP_GEOJSON,
  PHASE_ONE_PARCELS_GEOJSON,
  EXISTING_THICKETS_GEOJSON,
  GREEN_FINGERS_GEOJSON,
} from "./dhunGeoData";
import { GIS_LAYERS_REGISTRY } from "./gisMetadata";
import {
  calculatePathDistanceMeters,
  calculateGeodesicAreaSqm,
  formatDistance,
  formatArea,
} from "./spatialUtils";
import GisDataQualityModal from "./GisDataQualityModal";
import MasterplanReferenceModal from "../components/MasterplanReferenceModal";
import { useAssetRegistry } from "../registry/AssetRegistryContext";
import type { RegisteredAsset } from "../registry/types";

// Basemap raster tile & presentation vector style definitions
const BASEMAP_STYLES: Record<BasemapStyle, { name: string; style: maplibregl.StyleSpecification; attribution: string }> = {
  presentation: {
    name: "Masterplan Presentation",
    attribution: "Dhun Masterplan Cartography · Chak Gulabpura, Rajasthan",
    style: {
      version: 8,
      sources: {},
      layers: [
        {
          id: "presentation-background",
          type: "background",
          paint: {
            "background-color": "#F4F2EA",
          },
        },
      ],
    },
  },
  satellite: {
    name: "Satellite Imagery",
    attribution: "Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and GIS User Community",
    style: {
      version: 8,
      sources: {
        "esri-satellite": {
          type: "raster",
          tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
          tileSize: 256,
          attribution: "Esri World Imagery",
          maxzoom: 19,
        },
      },
      layers: [
        {
          id: "esri-satellite-layer",
          type: "raster",
          source: "esri-satellite",
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    },
  },
  streets: {
    name: "Standard / Streets",
    attribution: "© OpenStreetMap contributors, © CARTO",
    style: {
      version: 8,
      sources: {
        "carto-voyager": {
          type: "raster",
          tiles: ["https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"],
          tileSize: 256,
          attribution: "CARTO Voyager",
          maxzoom: 19,
        },
      },
      layers: [
        {
          id: "carto-voyager-layer",
          type: "raster",
          source: "carto-voyager",
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    },
  },
  terrain: {
    name: "Topographic / Terrain",
    attribution: "Tiles © Esri — Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey",
    style: {
      version: 8,
      sources: {
        "esri-topo": {
          type: "raster",
          tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"],
          tileSize: 256,
          attribution: "Esri World Topo Map",
          maxzoom: 19,
        },
      },
      layers: [
        {
          id: "esri-topo-layer",
          type: "raster",
          source: "esri-topo",
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    },
  },
};

// Domain color mapping for map markers
const DOMAIN_COLORS: Record<string, string> = {
  Energy: "#D9A441",      // Energy amber
  Water: "#315D78",       // Deep water blue
  Ecology: "#234638",     // Primary forest
  Agriculture: "#15372D", // Dark forest
  Buildings: "#C78F68",   // Residential earth
  Compute: "#8679A9",     // Compute lavender
  Mobility: "#7EAEC1",    // Water blue
  Waste: "#68736C",       // Secondary muted
};

export interface MapFeatureSelection {
  id?: string;
  name?: string;
  category?: string;
  source?: string;
  areaSqm?: number;
  areaAcres?: number;
  properties?: Record<string, any>;
  geometryType?: string;
}

interface DhunGeographicMapProps {
  registeredAssets?: RegisteredAsset[];
  selectedAssetId?: string;
  onSelectAsset?: (assetId: string) => void;
  onSelectFeature?: (feature: MapFeatureSelection) => void;
  className?: string;
  height?: string | number;
}

export default function DhunGeographicMap({
  registeredAssets = [],
  selectedAssetId,
  onSelectAsset,
  onSelectFeature,
  className = "",
  height = "640px",
}: DhunGeographicMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const measurementSourceRef = useRef<FeatureCollection>({
    type: "FeatureCollection",
    features: [],
  });

  const { alerts } = useAssetRegistry();

  // State
  const [activeBasemap, setActiveBasemap] = useState<BasemapStyle>("presentation");
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(DHUN_DEFAULT_ZOOM);
  const [qualityModalOpen, setQualityModalOpen] = useState(false);
  const [masterplanModalOpen, setMasterplanModalOpen] = useState(false);
  const [layersMenuOpen, setLayersMenuOpen] = useState(false);
  const [unmappedListOpen, setUnmappedListOpen] = useState(false);
  const [measurementMode, setMeasurementMode] = useState<SpatialMeasurementMode>("none");
  const [measurementPoints, setMeasurementPoints] = useState<MeasurementPoint[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Layer visibility state initialized from metadata defaults
  const [layerVisibility, setLayerVisibility] = useState<Record<GisLayerId, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const layer of GIS_LAYERS_REGISTRY) {
      initial[layer.id] = layer.defaultVisible;
    }
    return initial as Record<GisLayerId, boolean>;
  });

  // Separate assets into Mapped (verified real coordinates) vs Unmapped (missing coordinates)
  const { mappedAssets, unmappedAssets } = useMemo(() => {
    const mapped: RegisteredAsset[] = [];
    const unmapped: RegisteredAsset[] = [];

    for (const asset of registeredAssets) {
      const coords = asset.location?.coordinates;
      if (
        asset.location?.hasVerifiedCoordinates &&
        coords &&
        typeof coords.lat === "number" &&
        typeof coords.lng === "number" &&
        !isNaN(coords.lat) &&
        !isNaN(coords.lng) &&
        coords.lat !== 0 &&
        coords.lng !== 0
      ) {
        mapped.push(asset);
      } else {
        unmapped.push(asset);
      }
    }
    return { mappedAssets: mapped, unmappedAssets: unmapped };
  }, [registeredAssets]);

  // Active measurement calculation
  const measurementResult = useMemo(() => {
    if (measurementMode === "distance" && measurementPoints.length >= 2) {
      const distance = calculatePathDistanceMeters(measurementPoints);
      return {
        type: "Distance",
        value: formatDistance(distance),
        pointsCount: measurementPoints.length,
      };
    }
    if (measurementMode === "area" && measurementPoints.length >= 3) {
      const sqm = calculateGeodesicAreaSqm(measurementPoints);
      const formatted = formatArea(sqm);
      return {
        type: "Area",
        value: formatted.combined,
        pointsCount: measurementPoints.length,
      };
    }
    return null;
  }, [measurementMode, measurementPoints]);

  // Function to add all GeoJSON layers to the map
  const addGisLayersToMap = useCallback((map: maplibregl.Map) => {
    // 1. 500-Acre Masterplan Perimeter
    if (!map.getSource("src_property_500ac")) {
      map.addSource("src_property_500ac", { type: "geojson", data: PROPERTY_BOUNDARY_500AC });
      map.addLayer({
        id: "property_boundary_500ac_fill",
        type: "fill",
        source: "src_property_500ac",
        paint: {
          "fill-color": "#173D32",
          "fill-opacity": 0.06,
        },
      });
      map.addLayer({
        id: "property_boundary_500ac_line",
        type: "line",
        source: "src_property_500ac",
        paint: {
          "line-color": "#173D32",
          "line-width": 2.5,
          "line-dasharray": [4, 2],
        },
      });
    }

    // 2. 422.01-Acre Surveyed Land-Use Boundary
    if (!map.getSource("src_surveyed_422ac")) {
      map.addSource("src_surveyed_422ac", { type: "geojson", data: SURVEYED_BOUNDARY_422AC });
      map.addLayer({
        id: "surveyed_boundary_422ac_fill",
        type: "fill",
        source: "src_surveyed_422ac",
        paint: {
          "fill-color": "#2B6CB0",
          "fill-opacity": 0.08,
        },
      });
      map.addLayer({
        id: "surveyed_boundary_422ac_line",
        type: "line",
        source: "src_surveyed_422ac",
        paint: {
          "line-color": "#2B6CB0",
          "line-width": 2.2,
        },
      });
    }

    // 3. 400-Acre Protected Bioreserve Target Envelope
    if (!map.getSource("src_bioreserve_400ac")) {
      map.addSource("src_bioreserve_400ac", { type: "geojson", data: BIORESERVE_ENVELOPE_400AC });
      map.addLayer({
        id: "bioreserve_envelope_400ac_fill",
        type: "fill",
        source: "src_bioreserve_400ac",
        paint: {
          "fill-color": "#276749",
          "fill-opacity": 0.12,
        },
      });
      map.addLayer({
        id: "bioreserve_envelope_400ac_line",
        type: "line",
        source: "src_bioreserve_400ac",
        paint: {
          "line-color": "#276749",
          "line-width": 1.8,
          "line-dasharray": [3, 2],
        },
      });
    }

    // 4. ≤100-Acre Permitted Construction Envelope
    if (!map.getSource("src_construction_100ac")) {
      map.addSource("src_construction_100ac", { type: "geojson", data: CONSTRUCTION_ENVELOPE_100AC });
      map.addLayer({
        id: "construction_envelope_100ac_fill",
        type: "fill",
        source: "src_construction_100ac",
        paint: {
          "fill-color": "#D97706",
          "fill-opacity": 0.08,
        },
      });
      map.addLayer({
        id: "construction_envelope_100ac_line",
        type: "line",
        source: "src_construction_100ac",
        paint: {
          "line-color": "#D97706",
          "line-width": 1.8,
          "line-dasharray": [2, 2],
        },
      });
    }

    // 5. Water Bodies (Ponds P1-P6 & Swales)
    if (!map.getSource("src_water_bodies")) {
      map.addSource("src_water_bodies", { type: "geojson", data: WATER_BODIES_GEOJSON });
      map.addLayer({
        id: "water_bodies_fill",
        type: "fill",
        source: "src_water_bodies",
        paint: {
          "fill-color": "#3182CE",
          "fill-opacity": 0.55,
        },
      });
      map.addLayer({
        id: "water_bodies_line",
        type: "line",
        source: "src_water_bodies",
        paint: {
          "line-color": "#2B6CB0",
          "line-width": 2,
        },
      });
    }

    // 6. Green Ecology
    if (!map.getSource("src_green_ecology")) {
      map.addSource("src_green_ecology", { type: "geojson", data: GREEN_ECOLOGY_GEOJSON });
      map.addLayer({
        id: "green_ecology_fill",
        type: "fill",
        source: "src_green_ecology",
        paint: {
          "fill-color": "#38A169",
          "fill-opacity": 0.35,
        },
      });
      map.addLayer({
        id: "green_ecology_line",
        type: "line",
        source: "src_green_ecology",
        paint: {
          "line-color": "#22543D",
          "line-width": 1.2,
        },
      });
    }

    // 7. Utilities & Infrastructure (Solar Farm, Substation, STP, Compute)
    if (!map.getSource("src_utilities_infra")) {
      map.addSource("src_utilities_infra", { type: "geojson", data: UTILITIES_INFRASTRUCTURE_GEOJSON });
      map.addLayer({
        id: "solar_infrastructure_fill",
        type: "fill",
        source: "src_utilities_infra",
        paint: {
          "fill-color": "#DD6B20",
          "fill-opacity": 0.35,
        },
      });
      map.addLayer({
        id: "solar_infrastructure_line",
        type: "line",
        source: "src_utilities_infra",
        paint: {
          "line-color": "#C05621",
          "line-width": 2,
        },
      });
    }

    // 8. Residential Clusters
    if (!map.getSource("src_residential")) {
      map.addSource("src_residential", { type: "geojson", data: RESIDENTIAL_CLUSTERS_GEOJSON });
      map.addLayer({
        id: "residential_clusters_fill",
        type: "fill",
        source: "src_residential",
        paint: {
          "fill-color": "#718096",
          "fill-opacity": 0.25,
        },
      });
      map.addLayer({
        id: "residential_clusters_line",
        type: "line",
        source: "src_residential",
        paint: {
          "line-color": "#2D3748",
          "line-width": 1.5,
        },
      });
    }

    // 9. Roads & Circulation Routes
    if (!map.getSource("src_roads")) {
      map.addSource("src_roads", { type: "geojson", data: ACCESS_CIRCULATION_GEOJSON });
      map.addLayer({
        id: "access_roads_line",
        type: "line",
        source: "src_roads",
        paint: {
          "line-color": "#CBD5E0",
          "line-width": 3,
        },
      });
    }

    // 10. Elevation Contours
    if (!map.getSource("src_contours")) {
      map.addSource("src_contours", { type: "geojson", data: CONTOURS_GEOJSON });
      map.addLayer({
        id: "contour_lines_line",
        type: "line",
        source: "src_contours",
        paint: {
          "line-color": "#A0AEC0",
          "line-width": 1.2,
          "line-dasharray": [1, 1],
        },
      });
    }

    // 11. Existing Thickets
    if (!map.getSource("src_existing_thickets")) {
      map.addSource("src_existing_thickets", { type: "geojson", data: EXISTING_THICKETS_GEOJSON });
      map.addLayer({
        id: "existing_thickets_fill",
        type: "fill",
        source: "src_existing_thickets",
        paint: {
          "fill-color": "#15372D",
          "fill-opacity": 0.35,
        },
      });
      map.addLayer({
        id: "existing_thickets_line",
        type: "line",
        source: "src_existing_thickets",
        paint: {
          "line-color": "#15372D",
          "line-width": 1.5,
        },
      });
    }

    // 12. Green Fingers Radiating Corridors
    if (!map.getSource("src_green_fingers")) {
      map.addSource("src_green_fingers", { type: "geojson", data: GREEN_FINGERS_GEOJSON });
      map.addLayer({
        id: "green_fingers_fill",
        type: "fill",
        source: "src_green_fingers",
        paint: {
          "fill-color": "#A8B996",
          "fill-opacity": 0.35,
        },
      });
      map.addLayer({
        id: "green_fingers_line",
        type: "line",
        source: "src_green_fingers",
        paint: {
          "line-color": "#7E9369",
          "line-width": 1.5,
        },
      });
    }

    // 13. The Dhun Loop (6m Mobility Spine)
    if (!map.getSource("src_dhun_loop")) {
      map.addSource("src_dhun_loop", { type: "geojson", data: DHUN_LOOP_GEOJSON });
      map.addLayer({
        id: "dhun_loop_line",
        type: "line",
        source: "src_dhun_loop",
        paint: {
          "line-color": "#D9A441",
          "line-width": 4,
        },
      });
    }

    // 14. Phase One Development Parcels
    if (!map.getSource("src_phase_one_parcels")) {
      map.addSource("src_phase_one_parcels", { type: "geojson", data: PHASE_ONE_PARCELS_GEOJSON });
      map.addLayer({
        id: "phase_one_parcels_fill",
        type: "fill",
        source: "src_phase_one_parcels",
        paint: {
          "fill-color": ["coalesce", ["get", "fillColor"], "#C78F68"],
          "fill-opacity": 0.28,
        },
      });
      map.addLayer({
        id: "phase_one_parcels_line",
        type: "line",
        source: "src_phase_one_parcels",
        paint: {
          "line-color": ["coalesce", ["get", "fillColor"], "#C78F68"],
          "line-width": 2,
        },
      });
    }

    // 15. Dynamic Measurement Layer
    if (!map.getSource("src_measurement")) {
      map.addSource("src_measurement", {
        type: "geojson",
        data: measurementSourceRef.current,
      });
      map.addLayer({
        id: "measurement_fill",
        type: "fill",
        source: "src_measurement",
        paint: {
          "fill-color": "#D69E2E",
          "fill-opacity": 0.25,
        },
      });
      map.addLayer({
        id: "measurement_line",
        type: "line",
        source: "src_measurement",
        paint: {
          "line-color": "#B7791F",
          "line-width": 2.5,
          "line-dasharray": [2, 1],
        },
      });
    }
  }, []);

  // Update layer visibility dynamically
  const applyLayerVisibility = useCallback((map: maplibregl.Map, visibility: Record<GisLayerId, boolean>) => {
    const layerMapping: Record<GisLayerId, string[]> = {
      property_boundary_500ac: ["property_boundary_500ac_fill", "property_boundary_500ac_line"],
      surveyed_boundary_422ac: ["surveyed_boundary_422ac_fill", "surveyed_boundary_422ac_line"],
      bioreserve_envelope_400ac: ["bioreserve_envelope_400ac_fill", "bioreserve_envelope_400ac_line"],
      construction_envelope_100ac: ["construction_envelope_100ac_fill", "construction_envelope_100ac_line"],
      water_bodies: ["water_bodies_fill", "water_bodies_line"],
      existing_thickets: ["existing_thickets_fill", "existing_thickets_line"],
      green_fingers: ["green_fingers_fill", "green_fingers_line"],
      residential_clusters: ["residential_clusters_fill", "residential_clusters_line"],
      dhun_loop: ["dhun_loop_line"],
      phase_one_parcels: ["phase_one_parcels_fill", "phase_one_parcels_line"],
      mixed_use: [],
      commercial_nodes: [],
      institutional_hubs: [],
      solar_infrastructure: ["solar_infrastructure_fill", "solar_infrastructure_line"],
      substation_grid: ["solar_infrastructure_fill", "solar_infrastructure_line"],
      stp_dewats: ["solar_infrastructure_fill", "solar_infrastructure_line"],
      access_roads: ["access_roads_line"],
      landscape_restoration: [],
      swales_catchment: [],
      water_infrastructure: [],
      registered_assets: [],
      contour_lines: ["contour_lines_line"],
    };

    for (const [layerId, isVisible] of Object.entries(visibility)) {
      const mapLayerIds = layerMapping[layerId as GisLayerId] || [];
      for (const mId of mapLayerIds) {
        if (map.getLayer(mId)) {
          map.setLayoutProperty(mId, "visibility", isVisible ? "visible" : "none");
        }
      }
    }
  }, []);

  // Update measurement GeoJSON source
  const updateMeasurementGeoJSON = useCallback((points: MeasurementPoint[], mode: SpatialMeasurementMode) => {
    if (!mapRef.current) return;
    const source = mapRef.current.getSource("src_measurement") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    if (points.length === 0 || mode === "none") {
      measurementSourceRef.current = { type: "FeatureCollection", features: [] };
      source.setData(measurementSourceRef.current);
      return;
    }

    const coordinates = points.map((p) => [p.lng, p.lat]);
    const features: Feature[] = [];

    if (mode === "distance" && points.length >= 2) {
      features.push({
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates,
        },
      });
    } else if (mode === "area" && points.length >= 3) {
      const closedCoords = [...coordinates, coordinates[0]];
      features.push({
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [closedCoords],
        },
      });
    }

    measurementSourceRef.current = { type: "FeatureCollection", features };
    source.setData(measurementSourceRef.current);
  }, []);

  // Sync measurement state with GeoJSON
  useEffect(() => {
    updateMeasurementGeoJSON(measurementPoints, measurementMode);
  }, [measurementPoints, measurementMode, updateMeasurementGeoJSON]);

  // Update HTML markers for registered digital-twin assets
  const updateAssetMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const showAssets = layerVisibility.registered_assets ?? true;

    if (!showAssets) {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      return;
    }

    const currentMarkerIds = new Set<string>();

    for (const asset of mappedAssets) {
      const coords = asset.location?.coordinates;
      if (!coords) continue;
      const { lat, lng } = coords;
      currentMarkerIds.add(asset.id);

      let marker = markersRef.current.get(asset.id);
      const isSelected = selectedAssetId === asset.id;
      const domainColor = DOMAIN_COLORS[asset.domain] || "#173D32";
      const isPlanned = asset.commissioningStatus === "Planned";
      const hasAlarm = alerts.some((a) => a.assetId === asset.id);
      const isDisconnected = asset.connectivityStatus === "Disconnected";
      const isIntermittent = asset.connectivityStatus === "Intermittent";

      if (!marker) {
        const el = document.createElement("div");
        el.className = `dhun-asset-marker group cursor-pointer transition-transform duration-150 hover:scale-125 z-10`;
        el.style.width = "28px";
        el.style.height = "28px";
        el.setAttribute("data-asset-id", asset.id);

        el.innerHTML = `
          <div class="relative flex items-center justify-center w-full h-full">
            <div class="selection-halo absolute -inset-1 rounded-full border-2 border-accent border-dashed ${isSelected ? "opacity-100" : "opacity-0"}" style="border-color: #173D32;"></div>
            <div class="w-5 h-5 rounded-full flex items-center justify-center text-white shadow-md border-2 border-white transition-all" style="background-color: ${domainColor}; border-style: ${isPlanned ? "dashed" : "solid"}; opacity: ${isDisconnected ? "0.6" : "1.0"};">
              <span class="text-[9px] font-mono font-bold leading-none">${asset.name.charAt(0)}</span>
            </div>
            ${
              hasAlarm
                ? `<span class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white animate-ping"></span>
                   <span class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white"></span>`
                : ""
            }
            ${
              isIntermittent || isDisconnected
                ? `<span class="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full border border-white"></span>`
                : ""
            }
          </div>
        `;

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          if (onSelectAsset) {
            onSelectAsset(asset.id);
          }

          const popup = new maplibregl.Popup({ offset: 15, closeButton: true, className: "dhun-map-popup" })
            .setLngLat([lng, lat])
            .setHTML(`
              <div class="p-3 text-[13px] font-sans max-w-[280px]">
                <div class="flex items-center justify-between gap-2 mb-1.5 border-b border-gray-200 pb-1.5">
                  <span class="font-mono text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded text-white" style="background-color: ${domainColor}">
                    ${asset.domain}
                  </span>
                  <span class="font-mono text-[10.5px] text-gray-500 font-semibold">${asset.id}</span>
                </div>
                <h4 class="font-bold text-[14px] text-gray-900 leading-tight">${asset.name}</h4>
                <p class="text-[11px] text-gray-500 mt-0.5">${asset.type} · ${asset.location?.parcelName || "Dhun Site"}</p>
                
                <div class="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between text-[11.5px]">
                  <span class="text-gray-600">Coordinates:</span>
                  <span class="font-mono text-[11px] text-gray-800 font-medium">${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E</span>
                </div>

                <div class="mt-1 flex items-center justify-between text-[11.5px]">
                  <span class="text-gray-600">Status:</span>
                  <span class="font-medium ${hasAlarm ? "text-red-700 font-semibold" : "text-emerald-700"}">
                    ${asset.commissioningStatus} (${asset.connectivityStatus || "Connected"})
                  </span>
                </div>

                <div class="mt-3 pt-2 border-t border-gray-200 flex gap-2">
                  <button id="btn-inspect-${asset.id}" class="w-full bg-[#173D32] hover:bg-[#12482E] text-white py-1 px-2.5 rounded text-[11.5px] font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer">
                    Inspect in Asset Registry →
                  </button>
                </div>
              </div>
            `);

          popup.addTo(map);

          setTimeout(() => {
            const btn = document.getElementById(`btn-inspect-${asset.id}`);
            if (btn && onSelectAsset) {
              btn.onclick = () => onSelectAsset(asset.id);
            }
          }, 50);
        });

        marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
        markersRef.current.set(asset.id, marker);
      } else {
        const el = marker.getElement();
        const halo = el.querySelector(".selection-halo");
        if (halo) {
          if (isSelected) {
            halo.classList.remove("opacity-0");
            halo.classList.add("opacity-100");
          } else {
            halo.classList.add("opacity-0");
            halo.classList.remove("opacity-100");
          }
        }
      }
    }

    markersRef.current.forEach((marker, id) => {
      if (!currentMarkerIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });
  }, [mappedAssets, selectedAssetId, onSelectAsset, layerVisibility, alerts]);

  // Initialize MapLibre GL map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: BASEMAP_STYLES[activeBasemap].style,
        center: DHUN_SITE_CENTER,
        zoom: DHUN_DEFAULT_ZOOM,
        pitch: 0,
        bearing: 0,
        attributionControl: false,
      });

      mapRef.current = map;

      map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), "top-right");
      map.addControl(new maplibregl.FullscreenControl(), "top-right");
      map.addControl(new maplibregl.ScaleControl({ unit: "metric", maxWidth: 150 }), "bottom-left");

      map.on("mousemove", (e) => {
        setCursorCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      });

      map.on("zoom", () => {
        setCurrentZoom(map.getZoom());
      });

      map.on("click", (e) => {
        setMeasurementMode((currentMode) => {
          if (currentMode !== "none") {
            setMeasurementPoints((prev) => [...prev, { lat: e.lngLat.lat, lng: e.lngLat.lng }]);
          }
          return currentMode;
        });
      });

      const attachFeatureListeners = (m: maplibregl.Map) => {
        const interactiveLayers = [
          "phase_one_parcels_fill",
          "dhun_loop_line",
          "water_bodies_fill",
          "existing_thickets_fill",
          "green_fingers_fill",
          "residential_clusters_fill",
          "solar_infrastructure_fill",
          "bioreserve_envelope_400ac_fill",
          "surveyed_boundary_422ac_fill",
        ];

        for (const layerId of interactiveLayers) {
          if (m.getLayer(layerId)) {
            m.on("click", layerId, (e) => {
              if (e.features && e.features[0]) {
                const feat = e.features[0];
                const props = feat.properties || {};
                if (onSelectFeature) {
                  onSelectFeature({
                    id: (feat.id as string) || props.id || props.name,
                    name: props.name || props.label || "Selected Masterplan Zone",
                    category: props.classification || props.domain || props.use || "Masterplan Zone",
                    source: props.source || "Dhun Reference Plan",
                    areaSqm: props.areaSqm ? Number(props.areaSqm) : undefined,
                    areaAcres: props.areaAcres ? Number(props.areaAcres) : undefined,
                    properties: props,
                    geometryType: feat.geometry.type,
                  });
                }
              }
            });

            m.on("mouseenter", layerId, () => {
              m.getCanvas().style.cursor = "pointer";
            });
            m.on("mouseleave", layerId, () => {
              m.getCanvas().style.cursor = "";
            });
          }
        }
      };

      map.on("load", () => {
        setMapLoaded(true);
        addGisLayersToMap(map);
        applyLayerVisibility(map, layerVisibility);
        attachFeatureListeners(map);
      });

      return () => {
        markersRef.current.forEach((marker) => marker.remove());
        markersRef.current.clear();
        map.remove();
        mapRef.current = null;
      };
    } catch (err) {
      console.error("Failed to initialize MapLibre GL map:", err);
      setMapError("Failed to initialize geographic map engine. WebGL may be disabled.");
    }
  }, []);

  // Switch basemap style dynamically
  const handleBasemapChange = (newStyle: BasemapStyle) => {
    if (!mapRef.current || newStyle === activeBasemap) return;
    setActiveBasemap(newStyle);

    const map = mapRef.current;
    map.setStyle(BASEMAP_STYLES[newStyle].style);

    map.once("style.load", () => {
      addGisLayersToMap(map);
      applyLayerVisibility(map, layerVisibility);
      updateMeasurementGeoJSON(measurementPoints, measurementMode);
      
      const interactiveLayers = [
        "phase_one_parcels_fill",
        "dhun_loop_line",
        "water_bodies_fill",
        "existing_thickets_fill",
        "green_fingers_fill",
        "residential_clusters_fill",
        "solar_infrastructure_fill",
        "bioreserve_envelope_400ac_fill",
        "surveyed_boundary_422ac_fill",
      ];
      for (const layerId of interactiveLayers) {
        if (map.getLayer(layerId)) {
          map.on("click", layerId, (e) => {
            if (e.features && e.features[0] && onSelectFeature) {
              const feat = e.features[0];
              const props = feat.properties || {};
              onSelectFeature({
                id: (feat.id as string) || props.id || props.name,
                name: props.name || props.label || "Selected Masterplan Zone",
                category: props.classification || props.domain || props.use || "Masterplan Zone",
                source: props.source || "Dhun Reference Plan",
                areaSqm: props.areaSqm ? Number(props.areaSqm) : undefined,
                areaAcres: props.areaAcres ? Number(props.areaAcres) : undefined,
                properties: props,
                geometryType: feat.geometry.type,
              });
            }
          });
          map.on("mouseenter", layerId, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", layerId, () => {
            map.getCanvas().style.cursor = "";
          });
        }
      }
    });
  };

  // Sync layer visibility changes
  useEffect(() => {
    if (mapRef.current && mapLoaded) {
      applyLayerVisibility(mapRef.current, layerVisibility);
    }
    updateAssetMarkers();
  }, [layerVisibility, mapLoaded, applyLayerVisibility, updateAssetMarkers]);

  // Recenter to Dhun site datum
  const handleRecenterDhun = () => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: DHUN_SITE_CENTER,
      zoom: DHUN_DEFAULT_ZOOM,
      pitch: 0,
      bearing: 0,
      essential: true,
      duration: 1200,
    });
  };

  // Navigate to specific zoom presets
  const handleZoomPreset = (zoom: number) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: DHUN_SITE_CENTER,
      zoom,
      essential: true,
      duration: 1000,
    });
  };

  const toggleLayer = (layerId: GisLayerId) => {
    setLayerVisibility((prev) => ({
      ...prev,
      [layerId]: !prev[layerId],
    }));
  };

  const toggleCategory = (categoryName: string, enable: boolean) => {
    const categoryLayers = GIS_LAYERS_REGISTRY.filter((l) => l.category === categoryName);
    setLayerVisibility((prev) => {
      const next = { ...prev };
      for (const l of categoryLayers) {
        next[l.id] = enable;
      }
      return next;
    });
  };

  return (
    <div className={`relative border border-rule bg-surface overflow-hidden flex flex-col ${className}`}>
      {/* Top Map Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule bg-surface-subtle px-4 py-2.5 text-[13px] z-20">
        {/* Left: Datum location badge & Basemap Switcher */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-ink bg-white border border-rule px-2.5 py-1 rounded shadow-xs">
            <Crosshair size={13} className="text-accent" />
            <span>26.719597° N, 75.593443° E</span>
            <span className="text-muted font-normal">· Dhun, Chak Gulabpura, RJ</span>
          </div>

          {/* Basemap Switcher Buttons */}
          <div className="inline-flex rounded-md border border-rule bg-white p-0.5 shadow-xs">
            {(
              [
                { id: "presentation", label: "Masterplan" },
                { id: "satellite", label: "Satellite" },
                { id: "streets", label: "Streets" },
                { id: "terrain", label: "Terrain" },
              ] as { id: BasemapStyle; label: string }[]
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleBasemapChange(id)}
                className={`px-2.5 py-1 text-[11.5px] font-medium rounded transition-all cursor-pointer ${
                  activeBasemap === id
                    ? "bg-[#234638] text-white shadow-xs font-semibold"
                    : "text-muted hover:text-ink hover:bg-gray-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Layer Manager, Measurement Tool, Data Quality Modal Button, Masterplan Archive */}
        <div className="flex items-center gap-2">
          {/* Masterplan Reference Archive Modal Button */}
          <button
            type="button"
            onClick={() => setMasterplanModalOpen(true)}
            className="btn btn-sm btn-outline flex items-center gap-1.5 text-[11.5px] py-1 px-2.5 text-ink hover:bg-[#E5EBDD] border-rule cursor-pointer"
            title="Inspect high-resolution authentic masterplan drawings (Phase 1, Blue-Green, Typologies, Mobility, First Principles)"
          >
            <ImageIcon size={13} className="text-[#234638]" />
            <span className="font-semibold text-[#234638]">Masterplan Archive</span>
          </button>
          {/* Zoom Presets Menu */}
          <div className="hidden sm:flex items-center gap-1 font-mono text-[11px] text-muted border-r border-rule pr-2 mr-1">
            <span className="text-[10px] uppercase font-bold">Zoom:</span>
            <button
              type="button"
              onClick={() => handleZoomPreset(11.5)}
              className="px-1.5 py-0.5 rounded hover:bg-gray-200 hover:text-ink cursor-pointer"
              title="Regional Watershed Context"
            >
              Regional
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => handleZoomPreset(DHUN_DEFAULT_ZOOM)}
              className="px-1.5 py-0.5 rounded hover:bg-gray-200 hover:text-ink font-semibold text-accent cursor-pointer"
              title="500-Acre Masterplan Overview"
            >
              Site
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => handleZoomPreset(17.2)}
              className="px-1.5 py-0.5 rounded hover:bg-gray-200 hover:text-ink cursor-pointer"
              title="Cluster & Parcel Level"
            >
              Cluster
            </button>
          </div>

          {/* Recenter Button */}
          <button
            type="button"
            onClick={handleRecenterDhun}
            className="btn btn-sm btn-outline flex items-center gap-1 text-[11.5px] py-1 px-2.5 cursor-pointer"
            title="Reset camera to Dhun center coordinate"
          >
            <RotateCcw size={12} />
            Recenter
          </button>

          {/* Spatial Measurement Toggle */}
          <div className="relative inline-flex rounded-md border border-rule bg-white p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => {
                setMeasurementMode((m) => (m === "distance" ? "none" : "distance"));
                setMeasurementPoints([]);
              }}
              className={`px-2 py-1 text-[11px] font-medium rounded flex items-center gap-1 cursor-pointer ${
                measurementMode === "distance" ? "bg-amber-700 text-white font-semibold" : "text-muted hover:text-ink"
              }`}
              title="Measure geodesic path distance"
            >
              <Ruler size={12} />
              Distance
            </button>
            <button
              type="button"
              onClick={() => {
                setMeasurementMode((m) => (m === "area" ? "none" : "area"));
                setMeasurementPoints([]);
              }}
              className={`px-2 py-1 text-[11px] font-medium rounded flex items-center gap-1 cursor-pointer ${
                measurementMode === "area" ? "bg-amber-700 text-white font-semibold" : "text-muted hover:text-ink"
              }`}
              title="Measure geodesic polygon area"
            >
              <Maximize2 size={12} />
              Area
            </button>
            {measurementMode !== "none" && (
              <button
                type="button"
                onClick={() => {
                  setMeasurementMode("none");
                  setMeasurementPoints([]);
                }}
                className="px-1.5 py-1 text-[10px] text-red-600 hover:bg-red-50 rounded cursor-pointer"
                title="Clear measurements"
              >
                ✕
              </button>
            )}
          </div>

          {/* Layers Toggle Button */}
          <button
            type="button"
            onClick={() => setLayersMenuOpen((open) => !open)}
            className={`btn btn-sm flex items-center gap-1.5 text-[12px] py-1 px-2.5 cursor-pointer ${
              layersMenuOpen ? "btn-accent" : "btn-outline"
            }`}
          >
            <Layers size={13} />
            <span>GIS Layers</span>
            <ChevronDown size={12} className={`transition-transform ${layersMenuOpen ? "rotate-180" : ""}`} />
          </button>

          {/* GIS Data Quality / Provenance Modal Trigger */}
          <button
            type="button"
            onClick={() => setQualityModalOpen(true)}
            className="btn btn-sm btn-outline flex items-center gap-1 text-[12px] py-1 px-2.5 text-accent hover:bg-accent-tint border-accent/30 cursor-pointer"
            title="Inspect GIS Provenance, CRS, and 500ac vs 422.01ac reconciliation report"
          >
            <FileText size={13} />
            <span>Data Quality</span>
          </button>
        </div>
      </div>

      {/* Boundary Discrepancy Callout Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F6F5F0] border-b border-rule px-4 py-1.5 text-[11.5px] z-10">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink">Boundary Provenance:</span>
          <span className="text-muted">
            500.00-acre masterplan concession vs 422.01-acre surveyed land-use schedule (77.99-acre peripheral buffer).
          </span>
          <span className="font-mono text-[10.5px] font-bold text-accent bg-accent-tint px-1.5 py-0.2 rounded border border-accent/20">
            Unreconciled by design
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span className="text-muted">
            Mapped Assets: <strong className="text-ink">{mappedAssets.length}</strong>
          </span>
          {unmappedAssets.length > 0 && (
            <button
              type="button"
              onClick={() => setUnmappedListOpen((o) => !o)}
              className="text-amber-800 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
            >
              <AlertTriangle size={11} />
              {unmappedAssets.length} unmapped (no fake coords)
            </button>
          )}
        </div>
      </div>

      {/* Main Map Canvas Area */}
      <div className="relative flex-1 w-full" style={{ minHeight: height }}>
        {mapError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-surface text-center">
            <AlertTriangle size={36} className="text-danger mb-3" />
            <h3 className="text-[17px] font-semibold text-ink mb-1">Geographic Engine Notice</h3>
            <p className="text-[13px] text-muted max-w-md">{mapError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn btn-sm btn-accent mt-4"
            >
              Reload Page
            </button>
          </div>
        ) : (
          <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
        )}

        {/* Floating Active Measurement HUD Banner */}
        {measurementMode !== "none" && (
          <div className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur-xs border border-amber-600/40 rounded-lg p-3 shadow-lg max-w-xs text-[12.5px]">
            <div className="flex items-center justify-between border-b border-rule pb-1.5 mb-2">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <Ruler size={14} />
                <span>Geodesic Measurement Active</span>
              </div>
              <span className="font-mono text-[10.5px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold capitalize">
                {measurementMode}
              </span>
            </div>
            <p className="text-[12px] text-muted leading-relaxed">
              {measurementMode === "distance"
                ? "Click on the map to place vertices along a path."
                : "Click 3 or more points on the map to define a polygon boundary."}
            </p>
            {measurementResult ? (
              <div className="mt-2.5 pt-2 border-t border-rule bg-amber-50/70 p-2 rounded">
                <div className="text-[10.5px] uppercase tracking-wider text-amber-800 font-bold font-mono">
                  Calculated {measurementResult.type} ({measurementResult.pointsCount} points)
                </div>
                <div className="font-mono text-[14.5px] font-bold text-amber-950 mt-0.5">
                  {measurementResult.value}
                </div>
              </div>
            ) : (
              <div className="mt-2 font-mono text-[11px] text-muted italic">
                Placed points: {measurementPoints.length}
              </div>
            )}
            <div className="mt-2.5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setMeasurementPoints([])}
                className="text-[11px] font-semibold text-muted hover:text-ink cursor-pointer"
              >
                Reset Points
              </button>
              <button
                type="button"
                onClick={() => {
                  setMeasurementMode("none");
                  setMeasurementPoints([]);
                }}
                className="text-[11px] font-semibold text-red-700 hover:text-red-900 cursor-pointer"
              >
                Close Tool
              </button>
            </div>
          </div>
        )}

        {/* Floating Layers Visibility Menu Drawer */}
        {layersMenuOpen && (
          <div className="absolute top-4 right-4 z-20 w-80 max-h-[85%] bg-white/95 backdrop-blur-md border border-rule rounded-lg shadow-xl overflow-y-auto text-[13px] flex flex-col">
            <div className="flex items-center justify-between border-b border-rule p-3 bg-surface-subtle sticky top-0 z-10">
              <div className="flex items-center gap-1.5 font-bold text-ink">
                <Layers size={15} className="text-accent" />
                <span>GIS Layers & Boundaries</span>
              </div>
              <button
                type="button"
                onClick={() => setLayersMenuOpen(false)}
                className="text-muted hover:text-ink text-[16px] leading-none px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 divide-y divide-rule space-y-3">
              {(
                [
                  "Landscape and Ecology",
                  "Water Systems",
                  "Masterplan and Neighbourhoods",
                  "Energy and Infrastructure",
                  "Digital Twin Assets",
                ] as const
              ).map((catName) => {
                const catLayers = GIS_LAYERS_REGISTRY.filter((l) => l.category === catName);
                if (catLayers.length === 0) return null;

                const allActive = catLayers.every((l) => layerVisibility[l.id]);

                return (
                  <div key={catName} className="pt-2.5 first:pt-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-muted">
                        {catName}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleCategory(catName, !allActive)}
                        className="text-[10.5px] font-semibold text-accent hover:underline cursor-pointer"
                      >
                        {allActive ? "Hide All" : "Show All"}
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {catLayers.map((layer) => {
                        const isVisible = layerVisibility[layer.id];
                        return (
                          <label
                            key={layer.id}
                            className="flex items-start gap-2.5 py-1 px-1.5 rounded hover:bg-gray-100/70 cursor-pointer text-[12px]"
                          >
                            <input
                              type="checkbox"
                              checked={isVisible}
                              onChange={() => toggleLayer(layer.id)}
                              className="mt-0.5 rounded border-gray-300 text-accent focus:ring-accent"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <span className={`font-medium ${isVisible ? "text-ink" : "text-muted"}`}>
                                  {layer.name}
                                </span>
                                <span
                                  className="w-2.5 h-2.5 rounded-xs shrink-0 ml-1 border border-black/20"
                                  style={{ backgroundColor: layer.color }}
                                />
                              </div>
                              <div className="text-[10.5px] text-muted flex items-center justify-between mt-0.5">
                                <span>{layer.areaAcres ? `${layer.areaAcres} ac` : layer.geometryType}</span>
                                <span className="font-mono">{layer.verificationStatus.replace(" source", "")}</span>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 border-t border-rule bg-gray-50 text-[11px] text-muted flex items-center justify-between">
              <span>Projection: EPSG:4326 (WGS 84)</span>
              <button
                type="button"
                onClick={() => setQualityModalOpen(true)}
                className="font-semibold text-accent hover:underline cursor-pointer"
              >
                Provenance Details →
              </button>
            </div>
          </div>
        )}

        {/* Floating Unmapped Assets Drawer */}
        {unmappedListOpen && (
          <div className="absolute top-4 left-4 z-20 w-80 max-h-[80%] bg-white/95 backdrop-blur-md border border-amber-500/50 rounded-lg shadow-xl overflow-y-auto text-[13px] flex flex-col">
            <div className="flex items-center justify-between border-b border-rule p-3 bg-amber-50/80 sticky top-0 z-10">
              <div className="flex items-center gap-1.5 font-bold text-amber-950">
                <AlertTriangle size={15} className="text-amber-700" />
                <span>Unmapped Assets ({unmappedAssets.length})</span>
              </div>
              <button
                type="button"
                onClick={() => setUnmappedListOpen(false)}
                className="text-muted hover:text-ink text-[16px] leading-none px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 text-[12px] text-muted leading-relaxed border-b border-rule bg-amber-50/30">
              These assets are registered in the inventory but have no verified physical GIS coordinates.
              Per strict engineering standards, they are retained in the asset registry but not given fake coordinates.
            </div>

            <div className="divide-y divide-rule overflow-y-auto">
              {unmappedAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="p-3 hover:bg-gray-50 flex items-center justify-between cursor-pointer"
                  onClick={() => {
                    if (onSelectAsset) onSelectAsset(asset.id);
                  }}
                >
                  <div>
                    <h5 className="font-semibold text-ink text-[13px]">{asset.name}</h5>
                    <p className="font-mono text-[10.5px] text-muted">
                      {asset.id} · {asset.domain}
                    </p>
                  </div>
                  <span className="font-mono text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                    {asset.commissioningStatus}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Coordinate & Attribution Bar */}
        <div className="absolute bottom-1 right-2 z-10 flex flex-wrap items-center gap-3 font-mono text-[10.5px] text-white/90 bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded shadow-xs">
          <span>Zoom: {currentZoom.toFixed(1)}</span>
          <span>|</span>
          <span>
            Cursor:{" "}
            {cursorCoords
              ? `${cursorCoords.lat.toFixed(6)}° N, ${cursorCoords.lng.toFixed(6)}° E`
              : "Move mouse over map"}
          </span>
          <span>|</span>
          <span className="text-gray-300">
            {BASEMAP_STYLES[activeBasemap].attribution.slice(0, 48)}...
          </span>
        </div>
      </div>

      {/* GIS Data Quality & Provenance Modal */}
      <GisDataQualityModal
        isOpen={qualityModalOpen}
        onClose={() => setQualityModalOpen(false)}
      />

      {/* Masterplan Reference Drawings Modal */}
      <MasterplanReferenceModal
        isOpen={masterplanModalOpen}
        onClose={() => setMasterplanModalOpen(false)}
      />
    </div>
  );
}
