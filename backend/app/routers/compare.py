"""GET /api/compare — validate obs_id pair; wire P5 align when possible."""

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.services.catalog import get_catalog_service
from app.services.compare import compare_observations

router = APIRouter(prefix="/api", tags=["compare"])


@router.get("/compare")
def compare_pair(
    obs_id_a: str = Query(..., min_length=1, description="First observation id"),
    obs_id_b: str = Query(..., min_length=1, description="Second observation id"),
):
    """Return comparable / not_comparable for a pair of known obs_ids.

    Metadata gates (bandpass, wavelength, local FITS) always run. When both
    FITS resolve, P5 ``align_fits_images`` (and quality when present) is
    attempted. Scientific difference is not implemented by P5 yet — ``diff``
    stays an honest stub (not a residual image). Unknown ids → 404; identical
    ids → 422. No invented NASA ``collection`` / ``source_url``.
    """
    outcome = compare_observations(
        get_catalog_service(), obs_id_a=obs_id_a, obs_id_b=obs_id_b
    )
    if outcome.http_status != 200:
        return JSONResponse(status_code=outcome.http_status, content=outcome.payload)
    return outcome.payload
