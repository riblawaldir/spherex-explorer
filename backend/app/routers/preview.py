"""GET /api/preview/{obs_id} — PNG when a labeled sample FITS exists."""

from io import BytesIO
from pathlib import Path

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse, Response
from PIL import Image

from app.routers.fixtures import STUB_PROVENANCE
from app.science.fits_inspection import inspect_fits, select_image_hdu
from app.science.image_processing import fits_to_png
from app.services.catalog import get_catalog_service

router = APIRouter(prefix="/api", tags=["preview"])


def _choose_image_hdu(fits_path: Path) -> int:
    """Pick HDU via P5 inspect: prefer unique IMAGE, else first numeric 2-D."""
    inspection = inspect_fits(fits_path)
    try:
        return select_image_hdu(inspection)
    except ValueError:
        for hdu in inspection.hdus:
            if hdu.is_numeric_2d_image and (hdu.valid_percent or 0) > 0:
                return hdu.index
        raise ValueError("No numeric 2-D image HDU with finite pixels")


@router.get("/preview/{obs_id}")
def get_preview(
    obs_id: str,
    size: int = Query(default=512, ge=1, le=4096),
):
    """Return PNG preview via P5 ``fits_to_png`` when a sample FITS is present.

    Uses ``inspect_fits`` / ``select_image_hdu`` so MEF stubs with an ``IMAGE``
    extension work. Otherwise 501. Sample paths come from labeled
    ``epochs.json``, ``data/samples/``, or an existing P4 cutout under
    ``data/raw/{obs_id}.fits`` — not invented NASA products.
    """
    fits_path = get_catalog_service().resolve_preview_fits(obs_id)
    if fits_path is None:
        return JSONResponse(
            status_code=501,
            content={
                "detail": (
                    f"Preview for obs_id={obs_id!r} unavailable: no local sample "
                    "FITS. Provide data/samples/{obs_id}.fits, set fits_sample "
                    "in data/metadata/epochs.json, or place a P4 cutout at "
                    "data/raw/{obs_id}.fits (P5 fits_to_png)."
                ),
                "provenance": STUB_PROVENANCE,
            },
            headers={"X-Provenance": "stub"},
        )

    try:
        hdu_index = _choose_image_hdu(fits_path)
        result = fits_to_png(fits_path, hdu=hdu_index)
    except (OSError, ValueError) as exc:
        return JSONResponse(
            status_code=501,
            content={
                "detail": (
                    f"Preview for obs_id={obs_id!r} failed while calling "
                    f"fits_to_png / inspect_fits: {exc}"
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

    # Samples under data/samples are cached_sample; raw cutouts stay cached_sample
    # until a live IRSA download path is proven end-to-end.
    from app.services.real_data_demo import PROVENANCE, verified_path
    provenance = PROVENANCE if verified_path(obs_id) == fits_path else "cached_sample"
    return Response(
        content=png,
        media_type="image/png",
        headers={
            "X-Provenance": provenance,
            "X-Obs-Id": obs_id,
            "X-Source-Fits": fits_path.name,
            "X-Hdu-Index": str(hdu_index),
        },
    )
