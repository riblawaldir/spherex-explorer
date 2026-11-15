"""Compare-pair response models (Sprint 4). No invented NASA fields."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


CompareStatus = Literal["comparable", "not_comparable"]
AlignmentStatus = Literal["ok", "failed", "skipped", "unavailable"]
DiffStatus = Literal["not_implemented", "skipped", "unavailable"]
Provenance = Literal["stub", "cached_sample", "live"]


class EpochSnapshot(BaseModel):
    """Known epoch fields only — omit collection/source_url unless present."""

    obs_id: str
    ra: float | None = None
    dec: float | None = None
    t_mjd: float | None = None
    bandpass: str | None = None
    wavelength_um: float | None = None
    preview_url: str | None = None
    provenance: Provenance
    collection: str | None = None
    source_url: str | None = None


class AlignmentReport(BaseModel):
    status: AlignmentStatus
    detail: str
    common_coverage_percent: float | None = None
    units_compatible: bool | None = None
    reference_unit: str | None = None
    target_unit: str | None = None
    reference_hdu: int | None = None
    target_hdu: int | None = None
    warnings: list[str] = Field(default_factory=list)


class DiffReport(BaseModel):
    status: DiffStatus
    detail: str
    provenance: Provenance = "stub"


class CompareResponse(BaseModel):
    obs_id_a: str
    obs_id_b: str
    status: CompareStatus
    provenance: Provenance
    reasons: list[str]
    epoch_a: EpochSnapshot
    epoch_b: EpochSnapshot
    alignment: AlignmentReport
    diff: DiffReport
    checks: dict[str, Any]
