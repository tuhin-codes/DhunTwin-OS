import type { ZoneId } from "../types";

/* ============================================================
   SITE PLAN GEOMETRY
   A survey-style diagram of the field station on an 800 x 500
   canvas. Parcels are straight-edged on purpose: this reads as
   a land plan, not a decorative illustration.
   ============================================================ */

export type Point = [number, number];

export interface ZoneShape {
  id: ZoneId;
  name: string;
  short: string;
  points: Point[];
  label: Point;
  anchorAsset: string;
}

export const ZONES: ZoneShape[] = [
  {
    id: "bioreserve",
    name: "Protected bioreserve",
    short: "Bioreserve",
    points: [
      [36, 60],
      [150, 34],
      [300, 28],
      [404, 46],
      [428, 120],
      [416, 196],
      [368, 250],
      [300, 286],
      [196, 292],
      [104, 262],
      [48, 190],
      [34, 112],
    ],
    label: [150, 74],
    anchorAsset: "bioreserve",
  },
  {
    id: "energy",
    name: "Energy precinct",
    short: "Energy",
    points: [
      [470, 44],
      [640, 32],
      [742, 44],
      [768, 104],
      [752, 178],
      [676, 204],
      [588, 196],
      [536, 150],
      [520, 92],
    ],
    label: [590, 62],
    anchorAsset: "grid-hub",
  },
  {
    id: "compute",
    name: "Compute commons",
    short: "Compute",
    points: [
      [612, 236],
      [730, 226],
      [772, 278],
      [758, 356],
      [676, 378],
      [624, 332],
      [606, 282],
    ],
    label: [640, 252],
    anchorAsset: "compute",
  },
  {
    id: "water",
    name: "Water & recharge",
    short: "Water",
    points: [
      [300, 300],
      [372, 288],
      [436, 306],
      [460, 344],
      [432, 394],
      [366, 404],
      [310, 372],
      [282, 334],
    ],
    label: [292, 302],
    anchorAsset: "stp",
  },
  {
    id: "built",
    name: "Built fabric",
    short: "Built",
    points: [
      [292, 344],
      [430, 326],
      [556, 332],
      [600, 392],
      [586, 462],
      [470, 486],
      [352, 482],
      [296, 424],
    ],
    label: [470, 470],
    anchorAsset: "residences",
  },
  {
    id: "waste",
    name: "Waste & gaushala",
    short: "Waste",
    points: [
      [64, 306],
      [186, 296],
      [250, 322],
      [246, 394],
      [176, 438],
      [92, 412],
      [58, 360],
    ],
    label: [110, 330],
    anchorAsset: "gaushala",
  },
];

export function zonePath(zone: ZoneShape): string {
  return (
    zone.points
      .map(
        ([x, y], index) =>
          `${index === 0 ? "M" : "L"}${x},${y}`
      )
      .join(" ") + " Z"
  );
}

/* Roads are drawn over the parcels, the way a site plan does. */
export const ROADS = [
  "M 410 500 C 405 440 396 392 400 340 C 404 288 420 250 452 212 C 486 172 520 140 566 108",
  "M 60 330 C 160 322 240 318 300 322 C 380 328 470 320 560 330 C 640 338 700 350 762 372",
];

export const CONTOURS = [
  "M 40 226 C 140 196 200 236 262 218 C 322 200 362 226 420 210",
  "M 46 258 C 140 228 204 268 268 250 C 326 232 366 258 424 242",
  "M 58 158 C 150 128 214 168 278 150 C 336 132 378 158 436 142",
  "M 300 372 C 372 356 432 372 486 396 C 534 418 566 446 590 470",
  "M 512 240 C 590 220 660 232 728 252",
];

export const PONDS = [
  { cx: 330, cy: 330, rx: 26, ry: 17 },
  { cx: 398, cy: 360, rx: 33, ry: 21 },
  { cx: 340, cy: 382, rx: 18, ry: 11 },
];

/* ------------------------------------------------------------
   TREE CANOPY
   Deterministic sampling inside the protected parcel so the
   canopy looks grown rather than scattered.
   ------------------------------------------------------------ */

function seeded(seed: number): () => number {
  let state = seed;

  return () => {
    state = (state + 0x6d2b79f5) | 0;

    let t = Math.imul(
      state ^ (state >>> 15),
      1 | state
    );

    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function inside(
  x: number,
  y: number,
  points: Point[]
): boolean {
  let hit = false;

  for (
    let i = 0, j = points.length - 1;
    i < points.length;
    j = i++
  ) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];

    if (
      yi > y !== yj > y &&
      x <
        ((xj - xi) * (y - yi)) / (yj - yi) + xi
    ) {
      hit = !hit;
    }
  }

  return hit;
}

export interface Canopy {
  x: number;
  y: number;
  r: number;
  o: number;
}

export const CANOPY: Canopy[] = (() => {
  const random = seeded(20261027);
  const bioreserve = ZONES[0].points;
  const waste = ZONES[5].points;
  const trees: Canopy[] = [];

  let attempts = 0;

  while (trees.length < 300 && attempts < 4000) {
    attempts += 1;

    const x = 30 + random() * 420;
    const y = 26 + random() * 290;

    const inBio = inside(x, y, bioreserve);
    const inWaste = inside(x, y, waste);

    if (!inBio && !inWaste) {
      continue;
    }

    trees.push({
      x,
      y,
      r: 2.2 + random() * 4.2,
      o: 0.24 + random() * 0.4,
    });
  }

  return trees;
})();
