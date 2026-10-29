import type {
  AssetStatus,
  DhunAsset,
  TwinSummary,
  ZoneId,
} from "../types";

import { percent } from "../lib/format";
import { PHASES } from "../data/phases";
import { ZONES } from "../data/zones";
import { landscapeWaterKlYr } from "./simulation";

/* ============================================================
   ZONE PRESSURE
   Turns the twin's flows into a small set of explainable zone
   verdicts. Every red or amber parcel on the map has a written
   reason underneath it, so the overlay can never be decorative.
   ============================================================ */

export interface Pressure {
  level: AssetStatus;
  text: string;
}

const RANK: Record<AssetStatus, number> = {
  healthy: 0,
  watch: 1,
  attention: 2,
};

export function worst(
  levels: AssetStatus[]
): AssetStatus {
  return levels.reduce<AssetStatus>(
    (acc, level) =>
      RANK[level] > RANK[acc] ? level : acc,
    "healthy"
  );
}

export function zonePressures(
  summary: TwinSummary,
  assets: DhunAsset[]
): Record<ZoneId, Pressure[]> {
  const byZone = (zone: ZoneId) =>
    assets.filter((asset) => asset.zone === zone);

  const config = PHASES[summary.phase];

  /* Domestic demand plus the designed landscape, so the parcel
     verdict and the scenario cockpit speak about the same
     water balance. */
  const irrigationKlYr = landscapeWaterKlYr(
    summary.phase
  );

  const waterDemandKlYr =
    summary.waterKlDay * 365 + irrigationKlYr;

  const waterRatio =
    waterDemandKlYr / summary.waterHarvestKlYr;

  const energy: Pressure[] = [];
  const installedSolarKwp = config.solarKwp;

  if (installedSolarKwp <= 0) {
    energy.push({
      level: "attention",
      text: "No on-site generation in this phase. Every kilowatt is imported from the grid.",
    });
  } else if (summary.renewableShare < 0.5) {
    energy.push({
      level: "watch",
      text: `Solar covers ${percent(
        summary.renewableShare
      )} of daily demand, below the 50% planning threshold.`,
    });
  } else {
    energy.push({
      level: "healthy",
      text: `Solar covers ${percent(
        summary.renewableShare
      )} of daily demand.`,
    });
  }

  const compute: Pressure[] = [];
  const computeAsset = byZone("compute")[0];

  if (computeAsset) {
    if (computeAsset.status === "watch") {
      compute.push({
        level: "watch",
        text: "PUE is above the 1.45 design target; cooling is the gap.",
      });
    } else if (
      computeAsset.status === "attention"
    ) {
      compute.push({
        level: "attention",
        text: "Compute is a material share of campus emissions.",
      });
    } else {
      compute.push({
        level: "healthy",
        text: "Load is small, deferrable, and inside the PUE target.",
      });
    }
  }

  const water: Pressure[] = [];

  if (waterRatio > 1) {
    water.push({
      level: "attention",
      text: `Annual demand of ${Math.round(
        waterDemandKlYr / 1000
      )}k kL exceeds the ${Math.round(
        summary.waterHarvestKlYr / 1000
      )}k kL harvest.`,
    });
  } else if (waterRatio > 0.8) {
    water.push({
      level: "watch",
      text: `Demand is at ${percent(
        waterRatio
      )} of harvest — the buffer is thin in a dry year.`,
    });
  } else {
    water.push({
      level: "healthy",
      text: `Demand is ${percent(
        waterRatio
      )} of harvested supply.`,
    });
  }

  const built: Pressure[] = [];
  const builtAssets = byZone("built");

  built.push({
    level: worst(
      builtAssets.map((asset) => asset.status)
    ),
    text:
      builtAssets.some(
        (asset) => asset.status === "attention"
      )
        ? "Occupied floor area dominates residual grid emissions."
        : summary.phase === "today"
          ? "School under construction. No metered baseline exists yet."
          : "Envelope performance is inside the efficient case.",
  });

  const bioreserve: Pressure[] = [
    {
      level: "healthy",
      text: "Protected canopy is intact and sequestering.",
    },
  ];

  const waste: Pressure[] = [
    {
      level:
        byZone("waste").some(
          (asset) => asset.status === "attention"
        )
        ? "attention"
        : "healthy",
      text: "Organic waste is composted on site; methane is avoided, not emitted.",
    },
  ];

  const map: Record<ZoneId, Pressure[]> = {
    bioreserve,
    energy,
    water,
    built,
    waste,
    compute,
  };

  /* Any zone holding a flagged asset inherits at least that
     level, so the map can never contradict the asset register.
     The inherited line names the asset rather than saying
     "something is wrong here". */
  for (const zone of ZONES) {
    const assetLevel = worst(
      byZone(zone.id).map((asset) => asset.status)
    );

    if (
      RANK[assetLevel] > RANK[zoneLevel(map[zone.id])]
    ) {
      const flagged = byZone(zone.id).find(
        (asset) => asset.status === assetLevel
      );

      map[zone.id] = [
        ...map[zone.id],
        {
          level: assetLevel,
          text: flagged
            ? `${flagged.name}: ${flagged.headlineValue} ${flagged.headlineLabel}.`
            : "Holds an asset flagged in the register.",
        },
      ];
    }
  }

  return map;
}

export function zoneLevel(
  pressures: Pressure[]
): AssetStatus {
  return worst(pressures.map((p) => p.level));
}

export function topPressure(
  pressures: Pressure[],
  level: AssetStatus
): Pressure {
  return (
    pressures.find((p) => p.level === level) ??
    pressures[0]
  );
}
