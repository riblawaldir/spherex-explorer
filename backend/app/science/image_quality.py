"""Quality diagnostics for aligned FITS images, without scientific subtraction.

Nearest-neighbour flag sampling is approximate: it is NOT a conservative
mask for every input pixel contributing to bilinear interpolation. The caller
must establish the product-specific flag bit definitions and grid registration.
"""
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import astropy.units as u
from astropy.io import fits
from astropy.wcs import WCS
from reproject import reproject_interp

from app.science.image_reprojection import AlignmentResult, align_fits_images


@dataclass(frozen=True)
class VarianceInfo:
    present: bool
    unit: str | None = None
    shape: tuple[int, ...] | None = None
    finite_pixels: int | None = None
    nonnegative_finite_pixels: int | None = None


@dataclass(frozen=True)
class QualityResult:
    alignment: AlignmentResult
    geometric_mask: np.ndarray
    geometric_coverage_percent: float
    finite_coverage_percent: float
    science_quality_evaluated: bool
    quality_mask: np.ndarray | None
    accepted_quality_percent: float | None
    reference_flags_present: bool
    target_flags_present: bool
    reject_bits: int | None
    reference_variance: VarianceInfo
    target_variance: VarianceInfo
    units_compatible: bool | None
    warnings: tuple[str, ...]


def _optional_hdu(hdus: fits.HDUList, name: str):
    matches = [h for h in hdus if h.name.upper() == name]
    if len(matches) > 1:
        raise ValueError(f'Ambiguous {name} extensions')
    return matches[0] if matches else None


def _variance_info(hdu) -> VarianceInfo:
    if hdu is None:
        return VarianceInfo(present=False)
    data = hdu.data
    if data is None or not np.issubdtype(data.dtype, np.number) or np.iscomplexobj(data):
        raise ValueError('VARIANCE must contain a real numeric array')
    finite = np.isfinite(data)
    return VarianceInfo(present=True, unit=str(hdu.header['BUNIT']) if 'BUNIT' in hdu.header else None,
                        shape=tuple(data.shape), finite_pixels=int(finite.sum()),
                        nonnegative_finite_pixels=int((finite & (data >= 0)).sum()))


def _flags_mask(hdu, shape, reject_bits: int) -> np.ndarray:
    flags = hdu.data
    if flags is None or flags.ndim != 2 or flags.shape != shape or not np.issubdtype(flags.dtype, np.integer):
        raise ValueError('FLAGS must be a 2-D integer array on the selected image grid')
    # Interpret signed integer storage as bit patterns; no implicit bit meanings.
    return (flags.astype(np.uint64) & np.uint64(reject_bits)) == 0


def _unit_compatibility(first: str | None, second: str | None) -> bool | None:
    if not first or not second:
        return None
    try:
        return bool(u.Unit(first).is_equivalent(u.Unit(second)))
    except (ValueError, TypeError):
        return None


def assess_aligned_quality(
    reference_path: str | Path,
    target_path: str | Path,
    *,
    reference_hdu: int | str,
    target_hdu: int | str,
    reject_bits: int | None = None,
    flags_share_image_grid: bool = False,
) -> QualityResult:
    """Assess geometric coverage and optionally sample explicit FLAGS bits.

    Both FLAGS HDUs and an explicit rejection bitmask are required to report
    quality acceptance. The caller must also confirm that both FLAGS planes
    are registered to their selected IMAGE grids. No bits are inferred. A
    nearest-neighbour mask cannot certify all bilinear contributors: the
    reported quality is a diagnostic, not a conservative science mask.
    Percentages use all reference-grid pixels as denominator. Variance is
    inspected, never reprojected or propagated. Original files remain intact.
    """
    if reject_bits is not None and (isinstance(reject_bits, bool) or not isinstance(reject_bits, int)
                                    or not 0 <= reject_bits < 2**64):
        raise ValueError('reject_bits must be an unsigned 64-bit integer or None')
    alignment = align_fits_images(reference_path, target_path,
                                  reference_hdu=reference_hdu, target_hdu=target_hdu)
    with fits.open(reference_path, mode='readonly', memmap=False) as ref_hdus, \
         fits.open(target_path, mode='readonly', memmap=False) as target_hdus:
        ref_image, target_image = ref_hdus[reference_hdu], target_hdus[target_hdu]
        ref_wcs = WCS(ref_image.header, fobj=ref_hdus).celestial
        target_wcs = WCS(target_image.header, fobj=target_hdus).celestial
        # Reproject ones to isolate geometric coverage from missing data/NaNs.
        _, geometric_footprint = reproject_interp(
            (np.ones(target_image.data.shape, dtype=np.uint8), target_wcs), ref_wcs,
            shape_out=alignment.shape, order='nearest-neighbor', return_footprint=True,
        )
        geometric = np.isfinite(geometric_footprint) & (geometric_footprint > 0)
        ref_flags = _optional_hdu(ref_hdus, 'FLAGS')
        target_flags = _optional_hdu(target_hdus, 'FLAGS')
        ref_variance = _variance_info(_optional_hdu(ref_hdus, 'VARIANCE'))
        target_variance = _variance_info(_optional_hdu(target_hdus, 'VARIANCE'))
        evaluated = reject_bits is not None and flags_share_image_grid and ref_flags is not None and target_flags is not None
        accepted = None
        if evaluated:
            ref_good = _flags_mask(ref_flags, ref_image.data.shape, reject_bits)
            target_good = _flags_mask(target_flags, target_image.data.shape, reject_bits)
            sampled, sampled_footprint = reproject_interp(
                (target_good.astype(np.uint8), target_wcs), ref_wcs, shape_out=alignment.shape,
                order='nearest-neighbor', return_footprint=True,
            )
            accepted = alignment.valid_mask & geometric & ref_good & (sampled_footprint > 0) & (sampled == 1)
        warnings = [
            'Nearest-neighbour flag sampling does not cover all bilinear interpolation contributors.',
            'Variance has not been propagated; uncertainty and pixel covariance are unknown.',
            'WCS alignment and unit equivalence do not establish scientific comparability.',
        ]
        if not evaluated:
            warnings.append('Scientific flag quality not evaluated: both FLAGS, reject_bits and grid confirmation are required.')
        return QualityResult(
            alignment=alignment, geometric_mask=geometric,
            geometric_coverage_percent=100.0 * np.count_nonzero(geometric) / geometric.size,
            finite_coverage_percent=alignment.common_coverage_percent,
            science_quality_evaluated=evaluated, quality_mask=accepted,
            accepted_quality_percent=(100.0 * np.count_nonzero(accepted) / geometric.size if evaluated else None),
            reference_flags_present=ref_flags is not None, target_flags_present=target_flags is not None,
            reject_bits=reject_bits, reference_variance=ref_variance, target_variance=target_variance,
            units_compatible=_unit_compatibility(alignment.reference_unit, alignment.target_unit),
            warnings=tuple(warnings),
        )
