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
    assert "stub" in first.get("notes", "").lower() or "pending" in first.get(
        "notes", ""
    ).lower()


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


def test_epochs_stub_empty():
    response = client.get("/api/epochs", params={"ra": 133.786, "dec": -7.411})
    assert response.status_code == 200
    body = response.json()
    assert body == {"epochs": [], "provenance": "stub"}


def test_epochs_requires_ra_dec():
    response = client.get("/api/epochs")
    assert response.status_code == 422


def test_preview_stub_501():
    response = client.get("/api/preview/stub-obs-1")
    assert response.status_code == 501
    body = response.json()
    assert body["provenance"] == "stub"
    assert "not implemented" in body["detail"].lower()
    assert response.headers.get("X-Provenance") == "stub"
