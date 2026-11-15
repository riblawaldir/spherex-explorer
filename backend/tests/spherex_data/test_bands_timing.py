import numpy as np
import pytest

from app.science.spherex_data.bands import BANDS, classify_band, classify_wavelength, get_band_metadata
from app.science.spherex_data.search import ObservationRecord, _finite_float
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


@pytest.mark.parametrize('value', [True, False, np.bool_(True), np.bool_(False)])
def test_finite_float_rejects_boolean_values(value):
    assert _finite_float(value) is None


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


def test_explicit_bandpass_and_wide_intervals():
    from astropy.table import Table
    from app.science.spherex_data.search import normalize_sia2_row
    table = Table(rows=[('obs','spherex_dr1','SPHEREx','SPHEREx-D1',2.5e-6,3e-6)],
                  names=['obs_id','obs_collection','instrument_name','energy_bandpassname','em_min','em_max'])
    result = normalize_sia2_row(table[0], table.colnames)
    assert result.detector == 'SPHEREx-D1'
    assert result.em_min_m == 2.5e-6
    assert 'spectral_metadata_warning' in result.extra
    assert classify_band(.8e-6, 4.9e-6) is None


def test_scientific_spectral_warning_prevents_false_invalid():
    from app.science.spherex_data.scientific_validation import validate_scientific_pair
    base = {'observations': [{'id':'a','em_min_m':1e-6,'em_max_m':2e-6,'spectral_metadata_warning':'conflict'},
                             {'id':'b','em_min_m':3e-6,'em_max_m':4e-6}]}
    assert validate_scientific_pair(base)['status'] == 'REVIEW_REQUIRED'
    del base['observations'][0]['spectral_metadata_warning']
    assert validate_scientific_pair(base)['status'] == 'INVALID'


def test_detector_sources_unknown_conflict_and_missing_limits():
    from astropy.table import Table
    from app.science.spherex_data.search import normalize_sia2_row
    cols=['obs_id','obs_collection','instrument_name','energy_bandpassname','em_min','em_max']
    rows=[('a','spherex_dr1','SPHEREx-D1','unknown',None,None),
          ('b','spherex_dr1','SPHEREx-D1','SPHEREx-D4',2.5e-6,3e-6)]
    table=Table(rows=rows,names=cols)
    first=normalize_sia2_row(table[0],cols); second=normalize_sia2_row(table[1],cols)
    assert first.detector == 'SPHEREx-D1'
    assert second.detector is None and 'Conflicting' in second.to_dict()['spectral_metadata_warning']
    assert second.em_min_m == 2.5e-6
