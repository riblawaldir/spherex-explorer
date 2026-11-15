import pytest

from app.science.spherex_data.bands import BANDS, classify_band, classify_wavelength, get_band_metadata
from app.science.spherex_data.search import ObservationRecord
from app.science.spherex_data.timing import (
    get_timeline_metadata, mjd_to_utc, normalize_timing, parse_planning_period,
)


@pytest.mark.parametrize("band", BANDS)
def test_detector_metadata_and_midpoint_classification(band):
    meta = get_band_metadata(band.detector)
    assert meta["resolving_power"] == band.resolving_power
    midpoint = (band.wavelength_min_um + band.wavelength_max_um) / 2
    assert classify_wavelength(midpoint)["detector"] == band.detector


def test_interval_classification_and_invalid_inputs():
    assert classify_band(0.90e-6, 1.00e-6)["detector"] == "SPHEREx-D1"
    assert classify_band(None, None) is None
    assert classify_wavelength(0.1) is None
    assert classify_wavelength(float("nan")) is None
    assert classify_wavelength(1.10) is None  # overlap is deliberately ambiguous


def test_mjd_to_utc_and_validation():
    assert mjd_to_utc(51544.5) == "2000-01-01T12:00:00.000Z"
    assert mjd_to_utc(None) is None
    assert mjd_to_utc(-1) is None
    assert mjd_to_utc(float("nan")) is None


def test_planning_period_and_unknown_survey_cycle():
    assert parse_planning_period("2026W21_2A_0001_2D1") == "2026W21_2A"
    assert parse_planning_period("incomplete") is None
    timing = normalize_timing(obs_id="2026W21_2A_0001_2D1", t_min_mjd=60000,
                              t_max_mjd=60000.1, exposure_seconds=-1)
    assert timing["planning_period"] == "2026W21_2A"
    assert timing["survey_cycle"] is None
    assert timing["exposure_seconds"] is None


def test_timeline_metadata_for_record_and_fixture():
    record = ObservationRecord("2026W21_2A_0001_2D1", "spherex_dr1", "url",
                               t_min_mjd=60000, detector="SPHEREx-D1")
    result = get_timeline_metadata(record)
    assert result["detector"] == "SPHEREx-D1"
    assert result["observed_at"] == mjd_to_utc(60000)
    fixture = get_timeline_metadata({"obs_id": "stub-1", "t_mjd": 60310.125,
                                     "bandpass": "SPHEREx-B1"})
    assert fixture["observed_at"] == mjd_to_utc(60310.125)
    assert fixture["survey_cycle"] is None
