"""Honest scientific status for a pair of local FITS images.

This wraps the validated inspection, alignment and quality functions.
It does not subtract images, fit an ePSF, or decide variability.
``photometric_equivalence`` stays false. ``variable_detected`` is not set.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from app.science.local_manifest import pair_for, resolve_allowed_fits


def science_not_assessed(detail: str) -> dict[str, Any]:
    return {
        "assessed": False,
        "detail": detail,
        "geometric_alignment": "not_run",
        "common_coverage_percent": None,
        "geometric_coverage_percent": None,
        "finite_coverage_percent": None,
        "units_compatible": None,
        "reference_unit": None,
        "target_unit": None,
        "reference_hdu": None,
        "target_hdu": None,
        "reference_flags_present": None,
        "target_flags_present": None,
        "reference_variance_present": None,
        "target_variance_present": None,
        "science_quality_evaluated": False,
        "spectral_comparability": "not_certified",
        "exploratory_spectral_note": None,
        "subtraction_validated": False,
        "variability_assessed": False,
        "photometric_equivalence": False,
        "category": "not_classified",
        "sha256_verified": False,
        "quality_warnings": [],
        "warnings": [
            "La evaluación científica no se ejecutó.",
            "No hay una resta científica validada.",
            "La variabilidad no fue evaluada.",
        ],
    }


def _choose_image_hdu(path: Path) -> int:
    from app.science.fits_inspection import inspect_fits, select_image_hdu

    return select_image_hdu(inspect_fits(path))


def assess_pair(
    path_a: str | Path,
    path_b: str | Path,
    *,
    obs_id_a: str | None = None,
    obs_id_b: str | None = None,
) -> dict[str, Any]:
    """Align two intensity images and report what that alignment does not prove.

    Opens both files read-only. Category comes only from the operator
    manifest. A successful WCS overlap never raises the category and never
    certifies spectra, photometry or variability.
    """
    path_a = Path(path_a)
    path_b = Path(path_b)
    pair = pair_for(obs_id_a, obs_id_b) if obs_id_a and obs_id_b else None
    category = pair.category if pair is not None else "not_classified"
    note = pair.exploratory_spectral_note if pair is not None else None
    extra = list(pair.warnings) if pair is not None else []
    verified = False
    if obs_id_a and obs_id_b:
        verified = (
            resolve_allowed_fits(obs_id_a) is not None
            and resolve_allowed_fits(obs_id_b) is not None
        )
    try:
        from app.science.image_quality import assess_aligned_quality

        hdu_a = _choose_image_hdu(path_a)
        hdu_b = _choose_image_hdu(path_b)
        quality = assess_aligned_quality(
            path_a, path_b, reference_hdu=hdu_a, target_hdu=hdu_b
        )
    except (OSError, ValueError) as exc:
        report = science_not_assessed(f"No se pudo evaluar el par: {exc}")
        report["category"] = category
        report["exploratory_spectral_note"] = note
        report["sha256_verified"] = verified
        report["warnings"] = list(report["warnings"]) + extra
        return report

    alignment = quality.alignment
    warnings = [
        "La alineación geométrica no es equivalencia fotométrica.",
        "La concordancia de detector o de banda no certifica el espectro.",
        "No hay una resta científica validada.",
        "La variabilidad no fue evaluada.",
        "La aceptación por FLAGS no fue evaluada: no se aplicó una máscara de bits.",
        "VARIANCE se inspeccionó y no se propagó.",
        *extra,
    ]
    return {
        "assessed": True,
        "detail": (
            "Alineación geométrica calculada. "
            f"Cobertura finita común {alignment.common_coverage_percent:.2f}%."
        ),
        "geometric_alignment": "ok",
        "common_coverage_percent": float(alignment.common_coverage_percent),
        "geometric_coverage_percent": float(quality.geometric_coverage_percent),
        "finite_coverage_percent": float(quality.finite_coverage_percent),
        "units_compatible": quality.units_compatible,
        "reference_unit": alignment.reference_unit,
        "target_unit": alignment.target_unit,
        "reference_hdu": hdu_a,
        "target_hdu": hdu_b,
        "reference_flags_present": quality.reference_flags_present,
        "target_flags_present": quality.target_flags_present,
        "reference_variance_present": quality.reference_variance.present,
        "target_variance_present": quality.target_variance.present,
        "science_quality_evaluated": False,
        "spectral_comparability": "not_certified",
        "exploratory_spectral_note": note,
        "subtraction_validated": False,
        "variability_assessed": False,
        "photometric_equivalence": False,
        "category": category,
        "sha256_verified": verified,
        "quality_warnings": list(quality.warnings),
        "warnings": warnings,
    }
