from urllib.parse import parse_qs, urlparse
from unittest.mock import patch

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
