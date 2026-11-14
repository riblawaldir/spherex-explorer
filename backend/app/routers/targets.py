"""GET /api/targets — hollow Sprint 0 stub."""

from fastapi import APIRouter

from app.routers.fixtures import STUB_TARGETS

router = APIRouter(prefix="/api", tags=["targets"])


@router.get("/targets")
def get_targets() -> list[dict]:
    """Return static test-target fixtures (stub provenance in notes)."""
    return STUB_TARGETS
