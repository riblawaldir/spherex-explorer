"""GET /api/epochs — hollow Sprint 0 stub."""

from fastapi import APIRouter, Query

from app.routers.fixtures import STUB_PROVENANCE

router = APIRouter(prefix="/api", tags=["epochs"])


@router.get("/epochs")
def get_epochs(
    ra: float = Query(..., description="RA degrees"),
    dec: float = Query(..., description="Dec degrees"),
    radius_arcsec: float | None = Query(default=None),
    band: str | None = Query(default=None),
) -> dict:
    """Empty epochs list until Sprint 2 IRSA / cache wiring.

    Accepts query params for contract shape; ignores them in Sprint 0.
    """
    _ = (ra, dec, radius_arcsec, band)
    return {"epochs": [], "provenance": STUB_PROVENANCE}
