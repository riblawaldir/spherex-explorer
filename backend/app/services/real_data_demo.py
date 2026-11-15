"""Allowlisted IRSA cutouts; files remain external and are verified on access."""
import hashlib
import os
from pathlib import Path

from astropy.io import fits
from app.science.fits_inspection import inspect_fits, select_image_hdu
from app.science.spherex_data.search import ObservationRecord

DATA = {
    '2025W21_1B_0582_3': {
        'filename': 'dr1_2025W21_1B_0582_3_D1_cutout_0p1deg.fits',
        'sha256': 'dbcbf07925b641131638c87b8a5efb7cf0f3db839f61849df180cf206799167b',
        'size_bytes': 4000320,
        'collection': 'spherex_dr1', 'mjd': 60817.085556817,
        'ra': 127.69456372, 'dec': -39.17832613,
        'url': 'https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/2025W21_1B/l2b-v27-2026-199/1/level2_2025W21_1B_0582_3D1_spx_l2b-v27-2026-199.fits',
    },
    '2026W21_1A_0480_1': {
        'filename': 'qr3_2026W21_1A_0480_1_D1_cutout_0p1deg_complete.fits',
        'sha256': '0c7812ba2ddc90faa09a6cd60013929408f3ae44bb1a449f96382e285f51663f',
        'size_bytes': 4000320,
        'collection': 'spherex_qr3', 'mjd': 61181.143987326,
        'ra': 127.69370653, 'dec': -39.17704503,
        'url': 'https://irsa.ipac.caltech.edu/ibe/data/spherex/qr3/level2/2026W21_1A/l2b-v27-2026-268/1/level2_2026W21_1A_0480_1D1_spx_l2b-v27-2026-268.fits',
    },
}
PROVENANCE = 'irsa_verified_local'


def verified_path(obs_id):
    root = os.environ.get('SPHEREX_REAL_DATA_DIR')
    item = DATA.get(obs_id)
    if not root or item is None:
        return None
    root_path = Path(root).resolve()
    path = (root_path / item['filename']).resolve()
    if path.parent != root_path or not path.is_file() or path.stat().st_size != item['size_bytes']:
        return None
    with path.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    return path if digest == item['sha256'] else None


def record(obs_id):
    path = verified_path(obs_id)
    if path is None:
        return None
    item = DATA[obs_id]
    return ObservationRecord(obs_id, item['collection'], item['url'], ra=item['ra'], dec=item['dec'],
        t_min_mjd=item['mjd'], em_min_m=7.455e-7, em_max_m=1.1167e-6,
        band_label='SPHEREx-D1', detector='D1', fits_path=str(path))


def describe(obs_id):
    path = verified_path(obs_id)
    if path is None:
        return None
    item = DATA[obs_id]
    with fits.open(path, memmap=False, checksum=True) as hdus:
        hdus.verify('exception')
        for hdu in hdus:
            _ = hdu.data
        header = hdus['IMAGE'].header
        date = header.get('DATE-OBS')
    inspection = inspect_fits(path)
    image_index = select_image_hdu(inspection)
    return {'obs_id': obs_id, 'collection': item['collection'], 'detector': 'D1',
            'date_obs': date, 'size_bytes': path.stat().st_size, 'sha256': item['sha256'],
            'source_url': item['url'], 'source_description': 'IRSA original full image; local file is a cutout',
            'provenance': PROVENANCE, 'integrity': 'sha256_verified', 'image_hdu': image_index,
            'extensions': [{'index': h.index, 'name': h.name, 'shape': h.shape, 'dtype': h.dtype,
                            'bunit': h.bunit, 'finite_percent': h.valid_percent, 'wcs_status': h.wcs_status}
                           for h in inspection.hdus]}
