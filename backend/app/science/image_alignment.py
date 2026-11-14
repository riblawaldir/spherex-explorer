"""Validate the celestial WCS of a two-dimensional FITS image.

Validation samples the centre and corners; it does not establish that two
observations are scientifically comparable or ready for subtraction.
"""

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from astropy.io import fits
from astropy.wcs import WCS
from astropy.wcs.utils import wcs_to_celestial_frame


class InvalidWCS(ValueError):
    """The image has missing, invalid, or unusable celestial WCS information."""


@dataclass(frozen=True)
class WCSGeometry:
    """Image dimensions and centre in the native celestial frame (degrees).

    Pixel coordinates use the Python/NumPy zero-based convention, with x
    along image columns and y along rows. Centre coordinates are in the order
    given by ``axis_types``; celestial axes need not be longitude first.
    """

    width: int
    height: int
    frame: str
    axis_types: tuple[str, str]
    axis_units: tuple[str, str]
    center_pixel: tuple[float, float]
    center_world: tuple[float, float]
    pixel_scale_matrix: tuple[tuple[float, float], tuple[float, float]]


def validate_fits_wcs(path: str | Path, *, hdu: int | str = 0) -> WCSGeometry:
    """Read and validate a celestial WCS for a 2-D FITS image HDU.

    Requires explicit axis types, reference pixels, reference values and a
    pixel scale (CD matrix or CDELT values). Checks finite, nonsingular scale
    and forward/inverse transformations at the image centre and four corners.
    Raises InvalidWCS for malformed or unusable image/WCS data. File I/O errors
    and missing HDU selectors propagate from Astropy, as in fits_to_png.
    """
    with fits.open(path, memmap=False) as hdus:
        image_hdu = hdus[hdu]
        data = image_hdu.data
        if data is None or data.ndim != 2 or not all(data.shape):
            raise InvalidWCS("Selected HDU must contain a non-empty 2-D image")
        if not np.issubdtype(data.dtype, np.number) or np.iscomplexobj(data):
            raise InvalidWCS("Selected HDU must contain a real numeric image")
        header = image_hdu.header
        required = ("CTYPE1", "CTYPE2", "CRPIX1", "CRPIX2", "CRVAL1", "CRVAL2")
        missing = [key for key in required if key not in header]
        has_cd = any(f"CD{i}_{j}" in header for i in (1, 2) for j in (1, 2))
        if not has_cd:
            missing += [key for key in ("CDELT1", "CDELT2") if key not in header]
        if missing:
            raise InvalidWCS(f"Missing WCS keywords: {', '.join(missing)}")
        height, width = data.shape
        try:
            wcs = WCS(header, fobj=hdus)
            if wcs.pixel_n_dim != 2 or wcs.world_n_dim != 2 or not wcs.has_celestial:
                raise InvalidWCS("WCS must have exactly two celestial axes")
            wcs = wcs.celestial
            frame = wcs_to_celestial_frame(wcs)
            matrix = np.asarray(wcs.pixel_scale_matrix, dtype=float)
            if not np.isfinite(matrix).all() or np.linalg.matrix_rank(matrix) != 2:
                raise InvalidWCS("WCS pixel scale matrix is invalid or singular")
            center = ((width - 1) / 2, (height - 1) / 2)
            pixels = np.array([center, (0, 0), (width - 1, 0),
                               (0, height - 1), (width - 1, height - 1)], dtype=float)
            world = np.asarray(wcs.all_pix2world(pixels, 0), dtype=float)
            if not np.isfinite(world).all():
                raise InvalidWCS("WCS pixel-to-world transformation is not finite")
            latitude = world[:, wcs.wcs.lat]
            if np.any(np.abs(latitude) > 90):
                raise InvalidWCS("WCS celestial latitude is outside [-90, 90] degrees")
            restored = np.asarray(wcs.all_world2pix(world, 0), dtype=float)
            if not np.isfinite(restored).all() or not np.allclose(restored, pixels, rtol=0, atol=1e-3):
                raise InvalidWCS("WCS transformations do not round-trip at sampled pixels")
            return WCSGeometry(
                width=width, height=height, frame=frame.name,
                axis_types=tuple(str(value) for value in wcs.wcs.ctype),
                axis_units=tuple(str(value) for value in wcs.wcs.cunit),
                center_pixel=center, center_world=tuple(float(value) for value in world[0]),
                pixel_scale_matrix=tuple(tuple(float(value) for value in row) for row in matrix),
            )
        except InvalidWCS:
            raise
        except Exception as exc:
            raise InvalidWCS(f"Invalid or unusable celestial WCS: {exc}") from exc
