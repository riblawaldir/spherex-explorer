from pathlib import Path
from unittest.mock import Mock

import numpy as np
import pytest
from astropy.io import fits
from astropy.wcs import WCS
from fastapi.testclient import TestClient

from app.main import app
from app.routers import comparability
from app.science.spherex_data.search import ObservationRecord
from app.services.catalog import CatalogService


@pytest.fixture
def setup_pair(tmp_path, monkeypatch):
    w = WCS(naxis=2)
    w.wcs.crpix = [3, 3]; w.wcs.cdelt = [-.01, .01]
    w.wcs.crval = [10, 0]; w.wcs.ctype = ['RA---TAN', 'DEC--TAN']
    records = []
    for index in range(2):
        path = tmp_path / f'obs{index}.fits'
        h = w.to_header(); h['BUNIT'] = 'MJy/sr'
        fits.HDUList([fits.PrimaryHDU(), fits.ImageHDU(np.ones((5,5)), header=h, name='IMAGE')]).writeto(path)
        records.append(ObservationRecord(f'obs{index}', 'spherex_dr1', '', t_min_mjd=60000+index*2, em_min_m=1e-6, em_max_m=2e-6, fits_path=str(path)))
    catalog = Mock()
    catalog.resolve_observation.side_effect = lambda name: next((r for r in records if r.obs_id == name), None)
    catalog.resolve_preview_fits.side_effect = lambda name: Path(next(r.fits_path for r in records if r.obs_id == name))
    monkeypatch.setattr(comparability, 'get_catalog_service', lambda: catalog)
    return TestClient(app), catalog, records


def call(client, **extra):
    return client.post('/api/comparability', json={'observation_1':'obs0', 'observation_2':'obs1', **extra})


def test_pair_review_and_no_paths(setup_pair):
    client, catalog, _ = setup_pair
    response = call(client)
    assert response.status_code == 200
    data = response.json()
    assert data['status'] == 'REQUIERE REVISIÓN'
    assert data['spatial']['geometric_coverage_percent'] > 0
    assert data['quality']['science_quality_evaluated'] is False
    assert all('fits_path' not in r and 'access_url' not in r for r in data['observations'])
    assert catalog.resolve_observation.call_count == 2
    assert catalog.resolve_preview_fits.call_count == 2


def test_missing_observation(setup_pair):
    client, _, _ = setup_pair
    assert client.post('/api/comparability', json={'observation_1':'missing','observation_2':'obs1'}).status_code == 404


def test_missing_fits(setup_pair):
    client, catalog, _ = setup_pair
    catalog.resolve_preview_fits.return_value = None
    catalog.resolve_preview_fits.side_effect = None
    response = call(client)
    assert response.status_code == 404 and 'FITS unavailable' in response.json()['detail']


def test_invalid_fits_and_wcs(setup_pair, monkeypatch):
    client, _, _ = setup_pair
    monkeypatch.setattr(comparability, 'inspect_fits', Mock(side_effect=OSError('private path')))
    response = call(client)
    assert response.status_code == 422 and 'private path' not in response.text


def test_disallow_paths_and_invalid_ids(setup_pair):
    client, _, _ = setup_pair
    assert call(client, fits_path='C:/secret').status_code == 422
    assert client.post('/api/comparability', json={'observation_1':'../secret','observation_2':'obs1'}).status_code == 422


def test_no_overlap(setup_pair):
    client, _, records = setup_pair
    with fits.open(records[1].fits_path, mode='update') as hdus:
        hdus[1].header['CRVAL1'] = 100
    response = call(client)
    assert response.status_code == 200
    assert response.json()['status'] == 'NO COMPARABLE'


def test_catalog_retains_irsa_record_and_rejects_ambiguous(tmp_path):
    catalog = CatalogService(samples_dir=tmp_path, raw_dir=tmp_path)
    rec = ObservationRecord('id','spherex_dr1','https://example.test/1',detector='D1')
    catalog._epochs_from_irsa({'_records':[rec]}, band=None)
    assert catalog.resolve_observation('id') is rec
    rec2 = ObservationRecord('id','spherex_dr1','https://example.test/2',detector='D4')
    catalog._epochs_from_irsa({'_records':[rec2]}, band=None)
    with pytest.raises(ValueError): catalog.resolve_observation('id')


def test_route_direct_review_and_collection(setup_pair):
    _, catalog, _ = setup_pair
    result = comparability.evaluate_pair(comparability.PairRequest(observation_1='obs0', observation_2='obs1'))
    assert result['status'] == 'REQUIERE REVISIÓN'
    assert result['spatial']['finite_coverage_percent'] > 0
    assert catalog.resolve_observation.call_count == 2
    assert all('fits_path' not in item for item in result['observations'])


def test_route_direct_invalid_wcs(setup_pair):
    _, _, records = setup_pair
    from fastapi import HTTPException
    with fits.open(records[0].fits_path, mode='update') as hdus:
        del hdus[1].header['CTYPE1']
    with pytest.raises(HTTPException) as exc:
        comparability.evaluate_pair(comparability.PairRequest(observation_1='obs0', observation_2='obs1'))
    assert exc.value.status_code == 422
    assert 'WCS' in exc.value.detail
