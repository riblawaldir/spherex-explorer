"""Sprint 4: GET /api/compare — pair validation + P5 align wiring (offline)."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from astropy.io import fits
from astropy.wcs import WCS
from fastapi.testclient import TestClient

from app.main import app
from app.services.catalog import CatalogService, get_catalog_service
from app.services.compare import compare_observations

client = TestClient(app)


def _make_wcs(*, offset=(0.0, 0.0), ra=133.79513, dec=-7.24459):
    w = WCS(naxis=2)
    w.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    w.wcs.crpix = [16.5 + offset[0], 16.5 + offset[1]]
    w.wcs.crval = [ra, dec]
    w.wcs.cd = np.array([[-0.001, 0.0], [0.0, 0.001]])
    return w


def _write_image_fits(path: Path, wcs: WCS, *, unit: str = "MJy/sr") -> None:
    data = np.zeros((32, 32), dtype=np.float32)
    data[12:18, 12:18] = 1.0
    header = wcs.to_header()
    header["BUNIT"] = unit
    fits.HDUList(
        [fits.PrimaryHDU(), fits.ImageHDU(data, header=header, name="IMAGE")]
    ).writeto(path)


def _catalog_with_pair(tmp_path: Path, *, unit_a: str = "MJy/sr", unit_b: str = "MJy/sr"):
    """Tiny fixture catalog with two WCS-aligned synthetic FITS (not NASA)."""
    samples = tmp_path / "samples"
    samples.mkdir()
    meta = tmp_path / "metadata"
    meta.mkdir()
    _write_image_fits(samples / "cmp-a.fits", _make_wcs(), unit=unit_a)
    _write_image_fits(
        samples / "cmp-b.fits", _make_wcs(offset=(1.0, -0.5)), unit=unit_b
    )

    epochs = {
        "provenance": "cached_sample",
        "epochs": [
            {
                "obs_id": "cmp-a",
                "ra": 133.79513,
                "dec": -7.24459,
                "t_mjd": 60310.0,
                "bandpass": "SPHEREx-B1",
                "wavelength_um": 0.95,
                "provenance": "cached_sample",
                "fits_sample": None,
            },
            {
                "obs_id": "cmp-b",
                "ra": 133.79513,
                "dec": -7.24459,
                "t_mjd": 60490.0,
                "bandpass": "SPHEREx-B1",
                "wavelength_um": 0.95,
                "provenance": "cached_sample",
                "fits_sample": None,
            },
            {
                "obs_id": "cmp-other-band",
                "ra": 133.79513,
                "dec": -7.24459,
                "t_mjd": 60500.0,
                "bandpass": "SPHEREx-B3",
                "wavelength_um": 2.4,
                "provenance": "cached_sample",
                "fits_sample": None,
            },
        ],
    }
    # Resolve via samples_dir / {obs_id}.fits (do not write into repo data/).
    epochs_path = meta / "epochs.json"
    epochs_path.write_text(json.dumps(epochs), encoding="utf-8")
    targets_path = meta / "targets.json"
    targets_path.write_text(
        json.dumps({"provenance": "stub", "targets": []}), encoding="utf-8"
    )
    return CatalogService(
        targets_path=targets_path,
        epochs_path=epochs_path,
        samples_dir=samples,
        raw_dir=tmp_path / "raw",
    )


def test_compare_requires_both_ids():
    response = client.get("/api/compare")
    assert response.status_code == 422


def test_compare_rejects_identical_ids():
    response = client.get(
        "/api/compare",
        params={"obs_id_a": "stub-wise0855-001", "obs_id_b": "stub-wise0855-001"},
    )
    assert response.status_code == 422
    body = response.json()
    assert body["provenance"] == "stub"
    assert "different" in body["detail"].lower()


def test_compare_unknown_obs_404():
    response = client.get(
        "/api/compare",
        params={"obs_id_a": "missing-a", "obs_id_b": "stub-wise0855-001"},
    )
    assert response.status_code == 404
    body = response.json()
    assert body["provenance"] == "stub"
    assert "unknown" in body["detail"].lower()


def test_compare_fixture_pair_not_comparable_without_wcs():
    """Labeled stubs share bandpass + FITS but lack celestial WCS → not_comparable."""
    response = client.get(
        "/api/compare",
        params={"obs_id_a": "stub-wise0855-001", "obs_id_b": "stub-wise0855-002"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "not_comparable"
    assert body["provenance"] == "cached_sample"
    assert body["checks"]["bandpass_match"] is True
    assert body["checks"]["both_local_fits"] is True
    assert body["checks"]["alignment_ok"] is False
    assert body["alignment"]["status"] == "failed"
    assert body["diff"]["status"] == "skipped"
    assert body["diff"]["provenance"] == "stub"
    assert "collection" not in body["epoch_a"]
    assert "source_url" not in body["epoch_b"]


def test_compare_bandpass_mismatch_skips_align():
    response = client.get(
        "/api/compare",
        params={"obs_id_a": "stub-wise0855-001", "obs_id_b": "stub-wise0855-003"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "not_comparable"
    assert body["checks"]["bandpass_match"] is False
    assert body["checks"]["both_local_fits"] is False
    assert body["alignment"]["status"] == "skipped"
    assert body["diff"]["status"] == "skipped"


def test_compare_aligned_pair_comparable(tmp_path: Path):
    catalog = _catalog_with_pair(tmp_path)
    outcome = compare_observations(catalog, obs_id_a="cmp-a", obs_id_b="cmp-b")
    assert outcome.http_status == 200
    body = outcome.payload
    assert body["status"] == "comparable"
    assert body["provenance"] == "cached_sample"
    assert body["checks"]["alignment_ok"] is True
    assert body["alignment"]["status"] == "ok"
    assert body["alignment"]["common_coverage_percent"] is not None
    assert body["alignment"]["common_coverage_percent"] > 0
    assert body["diff"]["status"] == "not_implemented"
    assert body["diff"]["provenance"] == "stub"
    assert "invented" in body["diff"]["detail"].lower() or "not present" in body["diff"]["detail"].lower()
    assert body["science"]["photometric_equivalence"] is False
    assert body["science"]["subtraction_validated"] is False
    assert body["science"]["variability_assessed"] is False
    assert "variable_detected" not in body["science"]


def test_compare_units_incompatible_not_comparable(tmp_path: Path):
    catalog = _catalog_with_pair(tmp_path, unit_a="MJy/sr", unit_b="adu")
    outcome = compare_observations(catalog, obs_id_a="cmp-a", obs_id_b="cmp-b")
    assert outcome.http_status == 200
    body = outcome.payload
    assert body["status"] == "not_comparable"
    assert body["alignment"]["status"] == "failed"
    assert body["alignment"]["units_compatible"] is False
    assert body["diff"]["status"] == "skipped"


def test_catalog_get_epoch_by_obs_id_known():
    get_catalog_service.cache_clear()
    svc = CatalogService()
    row = svc.get_epoch_by_obs_id("stub-wise0855-001")
    assert row is not None
    assert row["obs_id"] == "stub-wise0855-001"
    assert row["preview_url"] == "/api/preview/stub-wise0855-001"
    assert "collection" not in row
    assert svc.get_epoch_by_obs_id("does-not-exist") is None
