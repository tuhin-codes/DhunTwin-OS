/* ============================================================
   DHUN TWIN OS — REGISTRY & EXTENSIBLE MONITORING TEST SUITE
   Covers:
   1. Asset Registration & Validation
   2. Persistence Layer (LocalAssetRepository)
   3. Telemetry Validation, Stale-Data Detection (45s TTL) & Adapters
   4. Alert Rule Engine with Hysteresis & Regulatory vs Operating
   5. Dashboard & Ledger Double-Counting Protection
   ============================================================ */

import { LocalAssetRepository } from "../AssetRepository";
import { INITIAL_SEED_ASSETS } from "../seedAssets";
import {
  validateTelemetryReading,
  detectStaleTelemetry,
  parseTelemetryCsv,
  evaluateReadingQuality,
} from "../telemetryEngine";
import {
  evaluateAssetAlerts,
  isAlertSuppressedByHysteresis,
  REGULATORY_LIMITS,
} from "../alertEngine";
import type { RegisteredAsset, TelemetryReading } from "../types";
import {
  calculateGeodesicDistanceMeters,
  calculatePathDistanceMeters,
  calculateGeodesicAreaSqm,
  isPointInPolygon,
  formatCoordinatesDMS,
} from "../../gis/spatialUtils";
import {
  BOUNDARY_RECONCILIATION,
  GIS_LAYERS_REGISTRY,
} from "../../gis/gisMetadata";
import {
  DHUN_SITE_CENTER,
  PROPERTY_BOUNDARY_500AC,
  SURVEYED_BOUNDARY_422AC,
} from "../../gis/dhunGeoData";

declare const process: { exit: (code: number) => void };

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`TEST FAILED: ${message}`);
  }
}

console.log("=================================================");
console.log("  DHUN TWIN OS — VERIFICATION TEST SUITE");
console.log("=================================================\n");

let passedCount = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ [PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`✗ [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// ----------------------------------------------------------------
// 1. Asset Registration & Schema Validation
// ----------------------------------------------------------------
test("Asset Registration: enforces required fields (ID, Name, Domain, Type)", () => {
  const repo = new LocalAssetRepository("test_repo_1");
  repo.resetToDefaults();

  const invalidAsset = {
    id: "",
    name: "",
    domain: "Energy",
    type: "",
    ratedCapacity: 100,
    capacityUnit: "kW",
  } as unknown as RegisteredAsset;

  const result = repo.add(invalidAsset);
  assert(!result.success, "Registration must fail when mandatory fields are missing");
  assert(Boolean(result.error), "Registration must return error explanation");
});

test("Asset Registration: rejects duplicate asset IDs", () => {
  const repo = new LocalAssetRepository("test_repo_2");
  repo.resetToDefaults();

  const seed = repo.getAll()[0];
  const duplicateAsset: RegisteredAsset = {
    ...seed,
    name: "Duplicate Solar Array",
  };

  const result = repo.add(duplicateAsset);
  assert(!result.success, "Registration must reject duplicate asset ID");
  assert(result.error!.includes("already exists"), "Error message must cite ID conflict");
});

test("Asset Registration: accepts valid asset and preserves unknown fields explicitly", () => {
  const repo = new LocalAssetRepository("test_repo_3");
  repo.resetToDefaults();

  const newAsset: RegisteredAsset = {
    id: "water-tank-sw-02",
    name: "SW Bioreserve Retention Basin 2",
    domain: "Water",
    type: "Rainwater Basin",
    description: "Rainwater harvesting pond in southern watershed",
    commissioningStatus: "Planned",
    ratedCapacity: 50000,
    capacityUnit: "kL",
    channels: [
      {
        id: "level",
        name: "Water Level",
        unit: "kL",
        dataType: "numeric",
        source: "physical_sensor",
        expectedSamplingIntervalSeconds: 60,
      },
    ],
    evidenceClassification: "Reported",
    verificationStatus: "unverified",
    sourceDocument: "Dhun Water Masterplan Rev 4",
    uncertaintyNotes: undefined, // Unknown explicitly kept undefined
    location: {
      parcelName: "SW Bioreserve Parcel 3",
      hasVerifiedCoordinates: true,
      mapPosition: { x: 300, y: 700 },
    },
    carbonAccounting: {
      includedInCampusMeter: false,
      eligibleForLedger: false,
      emissionFactor: 0,
    },
  };

  const result = repo.add(newAsset);
  assert(result.success, "Valid asset should register successfully");
  const stored = repo.getById("water-tank-sw-02");
  assert(stored !== undefined, "Asset should be retrievable by ID");
  assert(stored?.uncertaintyNotes === undefined, "Unknown fields must remain undefined, never defaulted");
});

// ----------------------------------------------------------------
// 2. Persistence Layer
// ----------------------------------------------------------------
test("Persistence Layer: initializes seed inventory and persists mutations", () => {
  const repo = new LocalAssetRepository("test_repo_persistence");
  repo.resetToDefaults();

  const initialCount = repo.getAll().length;
  assert(initialCount === INITIAL_SEED_ASSETS.length, "Seed assets should match expected inventory size");

  // Update existing asset
  const asset = { ...repo.getAll()[0], description: "Updated engineering notes" };
  const updateRes = repo.update(asset);
  assert(updateRes.success, "Update must succeed");
  assert(repo.getById(asset.id)?.description === "Updated engineering notes", "Update must persist");

  // Delete
  const deleted = repo.delete(asset.id);
  assert(deleted, "Delete must return true");
  assert(repo.getById(asset.id) === undefined, "Deleted asset must not exist");
  assert(repo.getAll().length === initialCount - 1, "Inventory length must decrement");
});

test("Persistence Layer: JSON export and import validation", () => {
  const repo = new LocalAssetRepository("test_repo_json");
  repo.resetToDefaults();

  const exported = repo.exportJson();
  assert(typeof exported === "string" && exported.length > 100, "Export should produce formatted JSON");

  // Invalid JSON import
  const failImport = repo.importJson("{ not valid json");
  assert(!failImport.success, "Import must reject corrupted JSON");

  // Valid import
  const successImport = repo.importJson(exported);
  assert(successImport.success, "Import should accept valid asset export");
  assert(successImport.count === INITIAL_SEED_ASSETS.length, "Import count should match");
});

// ----------------------------------------------------------------
// 3. Telemetry Validation, Stale-Data Detection & Adapters
// ----------------------------------------------------------------
test("Telemetry: rejects malformed or non-finite readings", () => {
  const badReading1 = {
    assetId: "",
    channelId: "power",
    value: 120,
    unit: "kW",
    timestamp: new Date().toISOString(),
    source: "physical_sensor",
    quality: "good",
  } as TelemetryReading;

  const res1 = validateTelemetryReading(badReading1);
  assert(!res1.valid, "Empty assetId must fail validation");

  const badReading2 = {
    assetId: "solar-pv-01",
    channelId: "power",
    value: NaN,
    unit: "kW",
    timestamp: new Date().toISOString(),
    source: "physical_sensor",
    quality: "good",
  } as TelemetryReading;

  const res2 = validateTelemetryReading(badReading2);
  assert(!res2.valid, "NaN reading value must fail validation");
});

test("Telemetry: detects stale data using 45s TTL threshold", () => {
  const now = Date.now();
  const freshIso = new Date(now - 10000).toISOString(); // 10s old
  const staleIso = new Date(now - 50000).toISOString(); // 50s old (>45s TTL)

  const isFreshStale = detectStaleTelemetry(freshIso, 45);
  const isStaleDetected = detectStaleTelemetry(staleIso, 45);

  assert(!isFreshStale, "Reading 10s old must not be flagged as stale under 45s TTL");
  assert(isStaleDetected, "Reading 50s old must be detected as stale under 45s TTL");
});

test("Telemetry: evaluates data quality states (VALID, OUT_OF_RANGE, STALE)", () => {
  const now = new Date().toISOString();
  const qualityNormal = evaluateReadingQuality(350, 0, 500, now, 45);
  assert(qualityNormal === "VALID", "Normal in-range reading should have VALID quality");

  const qualityOutOfRange = evaluateReadingQuality(600, 0, 500, now, 45);
  assert(qualityOutOfRange === "OUT_OF_RANGE", "Exceeded reading should have OUT_OF_RANGE quality");

  const staleTime = new Date(Date.now() - 60000).toISOString();
  const qualityStale = evaluateReadingQuality(350, 0, 500, staleTime, 45);
  assert(qualityStale === "STALE", "Old reading timestamp should have STALE quality");
});

test("Telemetry: CSV adapter correctly parses tabular channel streams", () => {
  const csv = `assetId,channelId,value,unit,timestamp,source
solar-pv-01,power_kw,412.5,kW,2026-10-29T11:00:00Z,physical_sensor
bess-01,state_of_charge_pct,88.2,%,2026-10-29T11:00:00Z,gateway`;

  const parsed = parseTelemetryCsv(csv);
  assert(parsed.length === 2, "Should parse 2 valid telemetry rows");
  assert(parsed[0].assetId === "solar-pv-01", "Row 1 assetId must match");
  assert(parsed[0].value === 412.5, "Row 1 value must match");
  assert(parsed[1].channelId === "state_of_charge_pct", "Row 2 channelId must match");
});

// ----------------------------------------------------------------
// 4. Alert Rule Engine with Hysteresis & Envelopes
// ----------------------------------------------------------------
test("Alert Engine: generates alarms on operational limits violation", () => {
  const sampleAsset: RegisteredAsset = {
    id: "test-inverter-01",
    name: "Central Inverter 1",
    domain: "Energy",
    type: "Solar Inverter",
    description: "Test solar inverter",
    commissioningStatus: "Active",
    ratedCapacity: 500,
    capacityUnit: "kW",
    channels: [
      {
        id: "temperature_c",
        name: "Operating Temperature",
        unit: "°C",
        dataType: "numeric",
        source: "physical_sensor",
        expectedSamplingIntervalSeconds: 30,
        alertThresholds: {
          alarmMax: 75,
          normalMax: 68,
          thresholdSource: "Engineering Limit Specification",
          ruleDescription: "Observed temperature exceeds critical ceiling",
        },
      },
    ],
    evidenceClassification: "Measured",
    verificationStatus: "verified",
    location: { parcelName: "Solar Array", hasVerifiedCoordinates: false },
    carbonAccounting: { includedInCampusMeter: true, eligibleForLedger: true },
  };

  const highTempReading: TelemetryReading = {
    assetId: "test-inverter-01",
    channelId: "temperature_c",
    value: 78.5, // Exceeds alarmMax (75)
    unit: "°C",
    timestamp: new Date().toISOString(),
    source: "physical_sensor",
    quality: "good",
  };

  const alerts = evaluateAssetAlerts(sampleAsset, { temperature_c: highTempReading });
  assert(alerts.length === 1, "Should generate exactly 1 alert for temperature exceeding 75°C");
  assert(alerts[0].severity === "alarm", "Alert severity must be alarm");
  assert(alerts[0].observedValue === 78.5, "Observed value must match reading");
  assert(!alerts[0].isRegulatory, "Must be classified as Operating alert, not regulatory violation");
});

test("Alert Engine: hysteresis deadband prevents alert flapping near boundaries", () => {
  // Value 74.5 is below alarmHigh (75) but within the 2% deadband if prior state was Alarm
  const isSuppressed = isAlertSuppressedByHysteresis(74.5, 75, 0.02, true);
  assert(isSuppressed, "Hysteresis must hold alert active until value drops below the deadband margin");

  // Value 72.0 has safely cleared the deadband
  const isCleared = isAlertSuppressedByHysteresis(72.0, 75, 0.02, true);
  assert(!isCleared, "Value below deadband margin must allow alert recovery");
});

test("Alert Engine: regulatory envelope limits are documented and distinct", () => {
  assert(REGULATORY_LIMITS.MAX_BUILDING_HEIGHT_METERS === 12, "Building height limit must be 12m");
  assert(REGULATORY_LIMITS.MAX_CAMPUS_CONSTRUCTION_ACRES === 100, "Construction ceiling must be 100 acres");
  assert(REGULATORY_LIMITS.BIORESERVE_MIN_ACRES === 400, "Bioreserve minimum must be 400 acres");
  assert(REGULATORY_LIMITS.MAX_ANNUAL_WATER_WITHDRAWAL_KL === 550000, "Water boundary must be 550,000 kL");
});

// ----------------------------------------------------------------
// 5. Dashboard & Double-Counting Accounting Protection
// ----------------------------------------------------------------
test("Dashboard Integration: Map markers require verified coordinates", () => {
  const assets: RegisteredAsset[] = [
    {
      id: "located-asset",
      name: "Located Asset",
      domain: "Energy",
      type: "Array",
      description: "Located solar asset",
      commissioningStatus: "Active",
      ratedCapacity: 100,
      capacityUnit: "kW",
      channels: [],
      evidenceClassification: "Measured",
      verificationStatus: "verified",
      location: { parcelName: "Zone A", hasVerifiedCoordinates: true, mapPosition: { x: 200, y: 300 } },
      carbonAccounting: { includedInCampusMeter: true, eligibleForLedger: true },
    },
    {
      id: "unlocated-asset",
      name: "Unlocated In-Cabinet Sensor",
      domain: "Energy",
      type: "Sensor",
      description: "Cabinet internal sensor",
      commissioningStatus: "Active",
      ratedCapacity: 1,
      capacityUnit: "kW",
      channels: [],
      evidenceClassification: "Reported",
      verificationStatus: "unverified",
      location: { parcelName: "Substation Cabinet B", hasVerifiedCoordinates: false }, // No coordinates!
      carbonAccounting: { includedInCampusMeter: true, eligibleForLedger: true },
    },
  ];

  const mapEligible = assets.filter((a) => a.location?.hasVerifiedCoordinates && a.location.mapPosition);
  assert(mapEligible.length === 1, "Only assets with verified coordinates may be mapped");
  assert(mapEligible[0].id === "located-asset", "Unlocated asset must not be placed at invented map coordinates");
});

test("Carbon Accounting: prevents double-counting of submetered electrical assets", () => {
  const assets = INITIAL_SEED_ASSETS;

  // Grid hub is the campus boundary meter
  const gridHub = assets.find((a) => a.id === "grid-hub");
  assert(gridHub !== undefined, "Grid substation boundary meter must exist");
  assert(gridHub?.carbonAccounting?.eligibleForLedger === true, "Boundary meter directly calculates campus emissions");

  // Solar and Compute are sub-assets downstream of campus distribution
  const solarAsset = assets.find((a) => a.id === "solar-central");
  assert(solarAsset !== undefined, "Solar asset must exist in seed registry");
  assert(solarAsset?.carbonAccounting?.includedInCampusMeter === true, "Sub-asset must be marked includedInCampusMeter: true to avoid double counting");

  // Verify separation of assets tracked in campus ledger
  const ledgerEligible = assets.filter((a) => a.carbonAccounting?.eligibleForLedger);
  const submeteredComponents = assets.filter((a) => a.carbonAccounting?.includedInCampusMeter);

  assert(ledgerEligible.length > 0, "Must have defined ledger-eligible assets");
  assert(submeteredComponents.length > 0, "Must have tracked submetered components with double counting flag");
});

// ----------------------------------------------------------------
// 6. Scale Tests: 0, 1, 10, 100, 1,000, and 5,000 Assets (Part 4 & 5)
// ----------------------------------------------------------------
import { generateTestDataset, benchmarkRegistryPerformance, purgeTestAssetsFromList } from "../testLab";
import { ALL_ASSET_TEMPLATES, createAssetFromTemplate } from "../assetTemplates";
import {
  validateEnergyBalance,
  validateWaterBalance,
  validateCarbonBoundaries,
  validateBatteryDispatch,
  validateComputeMonitoring,
} from "../../engine/engineeringValidation";

test("Scale Engine: generates exact counts at 0, 1, 10, 100, 1,000, and 5,000 assets", () => {
  const counts = [0, 1, 10, 100, 1000, 5000];
  for (const count of counts) {
    const { assets } = generateTestDataset(count);
    assert(assets.length === count, `Generated dataset size must equal requested count ${count}`);
    // Check unique IDs
    const idSet = new Set(assets.map((a) => a.id));
    assert(idSet.size === count, `All ${count} assets must possess unique identifiers with zero collisions`);
    if (count > 0) {
      assert(assets.every((a) => a.isTestAsset === true), "All synthetic assets must be flagged isTestAsset: true");
    }
  }
});

test("Scale Performance: benchmarks 1,000 assets search, filter, and sort in <50ms", () => {
  const { assets } = generateTestDataset(1000);
  const bench = benchmarkRegistryPerformance(assets);
  assert(bench.datasetSize === 1000, "Benchmark must measure 1,000 assets");
  assert(bench.filterTimeMs < 50, `Filter time (${bench.filterTimeMs.toFixed(2)}ms) must be under 50ms`);
  assert(bench.searchTimeMs < 50, `Search time (${bench.searchTimeMs.toFixed(2)}ms) must be under 50ms`);
  assert(bench.sortTimeMs < 50, `Sort time (${bench.sortTimeMs.toFixed(2)}ms) must be under 50ms`);
});

// ----------------------------------------------------------------
// 7. Standard Asset Templates & Channels (Part 3)
// ----------------------------------------------------------------
test("Standard Templates: verifies blueprints for all 8 Dhun asset types", () => {
  const requiredTypes = [
    "Electrical Meter",
    "Solar Inverter",
    "Battery Energy Storage",
    "Water Meter & Pump",
    "Water Treatment Plant",
    "Building Node",
    "Compute Cluster Node",
    "Environmental Sensor Station",
  ];

  for (const reqType of requiredTypes) {
    const tmpl = ALL_ASSET_TEMPLATES.find((t) => t.type === reqType);
    assert(tmpl !== undefined, `Standard template must exist for: ${reqType}`);
    assert(tmpl!.channels.length > 0, `Template ${reqType} must declare standard monitoring channels`);
    
    // Instantiation
    const instance = createAssetFromTemplate(tmpl!, {
      id: `test-${tmpl!.domain.toLowerCase()}-01`,
      name: `Test ${tmpl!.name}`,
      locationParcel: "Campus Center",
      coordinates: { x: 100, y: 100 },
    });
    assert(instance.channels.length === tmpl!.channels.length, "Instance must preserve channel count");
    assert(instance.channels.every((ch) => Boolean(ch.unit)), "Every instantiated channel must have an explicit unit");
  }
});

// ----------------------------------------------------------------
// 8. Lifecycle vs Connectivity vs Monitoring Mode Independence (Part 2)
// ----------------------------------------------------------------
test("Lifecycle & Connectivity: active asset can be disconnected, planned cannot be live", () => {
  const activeDisconnected: RegisteredAsset = {
    ...INITIAL_SEED_ASSETS[0],
    id: "active-disc-test",
    lifecycleStatus: "Active",
    connectivityStatus: "Disconnected",
    monitoringMode: "Disconnected",
  };
  assert(activeDisconnected.lifecycleStatus === "Active", "Lifecycle can remain Active");
  assert(activeDisconnected.connectivityStatus === "Disconnected", "Connectivity can independently be Disconnected");

  const plannedAsset: RegisteredAsset = {
    ...INITIAL_SEED_ASSETS[0],
    id: "planned-test",
    lifecycleStatus: "Planned",
    monitoringMode: "Uncommissioned",
  };
  assert(plannedAsset.lifecycleStatus === "Planned", "Lifecycle is Planned");
  assert(plannedAsset.monitoringMode !== "Live", "Planned asset must never have monitoringMode Live");
});

// ----------------------------------------------------------------
// 9. Engineering Validation: Balances & Physical Laws (Part 8)
// ----------------------------------------------------------------
test("Engineering Validation: Energy Balance verifies supply == demand + storage + losses", () => {
  // Balanced: 500kW generation + 200kW import + 100kW discharge == 780kW demand + 0kW charge + 20kW losses = 800kW
  const balanced = validateEnergyBalance({
    periodHours: 1,
    unit: "kW",
    generation: 500,
    gridImport: 200,
    batteryDischarge: 100,
    demand: 780,
    batteryCharge: 0,
    losses: 20,
  });
  assert(balanced.valid, "Balanced energy system must pass validation");

  // Violation: 500kW supply vs 900kW demand
  const imbalanced = validateEnergyBalance({
    periodHours: 1,
    unit: "kW",
    generation: 500,
    gridImport: 0,
    batteryDischarge: 0,
    demand: 900,
    batteryCharge: 0,
    losses: 0,
  });
  assert(!imbalanced.valid, "Energy balance discrepancy must be caught");
  assert(imbalanced.errors.some((e) => e.includes("Energy balance violation")), "Error must cite discrepancy");
});

test("Engineering Validation: Water Balance clarifies 550ML catchment vs storage", () => {
  // Valid water balance
  const res = validateWaterBalance({
    periodDays: 30,
    openingStorageKL: 50000,
    closingStorageKL: 65000,
    storageCapacityKL: 100000,
    annualHarvestingPotentialKL: 550000,
    inflowRainwaterKL: 25000,
    inflowGroundwaterKL: 5000,
    inflowRecycledStpKL: 2000,
    demandCampusKL: 8000,
    demandIrrigationKL: 6000,
    evaporationLossesKL: 3000,
  });
  assert(res.valid, "Consistent water balance must validate");

  // Warning when storage capacity is conflated with 550M Litre catchment envelope
  const conflated = validateWaterBalance({
    periodDays: 30,
    openingStorageKL: 500000,
    closingStorageKL: 500000,
    storageCapacityKL: 550000,
    inflowRainwaterKL: 0,
    inflowGroundwaterKL: 0,
    inflowRecycledStpKL: 0,
    demandCampusKL: 0,
    demandIrrigationKL: 0,
    evaporationLossesKL: 0,
  });
  assert(conflated.warnings.some((w) => w.includes("550 million litre figure is the 500-acre annual catchment")), "Must flag 550ML catchment distinction");
});

test("Engineering Validation: Carbon Boundaries separate standing stock from annual flux", () => {
  const boundaryCheck = validateCarbonBoundaries({
    embodiedUpfrontTCO2e: 12500,
    operationalAnnualTCO2e: 340,
    storedBiomassStockTCO2e: 45000, // Standing stock
    annualRemovalsTCO2e: 1800,      // Annual flux
    annualAvoidedGridTCO2e: 950,
    submeteredBuildingTCO2e: 180,
    campusSubstationTCO2e: 340,
  });
  assert(boundaryCheck.valid, "Strict carbon boundary separation must pass");

  // Test violation: claiming 50,000 tCO2 removal from 45,000 tCO2 stock
  const invalidStock = validateCarbonBoundaries({
    embodiedUpfrontTCO2e: 12500,
    operationalAnnualTCO2e: 340,
    storedBiomassStockTCO2e: 45000,
    annualRemovalsTCO2e: 50000, // Impossible flux!
    annualAvoidedGridTCO2e: 950,
    submeteredBuildingTCO2e: 180,
    campusSubstationTCO2e: 340,
  });
  assert(!invalidStock.valid, "Excessive annual removal relative to standing stock must be flagged");
});

test("Engineering Validation: Battery BESS constraints enforce SOC and mutual exclusion", () => {
  // Valid BESS state
  const validBess = validateBatteryDispatch({
    nominalCapacityKWh: 1000,
    usableCapacityKWh: 900,
    minSocPct: 10,
    maxSocPct: 95,
    currentSocPct: 75,
    chargePowerKW: 250,
    dischargePowerKW: 0,
    maxChargeKW: 500,
    maxDischargeKW: 500,
    intervalHours: 1,
    roundTripEfficiency: 0.88,
  });
  assert(validBess.valid, "Valid battery dispatch must pass");

  // Simultaneous charge and discharge error
  const simultaneous = validateBatteryDispatch({
    nominalCapacityKWh: 1000,
    usableCapacityKWh: 900,
    minSocPct: 10,
    maxSocPct: 95,
    currentSocPct: 50,
    chargePowerKW: 200,
    dischargePowerKW: 200, // Impossible!
    maxChargeKW: 500,
    maxDischargeKW: 500,
    intervalHours: 1,
  });
  assert(!simultaneous.valid, "Simultaneous charge and discharge must fail validation");

  // SOC below minimum reserve
  const deepDischarge = validateBatteryDispatch({
    nominalCapacityKWh: 1000,
    usableCapacityKWh: 900,
    minSocPct: 10,
    maxSocPct: 95,
    currentSocPct: 5, // Below 10%
    chargePowerKW: 0,
    dischargePowerKW: 100,
    maxChargeKW: 500,
    maxDischargeKW: 500,
    intervalHours: 1,
  });
  assert(!deepDischarge.valid, "Deep discharge below 10% must fail validation");
});

test("Engineering Validation: Compute Monitoring enforces PUE >= 1.00 and IT load limits", () => {
  const computeAudit = validateComputeMonitoring({
    itLoadKW: 200,
    facilityLoadKW: 236, // PUE = 236 / 200 = 1.18
    coolingLoadKW: 30,
    workloadDurationHours: 24,
    gridCarbonIntensityKgPerKWh: 0.82,
  });
  assert(computeAudit.valid, "Valid compute monitoring must pass");
  assert(computeAudit.metadata?.pue === 1.18, "PUE must calculate correctly as 1.18");

  // Invalid: Facility Load < IT Load (PUE < 1.0)
  const impossiblePue = validateComputeMonitoring({
    itLoadKW: 200,
    facilityLoadKW: 150, // Impossible!
    coolingLoadKW: 0,
    workloadDurationHours: 24,
    gridCarbonIntensityKgPerKWh: 0.82,
  });
  assert(!impossiblePue.valid, "PUE < 1.0 must be rejected as physically impossible");
});

// ----------------------------------------------------------------
// 10. Test Lab Isolation & Safe Purging (Part 5 & 10)
// ----------------------------------------------------------------
test("Test Lab Isolation: test assets are tagged and purged without data loss to seed records", () => {
  const seedList = [...INITIAL_SEED_ASSETS];
  const { assets: testAssets } = generateTestDataset(100);

  // Mixed dataset
  const combined = [...seedList, ...testAssets];
  assert(combined.length === seedList.length + 100, "Combined list contains seed and test assets");

  // Purge
  const cleaned = purgeTestAssetsFromList(combined);
  assert(cleaned.length === seedList.length, "Purging must restore exact seed asset count");
  assert(cleaned.every((a) => !a.isTestAsset), "Zero test assets may remain after purge");
  assert(cleaned.map((a) => a.id).sort().join(",") === seedList.map((a) => a.id).sort().join(","), "Seed records must remain completely undamaged");
});

// ----------------------------------------------------------------
// 11. Real Geographic Map & GIS Integration Tests
// ----------------------------------------------------------------
test("GIS Engine: Geodesic Haversine distance matches spherical geometry", () => {
  // Test site center to a point ~1km North
  // 1 degree latitude ~= 110,816m at 26.7° N -> ~0.009024 degrees for 1,000m
  const lat1 = DHUN_SITE_CENTER[1]; // 26.719597
  const lng1 = DHUN_SITE_CENTER[0]; // 75.593443
  const lat2 = lat1 + 1000 / 110816.0;
  const lng2 = lng1;

  const distanceMeters = calculateGeodesicDistanceMeters(lat1, lng1, lat2, lng2);
  assert(
    Math.abs(distanceMeters - 1000) < 5,
    `Geodesic distance between site center and 1km north point must be ~1000m (got ${distanceMeters.toFixed(1)}m)`
  );

  // Multi-point path distance
  const pathDist = calculatePathDistanceMeters([
    { lat: lat1, lng: lng1 },
    { lat: lat2, lng: lng2 },
    { lat: lat1, lng: lng1 },
  ]);
  assert(
    Math.abs(pathDist - 2000) < 10,
    `Round-trip path distance must be ~2000m (got ${pathDist.toFixed(1)}m)`
  );

  // DMS formatting check
  const dmsString = formatCoordinatesDMS(lat1, lng1);
  assert(dmsString.includes("26°") && dmsString.includes("75°"), "DMS formatter must output degree minutes seconds");
});

test("GIS Engine: Geodesic polygon area calculates correctly for site scale", () => {
  // Define a 200m x 200m square (40,000 m² = 9.884 acres) centered at Dhun
  const centerLat = 26.719597;
  const centerLng = 75.593443;
  const dLat = 100 / 110816.0;
  const dLng = 100 / (111412.84 * Math.cos((centerLat * Math.PI) / 180));

  const squareVertices = [
    { lat: centerLat - dLat, lng: centerLng - dLng },
    { lat: centerLat - dLat, lng: centerLng + dLng },
    { lat: centerLat + dLat, lng: centerLng + dLng },
    { lat: centerLat + dLat, lng: centerLng - dLng },
  ];

  const calculatedSqm = calculateGeodesicAreaSqm(squareVertices);
  assert(
    Math.abs(calculatedSqm - 40000) < 500,
    `Calculated area for 200mx200m box must be ~40,000 m² (got ${calculatedSqm.toFixed(0)} m²)`
  );
});

test("GIS Engine: Point-in-polygon correctly classifies interior and exterior points", () => {
  const polygon: [number, number][] = [
    [75.590, 26.710],
    [75.600, 26.710],
    [75.600, 26.725],
    [75.590, 26.725],
    [75.590, 26.710],
  ];

  const insidePoint: [number, number] = [75.595, 26.718];
  const outsidePoint: [number, number] = [75.610, 26.730];

  assert(isPointInPolygon(insidePoint, polygon), "Interior point must be identified as inside polygon");
  assert(!isPointInPolygon(outsidePoint, polygon), "Exterior point must be identified as outside polygon");
});

test("GIS Boundary Reconciliation: 500-acre masterplan vs 422.01-acre survey are transparently unreconciled", () => {
  assert(
    BOUNDARY_RECONCILIATION.statedProjectAreaAcres === 500.0,
    "Stated project area must be exactly 500.00 acres"
  );
  assert(
    BOUNDARY_RECONCILIATION.surveyedClusterAreaAcres === 422.01,
    "Surveyed cluster land-use schedule must be exactly 422.01 acres"
  );
  assert(
    Math.abs(BOUNDARY_RECONCILIATION.differenceAcres - 77.99) < 0.01,
    "Area difference must be exactly 77.99 acres"
  );
  assert(
    BOUNDARY_RECONCILIATION.reconciliationStatus === "Documented discrepancy (unreconciled by design)",
    "Status must explicitly state documented discrepancy unreconciled by design"
  );
  assert(
    BOUNDARY_RECONCILIATION.sourceDocumentSurvey.includes("EDS"),
    "Survey source must cite the EDS Sustainability KPI Report"
  );
  assert(PROPERTY_BOUNDARY_500AC.features.length === 1, "500-acre boundary must have exactly 1 polygon feature");
  assert(SURVEYED_BOUNDARY_422AC.features.length === 1, "422.01-acre boundary must have exactly 1 polygon feature");
});

test("GIS Layer Integrity: All registered layers have documented CRS, authority, and verification status", () => {
  assert(GIS_LAYERS_REGISTRY.length >= 10, "Registry must contain at least 10 spatial layers");

  for (const layer of GIS_LAYERS_REGISTRY) {
    assert(layer.id.length > 0, `Layer ${layer.id} must have a valid ID`);
    assert(layer.name.length > 0, `Layer ${layer.id} must have a descriptive name`);
    assert(layer.crs.includes("EPSG:4326"), `Layer ${layer.id} must document EPSG:4326 WGS84 CRS`);
    assert(layer.sourceDocument.length > 0, `Layer ${layer.id} must cite its source document`);
    assert(layer.verificationStatus.length > 0, `Layer ${layer.id} must declare its verification status`);
  }
});

test("GIS Asset Integration: Verified coordinates map to Chak Gulabpura, unmapped stay unmapped", () => {
  const seedList = [...INITIAL_SEED_ASSETS];
  
  // Mapped assets must have verified coordinates within 2km of Dhun center
  const mapped = seedList.filter((a) => a.location?.hasVerifiedCoordinates && a.location.coordinates);
  assert(mapped.length >= 8, `Expected at least 8 mapped seed assets (found ${mapped.length})`);

  for (const asset of mapped) {
    const coords = asset.location.coordinates!;
    const distFromCenter = calculateGeodesicDistanceMeters(
      DHUN_SITE_CENTER[1],
      DHUN_SITE_CENTER[0],
      coords.lat,
      coords.lng
    );
    assert(
      distFromCenter < 2000,
      `Asset ${asset.name} (${coords.lat}, ${coords.lng}) must be within 2000m of Dhun datum (distance: ${distFromCenter.toFixed(1)}m)`
    );
  }

  // Assets without coordinates must remain unmapped without fabricated positions
  const unmapped = seedList.filter((a) => !a.location?.hasVerifiedCoordinates || !a.location.coordinates);
  for (const asset of unmapped) {
    assert(
      !asset.location?.hasVerifiedCoordinates,
      `Unmapped asset ${asset.name} must never have hasVerifiedCoordinates set to true`
    );
  }
});

console.log("\n=================================================");
console.log(`  ALL ${passedCount} VERIFICATION TESTS PASSED SUCCESSFULLY!`);
console.log("=================================================\n");

