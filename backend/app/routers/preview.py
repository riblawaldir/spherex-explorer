"""GET /api/preview/{obs_id} — hollow Sprint 0 stub (501)."""

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.routers.fixtures import STUB_PROVENANCE

router = APIRouter(prefix="/api", tags=["preview"])


@router.get("/preview/{obs_id}")
def get_preview(
    obs_id: str,
    size: int = Query(default=512, ge=1, le=4096),
) -> JSONResponse:
    """Preview PNG not implemented — Waldir (P5) processing in Sprint 2+.

    Returns 501 with stub provenance. Do not use in scientific demo.
    """
    _ = size
    return JSONResponse(
        status_code=501,
        content={
            "detail": (
                f"Preview for obs_id={obs_id!r} not implemented "
                "(Sprint 0 stub; FITS→PNG owned by P5)"
            ),
            "provenance": STUB_PROVENANCE,
        },
        headers={"X-Provenance": "stub"},
    )
