# CarbonTwin OS

**CarbonTwin OS** is an industrial AI and Digital Twin operating platform engineered for modern manufacturing plants and industrial facilities. It unifies high-frequency IoT telemetry streaming, physics-informed digital twin simulations, XGBoost-powered predictive failure estimation, and real-time carbon emission intelligence into a single operational command center.

---

## FixTrace

> *"Remember the failure. Remember the fix."*

**FixTrace** is the persistent experiential maintenance memory subsystem embedded within CarbonTwin OS, powered by **Hindsight** (Vectorize). 

While conventional industrial software relies on static relational work-order tables, FixTrace endows factory maintenance operations with continuous, cross-incident organizational learning. When a technician encounters an anomaly, FixTrace queries Hindsight to recall past troubleshooting trials, identifies previously failed interventions so teams avoid repeating costly mistakes, and highlights verified root causes and validated repair playbooks.

### Operational State vs. Experiential Memory

A critical architectural distinction in CarbonTwin OS is the strict separation between operational records and true experiential memory:

| Dimension | Operational State (Local SQLite / Relational) | Experiential Memory (Hindsight Cloud Memory Layer) |
| :--- | :--- | :--- |
| **Storage & Subsystem** | Local operational database (`fixtrace.db`) | Hindsight Vectorize Cloud Bank (`fixtrace-final-demo-01`) |
| **Data Scope** | Machine registry, active incident status, step-by-step attempt timestamps, telemetry snapshots | Semantic maintenance insights, multi-step failure reflections, failure causal relationships |
| **Query Mechanism** | Exact relational queries (`WHERE machine_id = 'MTR-001' AND status = 'OPEN'`) | Semantic vector search, hybrid keyword matching, cross-encoder neural reranking |
| **Cognitive Role** | Audit trail, state machine, and ledger of record | Long-term organizational memory, learning from failure, preventative guidance |
| **Future Utility** | Tracking specific work orders and operational lifecycles | Instant cross-incident knowledge transfer across facilities and machine variants |

### The Core Hindsight Closed-Loop Lifecycle

```
   [ CarbonTwin Telemetry Anomaly ]
                 │
                 ▼
       [ FixTrace Incident Ingest ]
                 │
                 ▼
        [ Hindsight Recall ] ────► Prior experience found?
                 │                         │
                 ├────────── No ───────────┴────────── Yes ──────────┐
                 ▼                                                   ▼
     Baseline Exploration Mode                          Surfaced Playbook & Warnings
    (Log step-by-step attempts)                        - Failed Actions to Avoid
                 │                                     - Verified Successful Fix
                 │                                     - Root Cause & Maintenance Lesson
                 ▼                                                   │
     [ Incident Resolution ]                                         ▼
   (Root Cause + Verified Fix)                             [ Accelerated Recovery ]
                 │
                 ▼
        [ Hindsight Retain ] ────► Synthesizes multi-unit experience, world models,
                 │                 and observations into Vectorize cloud bank
                 ▼
   [ Organizational Memory Updated ]
```

1. **CarbonTwin Anomaly**: Real-time sensor stream flags abnormal vibrations, temperatures, or pressure anomalies on asset `MTR-001`.
2. **FixTrace Incident**: Incident record is ingested with machine operating conditions (RPM, Temperature, Vibration RMS, Power).
3. **Hindsight Recall**: The incident query is dispatched to Hindsight. On first encounter, zero prior memories exist.
4. **Troubleshooting Execution**: Technicians log sequential attempts (marking intermediate interventions as FAILED and final resolution as SUCCESSFUL).
5. **Resolution**: Incident is formally resolved with confirmed Root Cause, Verified Fix, and Lesson Learned.
6. **Hindsight Retain**: FixTrace synthesizes the full maintenance narrative and calls `hindsight.retain()`, generating persistent reflections across observation, world, and experience memory layers.
7. **Future Recall**: When similar symptoms occur in the future, Hindsight instantly retrieves past lessons, warning technicians against dead-end attempts before tools touch the machine.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                               CarbonTwin OS UI                              │
│         (React 19 / TypeScript / Vite / Tailwind CSS / Recharts)            │
│      Factory Map  •  Digital Twin Panel  •  FixTrace Workbench  •  Copilot  │
└──────────────────────┬───────────────────────────────┬──────────────────────┘
                       │ :8000                         │ :8001
                       ▼                               ▼
       ┌───────────────────────────────┐   ┌──────────────────────────────┐
       │      CarbonTwin Backend       │   │       FixTrace Backend       │
       │    (FastAPI / Socket.IO)      │   │    (FastAPI / SQLite ORM)    │
       │  • Telemetry Simulation Engine│   │  • Incident Lifecycle State  │
       │  • XGBoost Predictive Models  │   │  • Attempt Action Ledger     │
       │  • Real-time Anomaly Detector │   │  • Observability Telemetry   │
       │  • Carbon Hotspot Analytics   │   └──────────────┬───────────────┘
       └───────────────────────────────┘                  │
                                                          │ Hindsight SDK / REST
                                                          ▼
                                           ┌──────────────────────────────┐
                                           │       Hindsight Cloud        │
                                           │    (Vectorize.io Engine)     │
                                           │  • Experiential Memory Bank  │
                                           │  • Semantic / Rerank Search  │
                                           │  • Long-Term Knowledge Base  │
                                           └──────────────────────────────┘
```

---

## Technology Stack

### CarbonTwin Core
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Recharts, Lucide Icons, Framer Motion
- **Backend**: FastAPI, Python 3.10+, Uvicorn, Python-SocketIO
- **Machine Learning**: XGBoost, Scikit-Learn, Pandas, NumPy
- **Real-time Telemetry**: Socket.IO bi-directional streaming

### FixTrace Experiential Subsystem
- **UI**: Embedded FixTrace Workbench, Dynamic Guidance Cards, Real-time Observability Ledger
- **Service API**: FastAPI (REST endpoints on port `8001`)
- **Operational Database**: SQLite with SQLAlchemy ORM
- **Experiential Memory Engine**: Hindsight (Vectorize Python SDK & Cloud API)

---

## Hindsight Integration

FixTrace integrates directly with **Hindsight** (`api.hindsight.vectorize.io`), treating organizational experience as a dynamic cognitive capability rather than a static text log:

- **Not a Mere Database**: Instead of string-matching SQL rows, Hindsight decomposes troubleshooting narratives into semantic memory units (`observation`, `world`, `experience`), indexing contextual machine state alongside failure modes.
- **Cognitive Decomposition**: Retained maintenance experiences yield structured insights—capturing why an approach failed and linking symptoms to laser alignment tolerances.
- **Demonstrated Dual-Stage Behavior**:
  - *Stage A (First Encounter)*: Asset `MTR-001` exhibits 120Hz vibration sidebands. Hindsight bank returns `0` memories (`prior_experience_found: false`). Technicians log two failed troubleshooting attempts (grease re-lubrication, belt de-tensioning) followed by a successful ceramic bearing installation and laser alignment. Upon resolution, Hindsight retains the full context.
  - *Stage B (Second Encounter)*: A subsequent incident with similar operating conditions triggers Hindsight recall. Hindsight retrieves the previous experience (relevance score `0.9047`), immediately presenting the technician with:
    1. **Approaches to Avoid**: Prior failed re-lubrication and belt tensioning attempts.
    2. **Recommended Action**: Matched ceramic hybrid bearing (SKF 6208-2Z) and precision laser alignment.
    3. **Root Cause & Lesson Learned**: 0.065mm angular coupling misalignment causing fatigue spalling.

---

## Verified Demo Flow (Asset MTR-001)

The canonical rehearsal validates the FixTrace cognitive loop against real Hindsight cloud memory:

```
[STAGE A] Incident INC-20260929-966D
  • Initial Recall: 0 prior memories found
  • Attempt 1 [FAILED]: Re-lubricated bearing housing with synthetic polyurea grease
  • Attempt 2 [FAILED]: Adjusted drive belt tension from 520N to 420N
  • Attempt 3 [SUCCESSFUL]: Installed ceramic hybrid bearing (SKF 6208-2Z) & laser aligned to 0.015mm
  • Resolution: Root cause & operational lesson recorded
  • Hindsight Retain: Retained to bank 'fixtrace-final-demo-01'

[STAGE B] Incident INC-20260929-7AE4 (New Incident, Similar Symptoms)
  • Subsequent Recall: 10 semantic memory units retrieved
  • Best Match Score: 0.9047 (Raw Hindsight reranker score)
  • UI Guidance: Surfaces 2 failed approaches to avoid, verified fix, root cause, and lesson
```

---

## Running Locally

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+
- Hindsight API Key from [Vectorize.io](https://vectorize.io)

### 1. Environment Setup

Copy `.env.example` to `.env` in both backend folders:

```bash
# In fixtrace-backend/
cp .env.example .env
# Edit .env to set your HINDSIGHT_API_KEY and HINDSIGHT_BANK_ID

# In backend/ (CarbonTwin core)
cp .env.example .env
# Edit .env to set your GEMINI_API_KEY
```

### 2. Start CarbonTwin Backend (Port 8000)

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
python run.py
```
*CarbonTwin backend will start at `http://127.0.0.1:8000`.*

### 3. Start FixTrace Backend (Port 8001)

```bash
cd fixtrace-backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```
*FixTrace API will start at `http://127.0.0.1:8001`.*

### 4. Start Unified Frontend (Port 5173)

```bash
cd frontend
npm install
npm run dev
```
*The unified dashboard is accessible at `http://localhost:5173`.*  
*Navigate to `/fixtrace` in the sidebar to open the FixTrace Workbench.*

---

## Running Tests

FixTrace includes an automated pytest suite covering CRUD operations, Hindsight API mock fallbacks, CarbonTwin anomaly ingestion, and observability endpoints:

```bash
cd fixtrace-backend
python -m pytest tests/ -v
```

---

## Security

- All API keys, tokens, and personal credentials are strictly excluded from this repository via `.gitignore`.
- Production instances must provide credentials through environment variables or secure vault injection.
- Local SQLite database files (`*.db`) and Python virtual environments are excluded from version control.

---

## Hackathon Submission

- **Hackathon**: HackWithHyderabad 3.0
- **Theme**: *AI Agents That Learn Using Hindsight*
- **Solution Alignment**: FixTrace directly embodies the theme by equipping industrial maintenance agents and operators with persistent, self-improving memory. By leveraging Hindsight's retain and recall APIs, CarbonTwin OS transforms ephemeral machine breakdowns into durable organizational wisdom.
