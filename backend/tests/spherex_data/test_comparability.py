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


@pytest.mark.parametrize('scenario', ['no_image','bad_wcs','no_overlap','spectral','epoch','collection'])
def test_reject_known_incompatibilities(tmp_path,scenario):
    a,b=tmp_path/'a.fits',tmp_path/'b.fits'
    image(a); image(b,ra=100 if scenario=='no_overlap' else 10,name='OTHER' if scenario=='no_image' else 'IMAGE',wcs=scenario!='bad_wcs')
    first=record(a,'a',60000)
    second=record(b,'b',60000 if scenario=='epoch' else 60002,lo=3e-6 if scenario=='spectral' else 1e-6,hi=4e-6 if scenario=='spectral' else 2e-6,collection='spherex_qr2' if scenario=='collection' else 'spherex_qr3')
    assert assess_candidate_pair(first,second)['status']=='NO COMPARABLE'


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
