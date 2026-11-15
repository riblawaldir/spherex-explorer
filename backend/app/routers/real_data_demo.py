"""Inspection of the two configured and hash-verified IRSA cutouts."""
from fastapi import APIRouter
from app.services.real_data_demo import DATA, describe

router = APIRouter(prefix='/api', tags=['real-data-demo'])


@router.get('/real-data-demo')
def real_data_demo():
    observations = []
    unavailable = []
    for obs_id in DATA:
        try:
            info = describe(obs_id)
        except (OSError, ValueError, IndexError):
            info = None
        if info is None:
            unavailable.append(obs_id)
        else:
            observations.append(info)
    return {'observations': observations, 'unavailable': unavailable,
            'limitations': ['WCS alignment is technical; scientific validation remains separate.',
                            'WCS-WAVE is approximate; local spectral calibration and flag policy remain unverified.']}
