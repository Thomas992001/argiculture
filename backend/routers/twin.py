"""Digital twin state API endpoints."""

from fastapi import APIRouter
from typing import List

from backend.models import Zone, Actuator, Alert, GreenhouseState
from backend.services.twin_state import twin_state

router = APIRouter(prefix="/api/twin", tags=["Digital Twin"])


@router.get("/state", response_model=GreenhouseState)
async def get_twin_state():
    """Get the complete digital twin state snapshot."""
    return twin_state.get_state()


@router.get("/zones", response_model=List[Zone])
async def get_zones():
    """List all greenhouse zones with current readings."""
    return twin_state.get_all_zones()


@router.get("/zones/{zone_id}", response_model=Zone)
async def get_zone(zone_id: str):
    """Get a specific zone's state."""
    zone = twin_state.get_zone(zone_id)
    if not zone:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found")
    return zone


@router.get("/actuators", response_model=List[Actuator])
async def get_actuators():
    """List all actuators and their current state."""
    return twin_state.get_all_actuators()


@router.get("/alerts", response_model=List[Alert])
async def get_alerts(include_acknowledged: bool = False):
    """Get active alerts."""
    return twin_state.get_alerts(include_acknowledged)


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str):
    """Acknowledge an alert."""
    success = twin_state.acknowledge_alert(alert_id)
    if not success:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found")
    return {"status": "acknowledged", "alert_id": alert_id}
