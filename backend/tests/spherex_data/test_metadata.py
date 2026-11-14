"""
test_metadata.py — Pruebas de extracción de metadatos FITS con AstroPy.

Incluye:
  - Prueba con FITS sintético generado por AstroPy.
  - Prueba con archivo FITS real si está disponible en data/raw/.
"""

import sys
from pathlib import Path
import numpy as np
import pytest
from astropy.io import fits
from astropy.wcs import WCS

sys.path.insert(0, str(Path(__file__).parent.parent))
from spherex_data.metadata import extract_metadata


# ---------------------------------------------------------------------------
# Fixture: FITS sintético con estructura similar a SPHEREx
# ---------------------------------------------------------------------------

@pytest.fixture
def synthetic_fits(tmp_path) -> Path:
    """
    Crea un archivo FITS MEF sintético con estructura parecida a SPHEREx.

    Los archivos MEF de SPHEREx tienen múltiples extensiones.
    Este fixture crea un FITS válido que AstroPy puede abrir.
    """
    fits_path = tmp_path / "synthetic_spherex.fits"

    # Cabecera WCS básica
    hdr = fits.Header()
    hdr["SIMPLE"] = True
    hdr["BITPIX"] = -32
    hdr["NAXIS"] = 2
    hdr["NAXIS1"] = 64
    hdr["NAXIS2"] = 64
    hdr["DATE-OBS"] = "2026-03-15T12:00:00"
    hdr["MJD-BEG"] = 61115.5
    hdr["MJD-END"] = 61115.6
    hdr["EXPTIME"] = 100.0
    hdr["TELESCOP"] = "SPHEREx"
    hdr["INSTRUME"] = "SPHEREx"
    hdr["BUNIT"] = "MJy/sr"
    # WCS
    hdr["CTYPE1"] = "RA---TAN"
    hdr["CTYPE2"] = "DEC--TAN"
    hdr["CRVAL1"] = 127.69444
    hdr["CRVAL2"] = -39.17760
    hdr["CRPIX1"] = 32.0
    hdr["CRPIX2"] = 32.0
    hdr["CDELT1"] = -6.94e-5   # ~0.25 arcsec/pixel
    hdr["CDELT2"] = 6.94e-5
    hdr["EQUINOX"] = 2000.0
    hdr["RADESYS"] = "ICRS"

    data = np.random.randn(64, 64).astype(np.float32)
    primary_hdu = fits.PrimaryHDU(data=data, header=hdr)

    # Extensión FLAGS (como en SPHEREx real)
    flags_hdu = fits.ImageHDU(
        data=np.zeros((64, 64), dtype=np.int16),
        name="FLAGS",
    )

    # Extensión VARIANCE
    var_hdu = fits.ImageHDU(
        data=np.ones((64, 64), dtype=np.float32),
        name="VARIANCE",
    )

    hdul = fits.HDUList([primary_hdu, flags_hdu, var_hdu])
    hdul.writeto(fits_path, overwrite=True)

    return fits_path


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestExtractMetadata:
    def test_file_not_found(self):
        with pytest.raises(FileNotFoundError):
            extract_metadata("/nonexistent/path/file.fits")

    def test_returns_dict(self, synthetic_fits):
        meta = extract_metadata(synthetic_fits)
        assert isinstance(meta, dict)

    def test_has_required_keys(self, synthetic_fits):
        meta = extract_metadata(synthetic_fits)
        for key in ("fits_path", "file_size_bytes", "extensions", "primary_header",
                    "wcs", "observation", "instrument", "image"):
            assert key in meta, f"Falta clave '{key}' en metadatos"

    def test_extensions_detected(self, synthetic_fits):
        """Debe detectar las 3 extensiones del MEF sintético."""
        meta = extract_metadata(synthetic_fits)
        assert len(meta["extensions"]) == 3
        names = [e["name"] for e in meta["extensions"]]
        assert "FLAGS" in names
        assert "VARIANCE" in names

    def test_observation_date_extracted(self, synthetic_fits):
        meta = extract_metadata(synthetic_fits)
        assert "date_obs" in meta["observation"]
        assert meta["observation"]["date_obs"] == "2026-03-15T12:00:00"

    def test_mjd_extracted(self, synthetic_fits):
        meta = extract_metadata(synthetic_fits)
        assert "mjd_begin" in meta["observation"]
        assert abs(meta["observation"]["mjd_begin"] - 61115.5) < 0.001

    def test_instrument_extracted(self, synthetic_fits):
        meta = extract_metadata(synthetic_fits)
        assert meta["instrument"].get("telescope") == "SPHEREx"
        assert meta["instrument"].get("instrument") == "SPHEREx"

    def test_image_dimensions(self, synthetic_fits):
        meta = extract_metadata(synthetic_fits)
        assert meta["image"].get("naxis") == 2
        assert meta["image"].get("naxis1") == 64
        assert meta["image"].get("naxis2") == 64

    def test_wcs_celestial(self, synthetic_fits):
        meta = extract_metadata(synthetic_fits)
        wcs_info = meta["wcs"]
        assert wcs_info is not None
        assert wcs_info.get("is_celestial") is True
        assert "center_ra_deg" in wcs_info
        assert "center_dec_deg" in wcs_info
        # Las coordenadas centrales deben estar cerca de las del CRVAL
        assert abs(wcs_info["center_ra_deg"] - 127.69444) < 1.0
        assert abs(wcs_info["center_dec_deg"] - (-39.17760)) < 1.0

    def test_file_size_reported(self, synthetic_fits):
        meta = extract_metadata(synthetic_fits)
        assert meta["file_size_bytes"] > 0

    def test_primary_header_has_bitpix(self, synthetic_fits):
        meta = extract_metadata(synthetic_fits)
        assert "BITPIX" in meta["primary_header"]


# ---------------------------------------------------------------------------
# Test con FITS real descargado (si existe en data/raw/)
# ---------------------------------------------------------------------------

@pytest.mark.real
class TestExtractMetadataReal:
    def test_real_fits_if_available(self):
        """Si hay un FITS real en data/raw/, verifica que AstroPy lo puede leer."""
        raw_dir = Path(__file__).parent.parent / "data" / "raw"
        fits_files = list(raw_dir.glob("*.fits"))

        if not fits_files:
            pytest.skip("No hay archivos FITS en data/raw/ para probar.")

        fits_path = fits_files[0]
        print(f"\nProbando con FITS real: {fits_path.name}")
        meta = extract_metadata(fits_path)

        assert isinstance(meta, dict)
        assert len(meta["extensions"]) >= 1
        print(f"  Extensiones: {[e['name'] for e in meta['extensions']]}")
        print(f"  Observación: {meta['observation']}")
        print(f"  Instrumento: {meta['instrument']}")

