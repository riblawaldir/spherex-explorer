"""SPHEREx detector band metadata from the IRSA explanatory supplement."""

from __future__ import annotations

from dataclasses import dataclass
import math


@dataclass(frozen=True)
class SpectralBand:
    detector: str
    wavelength_min_um: float
    wavelength_max_um: float
    resolving_power: int


# Design wavelength coverage / resolving powers (SSDC-DP-017, Table 2).
BANDS = (
    SpectralBand("SPHEREx-D1", 0.744, 1.116, 39),
    SpectralBand("SPHEREx-D2", 1.099, 1.651, 41),
    SpectralBand("SPHEREx-D3", 1.636, 2.421, 41),
    SpectralBand("SPHEREx-D4", 2.423, 3.822, 35),
    SpectralBand("SPHEREx-D5", 3.809, 4.420, 112),
    SpectralBand("SPHEREx-D6", 4.412, 5.002, 128),
)
_BY_DETECTOR = {band.detector: band for band in BANDS}


def get_band_metadata(detector: str | int | None) -> dict | None:
    """Return official design metadata for D1-D6; unknown inputs return None."""
    if detector is None:
        return None
    key = str(detector).upper().replace("SPHEREX-", "")
    if key.isdigit():
        key = f"D{key}"
    band = _BY_DETECTOR.get(f"SPHEREx-{key}")
    if band is None:
        return None
    return {
        "detector": band.detector,
        "wavelength_min_um": band.wavelength_min_um,
        "wavelength_max_um": band.wavelength_max_um,
        "resolving_power": band.resolving_power,
    }


def classify_wavelength(wavelength_um: float | None) -> dict | None:
    """Classify a wavelength only when it lies in exactly one design band.

    Published detector design ranges overlap slightly. Values in an overlap
    are intentionally left unclassified unless the detector is supplied.
    """
    if wavelength_um is None or isinstance(wavelength_um, bool):
        return None
    try:
        value = float(wavelength_um)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(value):
        return None
    matches = [b for b in BANDS if b.wavelength_min_um <= value <= b.wavelength_max_um]
    return get_band_metadata(matches[0].detector) if len(matches) == 1 else None


def classify_band(wavelength_min_m: float | None, wavelength_max_m: float | None,
                  detector: str | int | None = None) -> dict | None:
    """Classify an SIA wavelength interval (meters) or a known detector."""
    explicit = get_band_metadata(detector)
    if explicit is not None:
        return explicit
    if wavelength_min_m is None or wavelength_max_m is None:
        return None
    try:
        low, high = float(wavelength_min_m) * 1e6, float(wavelength_max_m) * 1e6
    except (TypeError, ValueError):
        return None
    if not (math.isfinite(low) and math.isfinite(high) and 0 < low <= high):
        return None
    return classify_wavelength((low + high) / 2)
