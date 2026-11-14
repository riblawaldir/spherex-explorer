"""
__init__.py — SPHEREx Data Acquisition Module

Módulo Python para adquisición, descarga y organización de observaciones
astronómicas reales de SPHEREx desde NASA/IPAC IRSA.

Desarrollado para NASA Space Apps Challenge 2026 — "Planet X and SPHEREx".

Integración:
  - Backend: exponible vía FastAPI (Integrante 3)
  - Procesamiento: datos preparados para AstroPy image processing (Integrante 5)

Fuentes de datos:
  - NASA/IPAC Infrared Science Archive (IRSA): https://irsa.ipac.caltech.edu/
  - SPHEREx DR1 y QR3 vía protocolo SIA2

Autores: Integrante 4 — Datos y procesamiento astronómico
"""

from .search import search_observations, ObservationRecord, CoordinateValidationError
from .downloader import download_cutout, download_observation
from .metadata import extract_metadata
from .observations import organize_observations
from .client import IRSAClient
from . import config

__version__ = "1.0.0"
__all__ = [
    "search_observations",
    "download_cutout",
    "download_observation",
    "extract_metadata",
    "organize_observations",
    "get_spherex_data",
    "IRSAClient",
    "ObservationRecord",
    "CoordinateValidationError",
    "config",
]


def get_spherex_data(
    ra: float,
    dec: float,
    radius_deg: float,
    collections: list[str] | None = None,
    download_cutouts: bool = False,
    cutout_size_deg: float = 0.05,
) -> dict:
    """
    Función de integración principal del módulo SPHEREx Data.

    Coordina: búsqueda → (descarga) → organización temporal.
    Produce una estructura JSON lista para consumir desde FastAPI.

    Args:
        ra: Ascensión recta en grados decimales (J2000, 0–360).
        dec: Declinación en grados decimales (J2000, −90 a +90).
        radius_deg: Radio de búsqueda en grados.
        collections: Colecciones IRSA a consultar.
                     Por defecto: ['spherex_dr1', 'spherex_qr3'].
        download_cutouts: Si True, intenta descargar recortes FITS.
                          Por defecto False (modo solo-metadatos).
        cutout_size_deg: Tamaño del recorte en grados si download_cutouts=True.

    Returns:
        Diccionario JSON con estructura:
        {
            "region": {...},
            "query": {...},
            "count": int,
            "observations": [...],
            "organized": {
                "sorted_observations": [...],
                "groups": [...],
                "comparable_pairs": [...],
                "warnings": [...],
                "statistics": {...}
            }
        }

    Example:
        >>> result = get_spherex_data(ra=127.69444, dec=-39.17760, radius_deg=0.01)
        >>> print(result["count"], "observaciones encontradas")
        >>> for obs in result["observations"]:
        ...     print(obs["id"], obs["observed_at"], obs["band_label"])
    """
    # 1. Buscar observaciones
    search_result = search_observations(ra, dec, radius_deg, collections)

    # 2. Recuperar objetos internos para procesamiento
    records: list[ObservationRecord] = search_result.pop("_records", [])

    # 3. Descargar recortes si se solicita
    if download_cutouts and records:
        for rec in records:
            download_observation(
                rec,
                cutout_size_deg=cutout_size_deg,
                center_ra=ra,
                center_dec=dec,
            )
        # Actualizar la lista serializada con fits_path
        search_result["observations"] = [r.to_dict() for r in records]

    # 4. Organizar temporalmente
    organized = organize_observations(records)

    # 5. Construir respuesta final
    return {
        **search_result,
        "organized": organized,
    }

