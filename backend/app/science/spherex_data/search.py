"""
search.py — Búsqueda y validación de observaciones SPHEREx en IRSA.

Implementa search_observations(ra, dec, radius_deg) y la normalización
de resultados del servicio SIA2 a un formato JSON consistente.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from astropy.table import Table
from astropy.time import Time

from .client import IRSAClient
from .config import (
    DEC_MAX, DEC_MIN,
    RA_MAX, RA_MIN,
    RADIUS_MAX_DEG, RADIUS_MIN_DEG,
    DEFAULT_COLLECTIONS,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Modelo de datos: ObservationRecord
# ---------------------------------------------------------------------------

@dataclass
class ObservationRecord:
    """
    Representa una observación SPHEREx recuperada de IRSA.

    Todos los campos provienen directamente de la respuesta SIA2 de IRSA.
    No se inventan ni se rellenan campos ausentes con valores ficticios.
    """
    obs_id: str                          # Identificador de observación
    collection: str                      # Colección IRSA (p.ej. 'spherex_dr1')
    access_url: str                      # URL de acceso al archivo FITS
    ra: Optional[float] = None           # RA central del campo (grados)
    dec: Optional[float] = None          # Dec central del campo (grados)
    t_min_mjd: Optional[float] = None   # Inicio de observación (MJD)
    t_max_mjd: Optional[float] = None   # Fin de observación (MJD)
    observed_at: Optional[str] = None   # ISO 8601 derivado de t_min
    em_min_m: Optional[float] = None    # Longitud de onda mínima (metros)
    em_max_m: Optional[float] = None    # Longitud de onda máxima (metros)
    band_label: Optional[str] = None    # Etiqueta de banda derivada de em_*
    instrument_name: Optional[str] = None
    facility_name: Optional[str] = None
    fits_path: Optional[str] = None     # Ruta local si se descargó el archivo
    extra: dict = field(default_factory=dict)  # Columnas adicionales del SIA2

    def to_dict(self) -> dict:
        """Serializa el registro a dict JSON-compatible."""
        return {
            "id": self.obs_id,
            "collection": self.collection,
            "access_url": self.access_url,
            "ra": self.ra,
            "dec": self.dec,
            "t_min_mjd": self.t_min_mjd,
            "t_max_mjd": self.t_max_mjd,
            "observed_at": self.observed_at,
            "em_min_m": self.em_min_m,
            "em_max_m": self.em_max_m,
            "band_label": self.band_label,
            "instrument_name": self.instrument_name,
            "facility_name": self.facility_name,
            "fits_path": self.fits_path,
        }


# ---------------------------------------------------------------------------
# Validación de coordenadas
# ---------------------------------------------------------------------------

class CoordinateValidationError(ValueError):
    """Error de validación de coordenadas astronómicas."""
    pass


def validate_coordinates(ra: float, dec: float, radius_deg: float) -> None:
    """
    Valida coordenadas astronómicas y radio de búsqueda.

    Args:
        ra: Ascensión recta en grados (0–360).
        dec: Declinación en grados (−90 a +90).
        radius_deg: Radio de búsqueda en grados.

    Raises:
        CoordinateValidationError: Si algún parámetro está fuera de rango.
        TypeError: Si los parámetros no son numéricos.
    """
    for name, val in (("ra", ra), ("dec", dec), ("radius_deg", radius_deg)):
        if not isinstance(val, (int, float)):
            raise TypeError(f"'{name}' debe ser numérico, se recibió {type(val).__name__}")

    if not (RA_MIN <= ra <= RA_MAX):
        raise CoordinateValidationError(
            f"RA={ra} fuera de rango [{RA_MIN}, {RA_MAX}]"
        )
    if not (DEC_MIN <= dec <= DEC_MAX):
        raise CoordinateValidationError(
            f"Dec={dec} fuera de rango [{DEC_MIN}, {DEC_MAX}]"
        )
    if not (RADIUS_MIN_DEG <= radius_deg <= RADIUS_MAX_DEG):
        raise CoordinateValidationError(
            f"radio={radius_deg}° fuera de rango [{RADIUS_MIN_DEG}, {RADIUS_MAX_DEG}]"
        )


# ---------------------------------------------------------------------------
# Normalización de filas SIA2
# ---------------------------------------------------------------------------

def _safe_get(row, col_name: str, default=None):
    """Lee una columna de una fila de Table sin lanzar KeyError."""
    try:
        val = row[col_name]
        # astropy puede devolver masked scalars
        if hasattr(val, "mask") and val.mask:
            return default
        # Convertir a tipo Python nativo si es posible
        try:
            return val.item()
        except (AttributeError, ValueError):
            return val
    except (KeyError, TypeError):
        return default


def _mjd_to_iso(mjd: Optional[float]) -> Optional[str]:
    """Convierte MJD a cadena ISO 8601 UTC. Retorna None si mjd es None."""
    if mjd is None:
        return None
    try:
        return Time(mjd, format="mjd", scale="utc").isot + "Z"
    except Exception:
        return None


def _derive_band_label(em_min_m: Optional[float], em_max_m: Optional[float]) -> Optional[str]:
    """
    Genera una etiqueta de banda legible a partir de los límites en metros.

    SPHEREx cubre ~0.75–5.0 µm con 102 bandas espectrales (R~40–130).
    Este etiquetado es orientativo basado en los límites reales de la observación.
    """
    if em_min_m is None or em_max_m is None:
        return None
    um_min = em_min_m * 1e6
    um_max = em_max_m * 1e6
    return f"{um_min:.3f}–{um_max:.3f} µm"


def normalize_sia2_row(row, available_columns: list[str]) -> ObservationRecord:
    """
    Convierte una fila de la tabla SIA2 a un ObservationRecord.

    Args:
        row: Fila de astropy.table.Table.
        available_columns: Columnas presentes en la tabla (para evitar KeyError).

    Returns:
        ObservationRecord con los campos disponibles.
    """
    # Columnas estándar SIA2 — verificadas en IRSA
    # Nota: los nombres reales pueden variar; usamos _safe_get para robustez
    obs_id = (
        _safe_get(row, "obs_id")
        or _safe_get(row, "obs_publisher_did")
        or "unknown"
    )
    collection = (
        _safe_get(row, "obs_collection")
        or _safe_get(row, "collection")
        or "unknown"
    )
    access_url = _safe_get(row, "access_url") or ""

    t_min = _safe_get(row, "t_min")
    t_max = _safe_get(row, "t_max")
    em_min = _safe_get(row, "em_min")
    em_max = _safe_get(row, "em_max")

    # Recoger todas las columnas restantes como 'extra'
    standard_cols = {
        "obs_id", "obs_publisher_did", "obs_collection", "collection",
        "access_url", "t_min", "t_max", "em_min", "em_max",
        "s_ra", "s_dec", "instrument_name", "facility_name",
    }
    extra = {
        col: _safe_get(row, col)
        for col in available_columns
        if col not in standard_cols and _safe_get(row, col) is not None
    }

    return ObservationRecord(
        obs_id=str(obs_id),
        collection=str(collection),
        access_url=str(access_url),
        ra=_safe_get(row, "s_ra"),
        dec=_safe_get(row, "s_dec"),
        t_min_mjd=float(t_min) if t_min is not None else None,
        t_max_mjd=float(t_max) if t_max is not None else None,
        observed_at=_mjd_to_iso(float(t_min) if t_min is not None else None),
        em_min_m=float(em_min) if em_min is not None else None,
        em_max_m=float(em_max) if em_max is not None else None,
        band_label=_derive_band_label(
            float(em_min) if em_min is not None else None,
            float(em_max) if em_max is not None else None,
        ),
        instrument_name=_safe_get(row, "instrument_name"),
        facility_name=_safe_get(row, "facility_name"),
        extra=extra,
    )


# ---------------------------------------------------------------------------
# Función principal: search_observations
# ---------------------------------------------------------------------------

def search_observations(
    ra: float,
    dec: float,
    radius_deg: float,
    collections: Optional[list[str]] = None,
    client: Optional[IRSAClient] = None,
) -> dict:
    """
    Busca observaciones SPHEREx reales en IRSA para las coordenadas dadas.

    Args:
        ra: Ascensión recta en grados decimales (J2000).
        dec: Declinación en grados decimales (J2000).
        radius_deg: Radio de búsqueda en grados.
        collections: Colecciones IRSA a consultar. Por defecto DR1 + QR3.
        client: Instancia de IRSAClient. Si es None, crea una nueva.

    Returns:
        Diccionario con la región buscada y la lista de observaciones encontradas.
        Ejemplo de estructura:
        {
            "region": {"ra": 127.69, "dec": -39.17, "radius_deg": 0.01},
            "query": {"collections": [...], "timestamp": "..."},
            "count": 3,
            "observations": [ObservationRecord.to_dict(), ...]
        }

    Raises:
        CoordinateValidationError: Si las coordenadas son inválidas.
        ConnectionError: Si falla la conexión con IRSA.
    """
    # 1. Validar coordenadas
    validate_coordinates(ra, dec, radius_deg)

    # 2. Preparar cliente
    if client is None:
        client = IRSAClient(collections=collections or DEFAULT_COLLECTIONS)
    target_collections = collections or client.collections

    logger.info(
        "Iniciando búsqueda | RA=%.5f Dec=%.5f radio=%.4f°",
        ra, dec, radius_deg,
    )

    # 3. Consultar SIA2
    table: Table = client.query_sia(ra, dec, radius_deg, target_collections)

    # 4. Manejar resultado vacío
    if table is None or len(table) == 0:
        logger.info("No se encontraron observaciones SPHEREx en la región solicitada.")
        return {
            "region": {"ra": ra, "dec": dec, "radius_deg": radius_deg},
            "query": {
                "collections": target_collections,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            "count": 0,
            "observations": [],
            "warning": "No se encontraron observaciones en esta región.",
        }

    # 5. Normalizar filas
    available_cols = list(table.colnames)
    logger.info("Columnas SIA2 disponibles: %s", available_cols)

    records: list[ObservationRecord] = []
    for row in table:
        try:
            rec = normalize_sia2_row(row, available_cols)
            records.append(rec)
        except Exception as exc:
            logger.warning("Error normalizando fila SIA2: %s", exc)

    logger.info("Observaciones normalizadas: %d", len(records))

    return {
        "region": {"ra": ra, "dec": dec, "radius_deg": radius_deg},
        "query": {
            "collections": target_collections,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "sia2_columns": available_cols,
        },
        "count": len(records),
        "observations": [r.to_dict() for r in records],
        "_records": records,  # Objetos internos para uso por otros módulos
    }

