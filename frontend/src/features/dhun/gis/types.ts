/* ============================================================
   DHUN TWIN OS — GIS & GEOGRAPHIC MAP TYPES
   Authoritative types for real geographic coordinates, GeoJSON
   layers, basemaps, spatial measurements, and GIS provenance.
   ============================================================ */

export type BasemapStyle = "satellite" | "streets" | "terrain" | "presentation";

export interface GeoCoordinate {
  lat: number;
  lng: number;
  elevationM?: number;
}

export type GisLayerId =
  | "property_boundary_500ac"
  | "surveyed_boundary_422ac"
  | "bioreserve_envelope_400ac"
  | "construction_envelope_100ac"
  | "existing_thickets"
  | "green_fingers"
  | "landscape_restoration"
  | "water_bodies"
  | "swales_catchment"
  | "water_infrastructure"
  | "residential_clusters"
  | "dhun_loop"
  | "phase_one_parcels"
  | "mixed_use"
  | "commercial_nodes"
  | "institutional_hubs"
  | "solar_infrastructure"
  | "substation_grid"
  | "stp_dewats"
  | "access_roads"
  | "registered_assets"
  | "contour_lines";

export type GisLayerCategory =
  | "Landscape and Ecology"
  | "Water Systems"
  | "Masterplan and Neighbourhoods"
  | "Energy and Infrastructure"
  | "Digital Twin Assets";

export type GisVerificationStatus =
  | "Verified source"
  | "Imported, not verified"
  | "Provisional"
  | "Missing source"
  | "Superseded";

export interface GisLayerMetadata {
  id: GisLayerId;
  name: string;
  category: GisLayerCategory;
  description: string;
  sourceDocument: string;
  sourceAuthority: string;
  surveyDate: string;
  crs: string; // e.g. "EPSG:4326 (WGS 84)"
  units: string;
  geometryType: "Polygon" | "MultiPolygon" | "LineString" | "Point" | "Mixed";
  featureCount: number;
  areaAcres?: number;
  areaSqm?: number;
  verificationStatus: GisVerificationStatus;
  knownLimitations: string;
  defaultVisible: boolean;
  color: string;
  fillOpacity?: number;
}

export type SpatialMeasurementMode = "none" | "distance" | "area";

export interface MeasurementPoint {
  lat: number;
  lng: number;
}

export interface ActiveMeasurement {
  mode: SpatialMeasurementMode;
  points: MeasurementPoint[];
  resultValue?: number; // meters for distance, sq meters for area
  formattedResult?: string;
}

export interface AssetMapFeatureProps {
  assetId: string;
  name: string;
  domain: string;
  assetType: string;
  lifecycleStatus: string;
  connectivityStatus: string;
  monitoringMode: string;
  primaryValue?: number;
  primaryUnit?: string;
  primaryLabel?: string;
  alertCount: number;
  hasActiveAlarm: boolean;
  isTestAsset: boolean;
  parcelName: string;
}
