# Dhun Twin OS

An extensible, evidence-first digital twin for the Logos × ZuGrama Field Station at Chak Gulabpura, Jaipur (500 acres).

Dhun Twin OS incorporates an authoritative, typed **Asset Registry**, deterministic physical modeling across energy, water, compute, and carbon, and extensible telemetry adapters (physical sensors, gateways, manual entry, CSV imports, and simulation). Every engineering value carries an explicit provenance tier:

| Tier | Meaning |
| --- | --- |
| Measured | Counted on site or in Dhun's own records |
| Dhun report | Taken from the KPI and masterplan documents |
| Assumption | A stated planning figure, not verified |
| Simulated | Produced by the deterministic twin model |

## Screens

## Workspaces

1. **Campus Masterplan & Spatial Twin (`/`)** — Interactive MapLibre GL satellite and terrain map of the 500-acre Dhun concession in Chak Gulabpura, Rajasthan (WGS-84). Includes independent GIS layers for cadastral boundaries, the 6m Dhun Loop mobility spine, swales, retention water bodies, preserved thickets, and Phase One building typologies.
2. **Digital Twin & Telemetry Inventory (`/twin`)** — Hardware and virtual asset topology across 8 standard Dhun asset blueprints. Real-time telemetry monitoring with 45-second Time-To-Live (TTL) stale data detection, hysteresis alarm evaluation, manual CSV streaming, and a dedicated test lab for synthetic device validation.
3. **Whole-Life Carbon Ledger (`/ledger`)** — EN 15978 whole-life carbon balance sheet across Scopes 1, 2, and 3. Embodied carbon capital tracking, 9.2-year repayment horizon, maturing semi-arid forest flux accounting, and submetering safeguards to prevent double-counting.
4. **Scenario Cockpit & Sensitivity Modeling (`/scenarios`)** — Parametric sensitivity sandbox. Real-time levers for solar capacity, BESS storage, grid ceilings, compute loads, and cooling typologies with live deltas for carbon repayment, water, and capital (₹ Cr).
5. **Compute Commons & Infrastructure Planning (`/compute`)** — Interactive AI compute facility sizing engine. Models 3 canonical scenarios (Pilot: 5 kW, Phase 1: 20 kW, Expansion: 50 kW), PUE facility overhead, BESS storage buffers, 24-hr marginal grid carbon curves, and source-backed accelerator BOM configurations without synthetic benchmark claims.
6. **Energy Intelligence & Utility Bill Evidence (`/energy`)** — Empirical calibration hub integrating historical JVVNL electricity invoices (February 2022). Comprehensive financial breakdown, arrears isolation, CT meter multiplier identification, and reconciliation against Dhun's bill-derived campus baseline (300 MWh/yr).

## Run it

```bash
cd frontend
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

Run automated verification tests (107 unit and integration tests):

```bash
npm test
```

No API keys, no network services and no database are required. The model runs
synchronously in the browser and is deterministic: the same inputs produce the
same outputs.

## What is modelled

- Three phases: Today (2026), Phase 1 (2029) and build-out (2035).
- Operational energy from built area, EPI, compute, pumping, STP and waste.
- Solar yield with seasonal shape, soiling and self-consumption.
- Land sink: 3.75 tCO₂e per protected acre per year plus established farms.
- Whole-life embodied carbon at 225 kgCO₂e/m² upfront and 287.5 kgCO₂e/m²
  in the use stage, over a 25-year assessment window.
- Water balance: domestic demand plus landscape irrigation against harvest.

Key planning assumptions live in
`frontend/src/features/dhun/data/constants.ts` and
`frontend/src/features/dhun/data/phases.ts`.

## Sensor gateway seam

The demo needs no network. To attach a field gateway later, build the frontend
with a websocket URL:

```bash
VITE_TELEMETRY_WS=wss://gateway.example/dhun npm run build
```

The gateway may send one packet, an array, or a `{ packets: [...] }` envelope:

```json
{"nodeId":"grid-hub","metric":"import","value":318.4,"at":1790000000000}
```

`at` is optional Unix milliseconds. A packet overrides the matching node and
channel for 30 seconds; then the deterministic model takes over again. Malformed
JSON and non-numeric values are dropped, and unknown keys never change a node.
The frame clock pauses without closing the socket, and losing the socket
degrades to the model rather than a blank screen.

## Confidentiality

This repository is shared project material for the Dhun team. Do not publish,
share, or redistribute it without explicit permission.
