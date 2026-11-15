"""Evidence-based scientific assessment of an existing Sprint 3 evaluation.

This layer does not infer a scientific policy, spectral calibration or flag mask.
"""
from __future__ import annotations

from typing import Any
import math

VALID = 'VALID'
INVALID = 'INVALID'
REVIEW_REQUIRED = 'REVIEW_REQUIRED'

# All eight are needed to certify a comparison under this workflow.
REQUIRED_CRITERIA = frozenset({'spatial', 'spectral', 'temporal', 'collection',
                               'quality', 'calibration', 'uncertainty', 'masks'})
SOURCES = {
    'spatial': 'Sprint 3: validate_fits_wcs / assess_aligned_quality',
    'spectral': 'IRSA SIA2 ObservationRecord em_min_m/em_max_m; FITS WCS-WAVE presence',
    'temporal': 'IRSA SIA2 ObservationRecord t_min_mjd / t_max_mjd',
    'collection': 'IRSA SIA2 ObservationRecord collection; Sprint 3 collection rules',
    'quality': 'FITS IMAGE, FLAGS, VARIANCE; Sprint 3 assess_aligned_quality',
    'calibration': 'Calibration products unavailable to this workflow',
    'uncertainty': 'FITS VARIANCE; Sprint 3 assess_aligned_quality',
    'masks': 'FITS FLAGS; Sprint 3 assess_aligned_quality',
}


def criterion(name: str, status: str, observed: Any, expected: str,
              evidence: str, reason: str, limitations: list[str]) -> dict:
    return {'name': name, 'status': status, 'observed': observed,
            'expected': expected, 'evidence': evidence, 'reason': reason,
            'limitations': limitations, 'source': SOURCES.get(name, 'Unknown')}


def aggregate_criteria(criteria: list[dict]) -> str:
    """Require exactly one well-formed result for each required criterion.

    A well-formed invalid criterion remains conclusive even when another is
    missing; duplicate names, unknown names and malformed entries require review.
    """
    if not isinstance(criteria, list):
        return REVIEW_REQUIRED
    fields = {'name', 'status', 'observed', 'expected', 'evidence', 'reason', 'limitations', 'source'}
    names = []
    for item in criteria:
        if (not isinstance(item, dict) or not fields <= item.keys()
                or not isinstance(item['name'], str) or item['name'] not in REQUIRED_CRITERIA
                or item['status'] not in (VALID, INVALID, REVIEW_REQUIRED)
                or not all(isinstance(item[k], str) and item[k].strip() for k in ('expected', 'evidence', 'reason', 'source'))
                or not isinstance(item['limitations'], list)
                or not all(isinstance(x, str) for x in item['limitations'])):
            return REVIEW_REQUIRED
        names.append(item['name'])
    if len(names) != len(set(names)):
        return REVIEW_REQUIRED
    if any(item['status'] == INVALID for item in criteria):
        return INVALID
    if set(names) == REQUIRED_CRITERIA and all(item['status'] == VALID for item in criteria):
        return VALID
    return REVIEW_REQUIRED


def _disjoint_catalog_intervals(observations: list) -> bool:
    """Verify both finite, positive intervals before using them as evidence."""
    if len(observations) != 2 or not all(isinstance(o, dict) for o in observations):
        return False
    intervals = []
    for obs in observations:
        lo, hi = obs.get('em_min_m'), obs.get('em_max_m')
        if (isinstance(lo, bool) or isinstance(hi, bool)
                or not isinstance(lo, (int, float)) or not isinstance(hi, (int, float))
                or not math.isfinite(lo) or not math.isfinite(hi) or not 0 < lo < hi):
            return False
        intervals.append((lo, hi))
    return max(a[0] for a in intervals) >= min(a[1] for a in intervals)


def validate_scientific_pair(assessment: dict) -> dict:
    """Interpret measured Sprint 3 diagnostics without treating them as certification."""
    spatial = assessment.get('spatial') or {}
    spectral = assessment.get('spectral') or {}
    temporal = assessment.get('temporal') or {}
    quality = assessment.get('quality') or {}
    collection = assessment.get('collection') or {}
    observations = assessment.get('observations') or []
    spectral_warnings = [o.get('spectral_metadata_warning') for o in observations
                         if o.get('spectral_metadata_warning')]
    spectral_disjoint = not spectral_warnings and _disjoint_catalog_intervals(observations)
    geometric = spatial.get('geometric_coverage_percent')
    finite = spatial.get('finite_coverage_percent')
    # Failure to produce a footprint may be due to missing data, not disjoint sky.
    spatial_reason = ('A reprojected common footprint was measured.' if geometric is not None
                      else 'A reliable geometric footprint was not established.')
    criteria = [
        criterion('spatial', REVIEW_REQUIRED,
                  {'wcs_valid': spatial.get('wcs_valid'), 'geometric_coverage_percent': geometric,
                   'finite_coverage_percent': finite},
                  'Verified sky overlap and sufficient coverage for the scientific objective.',
                  'Sprint 3 WCS validation and reprojection, relative to reference grid.',
                  spatial_reason,
                  ['No scientific coverage threshold or resolution-matching policy is specified.',
                   'A missing footprint is not proof of disjoint geometry.']),
        criterion('spectral', INVALID if spectral_disjoint else REVIEW_REQUIRED,
                  {'catalog_intervals_m': [[o.get('em_min_m'), o.get('em_max_m')] for o in observations],
                   'detectors': [o.get('detector') for o in observations],
                   'wcs_wave_present': spectral.get('wcs_wave_present'),
                   'metadata_warnings': spectral_warnings},
                  'Compatible local spectral responses supported by calibration data.',
                  'IRSA catalog ranges and FITS WCS-WAVE presence.',
                  ('Metadata conflict prevents reliable spectral interpretation.' if spectral_warnings else
                   'Valid catalog intervals do not overlap.' if spectral_disjoint else 'Local spectral response is not established.'),
                  ['WCS-WAVE is approximate; CWAVE, CBAND and response information are not assessed.']),
        criterion('temporal', REVIEW_REQUIRED,
                  {'mjd': [o.get('t_min_mjd') for o in observations],
                   'delta_days': temporal.get('delta_days'),
                   'different_epoch_sprint3': temporal.get('different_epoch')},
                  'Temporal separation appropriate to an explicit scientific objective.',
                  'ObservationRecord t_min_mjd; Sprint 3 timing.',
                  'No objective-specific temporal requirement was supplied or validated.',
                  ['Distinct timestamps do not establish scientifically distinct epochs.']),
        criterion('collection', REVIEW_REQUIRED, collection,
                  'Compatible processing and calibration for the comparison.',
                  'Sprint 3 collection metadata and compatibility rules.',
                  'Collection labels alone do not establish compatible calibration.',
                  ['Collection warnings require review in the context of the products.']),
        criterion('quality', REVIEW_REQUIRED, quality or None,
                  'Validated masks, uncertainty and quality appropriate to the comparison.',
                  'Sprint 3 finite coverage, FLAGS presence and VARIANCE inspection.',
                  'Scientific mask and quality acceptance have not been established.',
                  ['No quality mask or uncertainty propagation is performed.']),
        criterion('calibration', REVIEW_REQUIRED, None,
                  'Documented calibration and local spectral response for each product.',
                  'No calibration products supplied to this workflow.',
                  'Calibration cannot be established from file readability.',
                  ['CWAVE, CBAND and spectral response functions are not loaded.']),
        criterion('uncertainty', REVIEW_REQUIRED, quality.get('variance'),
                  'Valid uncertainty model propagated through reprojection.',
                  'Sprint 3 VARIANCE extension diagnostics.',
                  'Variance presence does not establish a propagated uncertainty model.',
                  ['Resampling covariance and uncertainty are not propagated.']),
        criterion('masks', REVIEW_REQUIRED, quality.get('flags_present'),
                  'Documented flag policy and masks suitable for the comparison.',
                  'Sprint 3 FLAGS extension presence.',
                  'Flags were not interpreted or applied.',
                  ['No undocumented rejection bits are assumed.']),
    ]
    return {'status': aggregate_criteria(criteria), 'criteria': criteria,
            'observation_ids': [o.get('id') for o in observations],
            'limitations': ['Scientific validation requires a defined objective and corroborating calibration and quality evidence.']}
