"""Normalize SPHEREx times without inferring undocumented survey cycles."""

from __future__ import annotations

import math
import re
from astropy.time import Time

_PLANNING_PERIOD = re.compile(r"(?<![A-Z0-9])(\d{4}W\d{2}_[A-Z0-9]+)(?:_|$)", re.I)


def mjd_to_utc(mjd: float | None) -> str | None:
    """Convert finite Modified Julian Date to UTC ISO-8601, or None."""
    if mjd is None or isinstance(mjd, bool):
        return None
    try:
        value = float(mjd)
        if not math.isfinite(value) or value < 0:
            return None
        return Time(value, format="mjd", scale="utc").isot + "Z"
    except (TypeError, ValueError, OverflowError):
        return None


def parse_planning_period(obs_id: str | None) -> str | None:
    """Extract the encoded YYYYWnn_plan token from a SPHEREx observation ID."""
    if not obs_id:
        return None
    match = _PLANNING_PERIOD.search(str(obs_id))
    return match.group(1).upper() if match else None


def normalize_timing(*, obs_id: str | None = None, mjd: float | None = None,
                     t_min_mjd: float | None = None, t_max_mjd: float | None = None,
                     exposure_seconds: float | None = None) -> dict:
    """Return known temporal metadata. Exposure is never guessed from MJD bounds."""
    start = mjd if mjd is not None else t_min_mjd
    try:
        exposure = float(exposure_seconds) if exposure_seconds is not None else None
        if exposure is not None and (not math.isfinite(exposure) or exposure < 0):
            exposure = None
    except (TypeError, ValueError):
        exposure = None
    return {
        "observed_at": mjd_to_utc(start),
        "mjd": start if start is None or mjd_to_utc(start) is not None else None,
        "t_min_mjd": t_min_mjd,
        "t_max_mjd": t_max_mjd,
        "exposure_seconds": exposure,
        "planning_period": parse_planning_period(obs_id),
        "survey_cycle": None,
    }


def get_timeline_metadata(observation) -> dict:
    """Build the stable timeline payload from an ObservationRecord or fixture."""
    def value(name, fallback=None):
        if isinstance(observation, dict):
            return observation.get(name, fallback)
        return getattr(observation, name, fallback)

    obs_id = value("obs_id", value("id"))
    mjd = value("t_min_mjd", value("t_mjd"))
    timing = normalize_timing(
        obs_id=obs_id, mjd=mjd, t_min_mjd=value("t_min_mjd", mjd),
        t_max_mjd=value("t_max_mjd"),
        exposure_seconds=value("exposure_seconds", value("t_exptime")),
    )
    return {
        **timing,
        "detector": value("detector"),
        "band": value("detector", value("bandpass", value("band"))),
        "wavelength_min_um": value("wavelength_min_um"),
        "wavelength_max_um": value("wavelength_max_um"),
        "resolving_power": value("resolving_power"),
    }
