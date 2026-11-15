import hashlib
import numpy as np
import pytest
from astropy.io import fits
from astropy.wcs import WCS
from fastapi.testclient import TestClient
from app.main import app
from app.services import real_data_demo
from app.routers import real_data_demo as demo_router


@pytest.fixture
def configured(tmp_path, monkeypatch):
    monkeypatch.setenv('SPHEREX_REAL_DATA_DIR', str(tmp_path))
    entries = {}
    w = WCS(naxis=2); w.wcs.crpix = [3, 3]; w.wcs.cdelt = [-.01, .01]
    w.wcs.crval = [10, 0]; w.wcs.ctype = ['RA---TAN', 'DEC--TAN']
    for i in range(2):
        filename = f'synthetic{i}.fits'; path = tmp_path / filename
        header = w.to_header(); header['BUNIT'] = 'MJy/sr'
        fits.HDUList([fits.PrimaryHDU(), fits.ImageHDU(np.ones((5, 5)), header=header, name='IMAGE'),
                      fits.ImageHDU(np.zeros((5, 5), dtype='int32'), name='FLAGS'),
                      fits.ImageHDU(np.ones((5, 5)), name='VARIANCE')]).writeto(path)
        entries[f'obs{i}'] = {'filename': filename, 'size_bytes': path.stat().st_size,
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'collection': 'spherex_dr1',
            'mjd': 60000 + i * 2, 'ra': 10, 'dec': 0, 'url': 'https://irsa.ipac.caltech.edu/example'}
    monkeypatch.setattr(real_data_demo, 'DATA', entries)
    monkeypatch.setattr(demo_router, 'DATA', entries)
    return tmp_path, entries


def test_hash_size_absent_and_truncated(configured):
    root, entries = configured
    assert real_data_demo.verified_path('obs0') is not None
    path = root / entries['obs0']['filename']
    data = path.read_bytes()
    path.write_bytes(data[:-1])
    assert real_data_demo.verified_path('obs0') is None
    path.write_bytes(bytes([data[0] ^ 1]) + data[1:])
    assert real_data_demo.verified_path('obs0') is None
    path.unlink()
    assert real_data_demo.verified_path('obs0') is None
    assert real_data_demo.verified_path('missing') is None


def test_demo_http_integration(configured):
    client = TestClient(app)
    response = client.get('/api/real-data-demo')
    assert response.status_code == 200
    payload = response.json()
    assert len(payload['observations']) == 2 and payload['unavailable'] == []
    assert payload['observations'][0]['integrity'] == 'sha256_verified'
    assert {'IMAGE', 'FLAGS', 'VARIANCE'} <= {h['name'] for h in payload['observations'][0]['extensions']}
    assert str(configured[0]) not in response.text
    epochs = client.get('/api/epochs', params={'ra':10,'dec':0,'radius_arcsec':60}).json()
    assert epochs['provenance'] == 'irsa_verified_local' and len(epochs['epochs']) == 2
    preview = client.get('/api/preview/obs0')
    assert preview.status_code == 200 and preview.headers['x-provenance'] == 'irsa_verified_local'
    pair = {'observation_1':'obs0','observation_2':'obs1'}
    assert client.post('/api/comparability', json=pair).status_code == 200
    scientific = client.post('/api/scientific-validation', json=pair)
    assert scientific.status_code == 200 and scientific.json()['status'] == 'REVIEW_REQUIRED'


def test_invalid_fits_with_matching_digest_is_unavailable(configured):
    root, entries = configured
    path = root / entries['obs0']['filename']
    path.write_bytes(b'not a FITS file')
    entries['obs0']['size_bytes'] = path.stat().st_size
    entries['obs0']['sha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
    response = TestClient(app).get('/api/real-data-demo')
    assert response.status_code == 200
    assert response.json()['unavailable'] == ['obs0']
