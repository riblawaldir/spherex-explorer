from io import BytesIO

import numpy as np
import pytest
from astropy.io import fits
from PIL import Image

from app.science.image_processing import fits_to_png


def test_preview_stretches_finite_pixels_and_makes_invalid_transparent(tmp_path):
    path = tmp_path / "synthetic.fits"
    fits.writeto(path, np.array([[0.0, 1.0], [2.0, np.nan]]))
    result = fits_to_png(path, lower_percentile=0, upper_percentile=100)
    image = np.array(Image.open(BytesIO(result.png)))
    assert image.tolist() == [
        [[0, 0, 0, 255], [128, 128, 128, 255]],
        [[255, 255, 255, 255], [0, 0, 0, 0]],
    ]
    assert (result.width, result.height) == (2, 2)
    assert (result.lower_value, result.upper_value) == (0, 2)
    assert (result.finite_pixels, result.invalid_pixels) == (3, 1)


def test_selects_image_extension_and_handles_constant_data(tmp_path):
    path = tmp_path / "synthetic.fits"
    fits.HDUList([fits.PrimaryHDU(), fits.ImageHDU(np.full((2, 3), 7.0), name="SCI")]).writeto(path)
    result = fits_to_png(path, hdu="SCI")
    assert (result.lower_value, result.upper_value) == (7, 7)
    pixels = np.array(Image.open(BytesIO(result.png)))
    assert np.all(pixels[..., :3] == 0)
    assert np.all(pixels[..., 3] == 255)


@pytest.mark.parametrize("limits", [(-1, 99), (1, 101), (50, 50), (99, 1)])
def test_rejects_invalid_percentiles(tmp_path, limits):
    with pytest.raises(ValueError, match="Percentiles"):
        fits_to_png(tmp_path / "missing.fits", lower_percentile=limits[0], upper_percentile=limits[1])


def test_rejects_empty_nonfinite_and_cube_images(tmp_path):
    path = tmp_path / "synthetic.fits"
    fits.PrimaryHDU().writeto(path)
    with pytest.raises(ValueError, match="no image data"):
        fits_to_png(path)
    fits.writeto(path, np.full((2, 2), np.nan), overwrite=True)
    with pytest.raises(ValueError, match="no finite"):
        fits_to_png(path)
    fits.writeto(path, np.zeros((2, 2, 2)), overwrite=True)
    with pytest.raises(ValueError, match="2-D"):
        fits_to_png(path)
