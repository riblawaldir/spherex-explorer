"""Local allowlist and honest scientific status. No photometric claim."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest
from astropy.io import fits
from astropy.wcs import WCS

from app.science.local_manifest import (
    ManifestError,
    cutout_center_radec,
    read_manifest,
    resolve_allowed_fits,
    sha256_file,
)
from app.science.scientific_status import assess_pair
from app.services.catalog import CatalogService
from app.services.compare import compare_observations


def _wcs() -> WCS:
    wcs = WCS(naxis=2)
    wcs.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    wcs.wcs.crpix = [8.5, 8.5]
    wcs.wcs.crval = [140.0, 55.0]
    wcs.wcs.cd = np.array([[-0.001, 0.0], [0.0, 0.001]])
    return wcs


def _write_fits(path: Path) -> str:
    data = np.ones((16, 16), dtype=np.float32)
    header = _wcs().to_header()
    header["BUNIT"] = "MJy/sr"
    fits.HDUList(
        [fits.PrimaryHDU(), fits.ImageHDU(data=data, header=header, name="IMAGE")]
    ).writeto(path)
    return sha256_file(path)


def _manifest(path: Path, fits_path: Path, digest: str, *, provenance: str = "local_real_fits") -> None:
    path.write_text(
        json.dumps(
            {
                "observations": [
                    {
                        "obs_id": "local-a",
                        "path": str(fits_path),
                        "sha256": digest,
                        "ra": 140.0,
                        "dec": 55.0,
                        "t_mjd": 61080.0,
                        "bandpass": "SPHEREx-D1",
                        "provenance": provenance,
                    }
                ]
            }
        ),
        encoding="utf-8",
    )


def test_manifest_rejects_live_and_relative_paths(tmp_path: Path):
    fits_path = tmp_path / "a.fits"
    digest = _write_fits(fits_path)
    live = tmp_path / "live.json"
    _manifest(live, fits_path, digest, provenance="live")
    with pytest.raises(ManifestError, match="local_real_fits"):
        read_manifest(live)

    relative = tmp_path / "rel.json"
    relative.write_text(
        json.dumps(
            {
                "observations": [
                    {
                        "obs_id": "local-a",
                        "path": "a.fits",
                        "sha256": digest,
                        "ra": 140.0,
                        "dec": 55.0,
                        "bandpass": "SPHEREx-D1",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    with pytest.raises(ManifestError, match="absolute"):
        read_manifest(relative)


def test_hash_mismatch_does_not_resolve(tmp_path: Path, monkeypatch):
    fits_path = tmp_path / "a.fits"
    _write_fits(fits_path)
    manifest = tmp_path / "manifest.json"
    _manifest(manifest, fits_path, "a" * 64)
    monkeypatch.setenv("SPHEREX_P5_LOCAL_MANIFEST", str(manifest))
    assert resolve_allowed_fits("local-a") is None
    assert resolve_allowed_fits("other") is None


def test_allowlist_compare_keeps_category_and_hash(tmp_path: Path, monkeypatch):
    first = tmp_path / "a.fits"
    second = tmp_path / "b.fits"
    digest_a = _write_fits(first)
    digest_b = _write_fits(second)
    manifest = tmp_path / "manifest.json"
    manifest.write_text(
        json.dumps(
            {
                "observations": [
                    {
                        "obs_id": "local-a",
                        "path": str(first),
                        "sha256": digest_a,
                        "ra": 140.0,
                        "dec": 55.0,
                        "t_mjd": 61080.0,
                        "bandpass": "SPHEREx-D1",
                    },
                    {
                        "obs_id": "local-b",
                        "path": str(second),
                        "sha256": digest_b,
                        "ra": 140.0,
                        "dec": 55.0,
                        "t_mjd": 61104.0,
                        "bandpass": "SPHEREx-D1",
                    },
                ],
                "pairs": [
                    {
                        "obs_id_a": "local-a",
                        "obs_id_b": "local-b",
                        "category": "B",
                        "exploratory_spectral_note": "filtro exploratorio, no certificación",
                        "warnings": ["Residuos estructurados."],
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("SPHEREX_P5_LOCAL_MANIFEST", str(manifest))
    meta = tmp_path / "metadata"
    meta.mkdir()
    (meta / "epochs.json").write_text(
        json.dumps({"provenance": "cached_sample", "epochs": []}), encoding="utf-8"
    )
    (meta / "targets.json").write_text(
        json.dumps({"provenance": "stub", "targets": []}), encoding="utf-8"
    )
    catalog = CatalogService(
        targets_path=meta / "targets.json",
        epochs_path=meta / "epochs.json",
        samples_dir=tmp_path / "samples",
        raw_dir=tmp_path / "raw",
    )
    found = catalog.epochs(ra=140.0, dec=55.0, radius_arcsec=30)
    assert found.provenance == "local_real_fits"
    assert {row["obs_id"] for row in found.epochs} == {"local-a", "local-b"}
    assert all(row["provenance"] == "local_real_fits" for row in found.epochs)

    outcome = compare_observations(catalog, obs_id_a="local-a", obs_id_b="local-b")
    body = outcome.payload
    assert body["provenance"] == "local_real_fits"
    assert body["science"]["category"] == "B"
    assert body["science"]["photometric_equivalence"] is False
    assert body["science"]["spectral_comparability"] == "not_certified"
    assert body["science"]["sha256_verified"] is True
    assert "variable_detected" not in body["science"]
    assert sha256_file(first) == digest_a
    assert sha256_file(second) == digest_b


def test_category_c_is_rejected(tmp_path: Path):
    fits_path = tmp_path / "a.fits"
    digest = _write_fits(fits_path)
    other = tmp_path / "b.fits"
    digest_b = _write_fits(other)
    manifest = tmp_path / "manifest.json"
    manifest.write_text(
        json.dumps(
            {
                "observations": [
                    {
                        "obs_id": "local-a",
                        "path": str(fits_path),
                        "sha256": digest,
                        "ra": 1.0,
                        "dec": 2.0,
                        "bandpass": "SPHEREx-D1",
                    },
                    {
                        "obs_id": "local-b",
                        "path": str(other),
                        "sha256": digest_b,
                        "ra": 1.0,
                        "dec": 2.0,
                        "bandpass": "SPHEREx-D1",
                    },
                ],
                "pairs": [
                    {
                        "obs_id_a": "local-a",
                        "obs_id_b": "local-b",
                        "category": "C",
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    with pytest.raises(ManifestError, match="category"):
        read_manifest(manifest)


def test_assess_pair_does_not_rewrite_fits(tmp_path: Path):
    path = tmp_path / "a.fits"
    digest = _write_fits(path)
    other = tmp_path / "b.fits"
    digest_b = _write_fits(other)
    report = assess_pair(path, other, obs_id_a="local-a", obs_id_b="local-b")
    assert report["geometric_alignment"] == "ok"
    assert report["category"] == "not_classified"
    assert report["subtraction_validated"] is False
    assert "variable_detected" not in report
    assert sha256_file(path) == digest
    assert sha256_file(other) == digest_b


_FIELD_P = Path.home() / "Downloads" / "spherex_real_fits_p5" / "seleccion_campo_p5"
_FIELD_P_A = _FIELD_P / "campoP_dr1_2026W15_2A_0124_1.fits"
_FIELD_P_B = _FIELD_P / "campoP_dr1_2026W18_2A_0829_1.fits"
_HASH_A = "0c8cc3b05ea0b58d2b5e49a0e6766b6cc9d7698aed9f92ef1dab875fca0c3e3f"
_HASH_B = "550c012a64114b84d99ed26330171c706b0b511a86faa6c99718eb5c8eac568d"


@pytest.mark.skipif(
    not (_FIELD_P_A.is_file() and _FIELD_P_B.is_file()),
    reason="Los FITS del campo P no están en esta máquina",
)
def test_cutout_center_ignores_reference_pixel_outside_the_image():
    header = fits.Header()
    header["CTYPE1"] = "RA---TAN"
    header["CTYPE2"] = "DEC--TAN"
    header["CRPIX1"] = 5.5
    header["CRPIX2"] = 5.5
    header["CRVAL1"] = 140.0
    header["CRVAL2"] = 55.0
    header["CDELT1"] = -0.01
    header["CDELT2"] = 0.01
    header["CUNIT1"] = "deg"
    header["CUNIT2"] = "deg"
    ra, dec = cutout_center_radec(header, 10, 10)
    assert ra == pytest.approx(140.0)
    assert dec == pytest.approx(55.0)

    header["CRPIX1"] = -20
    header["CRPIX2"] = 40
    ra, dec = cutout_center_radec(header, 10, 10)
    assert abs(ra - 140.0) > 0.01
    assert abs(dec - 55.0) > 0.01


def test_field_p_files_stay_intact():
    assert sha256_file(_FIELD_P_A) == _HASH_A
    assert sha256_file(_FIELD_P_B) == _HASH_B
    report = assess_pair(
        _FIELD_P_A,
        _FIELD_P_B,
        obs_id_a="2026W15_2A_0124_1",
        obs_id_b="2026W18_2A_0829_1",
    )
    assert report["geometric_alignment"] == "ok"
    assert report["photometric_equivalence"] is False
    assert report["category"] == "not_classified"
    assert report["common_coverage_percent"] == pytest.approx(100.0, abs=0.1)
    assert sha256_file(_FIELD_P_A) == _HASH_A
    assert sha256_file(_FIELD_P_B) == _HASH_B
