"""Observation catalog access (fixtures now; IRSA later).

Sprint 1 loads labeled JSON under ``data/metadata/`` and optional tiny
synthetic FITS under ``data/samples/``. Provenance is always ``stub`` or
``cached_sample`` — never presented as live NASA/IRSA metadata.

TODO(P4 / feat/spherex-data): replace fixture-backed methods with an IRSA
SIA2 / TAP client. Keep method signatures stable so routers stay thin.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

# Repo root: backend/app/services/catalog.py → parents[3] = repo root
_REPO_ROOT = Path(__file__).resolve().parents[3]
_METADATA_DIR = _REPO_ROOT / "data" / "metadata"
_SAMPLES_DIR = _REPO_ROOT / "data" / "samples"

DEFAULT_SEARCH_RADIUS_ARCSEC = 60.0
DEFAULT_EPOCH_RADIUS_ARCSEC = 120.0


@dataclass(frozen=True)
class SearchResult:
    hits: list[dict[str, Any]]
    provenance: str


@dataclass(frozen=True)
class EpochsResult:
    epochs: list[dict[str, Any]]
    provenance: str


def _angular_separation_arcsec(
    ra1_deg: float, dec1_deg: float, ra2_deg: float, dec2_deg: float
) -> float:
    """Great-circle separation in arcseconds (spherical law of cosines)."""
    ra1, dec1, ra2, dec2 = map(math.radians, (ra1_deg, dec1_deg, ra2_deg, dec2_deg))
    cos_d = math.sin(dec1) * math.sin(dec2) + math.cos(dec1) * math.cos(dec2) * math.cos(
        ra1 - ra2
    )
    cos_d = max(-1.0, min(1.0, cos_d))
    return math.degrees(math.acos(cos_d)) * 3600.0


def _load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, dict):
        raise ValueError(f"Expected object in {path}")
    return data


class CatalogService:
    """Fixture-backed catalog. Swap body for IRSA in P4 without changing routers."""

    def __init__(
        self,
        *,
        targets_path: Path | None = None,
        epochs_path: Path | None = None,
        samples_dir: Path | None = None,
    ) -> None:
        self._targets_path = targets_path or (_METADATA_DIR / "targets.json")
        self._epochs_path = epochs_path or (_METADATA_DIR / "epochs.json")
        self._samples_dir = samples_dir or _SAMPLES_DIR

    def _targets_payload(self) -> dict[str, Any]:
        return _load_json(self._targets_path)

    def _epochs_payload(self) -> dict[str, Any]:
        return _load_json(self._epochs_path)

    def list_targets(self) -> list[dict[str, Any]]:
        return list(self._targets_payload().get("targets", []))

    def search(
        self,
        *,
        q: str | None = None,
        ra: float | None = None,
        dec: float | None = None,
        radius_arcsec: float | None = None,
    ) -> SearchResult:
        payload = self._targets_payload()
        provenance = str(payload.get("provenance", "stub"))
        targets = list(payload.get("targets", []))
        hits = targets

        if q is not None and q.strip():
            needle = q.strip().lower()
            hits = [
                t
                for t in hits
                if needle in str(t.get("name", "")).lower()
                or needle in str(t.get("id", "")).lower()
            ]

        if ra is not None and dec is not None:
            radius = (
                DEFAULT_SEARCH_RADIUS_ARCSEC
                if radius_arcsec is None
                else float(radius_arcsec)
            )
            hits = [
                t
                for t in hits
                if _angular_separation_arcsec(
                    ra, dec, float(t["ra"]), float(t["dec"])
                )
                <= radius
            ]

        return SearchResult(hits=hits, provenance=provenance)

    def epochs(
        self,
        *,
        ra: float,
        dec: float,
        radius_arcsec: float | None = None,
        band: str | None = None,
    ) -> EpochsResult:
        payload = self._epochs_payload()
        provenance = str(payload.get("provenance", "stub"))
        radius = (
            DEFAULT_EPOCH_RADIUS_ARCSEC
            if radius_arcsec is None
            else float(radius_arcsec)
        )
        rows: list[dict[str, Any]] = []
        for row in payload.get("epochs", []):
            sep = _angular_separation_arcsec(
                ra, dec, float(row["ra"]), float(row["dec"])
            )
            if sep > radius:
                continue
            if band is not None and band.strip():
                bp = row.get("bandpass") or ""
                if band.strip().lower() not in str(bp).lower():
                    continue
            rows.append(
                {
                    "obs_id": row["obs_id"],
                    "ra": row.get("ra"),
                    "dec": row.get("dec"),
                    "t_mjd": row.get("t_mjd"),
                    "bandpass": row.get("bandpass"),
                    "wavelength_um": row.get("wavelength_um"),
                    "preview_url": row.get("preview_url"),
                    "provenance": row.get("provenance", provenance),
                }
            )

        # Time-ordered: null MJD last, then ascending.
        rows.sort(
            key=lambda e: (
                e["t_mjd"] is None,
                e["t_mjd"] if e["t_mjd"] is not None else 0.0,
            )
        )
        return EpochsResult(epochs=rows, provenance=provenance)

    def resolve_preview_fits(self, obs_id: str) -> Path | None:
        """Return local FITS path for ``obs_id`` if a labeled sample exists."""
        payload = self._epochs_payload()
        for row in payload.get("epochs", []):
            if row.get("obs_id") != obs_id:
                continue
            rel = row.get("fits_sample")
            if not rel:
                return None
            path = (_REPO_ROOT / "data" / rel).resolve()
            # Stay inside data/
            if not str(path).startswith(str((_REPO_ROOT / "data").resolve())):
                return None
            return path if path.is_file() else None
        # Fallback: convention data/samples/{obs_id}.fits
        candidate = self._samples_dir / f"{obs_id}.fits"
        return candidate if candidate.is_file() else None


@lru_cache(maxsize=1)
def get_catalog_service() -> CatalogService:
    return CatalogService()
