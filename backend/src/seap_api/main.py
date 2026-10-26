from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from seap_api.auth import require_user
from seap_api.config import get_settings
from seap_api.database import check_database

settings = get_settings()
app = FastAPI(title="ControleSEAP API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)


@app.get("/health/live", tags=["health"])
def liveness() -> dict[str, str]:
    return {"status": "alive"}


@app.get("/health/ready", tags=["health"])
def readiness() -> dict[str, str]:
    if not check_database():
        raise HTTPException(status_code=503, detail="database_not_ready")
    return {"status": "ready", "database": "connected"}


@app.get("/api/v1/me", tags=["auth"])
def current_user(user: dict = Depends(require_user)) -> dict[str, str]:
    return {"id": str(user["sub"]), "role": str(user.get("role", "authenticated"))}
