"""Turn a two-dimensional FITS image into a display-only PNG preview.

These previews are contrast-stretched and quantized; do not use them for
scientific measurements or comparisons. Use the original FITS data instead.
"""

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

import numpy as np
from astropy.io import fits
from PIL import Image


@dataclass(frozen=True)
class PreviewResult:
    """PNG bytes and the display stretch used to produce them."""

    png: bytes
    width: int
    height: int
    lower_value: float
    upper_value: float
    finite_pixels: int
    invalid_pixels: int
    lower_percentile: float
    upper_percentile: float


def fits_to_png(
    path: str | Path,
    *,
    hdu: int | str = 0,
    lower_percentile: float = 1.0,
    upper_percentile: float = 99.0,
) -> PreviewResult:
    """Render one 2-D image HDU from a local FITS file as grayscale PNG.

    Percentiles are calculated from finite pixels only. Non-finite pixels are
    transparent. A constant image is rendered black and remains opaque. The
    FITS row order is retained; this is not a WCS orientation operation.

    Raises ValueError for invalid parameters, missing image data, non-2-D or
    non-numeric arrays, and images without finite pixels. FITS I/O errors and
    invalid HDU selectors propagate from Astropy.
    """
    if not (0 <= lower_percentile < upper_percentile <= 100):
        raise ValueError("Percentiles must satisfy 0 <= lower < upper <= 100")

    with fits.open(path, memmap=False) as hdus:
        data = hdus[hdu].data
        if data is None:
            raise ValueError("Selected HDU contains no image data")
        if data.ndim != 2 or not np.issubdtype(data.dtype, np.number) or np.iscomplexobj(data):
            raise ValueError("Selected HDU must contain a real, numeric 2-D image")
        values = np.asarray(data, dtype=np.float64)

    finite = np.isfinite(values)
    count = int(finite.sum())
    if not count:
        raise ValueError("Image contains no finite pixels")
    lower, upper = np.percentile(values[finite], [lower_percentile, upper_percentile])
    scaled = np.zeros(values.shape, dtype=np.uint8)
    if upper > lower:
        # Clip first to avoid overflow from extreme outliers during scaling.
        clipped = np.clip(values[finite], lower, upper)
        scaled[finite] = np.rint((clipped - lower) / (upper - lower) * 255).astype(np.uint8)

    rgba = np.empty((*values.shape, 4), dtype=np.uint8)
    rgba[..., :3] = scaled[..., None]
    rgba[..., 3] = finite.astype(np.uint8) * 255
    output = BytesIO()
    Image.fromarray(rgba).save(output, format="PNG")
    height, width = values.shape
    return PreviewResult(
        png=output.getvalue(), width=width, height=height,
        lower_value=float(lower), upper_value=float(upper), finite_pixels=count,
        invalid_pixels=int(values.size - count), lower_percentile=lower_percentile,
        upper_percentile=upper_percentile,
    )
