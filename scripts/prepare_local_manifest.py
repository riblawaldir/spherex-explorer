"""Write the operator allowlist for the field-P cutouts already on disk.

Reads DATE-OBS, MJD and the celestial reference from each FITS header.
Refuses a file whose SHA-256 is not the one recorded for that OBSID.
Does not download anything and does not modify the FITS.
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
from pathlib import Path

from astropy.io import fits
from astropy.time import Time

AUTHORIZED = {
    "2026W15_2A_0124_1": {
        "filename": "campoP_dr1_2026W15_2A_0124_1.fits",
        "sha256": "0c8cc3b05ea0b58d2b5e49a0e6766b6cc9d7698aed9f92ef1dab875fca0c3e3f",
        "detector": "D1",
        "bandpass": "SPHEREx-D1",
        "collection": "spherex_dr1",
    },
    "2026W18_2A_0829_1": {
        "filename": "campoP_dr1_2026W18_2A_0829_1.fits",
        "sha256": "550c012a64114b84d99ed26330171c706b0b511a86faa6c99718eb5c8eac568d",
        "detector": "D1",
        "bandpass": "SPHEREx-D1",
        "collection": "spherex_dr1",
    },
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def header_row(path: Path, obs_id: str, meta: dict) -> dict:
    digest = sha256_file(path)
    if digest != meta["sha256"]:
        raise SystemExit(f"SHA-256 distinto para {obs_id}: {digest}")
    with fits.open(path, mode="readonly", memmap=False) as hdus:
        image = None
        for hdu in hdus:
            if hdu.name.upper() == "IMAGE":
                image = hdu
                break
        if image is None:
            raise SystemExit(f"{obs_id} no tiene extensión IMAGE")
        header = image.header
        ra = header.get("CRVAL1")
        dec = header.get("CRVAL2")
        mjd = header.get("MJD-OBS")
        if mjd is None and header.get("DATE-OBS"):
            mjd = Time(str(header["DATE-OBS"]), format="isot", scale="utc").mjd
    if ra is None or dec is None or mjd is None:
        raise SystemExit(f"{obs_id} no trae RA, Dec o tiempo en la cabecera")
    return {
        "obs_id": obs_id,
        "path": str(path.resolve()),
        "sha256": digest,
        "ra": float(ra),
        "dec": float(dec),
        "t_mjd": float(mjd),
        "bandpass": meta["bandpass"],
        "detector": meta["detector"],
        "collection": meta["collection"],
        "wavelength_um": None,
        "provenance": "local_real_fits",
    }


def main() -> int:
    root = Path(os.environ.get("SPHEREX_P5_FITS_DIR", Path.home() / "Downloads" / "spherex_real_fits_p5"))
    folder = root / "seleccion_campo_p5"
    out = Path(
        os.environ.get(
            "SPHEREX_P5_LOCAL_MANIFEST",
            root / "manifiesto_local_p5.json",
        )
    )
    rows = []
    for obs_id, meta in AUTHORIZED.items():
        path = folder / meta["filename"]
        if not path.is_file():
            print(f"No está {path}", file=sys.stderr)
            return 2
        rows.append(header_row(path, obs_id, meta))
    payload = {
        "observations": rows,
        "pairs": [
            {
                "obs_id_a": "2026W15_2A_0124_1",
                "obs_id_b": "2026W18_2A_0829_1",
                "category": "B",
                "exploratory_spectral_note": (
                    "El filtro exploratorio CWAVE/CBAND se cumplió en el diagnóstico "
                    "previo. Esta API no lo certifica."
                ),
                "warnings": [
                    "Categoría B: residuos estructurados en el núcleo.",
                    "La fotometría de esta pareja está cerrada.",
                    "No hay detección de variabilidad.",
                ],
            }
        ],
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
