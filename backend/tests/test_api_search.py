"""Sprint 1 API: validation, search, epochs fixtures, preview wiring."""

from fastapi.testclient import TestClient

from app.main import app
from app.services.catalog import CatalogService, get_catalog_service

client = TestClient(app)


def test_health_still_ok():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_targets_from_labeled_fixtures():
    response = client.get("/api/targets")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 5
    first = data[0]
    assert {"id", "name", "ra", "dec"} <= first.keys()
    assert first["id"] == "wise-0855"


def test_search_by_q():
    response = client.get("/api/search", params={"q": "wise"})
    assert response.status_code == 200
    body = response.json()
    assert body["provenance"] == "stub"
    assert len(body["hits"]) >= 1
    assert body["hits"][0]["id"] == "wise-0855"


def test_search_all_when_no_params():
    response = client.get("/api/search")
    assert response.status_code == 200
    body = response.json()
    assert body["provenance"] == "stub"
    assert len(body["hits"]) == 5


def test_search_by_ra_dec_near_target():
    response = client.get(
        "/api/search",
        params={"ra": 133.79513, "dec": -7.24459, "radius_arcsec": 30},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["provenance"] == "stub"
    ids = {h["id"] for h in body["hits"]}
    assert "wise-0855" in ids


def test_search_rejects_unpaired_ra():
    response = client.get("/api/search", params={"ra": 10})
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert "both ra and dec" in str(detail).lower()


def test_search_rejects_out_of_range_ra():
    response = client.get("/api/search", params={"ra": 400, "dec": 0})
    assert response.status_code == 422


def test_search_rejects_out_of_range_dec():
    response = client.get("/api/search", params={"ra": 10, "dec": 95})
    assert response.status_code == 422


def test_search_rejects_non_positive_radius():
    response = client.get(
        "/api/search",
        params={"ra": 10, "dec": 0, "radius_arcsec": 0},
    )
    assert response.status_code == 422


def test_search_rejects_radius_without_coords():
    response = client.get("/api/search", params={"radius_arcsec": 10})
    assert response.status_code == 422


def test_epochs_time_ordered_for_wise_region():
    response = client.get(
        "/api/epochs",
        params={"ra": 133.79513, "dec": -7.24459, "radius_arcsec": 60},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["provenance"] == "cached_sample"
    epochs = body["epochs"]
    assert len(epochs) >= 3
    mjds = [e["t_mjd"] for e in epochs]
    assert mjds == sorted(mjds)
    required = {
        "obs_id",
        "ra",
        "dec",
        "t_mjd",
        "bandpass",
        "wavelength_um",
        "preview_url",
        "provenance",
    }
    assert required <= epochs[0].keys()
    assert all(e["provenance"] in {"stub", "cached_sample"} for e in epochs)
    # Fixture truth: coords from data/metadata/epochs.json — not invented defaults.
    assert epochs[0]["ra"] == 133.79513
    assert epochs[0]["dec"] == -7.24459
    # Epochs preserve the existing payload and add normalized timeline metadata.
    assert "collection" not in epochs[0]
    assert "source_url" not in epochs[0]
    assert epochs[0]["observed_at"].endswith("Z")
    assert epochs[0]["detector"] == "SPHEREx-D1"
    assert epochs[0]["resolving_power"] == 39
    assert epochs[0]["survey_cycle"] is None


def test_epochs_band_filter():
    response = client.get(
        "/api/epochs",
        params={
            "ra": 133.79513,
            "dec": -7.24459,
            "radius_arcsec": 60,
            "band": "B3",
        },
    )
    assert response.status_code == 200
    epochs = response.json()["epochs"]
    assert len(epochs) == 1
    assert "B3" in epochs[0]["bandpass"]
    assert epochs[0]["detector"] == "SPHEREx-D3"


def test_epochs_requires_ra_dec():
    response = client.get("/api/epochs")
    assert response.status_code == 422


def test_epochs_rejects_invalid_dec():
    response = client.get("/api/epochs", params={"ra": 10, "dec": -100})
    assert response.status_code == 422


def test_preview_png_when_sample_fits_exists():
    response = client.get("/api/preview/stub-wise0855-001")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/png")
    assert response.headers.get("X-Provenance") == "cached_sample"
    assert response.content[:8] == b"\x89PNG\r\n\x1a\n"


def test_preview_501_without_sample():
    response = client.get("/api/preview/stub-wise0855-002")
    assert response.status_code == 501
    body = response.json()
    assert body["provenance"] == "stub"
    assert "no local sample" in body["detail"].lower()
    assert response.headers.get("X-Provenance") == "stub"


def test_catalog_service_direct_fixture_load():
    """Unit-level: CatalogService reads labeled JSON (P4 swap point)."""
    # Clear cache so a fresh default instance is used.
    get_catalog_service.cache_clear()
    svc = CatalogService()
    result = svc.search(q="barnard")
    assert result.provenance == "stub"
    assert any(h["id"] == "barnards-star" for h in result.hits)
