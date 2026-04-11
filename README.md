# Digital Twin Agriculture

**Digital Twin for a Small-Scale Greenhouse and Water-Culture Farm**

A full-stack digital twin system that provides real-time monitoring, AI-powered forecasting, anomaly detection, and actuator control for a small greenhouse with hydroponic and substrate-based growing zones.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Frontend (React)                       │
│  Dashboard │ 3D Greenhouse │ Control │ Analytics          │
└──────────────────┬───────────────────────────────────────┘
                   │  REST + WebSocket
┌──────────────────┴───────────────────────────────────────┐
│                  Backend (FastAPI)                         │
│  API Routers │ Twin State │ Rules Engine │ ML Service     │
└───────┬──────────┬──────────────────────┬────────────────┘
        │          │                      │
   ┌────┴───┐  ┌──┴───┐           ┌──────┴──────┐
   │  TSDB  │  │ MQTT │           │ Simulator   │
   │In-Mem  │  │Broker│           │(Sensor Data)│
   └────────┘  └──────┘           └─────────────┘
```

## Features

### Real-time Monitoring
- 14 simulated sensors across 4 zones (Air, Substrate Bed, Hydroponic NFT, Reservoir)
- Live WebSocket data streaming
- Time-series charts with configurable windows

### 3D Virtual Greenhouse
- Interactive Three.js visualization of the greenhouse
- Real-time sensor value overlays
- Animated actuators (fans, pumps)
- Orbit controls (rotate, zoom, pan)

### AI Analytics
- **Forecasting**: XGBoost-based multi-step prediction for temperature, humidity, moisture, CO₂, pH, water level
- **Anomaly Detection**: Z-score + rate-of-change + Isolation Forest ensemble
- Statistical summaries and trend analysis

### Actuator Control
- 8 controllable actuators (pumps, fans, valves, heater, lights, CO₂ injector)
- Emergency stop function
- Actuator effects reflect in sensor readings (e.g., fan ON → temperature drops)

### Alert System
- Threshold-based rules engine with warning/critical levels
- Real-time alert notifications via WebSocket
- Alert acknowledgment

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- (Optional) Docker for InfluxDB, Mosquitto, Grafana

### 1. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 2. Start the backend

```bash
python run_backend.py
```

The API will be available at `http://localhost:8000`. The simulator starts automatically and generates sensor data every 5 seconds.

### 3. Install and start the frontend

```bash
cd frontend
npm install
npm run dev
```

The UI will be available at `http://localhost:3000`.

### 4. (Optional) Start infrastructure with Docker

```bash
docker-compose up -d
```

This starts:
- **Mosquitto** MQTT broker on port 1883
- **InfluxDB** on port 8086
- **Grafana** on port 3001

---

## Project Structure

```
├── backend/                  # FastAPI backend
│   ├── main.py               # App entry + WebSocket
│   ├── config.py             # Configuration
│   ├── models.py             # Pydantic data models
│   ├── database.py           # In-memory time-series store
│   ├── services/
│   │   ├── twin_state.py     # Digital twin state manager
│   │   └── rules_engine.py   # Alert rules engine
│   └── routers/
│       ├── sensors.py        # Sensor data API
│       ├── twin.py           # Twin state API
│       ├── control.py        # Actuator control API
│       └── analytics.py      # ML analytics API
├── simulator/
│   └── greenhouse_simulator.py  # Realistic sensor data generator
├── ml/
│   ├── forecasting.py        # XGBoost / EMA forecasting
│   └── anomaly.py            # Anomaly detection service
├── frontend/                 # React + Vite + Tailwind
│   └── src/
│       ├── components/       # UI components
│       │   ├── VirtualGreenhouse.jsx  # 3D Three.js scene
│       │   ├── SensorCard.jsx
│       │   ├── RealtimeChart.jsx
│       │   ├── ControlPanel.jsx
│       │   ├── AlertPanel.jsx
│       │   └── ForecastChart.jsx
│       └── pages/            # Page views
├── config/                   # Mosquitto config
├── docker-compose.yml        # Infrastructure setup
├── requirements.txt          # Python dependencies
└── run_backend.py            # Backend start script
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/status` | System status |
| GET | `/api/sensors/latest` | Latest readings (all sensors) |
| GET | `/api/sensors/history` | Historical data with time range |
| GET | `/api/twin/state` | Full digital twin snapshot |
| GET | `/api/twin/zones` | Zone list with current data |
| GET | `/api/twin/actuators` | Actuator states |
| GET | `/api/twin/alerts` | Active alerts |
| POST | `/api/control/actuator` | Control an actuator |
| POST | `/api/control/emergency-stop` | Emergency stop all |
| GET | `/api/analytics/forecast` | ML forecast |
| GET | `/api/analytics/anomalies` | Anomaly detection |
| GET | `/api/analytics/statistics` | Statistical summary |
| WS | `/ws` | Real-time sensor stream |

---

## Sensor Zones

| Zone | Sensors | Actuators |
|------|---------|-----------|
| Greenhouse Air | Temperature, Humidity, CO₂, Light | Exhaust Fan, Circulation Fan, Heater, CO₂ Injector, Lights |
| Substrate Bed | Soil Moisture, Temperature, EC | Irrigation Valve |
| Hydroponic NFT | pH, EC, Water Temperature | Nutrient Pump |
| Reservoir | Water Level, pH, EC, Temperature | Main Pump |

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, FastAPI, WebSocket |
| Frontend | React 18, Vite, Tailwind CSS |
| 3D Visualization | Three.js, React Three Fiber |
| Charts | Recharts |
| ML/AI | XGBoost, scikit-learn, NumPy |
| Messaging | MQTT (Mosquitto) |
| Time-Series DB | InfluxDB (optional) |
| Dashboards | Grafana (optional) |
