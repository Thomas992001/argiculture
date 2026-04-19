"""
Digital Twin Agriculture - Backend API Server
FastAPI application with WebSocket for real-time sensor streaming.
"""

import asyncio
import json
import time
from contextlib import asynccontextmanager
from datetime import datetime
from typing import List, Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.config import settings
from backend.database import tsdb
from backend.models import SensorReading, SystemStatus, get_now
from backend.services.twin_state import twin_state
from backend.services.rules_engine import rules_engine
from backend.services.automation_engine import automation_engine
from simulator.greenhouse_simulator import GreenhouseSimulator

app_state = {}


class ConnectionManager:
    """Manages active WebSocket connections for real-time data push."""

    def __init__(self):
        self.active: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active.discard(websocket)

    async def broadcast(self, message: dict):
        dead = set()
        for ws in self.active:
            try:
                await ws.send_json(message)
            except Exception:
                dead.add(ws)
        self.active -= dead


ws_manager = ConnectionManager()


def on_sensor_data(readings: List[SensorReading]):
    """Callback from the simulator: store data, evaluate rules, queue WS broadcast."""
    tsdb.write_batch(readings)
    twin_state.update_readings(readings)

    violations = rules_engine.evaluate(readings)
    for v in violations:
        twin_state.add_alert(
            severity=v.severity,
            message=v.message,
            sensor_id=v.reading.sensor_id,
            zone_id=v.reading.zone_id,
            value=v.reading.value,
            threshold=v.rule.warning_high or v.rule.warning_low,
        )

    # Closed-loop automation: evaluates rules that actually drive actuators
    # (e.g. hot + dry → pulse the per-bed pump)
    try:
        automation_engine.evaluate(readings)
    except Exception as e:
        print(f"[AutomationEngine] evaluate error: {e}")

    payload = {
        "type": "sensor_update",
        "timestamp": get_now().isoformat(),
        "readings": [
            {
                "sensor_id": r.sensor_id,
                "sensor_type": r.sensor_type.value,
                "zone_id": r.zone_id,
                "value": r.value,
                "unit": r.unit,
                "quality": r.quality,
            }
            for r in readings
        ],
        "alerts": [
            {
                "alert_id": v.reading.sensor_id,
                "severity": v.severity.value,
                "message": v.message,
            }
            for v in violations
        ],
    }

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.run_coroutine_threadsafe(ws_manager.broadcast(payload), loop)
    except RuntimeError:
        pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    simulator = GreenhouseSimulator()
    simulator.on_data(on_sensor_data)
    # Firestore/UI and automation both go through twin_state → simulator
    twin_state.bind_actuator_sink(simulator.set_actuator)
    app_state["simulator"] = simulator
    app_state["start_time"] = time.time()

    if settings.simulator_enabled:
        simulator.start(interval=settings.simulator_interval_seconds)

    yield

    simulator.stop()


app = FastAPI(
    title="Digital Twin Agriculture",
    description="Digital Twin for a Small-Scale Greenhouse and Water-Culture Farm",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
from backend.routers import sensors, twin, control, analytics, advisor

app.include_router(sensors.router)
app.include_router(twin.router)
app.include_router(control.router)
app.include_router(analytics.router)
app.include_router(advisor.router)


@app.post("/api/simulator/bind")
async def bind_simulator(data: dict):
    """Link the local simulator to a specific Firebase UID and start cloud listeners."""
    uid = data.get("uid")
    if uid:
        tsdb.set_active_uid(uid)
        
        # 1. Pull previous state from cloud (Restore session)
        twin_state.pull_actuators_from_cloud(uid)
        
        # 2. Start background listeners for cloud synchronization
        tsdb.start_rtdb_listener(uid)
        twin_state.start_control_listener(uid)
        
        # 3. Push current state to cloud (Ensure paths exist/Sync back)
        twin_state.push_actuators_to_cloud(uid)
        
        return {"status": "bound", "uid": uid}
    return {"status": "error", "message": "No UID provided"}


@app.get("/api/status", response_model=SystemStatus)
async def get_system_status():
    simulator = app_state.get("simulator")
    return SystemStatus(
        uptime_seconds=time.time() - app_state.get("start_time", time.time()),
        mqtt_connected=False,
        influxdb_connected=False,
        simulator_running=simulator.is_running if simulator else False,
        active_sensors=len(tsdb.get_all_latest()),
        active_actuators=len(twin_state.get_all_actuators()),
        pending_alerts=len(twin_state.get_alerts()),
    )


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            elif msg.get("type") == "get_state":
                state = twin_state.get_state()
                await websocket.send_json({
                    "type": "state_snapshot",
                    "data": json.loads(state.model_dump_json()),
                })
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)

# --- SPA Routing for Unified Deployment ---
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

dist_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")

# Only mount if the dist directory exists (e.g. in Docker)
if os.path.exists(dist_path):
    # Mount assets folder explicitly if it exists
    assets_path = os.path.join(dist_path, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    # Catch-all route to serve the React SPA
    @app.get("/{catchall:path}")
    async def serve_spa(catchall: str):
        # Prevent React from catching API or WS routes 
        if catchall.startswith("api/") or catchall.startswith("ws"):
            raise StarletteHTTPException(status_code=404, detail="Not Found")
            
        file_path = os.path.join(dist_path, catchall)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
            
        return FileResponse(os.path.join(dist_path, "index.html"))
