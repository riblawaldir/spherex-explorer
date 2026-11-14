"""GET /api/preview/{obs_id} — PNG when a labeled sample FITS exists."""

from io import BytesIO

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse, Response
from PIL import Image

from app.routers.fixtures import STUB_PROVENANCE
from app.services.catalog import get_catalog_service

# Public P5 API — do not reimplement stretch logic here.
from app.science.image_processing import fits_to_png

router = APIRouter(prefix="/api", tags=["preview"])


@router.get("/preview/{obs_id}")
def get_preview(
    obs_id: str,
    size: int = Query(default=512, ge=1, le=4096),
):
    """Return PNG preview via P5 ``fits_to_png`` when a sample FITS is present.

    Otherwise 501 with a clear message. Sample paths come from labeled
    ``epochs.json`` / ``data/samples/`` — not live IRSA cutouts.
    """
    fits_path = get_catalog_service().resolve_preview_fits(obs_id)
    if fits_path is None:
        return JSONResponse(
            status_code=501,
            content={
                "detail": (
                    f"Preview for obs_id={obs_id!r} unavailable: no local sample "
                    "FITS. Provide data/samples/{obs_id}.fits or set fits_sample "
                    "in data/metadata/epochs.json (P5 fits_to_png). Live IRSA "
                    "cutouts arrive with P4."
                ),
                "provenance": STUB_PROVENANCE,
            },
            headers={"X-Provenance": "stub"},
        )

    try:
        result = fits_to_png(fits_path)
    except (OSError, ValueError) as exc:
        return JSONResponse(
            status_code=501,
            content={
                "detail": (
                    f"Preview for obs_id={obs_id!r} failed while calling "
                    f"fits_to_png: {exc}"
                ),
                "provenance": STUB_PROVENANCE,
            },
            headers={"X-Provenance": "stub"},
        )

    png = result.png
    # Optional downscale for the contract ``size`` query (longest side).
    if max(result.width, result.height) > size:
        image = Image.open(BytesIO(png))
        image.thumbnail((size, size), Image.Resampling.LANCZOS)
        buf = BytesIO()
        image.save(buf, format="PNG")
        png = buf.getvalue()

    return Response(
        content=png,
        media_type="image/png",
        headers={
            "X-Provenance": "cached_sample",
            "X-Obs-Id": obs_id,
            "X-Source-Fits": fits_path.name,
        },
    )
