"""Compare two observations: metadata gate + optional P5 align; honest diff stub.

Scientific difference / subtraction is owned by P5. This module never invents
NASA fields or residual images. When P5 ``align_fits_images`` is importable and
both local FITS resolve, alignment is attempted; otherwise alignment is reported
unavailable/failed. Diff is always ``not_implemented`` until a P5 diff API exists.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.services.catalog import (
    PROVENANCE_CACHED_SAMPLE,
    PROVENANCE_STUB,
    CatalogService,
)

# Soft wavelength match only when both values are present (µm).
_WAVELENGTH_TOLERANCE_UM = 0.05
STUB_PROVENANCE = PROVENANCE_STUB


def _choose_image_hdu(fits_path: Path) -> int:
    """Pick HDU via P5 inspect: prefer unique IMAGE, else first numeric 2-D."""
    from app.science.fits_inspection import inspect_fits, select_image_hdu

    inspection = inspect_fits(fits_path)
    try:
        return select_image_hdu(inspection)
    except ValueError:
        for hdu in inspection.hdus:
            if hdu.is_numeric_2d_image and (hdu.valid_percent or 0) > 0:
                return hdu.index
        raise ValueError("No numeric 2-D image HDU with finite pixels")


@dataclass(frozen=True)
class CompareOutcome:
    payload: dict[str, Any]
    http_status: int = 200


def _pair_provenance(epoch_a: dict[str, Any], epoch_b: dict[str, Any]) -> str:
    ranks = {PROVENANCE_STUB: 0, PROVENANCE_CACHED_SAMPLE: 1, "irsa_verified_local": 2, "live": 3}
    a = str(epoch_a.get("provenance", PROVENANCE_STUB))
    b = str(epoch_b.get("provenance", PROVENANCE_STUB))
    # Conservative label: weakest of the two (never promote to live).
    return a if ranks.get(a, 0) <= ranks.get(b, 0) else b


def _bandpass_match(a: str | None, b: str | None) -> bool:
    if a is None or b is None:
        return False
    return str(a).strip().lower() == str(b).strip().lower()


def _wavelength_match(a: float | None, b: float | None) -> bool | None:
    if a is None or b is None:
        return None
    return abs(float(a) - float(b)) <= _WAVELENGTH_TOLERANCE_UM


def _epoch_snapshot(epoch: dict[str, Any]) -> dict[str, Any]:
    snap = {
        "obs_id": epoch["obs_id"],
        "ra": epoch.get("ra"),
        "dec": epoch.get("dec"),
        "t_mjd": epoch.get("t_mjd"),
        "bandpass": epoch.get("bandpass"),
        "wavelength_um": epoch.get("wavelength_um"),
        "preview_url": epoch.get("preview_url"),
        "provenance": epoch.get("provenance", PROVENANCE_STUB),
    }
    if epoch.get("collection"):
        snap["collection"] = epoch["collection"]
    if epoch.get("source_url"):
        snap["source_url"] = epoch["source_url"]
    return snap


def _try_align(
    path_a: Path, path_b: Path
) -> tuple[dict[str, Any], bool]:
    """Attempt P5 ``align_fits_images`` (+ optional quality). Returns report, ok."""
    try:
        from app.science.image_reprojection import align_fits_images
    except ImportError:
        return (
            {
                "status": "unavailable",
                "detail": (
                    "P5 align_fits_images is not importable; alignment not run."
                ),
                "common_coverage_percent": None,
                "units_compatible": None,
                "reference_unit": None,
                "target_unit": None,
                "reference_hdu": None,
                "target_hdu": None,
                "warnings": [],
            },
            False,
        )

    try:
        hdu_a = _choose_image_hdu(path_a)
        hdu_b = _choose_image_hdu(path_b)
    except (OSError, ValueError) as exc:
        return (
            {
                "status": "failed",
                "detail": f"Could not select IMAGE HDU for alignment: {exc}",
                "common_coverage_percent": None,
                "units_compatible": None,
                "reference_unit": None,
                "target_unit": None,
                "reference_hdu": None,
                "target_hdu": None,
                "warnings": [],
            },
            False,
        )

    warnings: list[str] = []
    units_compatible: bool | None = None
    try:
        # Prefer quality assessment when present (wraps align + unit check).
        try:
            from app.science.image_quality import assess_aligned_quality

            quality = assess_aligned_quality(
                path_a,
                path_b,
                reference_hdu=hdu_a,
                target_hdu=hdu_b,
            )
            alignment = quality.alignment
            units_compatible = quality.units_compatible
            warnings = list(quality.warnings)
        except ImportError:
            alignment = align_fits_images(
                path_a,
                path_b,
                reference_hdu=hdu_a,
                target_hdu=hdu_b,
            )
            if alignment.reference_unit and alignment.target_unit:
                units_compatible = (
                    alignment.reference_unit == alignment.target_unit
                )
            warnings = [
                "WCS alignment alone does not establish scientific comparability."
            ]
    except Exception as exc:  # noqa: BLE001 — report honestly to client
        return (
            {
                "status": "failed",
                "detail": f"P5 alignment failed: {exc}",
                "common_coverage_percent": None,
                "units_compatible": None,
                "reference_unit": None,
                "target_unit": None,
                "reference_hdu": hdu_a,
                "target_hdu": hdu_b,
                "warnings": [],
            },
            False,
        )

    return (
        {
            "status": "ok",
            "detail": (
                "P5 align_fits_images succeeded on local FITS "
                f"(coverage={alignment.common_coverage_percent:.2f}%)."
            ),
            "common_coverage_percent": float(alignment.common_coverage_percent),
            "units_compatible": units_compatible,
            "reference_unit": alignment.reference_unit,
            "target_unit": alignment.target_unit,
            "reference_hdu": hdu_a,
            "target_hdu": hdu_b,
            "warnings": warnings,
        },
        True,
    )


def _diff_report(*, alignment_ok: bool, metadata_ok: bool) -> dict[str, Any]:
    """Honest stub: no P5 scientific difference module is wired."""
    if not metadata_ok:
        return {
            "status": "skipped",
            "detail": "Pair not metadata-compatible; difference not attempted.",
            "provenance": STUB_PROVENANCE,
        }
    if not alignment_ok:
        return {
            "status": "skipped",
            "detail": (
                "Alignment did not succeed; difference not attempted. "
                "No residual image is invented."
            ),
            "provenance": STUB_PROVENANCE,
        }
    return {
        "status": "not_implemented",
        "detail": (
            "P5 scientific difference / subtraction module is not present. "
            "Aligned arrays are not exposed as discoveries; no residual PNG "
            "is invented. Honest 501/stub until P5 ships a diff API."
        ),
        "provenance": STUB_PROVENANCE,
    }


def compare_observations(
    catalog: CatalogService,
    *,
    obs_id_a: str,
    obs_id_b: str,
) -> CompareOutcome:
    """Validate a pair and optionally run P5 alignment.

    Returns HTTP 404 when either obs_id is unknown in fixtures.
    Returns HTTP 422 when both ids are the same.
    """
    if obs_id_a == obs_id_b:
        return CompareOutcome(
            http_status=422,
            payload={
                "detail": "obs_id_a and obs_id_b must be different",
                "provenance": STUB_PROVENANCE,
            },
        )

    epoch_a = catalog.get_epoch_by_obs_id(obs_id_a)
    epoch_b = catalog.get_epoch_by_obs_id(obs_id_b)
    missing = [
        oid
        for oid, ep in ((obs_id_a, epoch_a), (obs_id_b, epoch_b))
        if ep is None
    ]
    if missing:
        return CompareOutcome(
            http_status=404,
            payload={
                "detail": (
                    "Unknown obs_id(s): "
                    + ", ".join(repr(m) for m in missing)
                    + ". Known ids come from labeled fixtures only "
                    "(no invented NASA products)."
                ),
                "provenance": STUB_PROVENANCE,
            },
        )

    assert epoch_a is not None and epoch_b is not None
    path_a = catalog.resolve_preview_fits(obs_id_a)
    path_b = catalog.resolve_preview_fits(obs_id_b)
    band_ok = _bandpass_match(epoch_a.get("bandpass"), epoch_b.get("bandpass"))
    wave_ok = _wavelength_match(
        epoch_a.get("wavelength_um"), epoch_b.get("wavelength_um")
    )
    both_fits = path_a is not None and path_b is not None

    reasons: list[str] = []
    checks: dict[str, Any] = {
        "bandpass_match": band_ok,
        "wavelength_match": wave_ok,
        "both_local_fits": both_fits,
        "alignment_ok": False,
    }

    if not band_ok:
        reasons.append("bandpass_mismatch_or_missing")
    else:
        reasons.append("bandpass_match")
    if wave_ok is True:
        reasons.append("wavelength_match")
    elif wave_ok is False:
        reasons.append("wavelength_mismatch")
    else:
        reasons.append("wavelength_unknown")
    if both_fits:
        reasons.append("both_local_fits")
    else:
        reasons.append("missing_local_fits")

    metadata_ok = band_ok and both_fits and wave_ok is not False

    if not metadata_ok:
        alignment = {
            "status": "skipped",
            "detail": "Pair not metadata-compatible; P5 alignment not attempted.",
            "common_coverage_percent": None,
            "units_compatible": None,
            "reference_unit": None,
            "target_unit": None,
            "reference_hdu": None,
            "target_hdu": None,
            "warnings": [],
        }
        alignment_ok = False
    else:
        assert path_a is not None and path_b is not None
        alignment, alignment_ok = _try_align(path_a, path_b)
        if alignment_ok:
            reasons.append("alignment_ok")
            # Units unknown is allowed; explicit incompatibility blocks comparable.
            if alignment.get("units_compatible") is False:
                alignment_ok = False
                reasons.append("units_incompatible")
                alignment = {
                    **alignment,
                    "status": "failed",
                    "detail": (
                        "P5 alignment ran but intensity units are not compatible "
                        f"({alignment.get('reference_unit')!r} vs "
                        f"{alignment.get('target_unit')!r})."
                    ),
                }
            else:
                reasons.append("units_ok_or_unknown")
        else:
            reasons.append(f"alignment_{alignment['status']}")

    checks["alignment_ok"] = alignment_ok
    status = "comparable" if (metadata_ok and alignment_ok) else "not_comparable"
    if status == "comparable":
        reasons.append("pair_comparable")
    else:
        reasons.append("pair_not_comparable")

    provenance = _pair_provenance(epoch_a, epoch_b)
    payload = {
        "obs_id_a": obs_id_a,
        "obs_id_b": obs_id_b,
        "status": status,
        "provenance": provenance,
        "reasons": reasons,
        "epoch_a": _epoch_snapshot(epoch_a),
        "epoch_b": _epoch_snapshot(epoch_b),
        "alignment": alignment,
        "diff": _diff_report(alignment_ok=alignment_ok, metadata_ok=metadata_ok),
        "checks": checks,
    }
    return CompareOutcome(payload=payload, http_status=200)
