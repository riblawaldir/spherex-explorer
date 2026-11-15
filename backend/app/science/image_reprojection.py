"""Geometric reprojection of a FITS image onto another image's WCS grid.

This does not calibrate images, verify spectral compatibility, correct
astrometric errors, conserve integrated flux, or justify image subtraction.
"""
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from astropy.io import fits
from astropy.wcs import WCS
from reproject import reproject_interp

from app.science.image_alignment import WCSGeometry, validate_fits_wcs


@dataclass(frozen=True)
class AlignmentResult:
    reference: np.ndarray
    aligned_target: np.ndarray
    footprint: np.ndarray
    valid_mask: np.ndarray
    shape: tuple[int, int]
    common_coverage_percent: float
    reference_geometry: WCSGeometry
    reference_unit: str | None
    target_unit: str | None


def _load_image(path: str | Path, hdu: int | str) -> tuple[np.ndarray, WCS, str | None]:
    with fits.open(path, mode='readonly', memmap=False) as hdus:
        selected = hdus[hdu]
        if selected.name.upper() in {'FLAGS', 'VARIANCE', 'WCS-WAVE'}:
            raise ValueError(f'{selected.name} is not an intensity image')
        if not isinstance(selected, (fits.PrimaryHDU, fits.ImageHDU, fits.CompImageHDU)):
            raise ValueError('Selected HDU is not an image')
        array = np.array(selected.data, dtype=np.float64, copy=True)
        wcs = WCS(selected.header, fobj=hdus).celestial
        unit = str(selected.header['BUNIT']) if 'BUNIT' in selected.header else None
    return array, wcs, unit


def align_fits_images(
    reference_path: str | Path,
    target_path: str | Path,
    *,
    reference_hdu: int | str,
    target_hdu: int | str,
) -> AlignmentResult:
    """Reproject target onto reference grid using bilinear interpolation.

    HDUs must be explicitly selected 2-D intensity images with valid celestial
    WCS. Common coverage is the percentage of all reference-grid pixels with
    positive footprint and finite values in both arrays. NaNs are excluded.
    Raises ValueError when there is no valid common coverage; FITS/WCS errors
    propagate. Inputs remain unchanged. Units are reported, never converted.
    """
    geometry = validate_fits_wcs(reference_path, hdu=reference_hdu)
    validate_fits_wcs(target_path, hdu=target_hdu)
    reference, reference_wcs, reference_unit = _load_image(reference_path, reference_hdu)
    target, target_wcs, target_unit = _load_image(target_path, target_hdu)
    aligned, footprint = reproject_interp(
        (target, target_wcs), reference_wcs, shape_out=reference.shape,
        order='bilinear', return_footprint=True,
    )
    valid = np.isfinite(reference) & np.isfinite(aligned) & np.isfinite(footprint) & (footprint > 0)
    count = int(np.count_nonzero(valid))
    if count == 0:
        raise ValueError('Images have no valid common coverage')
    return AlignmentResult(
        reference=reference, aligned_target=aligned, footprint=footprint,
        valid_mask=valid, shape=reference.shape,
        common_coverage_percent=100.0 * count / reference.size,
        reference_geometry=geometry, reference_unit=reference_unit, target_unit=target_unit,
    )
