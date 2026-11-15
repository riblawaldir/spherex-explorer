"""Evaluate locally available catalog observations without accepting paths."""
from dataclasses import replace
from typing import Annotated

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, StringConstraints

from app.science.fits_inspection import inspect_fits, select_image_hdu
from app.science.image_alignment import InvalidWCS, validate_fits_wcs
from app.science.spherex_data.comparability import assess_candidate_pair
from app.services.catalog import get_catalog_service

router = APIRouter(prefix='/api', tags=['comparability'])
ObservationId = Annotated[str, StringConstraints(min_length=1, max_length=128, pattern=r'^[A-Za-z0-9_-]+$')]


class PairRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    observation_1: ObservationId
    observation_2: ObservationId


@router.post('/comparability')
def evaluate_pair(request: PairRequest) -> dict:
    """Assess two previously discovered catalog products with local FITS files."""
    catalog = get_catalog_service()
    records = []
    for obs_id in (request.observation_1, request.observation_2):
        try:
            record = catalog.resolve_observation(obs_id)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail='Observation ID matches multiple products') from exc
        if record is None:
            raise HTTPException(status_code=404, detail=f'Observation not found: {obs_id}')
        path = catalog.resolve_preview_fits(obs_id)
        if path is None:
            raise HTTPException(status_code=404, detail=f'FITS unavailable for observation: {obs_id}')
        try:
            inspection = inspect_fits(path)
            index = select_image_hdu(inspection)
            validate_fits_wcs(path, hdu=index)
        except InvalidWCS as exc:
            raise HTTPException(status_code=422, detail=f'Invalid celestial WCS: {obs_id}') from exc
        except OSError as exc:
            raise HTTPException(status_code=422, detail=f'FITS read error: {obs_id}') from exc
        except (ValueError, IndexError) as exc:
            raise HTTPException(status_code=422, detail=f'Invalid FITS image: {obs_id}') from exc
        records.append(replace(record, fits_path=str(path)))
    result = assess_candidate_pair(*records)
    for item in result['observations']:
        item.pop('fits_path', None)
        item.pop('access_url', None)
    # Unexpected FITS errors can contain server paths; do not return exception text.
    result['warnings'] = [
        'Images have no valid common coverage.' if 'no valid common coverage' in warning else
        'Image inspection or alignment failed.'
        if warning.startswith(('Observation 1:', 'Observation 2:', 'Alignment or quality assessment failed:'))
        else warning for warning in result['warnings']
    ]
    return result
