from unittest.mock import Mock, call

import numpy as np
import pytest
from astropy.io import fits
from astropy.wcs import WCS
from fastapi.testclient import TestClient
from app.main import app
from app.routers import comparability
from app.routers import scientific_validation as router
from app.science.spherex_data.search import ObservationRecord
from app.science.spherex_data.scientific_validation import (
    VALID, INVALID, REVIEW_REQUIRED, REQUIRED_CRITERIA, criterion, aggregate_criteria, validate_scientific_pair,
)


def sample():
    return {'observations': [{'id': 'a', 't_min_mjd': 60000, 'em_min_m': 1e-6, 'em_max_m': 2e-6, 'detector': 'D1'},
                             {'id': 'b', 't_min_mjd': 60001, 'em_min_m': 1e-6, 'em_max_m': 2e-6, 'detector': 'D1'}],
            'spatial': {'wcs_valid': [True, True], 'geometric_coverage_percent': 55., 'finite_coverage_percent': 50.},
            'spectral': {'compatible': None, 'wcs_wave_present': [True, True], 'reason': 'local response unknown'},
            'temporal': {'delta_days': 1., 'different_epoch': True},
            'collection': {'compatible': True},
            'quality': {'flags_present': [True, True], 'variance': [{'present': True}, {'present': True}]}}


def test_scientific_endpoint_with_real_pair_evaluation(tmp_path, monkeypatch):
    wcs = WCS(naxis=2)
    wcs.wcs.crpix = [3, 3]
    wcs.wcs.cdelt = [-0.01, 0.01]
    wcs.wcs.crval = [10, 0]
    wcs.wcs.ctype = ['RA---TAN', 'DEC--TAN']
    records = {}
    paths = {}
    for index in range(2):
        obs_id = f'synthetic-{index}'
        path = tmp_path / f'{obs_id}.fits'
        header = wcs.to_header()
        header['BUNIT'] = 'MJy/sr'
        fits.HDUList([
            fits.PrimaryHDU(),
            fits.ImageHDU(np.ones((5, 5)), header=header, name='IMAGE'),
        ]).writeto(path)
        paths[obs_id] = path
        records[obs_id] = ObservationRecord(
            obs_id, 'spherex_dr1', 'https://example.test/source',
            t_min_mjd=60000 + index * 2, em_min_m=1e-6, em_max_m=2e-6,
            detector='D1', fits_path=str(path),
        )

    catalog = Mock()
    catalog.resolve_observation.side_effect = records.get
    catalog.resolve_preview_fits.side_effect = paths.get
    monkeypatch.setattr(comparability, 'get_catalog_service', lambda: catalog)

    response = TestClient(app).post('/api/scientific-validation', json={
        'observation_1': 'synthetic-0', 'observation_2': 'synthetic-1',
    })
    assert response.status_code == 200
    result = response.json()
    assert result['status'] == REVIEW_REQUIRED
    assert len(result['criteria']) == 8
    assert {item['name'] for item in result['criteria']} == REQUIRED_CRITERIA
    assert all(item['status'] != VALID for item in result['criteria'])
    assert 'fits_path' not in response.text
    assert 'access_url' not in response.text
    assert str(tmp_path) not in response.text
    assert catalog.resolve_observation.call_args_list == [call('synthetic-0'), call('synthetic-1')]
    assert catalog.resolve_preview_fits.call_args_list == [call('synthetic-0'), call('synthetic-1')]


def test_aggregation_requires_every_criterion():
    complete = [criterion(name, VALID, None, 'condition', 'evidence', 'reason', [])
                for name in REQUIRED_CRITERIA]
    assert aggregate_criteria(complete) == VALID
    assert aggregate_criteria(complete[:-1]) == REVIEW_REQUIRED
    assert aggregate_criteria(complete + [complete[0]]) == REVIEW_REQUIRED
    assert aggregate_criteria([]) == REVIEW_REQUIRED
    assert aggregate_criteria([None]) == REVIEW_REQUIRED
    assert aggregate_criteria([{'status': VALID}]) == REVIEW_REQUIRED
    changed = [dict(c) for c in complete]
    changed[0]['status'] = 'unknown'
    assert aggregate_criteria(changed) == REVIEW_REQUIRED
    changed[0]['status'] = INVALID
    assert aggregate_criteria(changed) == INVALID
    changed[0]['status'] = REVIEW_REQUIRED
    assert aggregate_criteria(changed) == REVIEW_REQUIRED


def test_uncalibrated_pair_requires_review():
    result = validate_scientific_pair(sample())
    assert result['status'] == REVIEW_REQUIRED
    assert len(result['criteria']) == 8
    assert all({'name','status','observed','expected','evidence','reason','limitations','source'} <= set(c) for c in result['criteria'])
    assert next(c for c in result['criteria'] if c['name'] == 'spectral')['status'] == REVIEW_REQUIRED


def test_disjoint_catalog_ranges_are_invalid():
    data = sample(); data['spectral']['compatible'] = False
    data['observations'][1].update(em_min_m=3e-6, em_max_m=4e-6)
    result = validate_scientific_pair(data)
    assert result['status'] == INVALID
    assert next(c for c in result['criteria'] if c['name'] == 'spectral')['status'] == INVALID


@pytest.mark.parametrize('lo,hi', [
    (float('nan'), 4e-6), (3e-6, float('nan')),
    (float('inf'), 4e-6), (3e-6, float('inf')),
    (float('-inf'), 4e-6), (3e-6, float('-inf')),
    (0, 4e-6), (4e-6, 3e-6), (3e-6, 3e-6),
    (True, 4e-6), (3e-6, False),
    (None, 4e-6), (3e-6, None), ('3e-6', 4e-6), (3e-6, '4e-6'),
])
def test_invalid_catalog_intervals_require_spectral_review(lo, hi):
    data = sample()
    data['spectral']['compatible'] = False
    data['observations'][1].update(em_min_m=lo, em_max_m=hi)
    result = validate_scientific_pair(data)
    assert result['status'] == REVIEW_REQUIRED
    assert next(c for c in result['criteria'] if c['name'] == 'spectral')['status'] == REVIEW_REQUIRED


@pytest.mark.parametrize('missing_key', ['em_min_m', 'em_max_m'])
def test_absent_catalog_interval_limit_requires_spectral_review(missing_key):
    data = sample()
    del data['observations'][1][missing_key]
    result = validate_scientific_pair(data)
    assert next(c for c in result['criteria'] if c['name'] == 'spectral')['status'] == REVIEW_REQUIRED
    assert result['status'] == REVIEW_REQUIRED


@pytest.mark.parametrize('field', ['expected', 'evidence', 'reason', 'source'])
@pytest.mark.parametrize('value', ['', '   '])
def test_aggregation_rejects_empty_required_text(field, value):
    complete = [criterion(name, VALID, None, 'condition', 'evidence', 'reason', [])
                for name in REQUIRED_CRITERIA]
    complete[0][field] = value
    assert aggregate_criteria(complete) == REVIEW_REQUIRED


@pytest.mark.parametrize('limitations', [None, 'not a list', {}, [123], ['ok', None]])
def test_aggregation_rejects_invalid_limitations(limitations):
    complete = [criterion(name, VALID, None, 'condition', 'evidence', 'reason', [])
                for name in REQUIRED_CRITERIA]
    complete[0]['limitations'] = limitations
    assert aggregate_criteria(complete) == REVIEW_REQUIRED


@pytest.mark.parametrize('field', ['name', 'status', 'observed', 'expected', 'evidence', 'reason', 'limitations', 'source'])
def test_aggregation_rejects_incomplete_criterion(field):
    complete = [criterion(name, VALID, None, 'condition', 'evidence', 'reason', [])
                for name in REQUIRED_CRITERIA]
    del complete[0][field]
    assert aggregate_criteria(complete) == REVIEW_REQUIRED


def test_missing_spatial_quality_and_times_are_not_positive():
    data = sample(); data['spatial'] = {}; data['quality'] = None; data['temporal'] = {}
    result = validate_scientific_pair(data)
    assert result['status'] == REVIEW_REQUIRED
    assert all(c['status'] != VALID for c in result['criteria'])


def test_api_uses_existing_pair_flow_and_rejects_paths(monkeypatch):
    monkeypatch.setattr(router, 'evaluate_pair', lambda request: sample())
    client = TestClient(app)
    response = client.post('/api/scientific-validation', json={'observation_1':'a', 'observation_2':'b'})
    assert response.status_code == 200
    assert response.json()['status'] == REVIEW_REQUIRED
    assert client.post('/api/scientific-validation', json={'observation_1':'a', 'observation_2':'b', 'fits_path':'C:/x'}).status_code == 422


def test_unsubstantiated_spectral_incompatibility_needs_review():
    data = sample(); data['spectral']['compatible'] = False
    assert validate_scientific_pair(data)['status'] == REVIEW_REQUIRED
    data['observations'][1]['em_min_m'] = None
    assert validate_scientific_pair(data)['status'] == REVIEW_REQUIRED


def test_pending_evidence_and_sources():
    data = sample(); data['spatial'] = {'wcs_valid': [True, True], 'geometric_coverage_percent': None, 'finite_coverage_percent': 0}
    data['temporal'] = {}; data['observations'][1]['t_min_mjd'] = None
    data['collection'] = {'compatible': None}
    result = validate_scientific_pair(data)
    assert all(c['status'] == REVIEW_REQUIRED for c in result['criteria'])
    assert all(c['source'] != c['evidence'] for c in result['criteria'])
    assert next(c for c in result['criteria'] if c['name'] == 'masks')['observed'] == [True, True]
    assert next(c for c in result['criteria'] if c['name'] == 'uncertainty')['observed'][0]['present']


def test_api_inherits_errors_and_hides_paths(monkeypatch):
    from fastapi import HTTPException
    client = TestClient(app)
    for code in (404, 409, 422):
        def fail(_request, status=code):
            raise HTTPException(status_code=status, detail='unavailable')
        monkeypatch.setattr(router, 'evaluate_pair', fail)
        response = client.post('/api/scientific-validation', json={'observation_1':'a', 'observation_2':'b'})
        assert response.status_code == code
    monkeypatch.setattr(router, 'evaluate_pair', lambda request: sample())
    response = client.post('/api/scientific-validation', json={'observation_1':'a', 'observation_2':'b'})
    assert 'fits_path' not in response.text
    assert 'C:/' not in response.text
