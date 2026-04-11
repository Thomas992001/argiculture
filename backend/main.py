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
from backend.models import SensorReading, SystemStatus
from backend.services.twin_state import twin_state
from backend.services.rules_engine import rules_engine
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

    payload = {
        "type": "sensor_update",
        "timestamp": datetime.utcnow().isoformat(),
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
