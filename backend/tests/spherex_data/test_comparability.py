import numpy as np
import pytest
from astropy.io import fits
from astropy.wcs import WCS
from app.science.spherex_data.search import ObservationRecord
from app.science.spherex_data.comparability import assess_candidate_pair


def image(path, ra=10, name='IMAGE', wcs=True):
    header = WCS(naxis=2)
    header.wcs.crpix = [5, 5]
    header.wcs.cdelt = [-0.01, 0.01]
    header.wcs.crval = [ra, 0]
    header.wcs.ctype = ['RA---TAN', 'DEC--TAN']
    h = header.to_header() if wcs else fits.Header()
    h['BUNIT'] = 'MJy/sr'
    fits.HDUList([fits.PrimaryHDU(), fits.ImageHDU(np.ones((10,10)), header=h, name=name)]).writeto(path)


def record(path, obs, time, lo=1e-6, hi=2e-6, collection='spherex_dr1'):
    return ObservationRecord(obs, collection, '', t_min_mjd=time, em_min_m=lo, em_max_m=hi, fits_path=str(path))


def test_overlap_requires_spectral_and_quality_review(tmp_path):
    a,b=tmp_path/'a.fits',tmp_path/'b.fits'
    image(a); image(b)
    r=assess_candidate_pair(record(a,'a',60000),record(b,'b',60002,collection='spherex_qr3'))
    assert r['status']=='REQUIERE REVISIÓN'
    assert r['spatial']['coverage_percent'] > 0
    assert r['quality']['flags_present']==[False,False]
    assert r['spectral']['compatible'] is None


@pytest.mark.parametrize('interval,warning,status,compatible', [
    ((3e-6, 4e-6), 'Conflicting detector identifiers', 'REQUIERE REVISIÓN', None),
    ((3e-6, 4e-6), None, 'NO COMPARABLE', False),
    ((1.5e-6, 2.5e-6), None, 'REQUIERE REVISIÓN', None),
])
def test_spectral_warning_and_catalog_intervals(tmp_path, interval, warning, status, compatible):
    a, b = tmp_path/'a.fits', tmp_path/'b.fits'
    image(a); image(b)
    first = record(a, 'a', 60000)
    second = record(b, 'b', 60002, lo=interval[0], hi=interval[1])
    if warning:
        second.extra['spectral_metadata_warning'] = warning
    result = assess_candidate_pair(first, second)
    assert result['status'] == status
    assert result['spectral']['compatible'] is compatible
    if warning:
        assert 'review' in result['spectral']['reason']
        assert warning in result['warnings']
        assert result['observations'][1]['spectral_metadata_warning'] == warning


def test_spectral_warning_does_not_hide_other_incompatibilities(tmp_path):
    a, b = tmp_path/'a.fits', tmp_path/'b.fits'
    image(a); image(b, wcs=False)
    first = record(a, 'a', 60000)
    first.extra['spectral_metadata_warning'] = 'Conflicting detector identifiers'
    result = assess_candidate_pair(first, record(b, 'b', 60002, lo=3e-6, hi=4e-6))
    assert result['spectral']['compatible'] is None
    assert result['status'] == 'NO COMPARABLE'


@pytest.mark.parametrize('lo,hi', [
    (1e-6, 1e-6), (2e-6, 1e-6), (0, 1e-6), (-1e-6, 1e-6),
    (float('nan'), 1e-6), (1e-6, float('inf')), (None, 1e-6),
])
@pytest.mark.parametrize('invalid_first', [True, False])
def test_invalid_spectral_interval_requires_review(tmp_path, lo, hi, invalid_first):
    a, b = tmp_path/'a.fits', tmp_path/'b.fits'
    image(a); image(b)
    invalid = record(a, 'a', 60000, lo=lo, hi=hi)
    valid = record(b, 'b', 60002, lo=3e-6, hi=4e-6)
    result = assess_candidate_pair(*( (invalid, valid) if invalid_first else (valid, invalid) ))
    assert result['status'] == 'REQUIERE REVISIÓN'
    assert result['spectral']['compatible'] is None
    assert result['spectral']['reason'] == 'Missing or invalid catalog wavelength intervals.'


def test_degenerate_interval_does_not_hide_invalid_wcs(tmp_path):
    a, b = tmp_path/'a.fits', tmp_path/'b.fits'
    image(a); image(b, wcs=False)
    result = assess_candidate_pair(record(a, 'a', 60000, lo=1e-6, hi=1e-6),
                                   record(b, 'b', 60002, lo=3e-6, hi=4e-6))
    assert result['spectral']['compatible'] is None
    assert result['spectral']['reason'] == 'Missing or invalid catalog wavelength intervals.'
    assert result['spatial']['wcs_valid'][1] is False
    assert result['status'] == 'NO COMPARABLE'


@pytest.mark.parametrize('value', [True, False])
@pytest.mark.parametrize('limit', ['em_min_m', 'em_max_m'])
@pytest.mark.parametrize('observation', [0, 1])
def test_boolean_spectral_limits_require_review(tmp_path, value, limit, observation):
    a, b = tmp_path/'a.fits', tmp_path/'b.fits'
    image(a); image(b)
    records = [record(a, 'a', 60000, lo=1.0, hi=2.0),
               record(b, 'b', 60002, lo=3.0, hi=4.0)]
    setattr(records[observation], limit, value)
    result = assess_candidate_pair(*records)
    assert result['status'] == 'REQUIERE REVISIÓN'
    assert result['spectral']['compatible'] is None
    assert result['spectral']['reason'] == 'Missing or invalid catalog wavelength intervals.'


def test_boolean_spectral_limit_does_not_hide_invalid_wcs(tmp_path):
    a, b = tmp_path/'a.fits', tmp_path/'b.fits'
    image(a); image(b, wcs=False)
    result = assess_candidate_pair(record(a, 'a', 60000, lo=True, hi=2.0),
                                   record(b, 'b', 60002, lo=3.0, hi=4.0))
    assert result['spectral']['compatible'] is None
    assert result['spectral']['reason'] == 'Missing or invalid catalog wavelength intervals.'
    assert result['spatial']['wcs_valid'][1] is False
    assert result['status'] == 'NO COMPARABLE'


@pytest.mark.parametrize('scenario', ['no_image','bad_wcs','no_overlap','spectral','collection'])
def test_reject_known_incompatibilities(tmp_path,scenario):
    a,b=tmp_path/'a.fits',tmp_path/'b.fits'
    image(a); image(b,ra=100 if scenario=='no_overlap' else 10,name='OTHER' if scenario=='no_image' else 'IMAGE',wcs=scenario!='bad_wcs')
    first=record(a,'a',60000)
    second=record(b,'b',60000 if scenario=='epoch' else 60002,lo=3e-6 if scenario=='spectral' else 1e-6,hi=4e-6 if scenario=='spectral' else 2e-6,collection='spherex_qr2' if scenario=='collection' else 'spherex_qr3')
    assert assess_candidate_pair(first,second)['status']=='NO COMPARABLE'


@pytest.mark.parametrize('times', [(60000.49,60000.51), (60000.0,60000.4), (60000.0,60000.0)])
def test_timestamps_do_not_imply_scientific_epoch(tmp_path, times):
    a,b=tmp_path/'a.fits',tmp_path/'b.fits'
    image(a); image(b)
    result=assess_candidate_pair(record(a,'a',times[0]), record(b,'b',times[1]))
    assert result['temporal']['different_epoch'] is None
    assert result['temporal']['delta_days'] == pytest.approx(abs(times[1]-times[0]))
    assert result['status'] == 'REQUIERE REVISIÓN'


def test_unavailable_fits_requires_review(tmp_path):
    a,b=tmp_path/'a.fits',tmp_path/'b.fits'
    r=assess_candidate_pair(record(a,'a',60000),record(b,'b',60002))
    assert r['status']=='REQUIERE REVISIÓN'


def test_unknown_collection_requires_review(tmp_path):
    a,b=tmp_path/'a.fits',tmp_path/'b.fits'
    image(a); image(b)
    result=assess_candidate_pair(record(a,'a',60000,collection='unknown'), record(b,'b',60002,collection='unknown'))
    assert result['status']=='REQUIERE REVISIÓN'
    assert result['collection']['compatible'] is None
    assert result['spatial']['geometric_coverage_percent'] is not None
    assert result['spatial']['finite_coverage_percent'] == result['spatial']['coverage_percent']
    assert result['quality']['science_quality_evaluated'] is False


def test_boolean_threshold_is_invalid(tmp_path):
    with pytest.raises(ValueError):
        assess_candidate_pair(record(tmp_path/'a','a',60000),record(tmp_path/'b','b',60002),minimum_coverage_percent=True)
