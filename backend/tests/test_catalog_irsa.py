"""Unit tests: CatalogService ↔ P4 spherex_data mapping (no network)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pytest

from app.services.catalog import (
    PROVENANCE_CACHED_SAMPLE,
    PROVENANCE_LIVE,
    PROVENANCE_STUB,
    CatalogService,
    get_catalog_service,
)


@dataclass
class _FakeRec:
    obs_id: str
    collection: str
    access_url: str
    ra: float | None = None
    dec: float | None = None
    t_min_mjd: float | None = None
    t_max_mjd: float | None = None
    observed_at: str | None = None
    em_min_m: float | None = None
    em_max_m: float | None = None
    band_label: str | None = None
    instrument_name: str | None = None
    facility_name: str | None = None
    fits_path: str | None = None


def _payload(records: list[_FakeRec]) -> dict[str, Any]:
    return {
        "region": {"ra": 1.0, "dec": 2.0, "radius_deg": 0.01},
        "query": {"collections": ["spherex_dr1"]},
        "count": len(records),
        "observations": [],
        "_records": records,
    }


@pytest.fixture(autouse=True)
def _clear_catalog_cache():
    get_catalog_service.cache_clear()
    yield
    get_catalog_service.cache_clear()


def test_default_epochs_stay_on_fixtures():
    svc = CatalogService(use_irsa=False)
    result = svc.epochs(ra=133.79513, dec=-7.24459, radius_arcsec=60)
    assert result.provenance == PROVENANCE_CACHED_SAMPLE
    assert len(result.epochs) >= 3
    assert "collection" not in result.epochs[0]
    assert "source_url" not in result.epochs[0]


def test_live_epochs_map_p4_fields(monkeypatch):
    recs = [
        _FakeRec(
            obs_id="sia-obs-b",
            collection="spherex_dr1",
            access_url="https://irsa.example/a.fits",
            ra=133.79,
            dec=-7.24,
            t_min_mjd=60400.5,
            em_min_m=1.0e-6,
            em_max_m=1.2e-6,
            band_label="1.000–1.200 µm",
        ),
        _FakeRec(
            obs_id="sia-obs-a",
            collection="spherex_qr3",
            access_url="https://irsa.example/b.fits",
            ra=133.80,
            dec=-7.25,
            t_min_mjd=60300.0,
            em_min_m=2.0e-6,
            em_max_m=2.4e-6,
            band_label="2.000–2.400 µm",
        ),
        _FakeRec(
            obs_id="sia-no-time",
            collection="spherex_dr1",
            access_url="",
            ra=None,
            dec=None,
            t_min_mjd=None,
            band_label=None,
        ),
    ]

    def fake_search(ra, dec, radius_deg, collections=None, client=None):
        assert ra == 133.79513
        return _payload(recs)

    svc = CatalogService(use_irsa=True, search_observations_fn=fake_search)
    result = svc.epochs(ra=133.79513, dec=-7.24459, radius_arcsec=120)
    assert result.provenance == PROVENANCE_LIVE
    assert [e["obs_id"] for e in result.epochs] == [
        "sia-obs-a",
        "sia-obs-b",
        "sia-no-time",
    ]
    first = result.epochs[0]
    assert first["t_mjd"] == 60300.0
    assert first["bandpass"] == "2.000–2.400 µm"
    assert first["wavelength_um"] == pytest.approx(2.2)
    assert first["preview_url"] is None
    assert first["provenance"] == PROVENANCE_LIVE
    assert first["collection"] == "spherex_qr3"
    assert first["source_url"] == "https://irsa.example/b.fits"
    # Null-safe coords when IRSA omitted them.
    assert result.epochs[2]["ra"] is None
    assert result.epochs[2]["dec"] is None
    assert "source_url" not in result.epochs[2]


def test_live_epochs_band_filter():
    recs = [
        _FakeRec(
            obs_id="keep",
            collection="spherex_dr1",
            access_url="https://irsa.example/k.fits",
            ra=1.0,
            dec=2.0,
            t_min_mjd=1.0,
            band_label="SPHEREx-B3 mid",
        ),
        _FakeRec(
            obs_id="drop",
            collection="spherex_dr1",
            access_url="https://irsa.example/d.fits",
            ra=1.0,
            dec=2.0,
            t_min_mjd=2.0,
            band_label="SPHEREx-B1",
        ),
    ]
    svc = CatalogService(
        use_irsa=True,
        search_observations_fn=lambda *a, **k: _payload(recs),
    )
    result = svc.epochs(ra=1.0, dec=2.0, band="B3")
    assert result.provenance == PROVENANCE_LIVE
    assert [e["obs_id"] for e in result.epochs] == ["keep"]


def test_irsa_failure_falls_back_to_fixtures():
    def boom(*_a, **_k):
        raise ConnectionError("IRSA down")

    svc = CatalogService(use_irsa=True, search_observations_fn=boom)
    result = svc.epochs(ra=133.79513, dec=-7.24459, radius_arcsec=60)
    assert result.provenance == PROVENANCE_CACHED_SAMPLE
    assert any(e["obs_id"] == "stub-wise0855-001" for e in result.epochs)


def test_live_search_maps_hits_and_skips_null_coords():
    recs = [
        _FakeRec(
            obs_id="hit-1",
            collection="spherex_dr1",
            access_url="https://irsa.example/1.fits",
            ra=10.0,
            dec=-5.0,
            band_label="1.0–1.1 µm",
        ),
        _FakeRec(
            obs_id="skip-null",
            collection="spherex_dr1",
            access_url="https://irsa.example/2.fits",
            ra=None,
            dec=None,
            band_label="x",
        ),
    ]
    svc = CatalogService(
        use_irsa=True,
        search_observations_fn=lambda *a, **k: _payload(recs),
    )
    result = svc.search(ra=10.0, dec=-5.0, radius_arcsec=30)
    assert result.provenance == PROVENANCE_LIVE
    assert len(result.hits) == 1
    assert result.hits[0]["id"] == "hit-1"
    assert result.hits[0]["name"] == "1.0–1.1 µm"
    assert "spherex_dr1" in result.hits[0]["notes"]


def test_search_without_coords_stays_on_fixtures_even_if_irsa_enabled():
    def boom(*_a, **_k):
        raise AssertionError("IRSA must not be called for name-only search")

    svc = CatalogService(use_irsa=True, search_observations_fn=boom)
    result = svc.search(q="wise")
    assert result.provenance == PROVENANCE_STUB
    assert any(h["id"] == "wise-0855" for h in result.hits)


def test_search_irsa_failure_falls_back():
    def boom(*_a, **_k):
        raise ConnectionError("no network")

    svc = CatalogService(use_irsa=True, search_observations_fn=boom)
    result = svc.search(ra=133.79513, dec=-7.24459, radius_arcsec=30)
    assert result.provenance == PROVENANCE_STUB
    assert any(h["id"] == "wise-0855" for h in result.hits)


def test_live_fits_path_sets_preview_url(tmp_path):
    """P4 cutout already on disk under data/ → honest preview_url (no invent)."""
    import numpy as np
    from astropy.io import fits

    raw = tmp_path / "raw"
    raw.mkdir()
    fits_path = raw / "sia-cutout-1.fits"
    fits.PrimaryHDU(np.ones((4, 4), dtype=np.float64)).writeto(fits_path)

    # CatalogService only accepts paths under repo data/; use real samples dir
    # via fits_path pointing at an existing stub sample (honest file, not invented).
    from pathlib import Path

    repo_sample = (
        Path(__file__).resolve().parents[2]
        / "data"
        / "samples"
        / "stub-wise0855-001.fits"
    )
    assert repo_sample.is_file()

    recs = [
        _FakeRec(
            obs_id="sia-with-cutout",
            collection="spherex_dr1",
            access_url="https://irsa.example/c.fits",
            ra=1.0,
            dec=2.0,
            t_min_mjd=10.0,
            band_label="B1",
            fits_path=str(repo_sample),
        )
    ]
    svc = CatalogService(
        use_irsa=True,
        search_observations_fn=lambda *a, **k: _payload(recs),
    )
    result = svc.epochs(ra=1.0, dec=2.0, radius_arcsec=120)
    assert result.provenance == PROVENANCE_LIVE
    row = result.epochs[0]
    assert row["preview_url"] == "/api/preview/sia-with-cutout"
    assert svc.resolve_preview_fits("sia-with-cutout") == repo_sample.resolve()


def test_resolve_preview_fits_raw_drop_in(tmp_path):
    import numpy as np
    from astropy.io import fits

    raw = tmp_path / "raw"
    samples = tmp_path / "samples"
    raw.mkdir()
    samples.mkdir()
    path = raw / "dropped-obs.fits"
    fits.PrimaryHDU(np.full((3, 3), 2.0)).writeto(path)

    # Point CatalogService at temp dirs; empty epochs so convention/raw wins.
    epochs = tmp_path / "epochs.json"
    epochs.write_text('{"provenance": "stub", "epochs": []}', encoding="utf-8")
    targets = tmp_path / "targets.json"
    targets.write_text('{"provenance": "stub", "targets": []}', encoding="utf-8")

    svc = CatalogService(
        targets_path=targets,
        epochs_path=epochs,
        samples_dir=samples,
        raw_dir=raw,
        use_irsa=False,
    )
    assert svc.resolve_preview_fits("dropped-obs") == path.resolve()
    assert svc.resolve_preview_fits("missing") is None
