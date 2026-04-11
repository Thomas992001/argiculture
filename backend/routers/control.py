"""Actuator control API endpoints."""

from fastapi import APIRouter, HTTPException

from backend.models import ActuatorCommand, Actuator
from backend.services.twin_state import twin_state

router = APIRouter(prefix="/api/control", tags=["Control"])


@router.post("/actuator", response_model=Actuator)
async def control_actuator(command: ActuatorCommand):
    """Send a command to an actuator (on/off/auto)."""
    from backend.main import app_state
    simulator = app_state.get("simulator")

    actuator = twin_state.set_actuator(command)
    if not actuator:
        raise HTTPException(status_code=404, detail=f"Actuator '{command.actuator_id}' not found")

    if simulator:
        simulator.set_actuator(command.actuator_id, command.command)

    return actuator


@router.post("/emergency-stop")
async def emergency_stop():
    """Emergency stop: turn off all actuators."""
    from backend.main import app_state
    simulator = app_state.get("simulator")

    actuators = twin_state.get_all_actuators()
    for act in actuators:
        cmd = ActuatorCommand(actuator_id=act.actuator_id, command="off")
        twin_state.set_actuator(cmd)
        if simulator:
            simulator.set_actuator(act.actuator_id, "off")

    return {"status": "all_actuators_stopped", "count": len(actuators)}
