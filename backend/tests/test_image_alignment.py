"""Tests use synthetic FITS images, not astronomical observations."""

import numpy as np
import pytest
from astropy.io import fits
from astropy.wcs import WCS

from app.science.image_alignment import InvalidWCS, validate_fits_wcs
from app.science.image_processing import fits_to_png


def celestial_header():
    wcs = WCS(naxis=2)
    wcs.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    wcs.wcs.crpix = [3, 2]
    wcs.wcs.crval = [127.5, -39.0]
    wcs.wcs.cdelt = [-0.01, 0.01]
    wcs.wcs.cunit = ["deg", "deg"]
    return wcs.to_header()


def test_valid_wcs_and_preview_share_fits_input(tmp_path):
    path = tmp_path / "synthetic.fits"
    fits.writeto(path, np.arange(15, dtype=float).reshape(3, 5), celestial_header())
    result = validate_fits_wcs(path)
    assert (result.width, result.height) == (5, 3)
    assert result.frame == "icrs"
    assert result.axis_types == ("RA---TAN", "DEC--TAN")
    assert result.axis_units == ("deg", "deg")
    assert result.center_pixel == (2, 1)
    assert result.center_world == pytest.approx((127.5, -39))
    assert np.allclose(result.pixel_scale_matrix, [[-0.01, 0], [0, 0.01]])
    assert fits_to_png(path).png.startswith(b"\x89PNG\r\n\x1a\n")


def test_named_extension_with_cd_matrix_and_swapped_axes(tmp_path):
    header = celestial_header()
    header['CTYPE1'], header['CTYPE2'] = 'DEC--TAN', 'RA---TAN'
    header['CRVAL1'], header['CRVAL2'] = -39.0, 127.5
    del header['CDELT1'], header['CDELT2']
    header['CD1_1'], header['CD2_2'] = 0.01, -0.01
    path = tmp_path / "synthetic.fits"
    fits.HDUList([fits.PrimaryHDU(), fits.ImageHDU(np.ones((3, 5)), header, name='SCI')]).writeto(path)
    result = validate_fits_wcs(path, hdu='SCI')
    assert result.axis_types == ('DEC--TAN', 'RA---TAN')
    assert result.center_world == pytest.approx((-39, 127.5))


def test_missing_wcs_and_incomplete_header(tmp_path):
    path = tmp_path / 'synthetic.fits'
    fits.writeto(path, np.ones((2, 2)))
    with pytest.raises(InvalidWCS, match='Missing WCS keywords'):
        validate_fits_wcs(path)
    header = celestial_header()
    del header['CRVAL1']
    fits.writeto(path, np.ones((2, 2)), header, overwrite=True)
    with pytest.raises(InvalidWCS, match='CRVAL1'):
        validate_fits_wcs(path)


def test_invalid_axes_and_singular_scale(tmp_path):
    path = tmp_path / 'synthetic.fits'
    header = celestial_header()
    header['CTYPE1'], header['CTYPE2'] = 'LINEAR', 'LINEAR'
    fits.writeto(path, np.ones((3, 5)), header)
    with pytest.raises(InvalidWCS, match='celestial'):
        validate_fits_wcs(path)
    header = celestial_header()
    header['CDELT1'] = 0.0
    fits.writeto(path, np.ones((3, 5)), header, overwrite=True)
    with pytest.raises(InvalidWCS):
        validate_fits_wcs(path)


def test_rejects_empty_hdu_and_cube(tmp_path):
    path = tmp_path / 'synthetic.fits'
    fits.PrimaryHDU().writeto(path)
    with pytest.raises(InvalidWCS, match='2-D image'):
        validate_fits_wcs(path)
    fits.writeto(path, np.zeros((2, 3, 5)), celestial_header(), overwrite=True)
    with pytest.raises(InvalidWCS, match='2-D image'):
        validate_fits_wcs(path)


def test_nonfinite_or_invalid_projection_rejected(tmp_path):
    path = tmp_path / 'synthetic.fits'
    header = celestial_header()
    header['CRVAL2'] = 100.0
    fits.writeto(path, np.ones((3, 5)), header)
    with pytest.raises(InvalidWCS):
        validate_fits_wcs(path)


def test_galactic_frame_and_rotated_matrix(tmp_path):
    path = tmp_path / 'synthetic.fits'
    wcs = WCS(naxis=2)
    wcs.wcs.ctype = ['GLON-TAN', 'GLAT-TAN']
    wcs.wcs.crpix = [2, 2]
    wcs.wcs.crval = [120, 30]
    wcs.wcs.cd = [[0.0, -0.01], [0.01, 0.0]]
    fits.writeto(path, np.ones((3, 3)), wcs.to_header())
    result = validate_fits_wcs(path)
    assert result.frame == 'galactic'
    assert result.center_world == pytest.approx((120, 30))
    assert np.allclose(result.pixel_scale_matrix, [[0, -0.01], [0.01, 0]])


def test_missing_file_and_hdu_propagate(tmp_path):
    with pytest.raises(FileNotFoundError):
        validate_fits_wcs(tmp_path / 'missing.fits')
    path = tmp_path / 'synthetic.fits'
    fits.writeto(path, np.ones((3, 5)), celestial_header())
    with pytest.raises(IndexError):
        validate_fits_wcs(path, hdu=4)
