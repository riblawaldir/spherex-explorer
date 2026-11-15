from hashlib import sha256
from io import BytesIO

import numpy as np
import pytest
from astropy.io import fits
from astropy.wcs import WCS
from PIL import Image

from app.science.fits_inspection import inspect_fits, select_image_hdu
from app.science.image_alignment import validate_fits_wcs
from app.science.image_processing import fits_to_png


@pytest.fixture
def mef(tmp_path):
    path = tmp_path / 'synthetic-mef.fits'
    wcs = WCS(naxis=2)
    wcs.wcs.ctype = ['RA---TAN', 'DEC--TAN']
    wcs.wcs.crpix = [3, 2]
    wcs.wcs.crval = [127.69444, -39.1776]
    wcs.wcs.cdelt = [-0.001, 0.001]
    header = wcs.to_header()
    header['BUNIT'] = 'MJy/sr'
    header['OBJECT'] = 'SYNTHETIC TEST'
    pixels = np.arange(15, dtype=np.float32).reshape(3, 5)
    pixels[0, 0] = np.nan
    fits.HDUList([
        fits.PrimaryHDU(),
        fits.ImageHDU(pixels, header=header, name='IMAGE'),
        fits.ImageHDU(np.zeros((3, 5), dtype=np.int16), name='FLAGS'),
        fits.ImageHDU(np.ones((3, 5), dtype=np.float32), name='VARIANCE'),
    ]).writeto(path)
    return path


def test_mef_inspection_wcs_and_existing_png_preserve_original(mef):
    before = sha256(mef.read_bytes()).hexdigest()
    info = inspect_fits(mef, rows_per_block=2)
    assert [h.name for h in info.hdus] == ['PRIMARY', 'IMAGE', 'FLAGS', 'VARIANCE']
    primary, image, flags, variance = info.hdus
    assert not primary.is_numeric_2d_image
    assert image.shape == (3, 5)
    assert image.dtype in ('>f4', 'float32')
    assert image.is_numeric_2d_image
    assert image.valid_percent == pytest.approx(100 * 14 / 15)
    assert image.bunit == 'MJy/sr'
    assert image.metadata['OBJECT'] == 'SYNTHETIC TEST'
    assert image.wcs_status == 'celestial'
    assert image.wcs_axis_types == ('RA---TAN', 'DEC--TAN')
    assert flags.is_numeric_2d_image and variance.is_numeric_2d_image
    assert flags.wcs_status == 'absent'
    index = select_image_hdu(info)
    assert index == 1
    assert validate_fits_wcs(mef, hdu=index).frame == 'icrs'
    # Both index and name select the same extension in the existing converter.
    result = fits_to_png(mef, hdu='IMAGE', lower_percentile=0, upper_percentile=100)
    assert result.png == fits_to_png(mef, hdu=index, lower_percentile=0, upper_percentile=100).png
    with Image.open(BytesIO(result.png)) as image_png:
        image_png.load()
        assert (image_png.format, image_png.size, image_png.mode) == ('PNG', (5, 3), 'RGBA')
        assert image_png.getpixel((0, 0))[3] == 0
    assert sha256(mef.read_bytes()).hexdigest() == before


def test_missing_image_does_not_fall_back_to_flags(tmp_path):
    path = tmp_path / 'flags.fits'
    fits.HDUList([fits.PrimaryHDU(), fits.ImageHDU(np.ones((2, 2)), name='FLAGS')]).writeto(path)
    with pytest.raises(ValueError, match='No IMAGE'):
        select_image_hdu(inspect_fits(path))


@pytest.mark.parametrize('data', [None, np.zeros((2, 2, 2)), np.full((2, 2), np.nan)])
def test_invalid_image_rejected(tmp_path, data):
    path = tmp_path / 'invalid.fits'
    fits.HDUList([fits.PrimaryHDU(), fits.ImageHDU(data, name='IMAGE')]).writeto(path)
    with pytest.raises(ValueError, match='IMAGE extension'):
        select_image_hdu(inspect_fits(path))


def test_duplicate_image_names_are_ambiguous(tmp_path):
    path = tmp_path / 'ambiguous.fits'
    fits.HDUList([fits.PrimaryHDU(), fits.ImageHDU(np.ones((2, 2)), name='IMAGE'),
                  fits.ImageHDU(np.ones((2, 2)), name='IMAGE')]).writeto(path)
    with pytest.raises(ValueError, match='Ambiguous'):
        select_image_hdu(inspect_fits(path))


def test_table_named_image_is_not_a_science_image(tmp_path):
    path = tmp_path / 'table.fits'
    table = fits.BinTableHDU.from_columns(
        [fits.Column(name='VALUE', format='E', array=np.array([1.0, 2.0]))], name='IMAGE'
    )
    fits.HDUList([fits.PrimaryHDU(), table]).writeto(path)
    info = inspect_fits(path)
    assert not info.hdus[1].is_numeric_2d_image
    with pytest.raises(ValueError, match='numeric 2-D'):
        select_image_hdu(info)


def test_bad_block_size_and_missing_file(tmp_path):
    with pytest.raises(ValueError, match='positive integer'):
        inspect_fits(tmp_path / 'missing.fits', rows_per_block=0)
    with pytest.raises(FileNotFoundError):
        inspect_fits(tmp_path / 'missing.fits')


def test_scaled_integer_image_counts_physical_pixels(tmp_path):
    path = tmp_path / 'scaled.fits'
    hdu = fits.ImageHDU(np.array([[1, 2], [3, -32768]], dtype=np.int16), name='IMAGE')
    hdu.header['BSCALE'] = 2
    hdu.header['BZERO'] = 10
    hdu.header['BLANK'] = -32768
    fits.HDUList([fits.PrimaryHDU(), hdu]).writeto(path)
    info = inspect_fits(path, rows_per_block=1)
    assert info.hdus[1].valid_percent == pytest.approx(75)
    assert select_image_hdu(info) == 1
