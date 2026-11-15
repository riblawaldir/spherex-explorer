"""Observation catalog access (fixtures + optional live IRSA via P4).

Default path loads labeled JSON under ``data/metadata/`` and optional tiny
synthetic FITS under ``data/samples/``. Provenance is ``stub`` or
``cached_sample`` — never presented as live NASA/IRSA metadata.

When ``use_irsa`` is enabled (constructor flag or env ``SPHEREX_USE_IRSA=1``),
``search`` / ``epochs`` call P4 ``search_observations``. Successful IRSA
queries are labeled ``live``. Network / client failures fall back to fixtures
so the demo stays offline-capable.
"""

from __future__ import annotations

import json
import logging
import math
import os
from collections.abc import Callable
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any
from app.science.spherex_data.timing import get_timeline_metadata
from app.science.spherex_data.bands import classify_wavelength

# Repo root: backend/app/services/catalog.py → parents[3] = repo root
_REPO_ROOT = Path(__file__).resolve().parents[3]
_DATA_DIR = _REPO_ROOT / "data"
_METADATA_DIR = _DATA_DIR / "metadata"
_SAMPLES_DIR = _DATA_DIR / "samples"
_RAW_DIR = _DATA_DIR / "raw"

DEFAULT_SEARCH_RADIUS_ARCSEC = 60.0
DEFAULT_EPOCH_RADIUS_ARCSEC = 120.0

# Provenance labels (OpenAPI enum): stub | cached_sample | live
PROVENANCE_STUB = "stub"
PROVENANCE_CACHED_SAMPLE = "cached_sample"
PROVENANCE_LIVE = "live"

logger = logging.getLogger(__name__)

# Optional injectable for unit tests (no network).
SearchObservationsFn = Callable[..., dict[str, Any]]


@dataclass(frozen=True)
class SearchResult:
    hits: list[dict[str, Any]]
    provenance: str


@dataclass(frozen=True)
class EpochsResult:
    epochs: list[dict[str, Any]]
    provenance: str


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


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


def _arcsec_to_deg(radius_arcsec: float) -> float:
    return float(radius_arcsec) / 3600.0


def _wavelength_um_from_record(rec: Any) -> float | None:
    """Midpoint wavelength in µm from IRSA em_min/em_max (meters), if present."""
    em_min = getattr(rec, "em_min_m", None)
    em_max = getattr(rec, "em_max_m", None)
    if em_min is not None and em_max is not None:
        return ((float(em_min) + float(em_max)) / 2.0) * 1e6
    if em_min is not None:
        return float(em_min) * 1e6
    if em_max is not None:
        return float(em_max) * 1e6
    return None


def _observation_records(payload: dict[str, Any]) -> list[Any]:
    """Prefer internal ObservationRecord list; else rebuild is not needed."""
    records = payload.get("_records")
    if isinstance(records, list):
        return records
    return []


class CatalogService:
    """Fixture-backed catalog with optional P4 IRSA live path."""

    def __init__(
        self,
        *,
        targets_path: Path | None = None,
        epochs_path: Path | None = None,
        samples_dir: Path | None = None,
        raw_dir: Path | None = None,
        use_irsa: bool | None = None,
        search_observations_fn: SearchObservationsFn | None = None,
    ) -> None:
        self._targets_path = targets_path or (_METADATA_DIR / "targets.json")
        self._epochs_path = epochs_path or (_METADATA_DIR / "epochs.json")
        self._samples_dir = samples_dir or _SAMPLES_DIR
        self._raw_dir = raw_dir or _RAW_DIR
        self._use_irsa = (
            _env_flag("SPHEREX_USE_IRSA", default=False)
            if use_irsa is None
            else bool(use_irsa)
        )
        self._search_observations_fn = search_observations_fn
        # obs_id → local FITS from a live P4 download in this process (no invent).
        self._live_fits: dict[str, Path] = {}

    def _targets_payload(self) -> dict[str, Any]:
        return _load_json(self._targets_path)

    def _epochs_payload(self) -> dict[str, Any]:
        return _load_json(self._epochs_path)

    def _irsa_search(
        self, *, ra: float, dec: float, radius_arcsec: float
    ) -> dict[str, Any]:
        """Call P4 search_observations (or test double). Raises on failure."""
        fn = self._search_observations_fn
        if fn is None:
            from app.science.spherex_data import search_observations as fn  # noqa: PLC0415

        return fn(ra, dec, _arcsec_to_deg(radius_arcsec))

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
        # Live IRSA path only when coords are present and IRSA is enabled.
        if self._use_irsa and ra is not None and dec is not None:
            radius = (
                DEFAULT_SEARCH_RADIUS_ARCSEC
                if radius_arcsec is None
                else float(radius_arcsec)
            )
            try:
                payload = self._irsa_search(ra=ra, dec=dec, radius_arcsec=radius)
                hits = self._hits_from_irsa(payload, q=q)
                return SearchResult(hits=hits, provenance=PROVENANCE_LIVE)
            except Exception as exc:  # noqa: BLE001 — fall back offline
                logger.warning(
                    "IRSA search failed; falling back to fixtures: %s", exc
                )

        return self._search_fixtures(
            q=q, ra=ra, dec=dec, radius_arcsec=radius_arcsec
        )

    def _search_fixtures(
        self,
        *,
        q: str | None,
        ra: float | None,
        dec: float | None,
        radius_arcsec: float | None,
    ) -> SearchResult:
        payload = self._targets_payload()
        provenance = str(payload.get("provenance", PROVENANCE_STUB))
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

    def _hits_from_irsa(
        self, payload: dict[str, Any], *, q: str | None
    ) -> list[dict[str, Any]]:
        """Map P4 ObservationRecord rows → SearchHit without inventing names."""
        hits: list[dict[str, Any]] = []
        needle = q.strip().lower() if q is not None and q.strip() else None

        for rec in _observation_records(payload):
            # SearchHit requires numeric ra/dec — skip rows IRSA left without coords.
            if rec.ra is None or rec.dec is None:
                continue
            obs_id = str(rec.obs_id)
            # Prefer real IRSA labels; never invent a sky-object name.
            name = rec.band_label or rec.collection or obs_id
            if needle is not None:
                hay = " ".join(
                    str(x)
                    for x in (obs_id, name, rec.collection, rec.band_label)
                    if x
                ).lower()
                if needle not in hay:
                    continue
            hit: dict[str, Any] = {
                "id": obs_id,
                "name": name,
                "ra": rec.ra,
                "dec": rec.dec,
            }
            if rec.collection:
                hit["notes"] = f"IRSA collection={rec.collection}"
            hits.append(hit)
        return hits

    def epochs(
        self,
        *,
        ra: float,
        dec: float,
        radius_arcsec: float | None = None,
        band: str | None = None,
    ) -> EpochsResult:
        radius = (
            DEFAULT_EPOCH_RADIUS_ARCSEC
            if radius_arcsec is None
            else float(radius_arcsec)
        )

        if self._use_irsa:
            try:
                payload = self._irsa_search(ra=ra, dec=dec, radius_arcsec=radius)
                rows = self._epochs_from_irsa(payload, band=band)
                return EpochsResult(epochs=rows, provenance=PROVENANCE_LIVE)
            except Exception as exc:  # noqa: BLE001 — fall back offline
                logger.warning(
                    "IRSA epochs failed; falling back to fixtures: %s", exc
                )

        return self._epochs_fixtures(ra=ra, dec=dec, radius=radius, band=band)

    def _epochs_fixtures(
        self,
        *,
        ra: float,
        dec: float,
        radius: float,
        band: str | None,
    ) -> EpochsResult:
        payload = self._epochs_payload()
        provenance = str(payload.get("provenance", PROVENANCE_STUB))
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
            obs_id = str(row["obs_id"])
            # Honest preview_url: only when a local FITS resolves (else null → FE
            # should not fetch a URL that 501s). Never invent collection/source_url.
            preview_url = (
                f"/api/preview/{obs_id}"
                if self.resolve_preview_fits(obs_id) is not None
                else None
            )
            rows.append(
                {
                    "obs_id": obs_id,
                    "ra": row.get("ra"),
                    "dec": row.get("dec"),
                    "t_mjd": row.get("t_mjd"),
                    "bandpass": row.get("bandpass"),
                    "wavelength_um": row.get("wavelength_um"),
                    "preview_url": preview_url,
                    "provenance": row.get("provenance", provenance),
                }
                        )
            epoch.update(get_timeline_metadata(epoch))
            spectral = classify_wavelength(epoch.get("wavelength_um"))
            if spectral:
                epoch.update(spectral)
                epoch["band"] = spectral["detector"]
            rows.append(epoch)

        rows.sort(
            key=lambda e: (
                e["t_mjd"] is None,
                e["t_mjd"] if e["t_mjd"] is not None else 0.0,
            )
        )
        return EpochsResult(epochs=rows, provenance=provenance)

    def _epochs_from_irsa(
        self, payload: dict[str, Any], *, band: str | None
    ) -> list[dict[str, Any]]:
        """Map P4 ObservationRecord → Epoch contract fields."""
        rows: list[dict[str, Any]] = []
        for rec in _observation_records(payload):
            bandpass = rec.band_label
            if band is not None and band.strip():
                if bandpass is None or band.strip().lower() not in str(
                    bandpass
                ).lower():
                    continue

            obs_id = str(rec.obs_id)
            # Optional P4 cutout already on disk (download_observation) — register
            # for /api/preview without inventing paths or fetching in this request.
            fits_path_attr = getattr(rec, "fits_path", None)
            if fits_path_attr:
                candidate = Path(str(fits_path_attr))
                if candidate.is_file():
                    self._live_fits[obs_id] = candidate.resolve()

            preview_url = (
                f"/api/preview/{obs_id}"
                if self.resolve_preview_fits(obs_id) is not None
                else None
            )

            epoch: dict[str, Any] = {
                "obs_id": obs_id,
                "ra": rec.ra,
                "dec": rec.dec,
                "t_mjd": rec.t_min_mjd,
                "bandpass": bandpass,
                "wavelength_um": _wavelength_um_from_record(rec),
                "preview_url": preview_url,
                "provenance": PROVENANCE_LIVE,
            }
            # P4 provides these; include only when present (do not invent).
            if rec.collection:
                epoch["collection"] = rec.collection
            access = (rec.access_url or "").strip()
            if access:
                epoch["source_url"] = access
            rows.append(epoch)

        rows.sort(
            key=lambda e: (
                e["t_mjd"] is None,
                e["t_mjd"] if e["t_mjd"] is not None else 0.0,
            )
        )
        return rows

    def _safe_data_path(self, path: Path) -> Path | None:
        """Return ``path`` only if it is a file under allowed data roots.

        Allowed roots: repo ``data/``, plus this instance's ``samples_dir`` /
        ``raw_dir`` (so tests and alternate layouts work without path escape).
        """
        try:
            resolved = path.resolve()
        except OSError:
            return None
        allowed = (
            _DATA_DIR.resolve(),
            self._samples_dir.resolve(),
            self._raw_dir.resolve(),
        )
        resolved_s = str(resolved)
        if not any(
            resolved_s == str(root) or resolved_s.startswith(str(root) + "/")
            for root in allowed
        ):
            return None
        return resolved if resolved.is_file() else None

    def resolve_preview_fits(self, obs_id: str) -> Path | None:
        """Return local FITS path for ``obs_id`` when a real file exists.

        Resolution order (first hit wins):
        1. In-process P4 ``fits_path`` registered from a live download
        2. ``fits_sample`` relative path from ``epochs.json``
        3. ``data/samples/{obs_id}.fits``
        4. ``data/raw/{obs_id}.fits`` (optional drop-in for P4 cutouts)

        Returns ``None`` when no file is present — callers must set
        ``preview_url`` to null / respond 501 (never invent NASA products).
        """
        live = self._live_fits.get(obs_id)
        if live is not None:
            found = self._safe_data_path(live)
            if found is not None:
                return found

        payload = self._epochs_payload()
        for row in payload.get("epochs", []):
            if row.get("obs_id") != obs_id:
                continue
            rel = row.get("fits_sample")
            if rel:
                found = self._safe_data_path(_DATA_DIR / str(rel))
                if found is not None:
                    return found
            break

        for candidate in (
            self._samples_dir / f"{obs_id}.fits",
            self._raw_dir / f"{obs_id}.fits",
        ):
            found = self._safe_data_path(candidate)
            if found is not None:
                return found
        return None


@lru_cache(maxsize=1)
def get_catalog_service() -> CatalogService:
    return CatalogService()
