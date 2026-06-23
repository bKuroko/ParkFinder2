from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models
from app.api.routes import admin, auth, ingest, public
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import engine


settings = get_settings()

app = FastAPI(
    title="ParkFinder API",
    description="Backend API for smart parking facility monitoring.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    if settings.create_tables_on_start:
        Base.metadata.create_all(bind=engine)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def root() -> dict[str, object]:
    return {
        "name": "ParkFinder API",
        "status": "running",
        "docs": "/docs",
        "health": "/health",
        "public_endpoints": ["/api/v1/facilities"],
    }


app.include_router(auth.router, prefix="/api/v1")
app.include_router(public.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(ingest.router, prefix="/api/v1")
