"""Backward-compatible smoke tests (Sprint 0 names → Sprint 1 fixtures)."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_still_ok():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_targets_stub_shape():
    response = client.get("/api/targets")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 5
    first = data[0]
    assert {"id", "name", "ra", "dec"} <= first.keys()


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


def test_epochs_returns_fixture_rows():
    response = client.get(
        "/api/epochs", params={"ra": 133.79513, "dec": -7.24459}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["provenance"] == "cached_sample"
    assert len(body["epochs"]) >= 1


def test_epochs_requires_ra_dec():
    response = client.get("/api/epochs")
    assert response.status_code == 422


def test_preview_stub_501_when_no_fits():
    response = client.get("/api/preview/missing-obs")
    assert response.status_code == 501
    body = response.json()
    assert body["provenance"] == "stub"
    assert "unavailable" in body["detail"].lower() or "not" in body["detail"].lower()
    assert response.headers.get("X-Provenance") == "stub"
