from hashlib import sha256
from io import BytesIO

import numpy as np
import pytest
from astropy.io import fits
from astropy.wcs import WCS
from fastapi.testclient import TestClient

from app.main import app
from app.routers import preview


@pytest.fixture
def image_file(tmp_path, monkeypatch):
    path = tmp_path / "sample.fits"
    wcs = WCS(naxis=2)
    wcs.wcs.crpix = [5, 5]
    wcs.wcs.cdelt = [-0.001, 0.001]
    wcs.wcs.crval = [139.983, 55.005]
    wcs.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    image = fits.ImageHDU(data=np.arange(100, dtype=np.float32).reshape(10, 10), header=wcs.to_header(), name="IMAGE")
    image.header["BUNIT"] = "MJy/sr"
    fits.HDUList([fits.PrimaryHDU(), image, fits.ImageHDU(data=np.zeros((10, 10), dtype=np.int16), name="FLAGS")]).writeto(path)
    class Catalog:
        def resolve_preview_fits(self, obs_id):
            return path if obs_id == "test" else None
    monkeypatch.setattr(preview, "get_catalog_service", lambda: Catalog())
    return path


def test_overlay_preserves_image_wcs_and_original(image_file):
    before = sha256(image_file.read_bytes()).hexdigest()
    response = TestClient(app).get("/api/overlay/test")
    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("application/fits")
    with fits.open(image_file) as original, fits.open(BytesIO(response.content)) as result:
        assert len(result) == 1
        np.testing.assert_array_equal(result[0].data, original["IMAGE"].data)
        assert result[0].header["BUNIT"] == "MJy/sr"
        pixels = [[0, 0], [5, 5], [9, 9]]
        np.testing.assert_allclose(WCS(result[0].header).all_pix2world(pixels, 0), WCS(original["IMAGE"].header).all_pix2world(pixels, 0), atol=1e-8)
    assert sha256(image_file.read_bytes()).hexdigest() == before


def test_overlay_rejects_missing_observation_and_invalid_wcs(image_file):
    client = TestClient(app)
    assert client.get("/api/overlay/missing").status_code == 404
    with fits.open(image_file, mode="update") as hdus:
        del hdus["IMAGE"].header["CTYPE1"]
        del hdus["IMAGE"].header["CTYPE2"]
    assert client.get("/api/overlay/test").status_code == 422
