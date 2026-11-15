"""
test_observations.py — Pruebas de organización temporal de observaciones SPHEREx.
"""

from pathlib import Path
import pytest

from app.science.spherex_data.search import ObservationRecord
from app.science.spherex_data.observations import organize_observations


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _make_obs(obs_id, collection, t_min_mjd, em_min=0.75e-6, em_max=1.1e-6):
    return ObservationRecord(
        obs_id=obs_id,
        collection=collection,
        access_url=f"https://irsa.ipac.caltech.edu/ibe/data/spherex/{obs_id}.fits",
        ra=127.69,
        dec=-39.17,
        t_min_mjd=t_min_mjd,
        t_max_mjd=t_min_mjd + 0.1 if t_min_mjd else None,
        observed_at=None,
        em_min_m=em_min,
        em_max_m=em_max,
        band_label=f"{em_min*1e6:.3f}–{em_max*1e6:.3f} µm",
    )


@pytest.fixture
def two_epoch_obs():
    """Dos observaciones de la misma banda en épocas distintas."""
    return [
        _make_obs("OBS-001", "spherex_dr1", 60000.0),
        _make_obs("OBS-002", "spherex_dr1", 60180.0),
    ]


@pytest.fixture
def mixed_band_obs():
    """Observaciones de bandas distintas."""
    return [
        _make_obs("OBS-A", "spherex_dr1", 60000.0, 0.75e-6, 1.1e-6),
        _make_obs("OBS-B", "spherex_dr1", 60000.0, 1.1e-6, 1.65e-6),
    ]


@pytest.fixture
def mixed_collection_obs():
    """Observaciones de DR1 y QR3 (compatibles según IRSA)."""
    return [
        _make_obs("DR1-001", "spherex_dr1", 60000.0),
        _make_obs("QR3-001", "spherex_qr3", 60000.0),
    ]


@pytest.fixture
def incompatible_qr2_obs():
    """Observaciones mezclando QR2 (incompatible) con DR1."""
    return [
        _make_obs("DR1-001", "spherex_dr1", 60000.0),
        _make_obs("QR2-001", "spherex_qr2", 59900.0),
    ]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestOrganizeObservations:
    def test_empty_list(self):
        result = organize_observations([])
        assert result["sorted_observations"] == []
        assert result["groups"] == []
        assert result["comparable_pairs"] == []
        assert result["statistics"]["total"] == 0

    def test_sorted_chronologically(self, two_epoch_obs):
        # Dar en orden invertido
        obs_inverted = list(reversed(two_epoch_obs))
        result = organize_observations(obs_inverted)
        sorted_obs = result["sorted_observations"]
        assert len(sorted_obs) == 2
        # El primero debe tener t_min más bajo
        assert sorted_obs[0]["t_min_mjd"] < sorted_obs[1]["t_min_mjd"]

    def test_two_epochs_are_comparable(self, two_epoch_obs):
        result = organize_observations(two_epoch_obs)
        assert len(result["comparable_pairs"]) >= 1
        assert result["statistics"]["comparable_pairs"] >= 1

    def test_single_epoch_not_comparable(self):
        obs = [_make_obs("OBS-001", "spherex_dr1", 60000.0)]
        result = organize_observations(obs)
        assert result["statistics"]["comparable_pairs"] == 0
        assert result["comparable_pairs"] == []

    def test_different_bands_separate_groups(self, mixed_band_obs):
        result = organize_observations(mixed_band_obs)
        assert len(result["groups"]) == 2

    def test_comparable_pair_has_delta_days(self, two_epoch_obs):
        result = organize_observations(two_epoch_obs)
        pair = result["comparable_pairs"][0]
        assert "delta_days" in pair
        assert pair["delta_days"] is not None
        assert pair["delta_days"] == pytest.approx(180.0, abs=1.0)

    def test_dr1_qr3_no_warning(self, mixed_collection_obs):
        """DR1 + QR3 son compatibles; no deben generar advertencias de calibración."""
        result = organize_observations(mixed_collection_obs)
        # No debe haber advertencia de incompatibilidad QR2
        for w in result["warnings"]:
            assert "QR1" not in w and "QR2" not in w

    def test_qr2_generates_warning(self, incompatible_qr2_obs):
        """Mezclar QR2 con DR1 debe generar una advertencia."""
        result = organize_observations(incompatible_qr2_obs)
        warnings_text = " ".join(result["warnings"])
        assert "QR2" in warnings_text or "calibración" in warnings_text.lower()

    def test_statistics_are_correct(self, two_epoch_obs):
        result = organize_observations(two_epoch_obs)
        stats = result["statistics"]
        assert stats["total"] == 2
        assert "collections_present" in stats
        assert "spherex_dr1" in stats["collections_present"]

    def test_no_date_observations_go_last(self):
        """Observaciones sin fecha deben aparecer al final del orden."""
        obs_with_date = _make_obs("OBS-DATE", "spherex_dr1", 60000.0)
        obs_no_date = _make_obs("OBS-NODATE", "spherex_dr1", None)
        result = organize_observations([obs_no_date, obs_with_date])
        sorted_list = result["sorted_observations"]
        # El que tiene fecha debe ir primero
        assert sorted_list[0]["id"] == "OBS-DATE"

    def test_comparable_pair_structure(self, two_epoch_obs):
        result = organize_observations(two_epoch_obs)
        pair = result["comparable_pairs"][0]
        for key in ("band_label", "collection_group", "observation_1",
                    "observation_2", "delta_days"):
            assert key in pair, f"Falta '{key}' en comparable_pair"
        assert pair["observation_1"]["id"] != pair["observation_2"]["id"]



def test_candidate_groups_do_not_round_timestamps():
    result = organize_observations([_make_obs('a','spherex_dr1',60000.0),
                                    _make_obs('b','spherex_dr1',60000.4)])
    assert result['comparable_pairs'][0]['delta_days'] == pytest.approx(.4)
    assert any('no comparabilidad científica' in w for w in result['warnings'])


def test_pair_limit_reports_truncation_and_deduplicates_timestamps():
    items=[_make_obs(str(i),'spherex_dr1',60000.0+i) for i in range(200)]
    items.append(_make_obs('0','spherex_dr1',60000.0))
    result=organize_observations(items,max_pairs=10)
    assert len(result['comparable_pairs'])==10
    assert result['statistics']['candidate_pairs_total']==19900
    assert result['statistics']['candidate_pairs_truncated'] is True
    assert any('truncated' in w for w in result['warnings'])


def test_product_identity_repeated_times_and_empty():
    first=_make_obs('a','spherex_dr1',60000.0)
    second=_make_obs('b','spherex_dr1',60000.0)
    third=_make_obs('c','spherex_dr1',60001.0)
    result=organize_observations([first, second, third, first],max_pairs=2)
    assert result['statistics']['candidate_pairs_total']==3
    assert result['statistics']['candidate_pairs_truncated'] is True
    assert result['comparable_pairs'][0]['delta_days']==0
    single=organize_observations([first, first])['statistics']
    assert single['candidate_pairs_total']==0 and single['candidate_pairs_truncated'] is False
    empty=organize_observations([])['statistics']
    assert empty['candidate_pairs_total']==0 and empty['candidate_pairs_truncated'] is False


def test_same_collection_and_url_deduplicates_distinct_internal_ids():
    first = _make_obs('first', 'spherex_dr1', 60000.0)
    duplicate = _make_obs('other-id', 'spherex_dr1', 60001.0)
    duplicate.access_url = first.access_url
    result = organize_observations([first, duplicate])
    assert result['statistics']['candidate_pairs_total'] == 0
    assert result['statistics']['candidate_pairs_truncated'] is False


def test_identity_without_url_uses_collection_obsid_and_detector():
    first = _make_obs('same', 'spherex_dr1', 60000.0)
    duplicate = _make_obs('same', 'spherex_dr1', 60001.0)
    other = _make_obs('same', 'spherex_dr1', 60000.0)
    for record in (first, duplicate, other):
        record.access_url = ''
        record.detector = 'SPHEREx-D1'
    other.detector = 'SPHEREx-D2'
    result = organize_observations([first, duplicate, other])
    assert result['statistics']['candidate_pairs_total'] == 1
    assert result['comparable_pairs'][0]['delta_days'] == 0


def test_unknown_identity_is_retained_with_warning():
    first = _make_obs('same', 'spherex_dr1', 60000.0)
    second = _make_obs('same', 'spherex_dr1', 60000.0)
    first.access_url = second.access_url = ''
    result = organize_observations([first, second])
    assert result['statistics']['candidate_pairs_total'] == 1
    assert result['statistics']['candidate_pairs_truncated'] is False
    assert any('identity incomplete' in warning for warning in result['warnings'])
