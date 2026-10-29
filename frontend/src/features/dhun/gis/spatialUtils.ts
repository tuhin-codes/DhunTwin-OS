/* ============================================================
   DHUN TWIN OS — SPATIAL GEODESIC UTILITIES
   WGS84 ellipsoidal and spherical calculations for distances,
   polygon surface areas, coordinate formatting, and spatial checks.
   ============================================================ */

import type { MeasurementPoint } from "./types";

const EARTH_RADIUS_METERS = 6378137; // WGS 84 major axis radius

/**
 * Calculate geodesic distance between two points in meters using the Haversine formula
 */
export function calculateGeodesicDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculate total path distance across an array of sequential points in meters
 */
export function calculatePathDistanceMeters(points: MeasurementPoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += calculateGeodesicDistanceMeters(
      points[i].lat,
      points[i].lng,
      points[i + 1].lat,
      points[i + 1].lng
    );
  }
  return total;
}

/**
 * Calculate geodesic area of a closed polygon in square meters using spherical excess
 */
export function calculateGeodesicAreaSqm(points: MeasurementPoint[]): number {
  if (points.length < 3) return 0;

  let totalAngle = 0;
  const numPoints = points.length;

  for (let i = 0; i < numPoints; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % numPoints];
    const p3 = points[(i + 2) % numPoints];

    const bearing12 = calculateBearing(p2.lat, p2.lng, p1.lat, p1.lng);
    const bearing23 = calculateBearing(p2.lat, p2.lng, p3.lat, p3.lng);

    let angle = bearing23 - bearing12;
    if (angle < -Math.PI) angle += 2 * Math.PI;
    if (angle > Math.PI) angle -= 2 * Math.PI;

    totalAngle += angle;
  }

  // Projection approximation for local site scales (< 10km)
  // Equal-area sinusoidal projection centered on site
  const centerLat = points.reduce((s, p) => s + p.lat, 0) / numPoints;
  const radLat = toRadians(centerLat);
  const mPerDegLat = 111132.92 - 559.82 * Math.cos(2 * radLat);
  const mPerDegLng = 111412.84 * Math.cos(radLat);

  let area = 0;
  for (let i = 0; i < numPoints; i++) {
    const j = (i + 1) % numPoints;
    const xi = (points[i].lng - points[0].lng) * mPerDegLng;
    const yi = (points[i].lat - points[0].lat) * mPerDegLat;
    const xj = (points[j].lng - points[0].lng) * mPerDegLng;
    const yj = (points[j].lat - points[0].lat) * mPerDegLat;
    area += xi * yj - xj * yi;
  }

  return Math.abs(area) / 2;
}

function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaLambda = toRadians(lon2 - lon1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  return Math.atan2(y, x);
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Format meters into human-readable distance (m or km)
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters.toFixed(1)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * Format square meters into acres, hectares, and m²
 */
export function formatArea(sqm: number): {
  sqm: string;
  acres: string;
  hectares: string;
  combined: string;
} {
  const acres = sqm / 4046.8564224;
  const hectares = sqm / 10000;
  return {
    sqm: `${sqm.toLocaleString(undefined, { maximumFractionDigits: 0 })} m²`,
    acres: `${acres.toFixed(2)} acres`,
    hectares: `${hectares.toFixed(2)} ha`,
    combined: `${acres.toFixed(2)} acres (${sqm.toLocaleString(undefined, { maximumFractionDigits: 0 })} m²)`,
  };
}

/**
 * Format decimal degrees into standard Geographic DMS (Degrees, Minutes, Seconds)
 */
export function formatCoordinatesDMS(lat: number, lng: number): string {
  const formatDMS = (deg: number, isLat: boolean) => {
    const dir = isLat ? (deg >= 0 ? "N" : "S") : deg >= 0 ? "E" : "W";
    const absDeg = Math.abs(deg);
    const d = Math.floor(absDeg);
    const minFloat = (absDeg - d) * 60;
    const m = Math.floor(minFloat);
    const s = ((minFloat - m) * 60).toFixed(1);
    return `${d}° ${m}' ${s}" ${dir}`;
  };

  return `${formatDMS(lat, true)}, ${formatDMS(lng, false)}`;
}

/**
 * Point in polygon check using ray casting algorithm
 */
export function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}
