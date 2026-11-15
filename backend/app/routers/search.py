"""GET /api/search — fixture targets by default; optional live IRSA coords search."""

from fastapi import APIRouter, HTTPException, Query

from app.services.catalog import get_catalog_service
from app.validation import OptionalDecQuery, OptionalRaQuery, OptionalRadiusArcsecQuery

router = APIRouter(prefix="/api", tags=["search"])


@router.get("/search")
def search(
    q: str | None = Query(default=None, description="Name fragment"),
    ra: OptionalRaQuery = None,
    dec: OptionalDecQuery = None,
    radius_arcsec: OptionalRadiusArcsecQuery = None,  # noqa: FAST002 — default via =
) -> dict:
    """Search by name fragment and/or sky position.

    Default: labeled targets in ``data/metadata/targets.json``.
    With SPHEREX_USE_IRSA=1 and ra/dec, CatalogService queries P4 IRSA and
    returns live hits (falls back to fixtures on failure).
    """
    if (ra is None) ^ (dec is None):
        raise HTTPException(
            status_code=422,
            detail="Provide both ra and dec together, or neither",
        )
    if radius_arcsec is not None and (ra is None or dec is None):
        raise HTTPException(
            status_code=422,
            detail="radius_arcsec requires ra and dec",
        )

    result = get_catalog_service().search(
        q=q, ra=ra, dec=dec, radius_arcsec=radius_arcsec
    )
    return {"hits": result.hits, "provenance": result.provenance}
