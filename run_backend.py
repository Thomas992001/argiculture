"""Start the Digital Twin Greenhouse backend server."""
import os
import uvicorn
from backend.config import settings

if __name__ == "__main__":
    # Get port from environment or settings
    # Pydantic Settings already handles the PORT alias, but we can be explicit here too
    port = int(os.environ.get("PORT", settings.backend_port))
    host = settings.backend_host
    
    # Reload should be False in production (Cloud Run)
    is_prod = os.environ.get("K_SERVICE") is not None  # K_SERVICE is set in Cloud Run
    
    uvicorn.run(
        "backend.main:app",
        host=host,
        port=port,
        reload=not is_prod,
        log_level="info",
    )
