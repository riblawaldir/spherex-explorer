"""Reprojection tests use synthetic images; no astronomical discoveries."""
from hashlib import sha256

import numpy as np
import pytest
from astropy.io import fits
from astropy.wcs import WCS

from app.science.image_alignment import InvalidWCS
from app.science.image_reprojection import align_fits_images


def make_wcs(*, offset=(0, 0), angle=0, scale=1, ra=120):
    w = WCS(naxis=2)
    w.wcs.ctype = ['RA---TAN', 'DEC--TAN']
    w.wcs.crpix = [32.5 + offset[0], 32.5 + offset[1]]
    w.wcs.crval = [ra, 25]
    theta = np.deg2rad(angle)
    w.wcs.cd = np.array([[-np.cos(theta), np.sin(theta)],
                          [np.sin(theta), np.cos(theta)]]) * (0.001 * scale)
    return w


def star_field(w, position):
    # Same fixed sky source in each WCS; smooth profile permits bilinear sampling.
    x0, y0 = w.world_to_pixel_values(*position)
    y, x = np.mgrid[:64, :64]
    return np.exp(-((x-x0)**2 + (y-y0)**2) / (2 * (2 / np.sqrt(abs(np.linalg.det(w.pixel_scale_matrix)) / 1e-6))**2))


def write_mef(path, w, data, unit='MJy/sr'):
    header = w.to_header()
    header['BUNIT'] = unit
    fits.HDUList([fits.PrimaryHDU(), fits.ImageHDU(data, header=header, name='IMAGE')]).writeto(path)


def peak(image):
    y, x = np.unravel_index(np.nanargmax(image), image.shape)
    return np.array([x, y])


@pytest.mark.parametrize('offset,angle,scale', [((0, 0), 0, 1), ((7, -4), 0, 1),
                                                ((0, 0), 25, 1), ((0, 0), 0, 0.8)])
def test_common_star_aligned_and_files_unchanged(tmp_path, offset, angle, scale):
    ref, target = tmp_path / 'a.fits', tmp_path / 'b.fits'
    a, b = make_wcs(), make_wcs(offset=offset, angle=angle, scale=scale)
    position = a.pixel_to_world_values(37, 27)
    write_mef(ref, a, star_field(a, position))
    write_mef(target, b, star_field(b, position), unit='Jy/sr')
    hashes = [sha256(p.read_bytes()).hexdigest() for p in (ref, target)]
    result = align_fits_images(ref, target, reference_hdu='IMAGE', target_hdu='IMAGE')
    assert result.shape == (64, 64)
    assert result.reference_unit == 'MJy/sr' and result.target_unit == 'Jy/sr'
    assert result.reference_geometry.frame == 'icrs'
    # Argmax is quantized to a pixel; two-pixel tolerance allows interpolation.
    assert np.linalg.norm(peak(result.reference) - peak(result.aligned_target)) <= 2
    assert 0 < result.common_coverage_percent <= 100
    assert np.isfinite(result.aligned_target[result.valid_mask]).all()
    assert hashes == [sha256(p.read_bytes()).hexdigest() for p in (ref, target)]
    if offset == (0, 0) and angle == 0 and scale == 1:
        assert result.common_coverage_percent == pytest.approx(100)
        assert np.allclose(result.reference, result.aligned_target, atol=1e-9)


def test_partial_coverage_and_reference_nan(tmp_path):
    a, b = make_wcs(), make_wcs(offset=(25, 0))
    ref, target = tmp_path / 'a.fits', tmp_path / 'b.fits'
    data = np.ones((64, 64)); data[20, 20] = np.nan
    write_mef(ref, a, data); write_mef(target, b, np.ones((64, 64)))
    result = align_fits_images(ref, target, reference_hdu=1, target_hdu=1)
    assert 0 < result.common_coverage_percent < 100
    assert not result.valid_mask[20, 20]
    assert np.any(result.footprint == 0)
    assert result.common_coverage_percent == pytest.approx(100 * result.valid_mask.sum() / 4096)


def test_target_nan_excluded(tmp_path):
    a = make_wcs(); ref, target = tmp_path / 'a.fits', tmp_path / 'b.fits'
    data = np.ones((64, 64)); data[25:35, 25:35] = np.nan
    write_mef(ref, a, np.ones((64, 64))); write_mef(target, a, data)
    result = align_fits_images(ref, target, reference_hdu='IMAGE', target_hdu='IMAGE')
    assert not result.valid_mask[30, 30]
    assert result.common_coverage_percent < 100


def test_no_overlap_rejected(tmp_path):
    ref, target = tmp_path / 'a.fits', tmp_path / 'b.fits'
    write_mef(ref, make_wcs(), np.ones((64, 64)))
    write_mef(target, make_wcs(ra=140), np.ones((64, 64)))
    with pytest.raises(ValueError, match='no valid common coverage'):
        align_fits_images(ref, target, reference_hdu=1, target_hdu=1)


def test_invalid_wcs_rejected(tmp_path):
    ref, target = tmp_path / 'a.fits', tmp_path / 'b.fits'
    write_mef(ref, make_wcs(), np.ones((64, 64)))
    fits.HDUList([fits.PrimaryHDU(), fits.ImageHDU(np.ones((64, 64)), name='IMAGE')]).writeto(target)
    with pytest.raises(InvalidWCS):
        align_fits_images(ref, target, reference_hdu='IMAGE', target_hdu='IMAGE')


def test_rejects_auxiliary_hdu_even_if_wcs_present(tmp_path):
    ref, target = tmp_path / 'a.fits', tmp_path / 'b.fits'
    write_mef(ref, make_wcs(), np.ones((64, 64)))
    header = make_wcs().to_header()
    fits.HDUList([fits.PrimaryHDU(), fits.ImageHDU(np.ones((64, 64)), header=header, name='FLAGS')]).writeto(target)
    with pytest.raises(ValueError, match='not an intensity image'):
        align_fits_images(ref, target, reference_hdu='IMAGE', target_hdu='FLAGS')
