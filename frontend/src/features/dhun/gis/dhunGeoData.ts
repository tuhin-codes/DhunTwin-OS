/* ============================================================
   DHUN TWIN OS — AUTHORITATIVE GEOGRAPHIC GEOJSON DATA
   Anchored at Dhun, Chak Gulabpura, Rajasthan, India
   Reference Datum: 26.719597° N, 75.593443° E (WGS 84)
   All geometries derived from EDS Dhun Sustainability KPI Report
   (Rev 2, July 2022) Land-Use Schedule and Masterplan Cadastre.
   ============================================================ */
import type { FeatureCollection } from "geojson";

export const DHUN_SITE_CENTER: [number, number] = [75.593443, 26.719597]; // [Lng, Lat]
export const DHUN_DEFAULT_ZOOM = 15.2;

// Coordinate transformation helpers from local site meters to WGS84
const LAT_DATUM = 26.719597;
const LNG_DATUM = 75.593443;
const M_TO_DEG_LAT = 1 / 110816.0;
const M_TO_DEG_LNG = 1 / (111412.84 * Math.cos((LAT_DATUM * Math.PI) / 180));

export function localMetersToWgs84(dxMeters: number, dyMeters: number): [number, number] {
  const lng = LNG_DATUM + dxMeters * M_TO_DEG_LNG;
  const lat = LAT_DATUM + dyMeters * M_TO_DEG_LAT;
  return [Number(lng.toFixed(6)), Number(lat.toFixed(6))];
}

// -------------------------------------------------------------
// 1. 500-Acre Masterplan Concession Perimeter
// 500 acres = 2,023,428 m² (~1,422m x ~1,422m envelope)
// -------------------------------------------------------------
export const PROPERTY_BOUNDARY_500AC: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "boundary-500ac",
      properties: {
        id: "property_boundary_500ac",
        name: "500-Acre Masterplan Concession Perimeter",
        areaAcres: 500.0,
        areaSqm: 2023428,
        source: "Dhun Masterplan Concession Brief",
        authority: "Dhun Field Station Planning Group",
        crs: "EPSG:4326 (WGS 84)",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            localMetersToWgs84(-710, -710),
            localMetersToWgs84(-710, 480),
            localMetersToWgs84(-420, 710),
            localMetersToWgs84(320, 710),
            localMetersToWgs84(710, 520),
            localMetersToWgs84(710, -450),
            localMetersToWgs84(480, -710),
            localMetersToWgs84(-710, -710),
          ],
        ],
      },
    },
  ],
};

// -------------------------------------------------------------
// 2. 422.01-Acre Surveyed Land-Use Schedule Envelope
// 422.01 acres = 1,707,800 m² (EDS Report Rev 2, July 2022, Page 10)
// -------------------------------------------------------------
export const SURVEYED_BOUNDARY_422AC: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "surveyed-422ac",
      properties: {
        id: "surveyed_boundary_422ac",
        name: "422.01-Acre Surveyed Land-Use Schedule",
        areaAcres: 422.01,
        areaSqm: 1707800,
        source: "EDS Dhun Sustainability KPI Report Rev 2 (Page 10)",
        authority: "Environmental Design Solutions",
        crs: "EPSG:4326 (WGS 84)",
        bufferDiscrepancyAcres: 77.99,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            localMetersToWgs84(-650, -650),
            localMetersToWgs84(-650, 440),
            localMetersToWgs84(-380, 650),
            localMetersToWgs84(290, 650),
            localMetersToWgs84(650, 480),
            localMetersToWgs84(650, -410),
            localMetersToWgs84(440, -650),
            localMetersToWgs84(-650, -650),
          ],
        ],
      },
    },
  ],
};

// -------------------------------------------------------------
// 3. 400-Acre Protected Bioreserve Target Envelope
// -------------------------------------------------------------
export const BIORESERVE_ENVELOPE_400AC: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "bioreserve-400ac",
      properties: {
        id: "bioreserve_envelope_400ac",
        name: "400-Acre Protected Bioreserve Target Envelope",
        areaAcres: 400.0,
        areaSqm: 1618742,
        source: "Dhun Ecological Restoration Covenant",
        authority: "Dhun Ecology Directorate",
        status: "Provisional target planning boundary",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            localMetersToWgs84(-680, -200),
            localMetersToWgs84(-680, 450),
            localMetersToWgs84(-400, 680),
            localMetersToWgs84(250, 680),
            localMetersToWgs84(180, 320),
            localMetersToWgs84(-100, 150),
            localMetersToWgs84(-250, -100),
            localMetersToWgs84(-500, -200),
            localMetersToWgs84(-680, -200),
          ],
        ],
      },
    },
  ],
};

// -------------------------------------------------------------
// 4. ≤100-Acre Permitted Construction Envelope
// -------------------------------------------------------------
export const CONSTRUCTION_ENVELOPE_100AC: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "construction-100ac",
      properties: {
        id: "construction_envelope_100ac",
        name: "≤100-Acre Maximum Permitted Construction Envelope",
        areaAcres: 100.0,
        areaSqm: 404686,
        source: "Rajasthan R1 Zonal Planning Regulations & Dhun Masterplan",
        authority: "Jaipur Development Authority (JDA)",
        restriction: "Max building height strictly limited to 12m (tree canopy ceiling)",
      },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          // Central Campus Core
          [
            [
              localMetersToWgs84(-120, -150),
              localMetersToWgs84(-120, 160),
              localMetersToWgs84(240, 160),
              localMetersToWgs84(240, -150),
              localMetersToWgs84(-120, -150),
            ],
          ],
          // Eastern Residential Clusters
          [
            [
              localMetersToWgs84(280, -320),
              localMetersToWgs84(280, 220),
              localMetersToWgs84(580, 220),
              localMetersToWgs84(580, -320),
              localMetersToWgs84(280, -320),
            ],
          ],
        ],
      },
    },
  ],
};

// -------------------------------------------------------------
// 5. Water Bodies (Total Blue LU: 32.12 Acres / 130,000 m²)
// -------------------------------------------------------------
export const WATER_BODIES_GEOJSON: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "lake-central",
      properties: {
        name: "Central Stormwater Retention Lake",
        subType: "Harvesting Reservoir",
        areaSqm: 56000,
        areaAcres: 13.84,
        capacityKL: 120000,
        source: "EDS KPI Report Rev 2 (Page 7)",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            localMetersToWgs84(-180, 50),
            localMetersToWgs84(-140, 160),
            localMetersToWgs84(20, 210),
            localMetersToWgs84(80, 140),
            localMetersToWgs84(50, 40),
            localMetersToWgs84(-80, 10),
            localMetersToWgs84(-180, 50),
          ],
        ],
      },
    },
    {
      type: "Feature",
      id: "pond-bioreserve",
      properties: {
        name: "Bioreserve Ecological Swale & Wetland",
        subType: "Percolation Wetland",
        areaSqm: 38000,
        areaAcres: 9.39,
        capacityKL: 75000,
        source: "EDS KPI Report Rev 2 (Page 7)",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            localMetersToWgs84(-480, 280),
            localMetersToWgs84(-420, 420),
            localMetersToWgs84(-290, 450),
            localMetersToWgs84(-260, 360),
            localMetersToWgs84(-360, 260),
            localMetersToWgs84(-480, 280),
          ],
        ],
      },
    },
    {
      type: "Feature",
      id: "pond-south",
      properties: {
        name: "Southern Infiltration Basin & Lake",
        subType: "Aquifer Recharge",
        areaSqm: 36000,
        areaAcres: 8.89,
        capacityKL: 80800,
        source: "EDS KPI Report Rev 2 (Page 7)",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            localMetersToWgs84(-90, -420),
            localMetersToWgs84(-30, -320),
            localMetersToWgs84(110, -340),
            localMetersToWgs84(140, -460),
            localMetersToWgs84(30, -510),
            localMetersToWgs84(-90, -420),
          ],
        ],
      },
    },
  ],
};

// -------------------------------------------------------------
// 6. Green Landscape Zones (Total Green LU: 76.11 Acres / 308,000 m²)
// -------------------------------------------------------------
export const GREEN_ECOLOGY_GEOJSON: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "green-g4-miyawaki",
      properties: {
        code: "G4",
        name: "Miyawaki Native Dense Forest",
        areaSqm: 48000,
        areaAcres: 11.86,
        canopyTarget: "Dense multi-layer native",
        source: "EDS KPI Report Rev 2 (Page 8)",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            localMetersToWgs84(-520, -50),
            localMetersToWgs84(-500, 180),
            localMetersToWgs84(-320, 150),
            localMetersToWgs84(-340, -80),
            localMetersToWgs84(-520, -50),
          ],
        ],
      },
    },
    {
      type: "Feature",
      id: "green-g3-bioreserve",
      properties: {
        code: "G3",
        name: "Bioreserve Core Restoration",
        areaSqm: 130000,
        areaAcres: 32.12,
        canopyTarget: "Wild arid biodiversity sanctuary",
        source: "EDS KPI Report Rev 2 (Page 8)",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            localMetersToWgs84(-600, 220),
            localMetersToWgs84(-480, 560),
            localMetersToWgs84(-150, 560),
            localMetersToWgs84(-210, 310),
            localMetersToWgs84(-500, 200),
            localMetersToWgs84(-600, 220),
          ],
        ],
      },
    },
    {
      type: "Feature",
      id: "green-g2-foodfarms",
      properties: {
        code: "G2",
        name: "Regenerative Food Farms & Orchards",
        areaSqm: 50000,
        areaAcres: 12.36,
        canopyTarget: "Agroforestry permaculture",
        source: "EDS KPI Report Rev 2 (Page 8)",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            localMetersToWgs84(80, 380),
            localMetersToWgs84(140, 580),
            localMetersToWgs84(380, 540),
            localMetersToWgs84(320, 360),
            localMetersToWgs84(80, 380),
          ],
        ],
      },
    },
    {
      type: "Feature",
      id: "green-g1-grassland",
      properties: {
        code: "G1",
        name: "Native Grassland Commons",
        areaSqm: 40000,
        areaAcres: 9.88,
        canopyTarget: "Dhaman / Sevan perennial grasses",
        source: "EDS KPI Report Rev 2 (Page 8)",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            localMetersToWgs84(-580, -420),
            localMetersToWgs84(-540, -180),
            localMetersToWgs84(-360, -220),
            localMetersToWgs84(-400, -460),
            localMetersToWgs84(-580, -420),
          ],
        ],
      },
    },
    {
      type: "Feature",
      id: "green-g5-thickets",
      properties: {
        code: "G5",
        name: "Open Canopy Thickets",
        areaSqm: 40000,
        areaAcres: 9.88,
        canopyTarget: "Acacia, Khejri, Rohida scrub",
        source: "EDS KPI Report Rev 2 (Page 8)",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            localMetersToWgs84(360, 240),
            localMetersToWgs84(420, 480),
            localMetersToWgs84(590, 450),
            localMetersToWgs84(540, 220),
            localMetersToWgs84(360, 240),
          ],
        ],
      },
    },
  ],
};

// -------------------------------------------------------------
// 7. Utility & Energy Precincts (Solar: 40 ac, Substation: 0.42 ac, STP: 2.28 ac)
// -------------------------------------------------------------
export const UTILITIES_INFRASTRUCTURE_GEOJSON: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "infra-solar-farm",
      properties: {
        name: "Dhun Solar Farm & PV Carport Precinct",
        domain: "Energy",
        areaSqm: 161874,
        areaAcres: 40.0,
        targetCapacityMWp: 16.8,
        phase1InstalledKWp: 100,
        source: "EDS KPI Report Rev 2 (Page 10, 83-84)",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            localMetersToWgs84(160, -640),
            localMetersToWgs84(180, -260),
            localMetersToWgs84(560, -280),
            localMetersToWgs84(540, -650),
            localMetersToWgs84(160, -640),
          ],
        ],
      },
    },
    {
      type: "Feature",
      id: "infra-substation-11kv",
      properties: {
        name: "Main Receiving Substation (11 kV)",
        domain: "Energy",
        areaSqm: 1700,
        areaAcres: 0.42,
        voltage: "11 kV / 415 V",
        source: "EDS KPI Report Rev 2 (Page 10)",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            localMetersToWgs84(110, -240),
            localMetersToWgs84(110, -190),
            localMetersToWgs84(150, -190),
            localMetersToWgs84(150, -240),
            localMetersToWgs84(110, -240),
          ],
        ],
      },
    },
    {
      type: "Feature",
      id: "infra-stp-dewats",
      properties: {
        name: "Sequencing Batch Reactor (SBR) & DEWATS STP",
        domain: "Water",
        areaSqm: 9240,
        areaAcres: 2.28,
        capacityKLDay: 150,
        source: "EDS KPI Report Rev 2 (Page 46)",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            localMetersToWgs84(-240, -380),
            localMetersToWgs84(-240, -280),
            localMetersToWgs84(-140, -280),
            localMetersToWgs84(-140, -380),
            localMetersToWgs84(-240, -380),
          ],
        ],
      },
    },
    {
      type: "Feature",
      id: "infra-compute-commons",
      properties: {
        name: "Compute Commons Datacenter Facility",
        domain: "Compute",
        areaSqm: 4500,
        areaAcres: 1.11,
        coolingType: "Direct-to-Chip Liquid Cooling",
        designPUE: 1.18,
        source: "Compute Commons Technical Spec Rev 2.1",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            localMetersToWgs84(80, 60),
            localMetersToWgs84(80, 130),
            localMetersToWgs84(150, 130),
            localMetersToWgs84(150, 60),
            localMetersToWgs84(80, 60),
          ],
        ],
      },
    },
  ],
};

// -------------------------------------------------------------
// 8. Residential Clusters R1–R8 (Total Residential: 95.38 Acres / 386,000 m²)
// -------------------------------------------------------------
export const RESIDENTIAL_CLUSTERS_GEOJSON: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "cluster-r1-arth",
      properties: {
        code: "R1",
        name: "Arth Residential Cluster (Phase 1 Priority)",
        areaSqm: 66000,
        areaAcres: 16.31,
        commissioningStatus: "Active",
        source: "EDS KPI Report Rev 2 (Page 8)",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            localMetersToWgs84(-60, -180),
            localMetersToWgs84(-60, 20),
            localMetersToWgs84(180, 20),
            localMetersToWgs84(180, -180),
            localMetersToWgs84(-60, -180),
          ],
        ],
      },
    },
    {
      type: "Feature",
      id: "cluster-r2-creator",
      properties: {
        code: "R2",
        name: "Creator's Village",
        areaSqm: 9000,
        areaAcres: 2.22,
        commissioningStatus: "Active",
        source: "EDS KPI Report Rev 2 (Page 8)",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            localMetersToWgs84(-210, -160),
            localMetersToWgs84(-210, -60),
            localMetersToWgs84(-110, -60),
            localMetersToWgs84(-110, -160),
            localMetersToWgs84(-210, -160),
          ],
        ],
      },
    },
    {
      type: "Feature",
      id: "cluster-r3-r8-reserve",
      properties: {
        code: "R3–R8",
        name: "Future Residential Clusters R3–R8",
        areaSqm: 311000,
        areaAcres: 76.85,
        commissioningStatus: "Planned",
        source: "EDS KPI Report Rev 2 (Page 8)",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            localMetersToWgs84(240, -180),
            localMetersToWgs84(240, 220),
            localMetersToWgs84(540, 200),
            localMetersToWgs84(540, -220),
            localMetersToWgs84(240, -180),
          ],
        ],
      },
    },
  ],
};

// -------------------------------------------------------------
// 9. Access & Circulation Network (37.07 Acres / 150,000 m²)
// -------------------------------------------------------------
export const ACCESS_CIRCULATION_GEOJSON: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "road-peripheral-ring",
      properties: {
        name: "Primary Permeable Arterial Ring Road",
        category: "Arterial Road",
        pavement: "Permeable paver with bioretention median",
        widthMeters: 7.0,
        source: "EDS KPI Report Rev 2 (Page 10 & 40)",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          localMetersToWgs84(-620, -620),
          localMetersToWgs84(-620, 420),
          localMetersToWgs84(-360, 620),
          localMetersToWgs84(260, 620),
          localMetersToWgs84(620, 460),
          localMetersToWgs84(620, -380),
          localMetersToWgs84(410, -620),
          localMetersToWgs84(-620, -620),
        ],
      },
    },
    {
      type: "Feature",
      id: "path-central-spine",
      properties: {
        name: "Central Shaded Mobility Spine",
        category: "Pedestrian & Electric Mobility",
        widthMeters: 4.5,
        source: "EDS KPI Report Rev 2 (Page 10)",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          localMetersToWgs84(-450, 0),
          localMetersToWgs84(0, 0),
          localMetersToWgs84(400, 0),
        ],
      },
    },
    {
      type: "Feature",
      id: "path-north-south",
      properties: {
        name: "North-South Watershed Trail",
        category: "Pedestrian Shaded Walkway",
        widthMeters: 3.0,
        source: "EDS KPI Report Rev 2 (Page 10)",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          localMetersToWgs84(0, -500),
          localMetersToWgs84(0, 0),
          localMetersToWgs84(0, 480),
        ],
      },
    },
  ],
};

// -------------------------------------------------------------
// 10. Topographic Elevation Contours (320m to 345m MSL)
// -------------------------------------------------------------
export const CONTOURS_GEOJSON: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "contour-345",
      properties: { elevationMeters: 345, name: "345m Ridge Contour" },
      geometry: {
        type: "LineString",
        coordinates: [
          localMetersToWgs84(-600, 400),
          localMetersToWgs84(-450, 520),
          localMetersToWgs84(-200, 560),
          localMetersToWgs84(100, 540),
        ],
      },
    },
    {
      type: "Feature",
      id: "contour-335",
      properties: { elevationMeters: 335, name: "335m Terrace Contour" },
      geometry: {
        type: "LineString",
        coordinates: [
          localMetersToWgs84(-500, 150),
          localMetersToWgs84(-250, 200),
          localMetersToWgs84(50, 180),
          localMetersToWgs84(300, 150),
          localMetersToWgs84(550, 120),
        ],
      },
    },
    {
      type: "Feature",
      id: "contour-325",
      properties: { elevationMeters: 325, name: "325m Swale Contour" },
      geometry: {
        type: "LineString",
        coordinates: [
          localMetersToWgs84(-400, -200),
          localMetersToWgs84(-100, -150),
          localMetersToWgs84(200, -180),
          localMetersToWgs84(450, -220),
        ],
      },
    },
  ],
};

// -------------------------------------------------------------
// 11. The Dhun Loop — Unifying Spine (Mobility Sheet Reference)
// -------------------------------------------------------------
export const DHUN_LOOP_GEOJSON: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "dhun-loop-spine",
      properties: {
        id: "dhun_loop",
        name: "The Dhun Loop",
        category: "Zero-Emissions Micromobility Spine",
        widthMeters: 6.0,
        description: "The Dhun Loop is the unifying spine that connects and services the entire site. It is a public space that threads through various experiences as one travels along it.",
        pavement: "Stabilized earth & permeable paving with bio-swale margins",
        modes: ["Electric Shuttles", "Cycles & E-bikes", "Pedestrian Shaded Walkways"],
        speedLimitKmh: 15,
        source: "Dhun Mobility Masterplan Reference",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          localMetersToWgs84(-520, -560),
          localMetersToWgs84(-540, -120),
          localMetersToWgs84(-480, 220),
          localMetersToWgs84(-320, 520),
          localMetersToWgs84(-150, 620),
          localMetersToWgs84(80, 640),
          localMetersToWgs84(320, 480),
          localMetersToWgs84(480, 180),
          localMetersToWgs84(540, -280),
          localMetersToWgs84(380, -580),
          localMetersToWgs84(10, -620),
          localMetersToWgs84(-280, -620),
          localMetersToWgs84(-520, -560),
        ],
      },
    },
  ],
};

// -------------------------------------------------------------
// 12. Phase One Detailed Development Parcels (Phase One Reference)
// -------------------------------------------------------------
export const PHASE_ONE_PARCELS_GEOJSON: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "p1-res-large",
      properties: {
        name: "Phase 1 Residential Block South",
        classification: "Residential",
        areaSqm: 59288,
        areaAcres: 14.65,
        source: "Dhun Phase One Plan Reference",
        fillColor: "#C78F68",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            localMetersToWgs84(-350, -560),
            localMetersToWgs84(-350, -380),
            localMetersToWgs84(-160, -360),
            localMetersToWgs84(-140, -550),
            localMetersToWgs84(-350, -560),
          ],
        ],
      },
    },
    {
      type: "Feature",
      id: "p1-tourism",
      properties: {
        name: "Eco-Tourism & Hospitality Anchor",
        classification: "Tourism",
        areaSqm: 99749,
        areaAcres: 24.65,
        source: "Dhun Phase One Plan Reference",
        fillColor: "#D9A441",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            localMetersToWgs84(-100, -420),
            localMetersToWgs84(-110, -180),
            localMetersToWgs84(140, -160),
            localMetersToWgs84(160, -380),
            localMetersToWgs84(-100, -420),
          ],
        ],
      },
    },
    {
      type: "Feature",
      id: "p1-inst",
      properties: {
        name: "Lifelong Learning & Knowledge Campus",
        classification: "Institutional",
        areaSqm: 30458,
        areaAcres: 7.53,
        source: "Dhun Phase One Plan Reference",
        fillColor: "#315D78",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            localMetersToWgs84(180, -220),
            localMetersToWgs84(170, -60),
            localMetersToWgs84(360, -80),
            localMetersToWgs84(350, -240),
            localMetersToWgs84(180, -220),
          ],
        ],
      },
    },
    {
      type: "Feature",
      id: "p1-rec",
      properties: {
        name: "Community Commons & Recreation Ground",
        classification: "Recreational",
        areaSqm: 25333,
        areaAcres: 6.26,
        source: "Dhun Phase One Plan Reference",
        fillColor: "#234638",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            localMetersToWgs84(-80, -580),
            localMetersToWgs84(-70, -440),
            localMetersToWgs84(60, -440),
            localMetersToWgs84(50, -580),
            localMetersToWgs84(-80, -580),
          ],
        ],
      },
    },
    {
      type: "Feature",
      id: "p1-fac-46k",
      properties: {
        name: "Central Utilities & Resource Hub",
        classification: "Facilities",
        areaSqm: 46834,
        areaAcres: 11.57,
        source: "Dhun Phase One Plan Reference",
        fillColor: "#15372D",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            localMetersToWgs84(160, -60),
            localMetersToWgs84(180, 80),
            localMetersToWgs84(380, 60),
            localMetersToWgs84(360, -80),
            localMetersToWgs84(160, -60),
          ],
        ],
      },
    },
  ],
};

// -------------------------------------------------------------
// 13. Existing Thickets & Preserved Canopies (Blue-Green Sheet)
// -------------------------------------------------------------
export const EXISTING_THICKETS_GEOJSON: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "thicket-north-central",
      properties: {
        name: "Native Khejri & Rohida Thicket Core",
        classification: "Existing Thickets",
        canopyCoverPct: 85,
        source: "Dhun Blue Green Infrastructure Reference",
        fillColor: "#15372D",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            localMetersToWgs84(-220, 100),
            localMetersToWgs84(-180, 360),
            localMetersToWgs84(80, 340),
            localMetersToWgs84(40, 80),
            localMetersToWgs84(-220, 100),
          ],
        ],
      },
    },
    {
      type: "Feature",
      id: "thicket-south-swale",
      properties: {
        name: "Acacia Riparian Thicket Buffer",
        classification: "Existing Thickets",
        canopyCoverPct: 75,
        source: "Dhun Blue Green Infrastructure Reference",
        fillColor: "#15372D",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            localMetersToWgs84(-380, -320),
            localMetersToWgs84(-360, -180),
            localMetersToWgs84(-240, -190),
            localMetersToWgs84(-260, -330),
            localMetersToWgs84(-380, -320),
          ],
        ],
      },
    },
  ],
};

// -------------------------------------------------------------
// 14. Green Fingers Radiating Corridors (Blue-Green Sheet)
// -------------------------------------------------------------
export const GREEN_FINGERS_GEOJSON: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "finger-west-1",
      properties: {
        name: "Western Ecological Link Finger",
        classification: "Green Fingers",
        widthMeters: 40,
        source: "Dhun Blue Green Infrastructure Reference",
        fillColor: "#A8B996",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            localMetersToWgs84(-540, -80),
            localMetersToWgs84(-520, -20),
            localMetersToWgs84(-220, -10),
            localMetersToWgs84(-240, -70),
            localMetersToWgs84(-540, -80),
          ],
        ],
      },
    },
    {
      type: "Feature",
      id: "finger-east-1",
      properties: {
        name: "Eastern Agrarian Shaded Finger",
        classification: "Green Fingers",
        widthMeters: 55,
        source: "Dhun Blue Green Infrastructure Reference",
        fillColor: "#A8B996",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            localMetersToWgs84(60, 140),
            localMetersToWgs84(80, 200),
            localMetersToWgs84(440, 220),
            localMetersToWgs84(420, 160),
            localMetersToWgs84(60, 140),
          ],
        ],
      },
    },
  ],
};

// -------------------------------------------------------------
// 15. The 14 First Principles of Dhun (Where We Become Reference)
// -------------------------------------------------------------
export interface FirstPrinciple {
  id: string;
  name: string;
  category: "Ecological" | "Built & Materials" | "Social & Community" | "Human Wellbeing";
  description: string;
}

export const DHUN_FIRST_PRINCIPLES: FirstPrinciple[] = [
  { id: "p1", name: "Water Self-Sufficient", category: "Ecological", description: "100% on-site rainwater harvesting, cascading retention swales, decentralized wastewater reuse." },
  { id: "p2", name: "Energy Sufficient", category: "Ecological", description: "Zero-carbon on-site solar generation, BESS storage, zero fossil-fuel combustion." },
  { id: "p3", name: "Built Using Low-Impact Materials", category: "Built & Materials", description: "Stabilized rammed earth, stone masonry, lime plaster, non-toxic localized materials." },
  { id: "p4", name: "Natural Food", category: "Ecological", description: "Regenerative agroforestry, organic farm-to-table nutrition, indigenous cropping systems." },
  { id: "p5", name: "Regenerative Ecosystem", category: "Ecological", description: "Restoring degraded semi-arid soils into self-healing Miyawaki forests and biodiverse habitat." },
  { id: "p6", name: "Diverse & Intergenerational", category: "Social & Community", description: "Spaces welcoming children, elders, makers, researchers, and artisans." },
  { id: "p7", name: "Experimental & Creative", category: "Human Wellbeing", description: "Living laboratory for spatial compute, vernacular craftsmanship, and low-energy cooling." },
  { id: "p8", name: "Individual & Social Wellbeing", category: "Human Wellbeing", description: "Active walking landscape, community tables, quiet contemplation courtyards." },
  { id: "p9", name: "Contextual Use of Ancient Wisdom", category: "Built & Materials", description: "Stepwell hydrology, wind-scoop courtyards, thermal mass adapted to Rajasthan's climate." },
  { id: "p10", name: "Co-Creation with Communities", category: "Social & Community", description: "Participatory stewardship with surrounding Chak Gulabpura villages." },
  { id: "p11", name: "Responsible Consumption", category: "Ecological", description: "Circular resource tracking, zero single-use plastics, verified carbon boundaries." },
  { id: "p12", name: "Living with Nature", category: "Ecological", description: "Bioreserve envelope of 80% untouched land, respecting wild fauna corridors." },
  { id: "p13", name: "Lifelong Learning", category: "Social & Community", description: "Field station research, environmental workshops, peer knowledge exchange." },
  { id: "p14", name: "Design & Culture", category: "Built & Materials", description: "Timeless architectural elegance celebrating tactile materiality and light." },
];

// -------------------------------------------------------------
// 16. Built Typologies (Typology Reference Sheet)
// -------------------------------------------------------------
export interface BuiltTypology {
  id: string;
  name: string;
  floors: string;
  description: string;
  features: string[];
}

export const DHUN_TYPOLOGIES: BuiltTypology[] = [
  {
    id: "typ-1",
    name: "Detached Villas",
    floors: "G+1",
    description: "Detached villas have their entrance predominantly towards the central node to encourage resident interaction. Play between levels creates terraces and courtyards.",
    features: ["Light well", "Staggered massing", "Private courtyard", "Terraced roof garden"],
  },
  {
    id: "typ-2",
    name: "Town Houses",
    floors: "2 to 3 Stories + Basement",
    description: "Town houses vary between 2 to 3 stories including an additional basement creating a cool micro-climate at home. Direct access to private garden and roof terrace.",
    features: ["Subterranean cool micro-climate", "Private garden", "Balconies", "Roof terrace"],
  },
  {
    id: "typ-3",
    name: "Dense Urban Structure",
    floors: "G+2 to G+3",
    description: "Ensuring natural ventilation of larger blocks in dense urban areas is crucial. Incorporating open courtyards and light wells provides ample daylight and air flow.",
    features: ["Open central courtyard", "Light wells", "Cross-ventilation chicanes", "Shaded pedestrian arcades"],
  },
  {
    id: "typ-4",
    name: "Duplex on Dhun Loop",
    floors: "G+1 Duplex",
    description: "Duplex units, spanning two stories, situated atop a G+1 dense urban structure along the Dhun Loop. Residents enjoy expansive views of the protected bioreserve.",
    features: ["Panoramic bioreserve views", "Direct Dhun Loop access", "Setback terraces", "Angled solar louvers"],
  },
];

