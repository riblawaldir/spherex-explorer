"""Synthetic-only tests: bit 1 is marked bad solely for these test images."""
from hashlib import sha256

import numpy as np
import pytest
from astropy.io import fits
from astropy.wcs import WCS

from app.science.image_alignment import InvalidWCS
from app.science.image_quality import assess_aligned_quality


def make_file(path, *, shift=0, flags=True, variance=True, unit='MJy/sr', nan=False, valid_wcs=True):
    wcs = WCS(naxis=2)
    wcs.wcs.ctype = ['RA---TAN', 'DEC--TAN']
    wcs.wcs.crpix = [8.5 + shift, 8.5]
    wcs.wcs.crval = [120, 25]
    wcs.wcs.cdelt = [-0.001, 0.001]
    header = wcs.to_header() if valid_wcs else fits.Header()
    if unit is not None:
        header['BUNIT'] = unit
    image = np.ones((16, 16), dtype=np.float32)
    if nan:
        image[4, 4] = np.nan
    hdus = [fits.PrimaryHDU(), fits.ImageHDU(image, header, name='IMAGE')]
    if flags:
        values = np.zeros((16, 16), dtype=np.int16)
        values[8, 8] = 2  # Synthetic bit 1: reject; no claim about SPHEREx bits.
        values[3, 3] = 4  # Synthetic bit 2: retained by the bit-1 mask.
        hdus.append(fits.ImageHDU(values, name='FLAGS'))
    if variance:
        v = fits.ImageHDU(np.ones((16, 16)), name='VARIANCE')
        v.header['BUNIT'] = 'synthetic_variance_unit'
        hdus.append(v)
    fits.HDUList(hdus).writeto(path)


def run(a, b, **kw):
    return assess_aligned_quality(a, b, reference_hdu='IMAGE', target_hdu='IMAGE', **kw)


def test_full_coverage_explicit_flags_variance_and_immutable_inputs(tmp_path):
    a, b = tmp_path/'a.fits', tmp_path/'b.fits'
    make_file(a); make_file(b)
    hashes = [sha256(p.read_bytes()).hexdigest() for p in (a,b)]
    r = run(a, b, reject_bits=2, flags_share_image_grid=True)
    assert r.geometric_coverage_percent == pytest.approx(100)
    assert r.finite_coverage_percent == pytest.approx(100)
    assert r.science_quality_evaluated
    assert r.accepted_quality_percent == pytest.approx(100 * 255 / 256)
    assert not r.quality_mask[8, 8] and r.quality_mask[3, 3]
    assert r.reference_variance.present and r.target_variance.present
    assert r.reference_variance.unit == 'synthetic_variance_unit'
    assert r.reference_variance.finite_pixels == 256
    assert r.units_compatible is True
    assert hashes == [sha256(p.read_bytes()).hexdigest() for p in (a,b)]
    assert 'not been propagated' in ' '.join(r.warnings)


def test_partial_coverage_and_nan_are_reported_separately(tmp_path):
    a, b = tmp_path/'a.fits', tmp_path/'b.fits'
    make_file(a, nan=True); make_file(b, shift=5)
    r = run(a, b, reject_bits=2, flags_share_image_grid=True)
    assert 0 < r.geometric_coverage_percent < 100
    assert r.finite_coverage_percent <= r.geometric_coverage_percent
    assert not r.alignment.valid_mask[4, 4]
    assert r.accepted_quality_percent <= r.finite_coverage_percent
    assert r.geometric_coverage_percent == pytest.approx(100*r.geometric_mask.sum()/256)


def test_target_flag_reprojected_nearest_neighbor(tmp_path):
    a, b = tmp_path/'a.fits', tmp_path/'b.fits'
    make_file(a, flags=False); make_file(b, shift=3)
    # Give reference a zero FLAGS plane; target bit at (8,8) shifts to x=5.
    with fits.open(a, mode='update') as hdus:
        hdus.append(fits.ImageHDU(np.zeros((16,16), dtype=np.int16), name='FLAGS'))
    r = run(a, b, reject_bits=2, flags_share_image_grid=True)
    assert r.science_quality_evaluated
    assert r.alignment.valid_mask[8,5]
    assert not r.quality_mask[8,5]
    assert r.quality_mask[8,8]


@pytest.mark.parametrize('flags_a,flags_b,bits,confirmed', [(False,True,2,True),(True,False,2,True),
                                                            (True,True,None,True),(True,True,2,False)])
def test_unknown_quality_is_not_assumed_good(tmp_path, flags_a, flags_b, bits, confirmed):
    a, b = tmp_path/'a.fits', tmp_path/'b.fits'
    make_file(a, flags=flags_a); make_file(b, flags=flags_b)
    r = run(a, b, reject_bits=bits, flags_share_image_grid=confirmed)
    assert not r.science_quality_evaluated
    assert r.quality_mask is None and r.accepted_quality_percent is None
    assert 'not evaluated' in ' '.join(r.warnings)


def test_missing_variance_and_units(tmp_path):
    a, b = tmp_path/'a.fits', tmp_path/'b.fits'
    make_file(a, variance=False, unit='Jy'); make_file(b, variance=False, unit='m')
    r = run(a, b)
    assert not r.reference_variance.present and not r.target_variance.present
    assert r.units_compatible is False


def test_unknown_unit_and_invalid_wcs(tmp_path):
    a, b = tmp_path/'a.fits', tmp_path/'b.fits'
    make_file(a, unit=None); make_file(b)
    assert run(a,b).units_compatible is None
    bad = tmp_path/'bad.fits'; make_file(bad, valid_wcs=False)
    with pytest.raises(InvalidWCS): run(a,bad)


def test_bad_flags_shape_and_bitmask(tmp_path):
    a, b = tmp_path/'a.fits', tmp_path/'b.fits'
    make_file(a); make_file(b)
    with fits.open(b, mode='update') as hdus:
        hdus['FLAGS'].data = np.zeros((4, 4), dtype=np.int16)
    with pytest.raises(ValueError, match='FLAGS must'):
        run(a,b,reject_bits=2,flags_share_image_grid=True)
    with pytest.raises(ValueError, match='reject_bits'):
        run(a,b,reject_bits=-1)
