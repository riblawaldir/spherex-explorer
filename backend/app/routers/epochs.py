"""GET /api/epochs — time-ordered visits (fixtures default; optional live IRSA)."""

from fastapi import APIRouter, Query

from app.services.catalog import get_catalog_service
from app.validation import DecQuery, OptionalRadiusArcsecQuery, RaQuery

router = APIRouter(prefix="/api", tags=["epochs"])


@router.get("/epochs")
def get_epochs(
    ra: RaQuery,
    dec: DecQuery,
    radius_arcsec: OptionalRadiusArcsecQuery = None,
    band: str | None = Query(default=None, description="Optional bandpass filter"),
) -> dict:  # radius default via = (FastAPI Annotated rule)
    """Return time-ordered epochs near ra/dec.

    Returns fixture fields plus normalized UTC, detector metadata, and
    Planning Period when encoded in the ID. Unknown fields remain null.
    ra/dec come from labeled fixtures when present (nullable);
    collection/source_url are not invented here.
    TODO(P4): replace fixture CatalogService with IRSA SIA2/TAP results.
    Default: labeled fixtures (stub / cached_sample). With SPHEREX_USE_IRSA=1,
    CatalogService calls P4 search_observations and labels successful rows
    ``live`` (falls back to fixtures on IRSA failure).

    Required fields: obs_id, ra, dec, t_mjd, bandpass, wavelength_um,
    preview_url, provenance. Live rows may also include collection /
    source_url when IRSA provided them.
    """
    result = get_catalog_service().epochs(
        ra=ra, dec=dec, radius_arcsec=radius_arcsec, band=band
    )
    return {"epochs": result.epochs, "provenance": result.provenance}
