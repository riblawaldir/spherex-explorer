"""GET /api/search — hollow Sprint 0 stub."""

from fastapi import APIRouter, Query

from app.routers.fixtures import STUB_PROVENANCE, STUB_TARGETS

router = APIRouter(prefix="/api", tags=["search"])


@router.get("/search")
def search(
    q: str | None = Query(default=None, description="Name fragment"),
    ra: float | None = Query(default=None, description="RA degrees"),
    dec: float | None = Query(default=None, description="Dec degrees"),
) -> dict:
    """Filter static fixtures by name fragment or exact ra/dec match.

    No IRSA / SIMBAD — Sprint 0 placeholder only.
    """
    hits: list[dict] = []

    if q is not None and q.strip():
        needle = q.strip().lower()
        hits = [
            t
            for t in STUB_TARGETS
            if needle in t["name"].lower() or needle in t["id"].lower()
        ]
    elif ra is not None and dec is not None:
        # Exact match against stub fixtures only (no sky search).
        hits = [
            t for t in STUB_TARGETS if t["ra"] == ra and t["dec"] == dec
        ]
    else:
        hits = list(STUB_TARGETS)

    return {"hits": hits, "provenance": STUB_PROVENANCE}
