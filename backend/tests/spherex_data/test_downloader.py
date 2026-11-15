from urllib.parse import parse_qs, urlparse
from unittest.mock import patch
import pytest

from app.science.spherex_data.downloader import (
    _build_cutout_url,
    download_cutout,
    download_observation,
)
from app.science.spherex_data.search import ObservationRecord


def test_cutout_url_replaces_existing_cutout_parameters():
    url = _build_cutout_url(
        "https://irsa.ipac.caltech.edu/ibe/data/spherex/file.fits?center=1,2&size=3&foo=bar",
        10.5,
        -20.25,
        0.05,
    )

    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    assert params == {"center": ["10.5,-20.25"], "size": ["0.05"], "foo": ["bar"]}


def test_download_rejects_lookalike_irsa_host(tmp_path):
    result = download_cutout(
        "https://irsa.ipac.caltech.edu.attacker.example/ibe/data/spherex/file.fits",
        10,
        20,
        0.05,
        output_dir=tmp_path,
    )
    assert result is None


def test_download_observation_accepts_requested_cutout_center(tmp_path):
    record = ObservationRecord(
        obs_id="test",
        collection="spherex_dr1",
        access_url="https://irsa.ipac.caltech.edu/ibe/data/spherex/file.fits",
        ra=100.0,
        dec=-10.0,
    )
    with patch("app.science.spherex_data.downloader.download_cutout", return_value=None) as cutout:
        download_observation(
            record,
            output_dir=tmp_path,
            center_ra=101.25,
            center_dec=-11.5,
        )

    assert cutout.call_args.kwargs["ra"] == 101.25
    assert cutout.call_args.kwargs["dec"] == -11.5


def test_truncated_hdus_rejected_and_valid_destination_preserved(tmp_path, monkeypatch):
    import numpy as np
    from astropy.io import fits
    from unittest.mock import Mock
    from app.science.spherex_data import downloader
    source = tmp_path / 'source.fits'
    fits.HDUList([fits.PrimaryHDU(), fits.ImageHDU(np.ones((100, 100)), name='IMAGE'),
                  fits.BinTableHDU.from_columns([fits.Column(name='X', format='100D', array=np.ones((20,100)))], name='TABLE')]).writeto(source)
    original = source.read_bytes()
    for cut in (1, 2880, 15000):
        broken = tmp_path / f'broken-{cut}.fits'
        broken.write_bytes(original[:-cut])
        assert not downloader._is_valid_fits(broken)
    url = 'https://irsa.ipac.caltech.edu/ibe/data/spherex/file.fits'
    dest = tmp_path / downloader._url_to_filename(url, 10, 20, .05)
    dest.write_bytes(original)
    response = Mock(); response.iter_content.return_value = [original[:-3000]]
    monkeypatch.setattr(downloader.requests, 'get', lambda *a, **k: response)
    monkeypatch.setattr(downloader, 'MAX_RETRIES', 1)
    assert downloader.download_cutout(url, 10, 20, .05, output_dir=tmp_path, skip_if_exists=False) is None
    assert dest.read_bytes() == original
    assert list(tmp_path.glob('.spherex-*.tmp')) == []


def test_partial_cache_is_not_accepted(tmp_path, monkeypatch):
    import numpy as np
    from astropy.io import fits
    from unittest.mock import Mock
    from app.science.spherex_data import downloader
    url = 'https://irsa.ipac.caltech.edu/ibe/data/spherex/file.fits'
    complete = tmp_path/'complete.fits'
    fits.HDUList([fits.PrimaryHDU(), fits.ImageHDU(np.ones((30,30)), name='IMAGE')]).writeto(complete)
    data = complete.read_bytes()
    dest = tmp_path / downloader._url_to_filename(url, 10, 20, .05)
    dest.write_bytes(data[:2880 + 100])
    response = Mock(); response.iter_content.return_value = [data]
    request = Mock(return_value=response)
    monkeypatch.setattr(downloader.requests, 'get', request)
    assert downloader.download_cutout(url, 10, 20, .05, output_dir=tmp_path) == dest
    assert request.call_count == 1 and dest.read_bytes() == data


def test_truncated_header_is_rejected(tmp_path):
    from app.science.spherex_data.downloader import _is_valid_fits
    path = tmp_path/'header.fits'
    path.write_bytes(b'SIMPLE  =                    T'.ljust(80, b' '))
    assert not _is_valid_fits(path)


@pytest.mark.parametrize('failure', ['stream','replace'])
def test_response_closed_and_temporary_removed_on_failure(tmp_path, monkeypatch, failure):
    import numpy as np
    from astropy.io import fits
    from unittest.mock import Mock
    from app.science.spherex_data import downloader
    url='https://irsa.ipac.caltech.edu/ibe/data/spherex/file.fits'
    initial=tmp_path/'source.fits'; fits.PrimaryHDU(np.ones((8,8))).writeto(initial)
    data=initial.read_bytes(); dest=tmp_path/downloader._url_to_filename(url,10,20,.05); dest.write_bytes(data)
    response=Mock()
    if failure == 'stream':
        def chunks(*args,**kwargs):
            yield data[:100]
            raise OSError('interrupted')
        response.iter_content.side_effect=chunks
    else:
        response.iter_content.return_value=[data]
        monkeypatch.setattr(downloader.os,'replace',Mock(side_effect=OSError('replace failed')))
    monkeypatch.setattr(downloader.requests,'get',lambda *a,**k: response)
    monkeypatch.setattr(downloader,'MAX_RETRIES',1)
    assert downloader.download_cutout(url,10,20,.05,output_dir=tmp_path,skip_if_exists=False) is None
    response.close.assert_called_once()
    assert dest.read_bytes()==data and list(tmp_path.glob('.spherex-*.tmp'))==[]


def test_variable_table_compressed_image_and_checksum(tmp_path):
    import numpy as np
    from astropy.io import fits
    from app.science.spherex_data.downloader import _is_valid_fits
    variable = fits.Column(name='DATA', format='PD()', array=[np.array([1.,2.]), np.array([3.])])
    path=tmp_path/'special.fits'
    fits.HDUList([fits.PrimaryHDU(), fits.CompImageHDU(np.ones((20,20)), name='IMAGE'),
                  fits.BinTableHDU.from_columns([variable], name='TABLE')]).writeto(path, checksum=True)
    assert _is_valid_fits(path)
    content=path.read_bytes(); broken=tmp_path/'truncated.fits'; broken.write_bytes(content[:-2880])
    assert not _is_valid_fits(broken)
    with fits.open(path) as hdus:
        offset=hdus[1].fileinfo()['datLoc']
    changed=bytearray(content); changed[offset] ^= 1
    bad=tmp_path/'checksum.fits'; bad.write_bytes(changed)
    assert not _is_valid_fits(bad)


@pytest.mark.parametrize('secondary', ['close','unlink'])
def test_secondary_cleanup_errors_keep_contract(tmp_path, monkeypatch, caplog, secondary):
    from unittest.mock import Mock
    from pathlib import Path
    from app.science.spherex_data import downloader
    url='https://irsa.ipac.caltech.edu/ibe/data/spherex/file.fits'
    response=Mock(); response.iter_content.side_effect=OSError('stream failure')
    if secondary=='close': response.close.side_effect=OSError('close failure')
    if secondary=='unlink':
        original=Path.unlink
        def guarded(self,*args,**kwargs):
            if self.name.startswith('.spherex-'): raise OSError('unlink failure')
            return original(self,*args,**kwargs)
        monkeypatch.setattr(Path,'unlink',guarded)
    monkeypatch.setattr(downloader.requests,'get',lambda *a,**kw: response)
    monkeypatch.setattr(downloader,'MAX_RETRIES',1)
    assert downloader.download_cutout(url,10,20,.05,output_dir=tmp_path) is None
    assert 'stream failure' in caplog.text
    assert ('close failure' if secondary=='close' else 'unlink failure') in caplog.text
