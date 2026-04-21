# 🌱 AgriTwin — Digital Twin Agriculture

**Cloud-native Digital Twin for a Small-Scale Greenhouse & Water-Culture Farm**

AgriTwin is a full-stack, cloud-deployed digital twin that fuses live IoT sensor data, a physics-aware simulator, closed-loop automation, and Google Gemini AI into one platform. It gives small farmers real-time visibility, agronomic advice, and natural-language control of their greenhouse — from any browser, in four languages.

> **Live deployment**: Single-container app on **Google Cloud Run**, backed by **Firebase** (Auth + Realtime Database + Firestore) and **Google Vertex AI** (Gemini).

---

## ✨ Highlights

- **🧠 Agentic AI (GreenMind)** — Chat with Google Gemini about your crop, ask "what-if" questions, generate daily reports and grow plans, diagnose plant photos with Gemini Vision.
- **🎙️ Hey Twin Voice Assistant** — Always-on wake-word ("Hey Twin / 你好 Twin / Halo Twin"). Speak natural commands like *"water Bed A for 30 seconds"* and the AI parses intent, proposes the action, and executes after confirmation.
- **🌐 Cloud-synced in real time** — Firebase Realtime Database streams sensor data; Firestore syncs actuator state. Frontend and backend stay coherent across devices.
- **🤖 Closed-loop automation** — Weather-aware auto-irrigation: if it's hot *and* soil moisture is low *and* no rain is expected, the backend pulses the right pump for that bed.
- **🖼️ 3D Virtual Greenhouse** — Interactive Three.js scene with live sensor overlays and animated actuators.
- **📈 Forecasting & Anomaly Detection** — XGBoost + Isolation Forest + Z-score ensemble, interpreted by Gemini in plain English.
- **🔌 Hardware-ready** — The simulator and an ESP32/Arduino node share the same RTDB schema (`rtdb_paths_guide.md`). Swap simulator off → real sensors write in; frontend needs zero changes.
- **🌍 Multilingual** — AI responses and voice I/O in English, 简体中文, Bahasa Melayu, and தமிழ்.

---

## 🏗️ Architecture

```
                      ┌──────────────────────────────┐
                      │   Browser (React + Vite)     │
                      │  Login · Overview · 3D       │
                      │  Control · Analytics · Chat  │
                      │  Hey Twin Voice Dialog       │
                      └─────┬────────┬───────┬───────┘
                            │        │       │
               Firebase Auth│        │REST / WS│
                            │        │       │
                 ┌──────────┴─┐  ┌───┴────┐  ┌┴───────────────┐
                 │  Firebase  │  │ FastAPI│  │ Firebase RTDB  │
                 │  Firestore │  │ Backend│  │ (live sensors) │
                 │ (controls) │  │        │  └───────┬────────┘
                 └──────┬─────┘  └───┬────┘          │
                        │            │               │
                        ▼            ▼               ▼
                  ┌────────────────────────────────────┐
                  │  Digital Twin State Manager        │
                  │  + Rules Engine                    │
                  │  + Automation Engine (closed loop) │
                  │  + Gemini Advisor (Vertex AI)      │
                  │  + Weather Service (Open-Meteo)    │
                  │  + Agent Executor (intent → act)   │
                  └───────┬──────────────┬─────────────┘
                          │              │
              Python Simulator   or   ESP32 / Arduino
                  (dev)                 (production)
```

Deployed as a **single Docker image** on Cloud Run: the React app is built into `frontend/dist/` and served as static assets by FastAPI, so one URL handles everything (API, WebSocket, SPA).

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+ (3.12 recommended)
- Node.js 18+
- A Google Cloud project with Vertex AI enabled (optional, for Gemini)
- A Firebase project with Auth + Realtime Database + Firestore (optional, for cloud sync)

### 1. Install & configure

```bash
pip install -r requirements.txt
cp .env.example .env   # then fill in keys (optional)
```

For Firebase, drop your service-account JSON next to `backend/firebase_admin_config.py` (excluded from Git by `.gitignore`).

### 2. Start the backend

```bash
python run_backend.py
```

- API: `http://localhost:8000`
- Auto-docs: `http://localhost:8000/docs`
- WebSocket: `ws://localhost:8000/ws`
- The simulator auto-starts and pushes data to Firebase RTDB every 5 s.

### 3. Start the frontend (dev)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. Log in with any Firebase Auth email/password account.

### 4. Or run the production container

```bash
docker build -t agritwin .
docker run -p 8080:8080 --env-file .env agritwin
```

### 5. (Optional) Deploy to Google Cloud Run

```bash
./deploy_cloudrun.ps1
# or use the provided cloudbuild-*.yaml files with:
gcloud builds submit --config cloudbuild.yaml
```

---

## 🗂️ Project Structure

```
backend/                   FastAPI app, AI, twin state, cloud sync
├── main.py                App entry, WebSocket, SPA routing
├── config.py              Pydantic settings + env loader
├── models.py              Pydantic schemas (sensors, actuators, alerts)
├── database.py            TS store + Firebase RTDB listener/writer
├── firebase_admin_config.py
└── routers/
│   ├── sensors.py         /api/sensors
│   ├── twin.py            /api/twin
│   ├── control.py         /api/control
│   ├── analytics.py       /api/analytics (Gemini-enhanced)
│   └── advisor.py         /api/advisor (GreenMind chat, vision, reports)
└── services/
    ├── twin_state.py      Digital twin state + Firestore control listener
    ├── rules_engine.py    Threshold alert engine
    ├── automation_engine.py  Closed-loop auto-irrigation
    ├── gemini_advisor.py  Vertex AI Gemini client + system prompt
    ├── agent_executor.py  Intent parser → actuator commands
    ├── ai_advisor.py      Rule-based fallback advisor + crop profiles
    └── weather_service.py Open-Meteo integration (KL)

simulator/
└── greenhouse_simulator.py  Physics-aware sensor generator

ml/
├── forecasting.py         XGBoost + EMA multi-step forecast
└── anomaly.py             Z-score + Isolation Forest ensemble

frontend/src/
├── App.jsx                Routing, wake-word, auth gate
├── firebase.js            Client Firebase SDK
├── pages/                 Login, Overview, Sensors, Greenhouse (3D),
│                          Control, Analytics, Assistant
├── components/            AiAssistant, HeyTwinDialog, SensorCard,
│                          RealtimeChart, VirtualGreenhouse, ...
├── hooks/                 useRTDBData, useRTDBHistory, useRTDBForecast,
│                          useRTDBAnomalies, useControlStates, useWebSocket
└── contexts/              AlertsProvider

rtdb_paths_guide.md        Hardware team's RTDB schema reference (zh)
analysis_and_roadmap.md    Architecture review & future roadmap (zh)
Dockerfile                 Multi-stage build (Node → Python)
cloudbuild*.yaml           Google Cloud Build configs
deploy_cloudrun.ps1        One-shot Cloud Run deploy script
```

---

## 🌿 Zones, Sensors & Actuators

### 4 zones × 13 sensors

| Zone | ID | Sensors |
|------|------|---------|
| Greenhouse Condition | `zone_air` | `air_rh_1`, `air_rh_2` (humidity), `air_temp_1` (temperature), `air_light_1` (light) |
| Substrate A | `zone_bed_a` | `bed_a_temp`, `bed_a_ph`, `bed_a_moisture` |
| Substrate B | `zone_bed_b` | `bed_b_temp`, `bed_b_ph`, `bed_b_moisture` |
| Substrate C | `zone_bed_c` | `bed_c_temp`, `bed_c_ph`, `bed_c_moisture` |

### 16 actuators

- **3 irrigation pumps** — `pump_a`, `pump_b`, `pump_c` (one per substrate bed)
- **13 sensor power channels** — `sensor_<sensor_id>` lets the user (or hardware) power each sensor individually. When OFF, the sensor reports `value=0, quality=0`.

Full RTDB schema + an ESP32 write-example lives in [`rtdb_paths_guide.md`](./rtdb_paths_guide.md).

---

## 🔌 API Reference (selected)

### Core twin

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/status` | System status + uptime |
| `GET`  | `/api/sensors/latest` | Latest reading for every sensor |
| `GET`  | `/api/sensors/history` | Historical range query |
| `GET`  | `/api/twin/state` | Full twin snapshot |
| `GET`  | `/api/twin/actuators` | All actuator states |
| `GET`  | `/api/twin/alerts` | Active alerts |
| `POST` | `/api/control/actuator` | Set an actuator on/off/auto |
| `POST` | `/api/control/emergency-stop` | Turn everything OFF |
| `POST` | `/api/simulator/bind` | Bind simulator to a Firebase UID |
| `WS`   | `/ws` | Real-time push (`sensor_update`, `alerts`, `state_snapshot`) |

### Gemini AI advisor

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/advisor/chat` | Conversational chat with live sensor context |
| `POST` | `/api/advisor/agent-chat` | Agentic chat (natural-language → actuator action) |
| `POST` | `/api/advisor/confirm-action` | Confirm a proposed action by `action_id` |
| `GET`  | `/api/advisor/hello-twin` | Proactive greeting + status briefing |
| `GET`  | `/api/advisor/daily-report` | AI-generated daily greenhouse report |
| `POST` | `/api/advisor/grow-plan` | Week-by-week AI grow plan per crop |
| `POST` | `/api/advisor/what-if` | Physics-aware what-if scenario analysis |
| `POST` | `/api/advisor/diagnose-image` | Plant image health check (Gemini Vision) |
| `POST` | `/api/advisor/explain-anomaly` | Plain-language anomaly explanation |
| `GET`  | `/api/advisor/automation-schedule` | AI-optimized 24 h schedule |
| `GET`  | `/api/advisor/learn/{topic}` | Beginner explainer for a concept |
| `GET`  | `/api/advisor/weather` | Live outdoor weather + 12 h forecast |
| `GET`  | `/api/advisor/forecast-soil` | Gemini soil forecast (1–24 h) |
| `GET`  | `/api/advisor/vpd` | Current VPD + crop-specific status |
| `GET`  | `/api/advisor/crops` / `POST /api/advisor/crop/{name}` | List / set active crop profile |
| `GET`  | `/api/advisor/automation/status` | Inspect the closed-loop engine |
| `POST` | `/api/advisor/automation/enabled?enabled=…` | Enable/disable auto-irrigation |
| `GET`  | `/api/advisor/agent-log` | Agent execution audit log |
| `GET`  | `/api/advisor/status` | Gemini availability + model-fallback state |

### Analytics

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/analytics/forecast?zone_id=…&sensor_type=…` | Multi-step forecast + Gemini interpretation |
| `GET`  | `/api/analytics/anomalies` | Per-sensor anomalies + Gemini report |
| `GET`  | `/api/analytics/statistics` | Stats + Gemini interpretation |

Interactive OpenAPI docs are always available at `/docs`.

---

## 🤖 AI Details

- **Model**: Google Gemini via Vertex AI, default `gemini-3-flash-preview`.
  Automatic fallback chain: `gemini-2.5-flash → gemini-2.5-flash-lite` with per-model rate-limit cooldowns.
- **Grounding**: every call re-builds a **live sensor context** snapshot (all 13 sensors, actuator states, active alerts, derived VPD/dew point, outdoor weather, active crop profile) and injects it as the prompt prefix.
- **Persona**: `GreenMind`, defined in `backend/services/gemini_advisor.py`. Speaks as an expert agronomist, always references actual sensor numbers, uses markdown.
- **Agentic flow** (`agent_executor.py`):
  1. Gemini parses the user's natural-language message into structured intent (`control_actuator`, `emergency_stop`, `optimize_environment`, `query_status`, `greeting`, `general_chat`).
  2. Actuators are resolved through a multilingual alias map (English / 中文 / Bahasa Melayu / Tamil).
  3. Risky / multi-actuator commands require confirmation via `/api/advisor/confirm-action`.
  4. Every action is written to an audit log, and pump durations are hard-capped at 5 minutes.
- **Fallback**: if Vertex AI is unreachable, the rule-based `ai_advisor.py` takes over so the UI keeps working offline.

---

## 🔐 Firebase Data Paths

| Purpose | Path |
|---------|------|
| Sensor live values | `users/{uid}/live/latest/{zone_id}:{sensor_id}` (RTDB) |
| Sensor history     | `users/{uid}/live/history/{zone_id}/{sensor_id}/` (RTDB) |
| Actuator commands  | `users/{uid}/control/latest` (Firestore document, keys = actuator IDs) |

See `rtdb_paths_guide.md` for the complete schema and an Arduino/ESP32 write-example.

---

## 🧪 Testing

Ad-hoc scripts for manual verification live at the repo root:

- `test_agent.py` — hit the agentic AI endpoints
- `test_ws.py` — WebSocket client smoke test
- `test_rtdb.py` — verify the Firebase listener + writer
- `clear_rtdb.py` — wipe a UID's live data during development

---

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite 6, Tailwind CSS, Three.js / @react-three/fiber, Recharts, Firebase Web SDK, Lucide icons |
| Backend | FastAPI, Uvicorn, WebSockets, APScheduler, httpx |
| AI / ML | Google Gemini (Vertex AI), `google-genai`, XGBoost, scikit-learn, NumPy, Pandas |
| Data | Firebase Realtime Database, Firestore, in-memory TSDB ring buffer |
| Voice | Web Speech API (wake-word + TTS), multilingual |
| Weather | Open-Meteo (no key required) |
| Container | Multi-stage Docker (Node build → Python runtime) |
| Hosting | Google Cloud Run + Cloud Build |

---

## 📚 Further Reading

- [`rtdb_paths_guide.md`](./rtdb_paths_guide.md) — Firebase RTDB schema for the hardware team (中文)
- [`analysis_and_roadmap.md`](./analysis_and_roadmap.md) — code audit + future roadmap (中文)
- `Digital Twin Agriculture for a Small-Scale Greenhouse and Water-Culture Farm.docx` — original project brief

---

## 📄 License

Internal research project. All rights reserved to the AgriTwin team.
