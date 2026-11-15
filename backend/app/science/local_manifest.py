"""Operator allowlist of local FITS files.

Web clients never supply filesystem paths. The only files this module
returns are those named by ``SPHEREX_P5_LOCAL_MANIFEST``, and only after
the recorded SHA-256 matches the bytes on disk. Provenance is
``local_real_fits``. The label ``live`` is rejected: a file that once
came from IRSA is not a live query.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path

PROVENANCE_LOCAL_REAL = "local_real_fits"
ENV_NAME = "SPHEREX_P5_LOCAL_MANIFEST"
_ALLOWED_CATEGORIES = frozenset({"A", "B", "not_classified"})
logger = logging.getLogger(__name__)

# (path, mtime_ns, size, expected hash) -> verified path
_verified: dict[tuple[str, int, int, str], Path] = {}


class ManifestError(ValueError):
    """The manifest is present but does not meet the allowlist contract."""


@dataclass(frozen=True)
class LocalObservation:
    obs_id: str
    path: Path
    sha256: str
    ra: float
    dec: float
    t_mjd: float | None
    bandpass: str
    wavelength_um: float | None = None
    collection: str | None = None
    source_url: str | None = None
    detector: str | None = None


@dataclass(frozen=True)
class LocalPair:
    obs_id_a: str
    obs_id_b: str
    category: str
    exploratory_spectral_note: str | None
    warnings: tuple[str, ...]


@dataclass(frozen=True)
class LocalManifest:
    observations: tuple[LocalObservation, ...]
    pairs: tuple[LocalPair, ...]

    def observation(self, obs_id: str) -> LocalObservation | None:
        for row in self.observations:
            if row.obs_id == obs_id:
                return row
        return None

    def pair(self, obs_id_a: str, obs_id_b: str) -> LocalPair | None:
        wanted = {obs_id_a, obs_id_b}
        for row in self.pairs:
            if {row.obs_id_a, row.obs_id_b} == wanted and obs_id_a != obs_id_b:
                return row
        return None


def cutout_center_radec(header, naxis1: int, naxis2: int) -> tuple[float, float]:
    """Sky position of the image center, in degrees.

    A SPHEREx cutout keeps the detector reference pixel. That pixel can fall
    outside the cutout, so CRVAL is not the coordinate a user should search.
    """
    from astropy.wcs import WCS

    sky = WCS(header).pixel_to_world((naxis1 + 1) / 2 - 1, (naxis2 + 1) / 2 - 1)
    return float(sky.ra.deg), float(sky.dec.deg)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _require_str(row: dict, key: str) -> str:
    value = row.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ManifestError(f"{key} must be a non-empty string")
    return value.strip()


def _optional_str(row: dict, key: str) -> str | None:
    value = row.get(key)
    if value is None:
        return None
    if not isinstance(value, str) or not value.strip():
        raise ManifestError(f"{key} must be a string when present")
    return value.strip()


def _optional_float(row: dict, key: str) -> float | None:
    value = row.get(key)
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ManifestError(f"{key} must be a number when present")
    number = float(value)
    if number != number or number in (float("inf"), float("-inf")):
        raise ManifestError(f"{key} must be finite")
    return number


def _parse_observation(row: object) -> LocalObservation:
    if not isinstance(row, dict):
        raise ManifestError("each observation must be an object")
    provenance = row.get("provenance", PROVENANCE_LOCAL_REAL)
    if provenance != PROVENANCE_LOCAL_REAL:
        raise ManifestError(
            "local observations must use provenance local_real_fits, never live"
        )
    obs_id = _require_str(row, "obs_id")
    if any(token in obs_id for token in ("/", "\\", "..")):
        raise ManifestError("obs_id must not contain a path")
    raw_path = _require_str(row, "path")
    path = Path(raw_path)
    if not path.is_absolute():
        raise ManifestError("observation path must be absolute")
    sha = _require_str(row, "sha256").lower()
    if len(sha) != 64 or any(c not in "0123456789abcdef" for c in sha):
        raise ManifestError("sha256 must be 64 hexadecimal characters")
    ra = _optional_float(row, "ra")
    dec = _optional_float(row, "dec")
    if ra is None or dec is None or not 0 <= ra <= 360 or not -90 <= dec <= 90:
        raise ManifestError("ra/dec must be finite degrees in range")
    source = _optional_str(row, "source_url")
    if source is not None and not source.startswith(("https://", "http://")):
        raise ManifestError("source_url must be http(s) when present")
    return LocalObservation(
        obs_id=obs_id,
        path=path,
        sha256=sha,
        ra=ra,
        dec=dec,
        t_mjd=_optional_float(row, "t_mjd"),
        bandpass=_require_str(row, "bandpass"),
        wavelength_um=_optional_float(row, "wavelength_um"),
        collection=_optional_str(row, "collection"),
        source_url=source,
        detector=_optional_str(row, "detector"),
    )


def _parse_pair(row: object, known_ids: set[str]) -> LocalPair:
    if not isinstance(row, dict):
        raise ManifestError("each pair must be an object")
    obs_id_a = _require_str(row, "obs_id_a")
    obs_id_b = _require_str(row, "obs_id_b")
    if obs_id_a == obs_id_b or obs_id_a not in known_ids or obs_id_b not in known_ids:
        raise ManifestError("pair ids must be two distinct allowlisted observations")
    category = _require_str(row, "category")
    if category not in _ALLOWED_CATEGORIES:
        raise ManifestError("category must be A, B, or not_classified")
    warnings = row.get("warnings", [])
    if not isinstance(warnings, list) or not all(isinstance(item, str) for item in warnings):
        raise ManifestError("pair warnings must be a list of strings")
    return LocalPair(
        obs_id_a=obs_id_a,
        obs_id_b=obs_id_b,
        category=category,
        exploratory_spectral_note=_optional_str(row, "exploratory_spectral_note"),
        warnings=tuple(warnings),
    )


def read_manifest(path: Path) -> LocalManifest:
    """Parse a manifest file. Raises ManifestError when the contract fails."""
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ManifestError(f"manifest is not readable JSON: {exc}") from exc
    if not isinstance(payload, dict):
        raise ManifestError("manifest must be a JSON object")
    raw_rows = payload.get("observations")
    if not isinstance(raw_rows, list) or not raw_rows:
        raise ManifestError("observations must be a non-empty list")
    observations = tuple(_parse_observation(row) for row in raw_rows)
    ids = [row.obs_id for row in observations]
    if len(ids) != len(set(ids)):
        raise ManifestError("obs_id values must be unique")
    raw_pairs = payload.get("pairs", [])
    if not isinstance(raw_pairs, list):
        raise ManifestError("pairs must be a list when present")
    known = set(ids)
    pairs = tuple(_parse_pair(row, known) for row in raw_pairs)
    return LocalManifest(observations=observations, pairs=pairs)


def load_manifest() -> LocalManifest | None:
    """Return the env-selected manifest, or None when unset or invalid.

    An invalid file is logged and ignored so a bad local path cannot take
    down fixture endpoints. It also cannot widen the allowlist.
    """
    raw = os.environ.get(ENV_NAME)
    if raw is None or not raw.strip():
        return None
    path = Path(raw.strip())
    try:
        return read_manifest(path)
    except ManifestError as exc:
        logger.warning("Ignoring local FITS manifest %s: %s", path, exc)
        return None


def manifest_claims(obs_id: str) -> bool:
    manifest = load_manifest()
    return manifest is not None and manifest.observation(obs_id) is not None


def resolve_allowed_fits(obs_id: str) -> Path | None:
    """Return the allowlisted file only when its SHA-256 matches."""
    manifest = load_manifest()
    if manifest is None:
        return None
    row = manifest.observation(obs_id)
    if row is None or not row.path.is_file():
        return None
    try:
        stat = row.path.stat()
    except OSError:
        return None
    key = (str(row.path), stat.st_mtime_ns, stat.st_size, row.sha256)
    cached = _verified.get(key)
    if cached is not None:
        return cached
    try:
        digest = sha256_file(row.path)
    except OSError:
        return None
    if digest.lower() != row.sha256:
        logger.warning("SHA-256 mismatch for allowlisted obs_id %s", obs_id)
        return None
    _verified[key] = row.path
    return row.path


def pair_for(obs_id_a: str, obs_id_b: str) -> LocalPair | None:
    manifest = load_manifest()
    if manifest is None:
        return None
    return manifest.pair(obs_id_a, obs_id_b)
