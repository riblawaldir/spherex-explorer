"""Conservative candidate assessment using existing SPHEREx observation records.

Detector-wide SIA ranges can rule out overlap, but do not establish the local
LVF wavelength of the overlapping sky pixels. No scientific subtraction occurs.
"""
from dataclasses import asdict
from pathlib import Path
import math

from app.science.fits_inspection import inspect_fits, select_image_hdu
from app.science.image_alignment import validate_fits_wcs
from app.science.image_quality import assess_aligned_quality
from app.science.spherex_data.observations import _check_collection_compatibility, _COMPATIBLE_COLLECTION_GROUPS
from app.science.spherex_data.timing import mjd_to_utc


def assess_candidate_pair(first, second, *, minimum_coverage_percent=None):
    """Assess two ObservationRecord objects whose fits_path points to local data.

    Coverage is relative to the first image's entire grid. A nonzero overlap
    alone is not a science threshold. Detector-wide band overlap cannot confirm
    local spectral compatibility, so overlapping intervals require review.
    """
    if minimum_coverage_percent is not None and (isinstance(minimum_coverage_percent, bool) or not math.isfinite(minimum_coverage_percent) or not 0 < minimum_coverage_percent <= 100):
        raise ValueError('minimum_coverage_percent must be in (0, 100]')
    records = [first, second]
    result = {'observations': [r.to_dict() for r in records], 'status': None,
              'spatial': {'wcs_valid': [None, None], 'coverage_percent': None,
                          'geometric_coverage_percent': None, 'finite_coverage_percent': None},
              'spectral': {'compatible': None, 'reason': None, 'wcs_wave_present': [None, None]},
              'temporal': {'different_epoch': None, 'delta_days': None},
              'collection': {'compatible': None}, 'quality': None, 'warnings': []}
    failed, pending = False, False
    cols = {r.collection for r in records if r.collection}
    result['warnings'].extend(_check_collection_compatibility(cols))
    if len(cols) == 0 or any(not r.collection for r in records):
        pending = True
    elif any(cols <= group for group in _COMPATIBLE_COLLECTION_GROUPS):
        result['collection']['compatible'] = True
    elif result['warnings']:
        result['collection']['compatible'] = False
        failed = True
    else:
        result['warnings'].append('Collection compatibility is not established.')
        pending = True
    times = [r.t_min_mjd for r in records]
    if all(mjd_to_utc(t) is not None for t in times):
        result['temporal']['delta_days'] = abs(times[1] - times[0])
        # Distinct timestamps alone do not establish distinct scientific epochs.
        result['warnings'].append('Scientific epoch separation requires an explicit policy.')
        pending = True
    else:
        pending = True
    ranges = [(r.em_min_m, r.em_max_m) for r in records]
    spectral_warnings = [o['spectral_metadata_warning'] for o in result['observations']
                         if o.get('spectral_metadata_warning')]
    if spectral_warnings:
        result['warnings'].extend(spectral_warnings)
        result['spectral']['reason'] = 'Spectral metadata require review before interpreting catalog intervals.'
        pending = True
    elif all(not isinstance(a, bool) and not isinstance(b, bool)
             and isinstance(a, (int, float)) and isinstance(b, (int, float))
             and math.isfinite(a) and math.isfinite(b) and 0 < a < b for a,b in ranges):
        if max(ranges[0][0], ranges[1][0]) >= min(ranges[0][1], ranges[1][1]):
            result['spectral'].update(compatible=False, reason='Detector-wide catalog intervals do not overlap.')
            failed = True
        else:
            result['spectral']['reason'] = 'Catalog intervals overlap, but local LVF wavelengths on the common sky are not established.'
            pending = True
    else:
        result['spectral']['reason'] = 'Missing or invalid catalog wavelength intervals.'
        pending = True
    hdus = []
    for i, record in enumerate(records):
        if not record.fits_path or not Path(record.fits_path).is_file():
            result['warnings'].append(f'Observation {i+1}: FITS file unavailable.')
            pending = True
            hdus.append(None)
            continue
        try:
            inspection = inspect_fits(record.fits_path)
            result['spectral']['wcs_wave_present'][i] = any(h.name.upper() == 'WCS-WAVE' for h in inspection.hdus)
            hdu = select_image_hdu(inspection)
            hdus.append(hdu)
            validate_fits_wcs(record.fits_path, hdu=hdu)
            result['spatial']['wcs_valid'][i] = True
        except (OSError, ValueError, IndexError) as exc:
            if len(hdus) <= i: hdus.append(None)
            result['spatial']['wcs_valid'][i] = False
            result['warnings'].append(f'Observation {i+1}: {exc}')
            failed = True
    if all(h is not None for h in hdus) and all(result['spatial']['wcs_valid']):
        try:
            q = assess_aligned_quality(first.fits_path, second.fits_path, reference_hdu=hdus[0], target_hdu=hdus[1])
            coverage = q.finite_coverage_percent
            result['spatial']['coverage_percent'] = coverage
            result['spatial']['finite_coverage_percent'] = coverage
            result['spatial']['geometric_coverage_percent'] = q.geometric_coverage_percent
            result['quality'] = {'valid_common_pixels': int(q.alignment.valid_mask.sum()),
                'flags_present': [q.reference_flags_present, q.target_flags_present],
                'variance': [asdict(q.reference_variance), asdict(q.target_variance)],
                'units_compatible': q.units_compatible, 'science_quality_evaluated': q.science_quality_evaluated}
            result['warnings'].extend(q.warnings)
            if minimum_coverage_percent is None:
                result['warnings'].append('No minimum spatial coverage threshold has been specified.')
                pending = True
            elif coverage < minimum_coverage_percent:
                failed = True
            if q.units_compatible is False: failed = True
            elif q.units_compatible is None: pending = True
            if not q.science_quality_evaluated: pending = True
        except (OSError, ValueError, IndexError) as exc:
            result['warnings'].append(f'Alignment or quality assessment failed: {exc}')
            failed = True
    result['status'] = 'NO COMPARABLE' if failed else 'REQUIERE REVISIÓN' if pending else 'COMPARABLE'
    return result
