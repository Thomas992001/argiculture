"""Actuator control API endpoints."""

from fastapi import APIRouter, HTTPException

from backend.models import ActuatorCommand, Actuator, ActuatorState
from backend.services.twin_state import twin_state

router = APIRouter(prefix="/api/control", tags=["Control"])


@router.post("/actuator", response_model=Actuator)
async def control_actuator(command: ActuatorCommand):
    """Send a command to an actuator (on/off/auto)."""
    actuator = twin_state.set_actuator(command)
    if not actuator:
        raise HTTPException(status_code=404, detail=f"Actuator '{command.actuator_id}' not found")

    return actuator


@router.post("/emergency-stop")
async def emergency_stop():
    """Emergency stop: turn off all actuators."""
    actuators = twin_state.get_all_actuators()
    for act in actuators:
        twin_state.set_actuator(
            ActuatorCommand(actuator_id=act.actuator_id, command=ActuatorState.OFF)
        )

    return {"status": "all_actuators_stopped", "count": len(actuators)}
