"""GET /api/targets — labeled fixture catalog (Sprint 1)."""

from fastapi import APIRouter

from app.services.catalog import get_catalog_service

router = APIRouter(prefix="/api", tags=["targets"])


@router.get("/targets")
def get_targets() -> list[dict]:
    """Return test-target fixtures (provenance in notes / catalog payload)."""
    return get_catalog_service().list_targets()
