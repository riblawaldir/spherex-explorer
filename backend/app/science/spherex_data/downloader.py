"""
downloader.py — Descarga y recortes de archivos FITS de SPHEREx desde IRSA.

Implementa:
  - download_cutout(access_url, ra, dec, size_deg, output_path): recorte FITS
  - download_observation(observation): coordina la descarga de una observación

Servicio de recortes documentado en IRSA:
  https://irsa.ipac.caltech.edu/ibe/data/spherex/
  Parámetros: ?center=RA,DEC&size=DEGREES (aplica solo a archivos on-premises IRSA)

IMPORTANTE: No descargamos archivos FITS completos de SPHEREx sin justificación
porque los MEF pueden superar varios GB. Siempre usamos el servicio de recortes.
"""

import hashlib
import logging
import time
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse, urlencode, urlunparse, parse_qs

import requests
from astropy.io import fits

from .config import (
    MAX_RETRIES,
    RAW_DIR,
    REQUEST_TIMEOUT,
    RETRY_DELAY,
)
from .search import ObservationRecord

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_cutout_url(access_url: str, ra: float, dec: float, size_deg: float) -> str:
    """
    Construye la URL de recorte FITS añadiendo ?center=RA,DEC&size=DEG.

    Según la documentación oficial de IRSA IBE, el servicio de recortes
    se activa añadiendo estos parámetros a la URL base del archivo.
    Solo funciona para archivos alojados en on-premises IRSA (ibe/data/).

    Args:
        access_url: URL del archivo FITS de la respuesta SIA2.
        ra: Ascensión recta del centro del recorte (grados).
        dec: Declinación del centro del recorte (grados).
        size_deg: Tamaño del recorte en grados.

    Returns:
        URL completa con parámetros de recorte.
    """
    parsed = urlparse(access_url)
    cutout_params = f"center={ra},{dec}&size={size_deg}"
    if parsed.query:
        new_query = parsed.query + "&" + cutout_params
    else:
        new_query = cutout_params
    return urlunparse(parsed._replace(query=new_query))


def _url_to_filename(url: str, ra: float, dec: float, size_deg: float) -> str:
    """Genera un nombre de archivo único y legible para el recorte."""
    url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
    return f"spherex_cutout_ra{ra:.4f}_dec{dec:.4f}_sz{size_deg:.4f}_{url_hash}.fits"


def _is_valid_fits(path: Path) -> bool:
    """Verifica que el archivo FITS exista y sea legible con AstroPy."""
    if not path.exists() or path.stat().st_size == 0:
        return False
    try:
        with fits.open(path) as hdul:
            # Verificar que tiene al menos un HDU
            return len(hdul) >= 1
    except Exception as exc:
        logger.warning("El archivo %s no es un FITS válido: %s", path, exc)
        return False


# ---------------------------------------------------------------------------
# download_cutout
# ---------------------------------------------------------------------------

def download_cutout(
    access_url: str,
    ra: float,
    dec: float,
    size_deg: float,
    output_dir: Optional[Path] = None,
    skip_if_exists: bool = True,
) -> Optional[Path]:
    """
    Descarga un recorte FITS desde el servicio IBE de IRSA.

    Args:
        access_url: URL del archivo FITS (de la columna access_url del SIA2).
        ra: RA del centro del recorte en grados.
        dec: Dec del centro del recorte en grados.
        size_deg: Tamaño del recorte en grados (ancho y alto).
        output_dir: Directorio de salida. Por defecto usa RAW_DIR.
        skip_if_exists: Si True, no vuelve a descargar si el archivo ya existe.

    Returns:
        Path al archivo descargado, o None si falló la descarga.

    Note:
        El servicio de recortes de IRSA (?center=&size=) solo funciona
        para archivos alojados on-premises en IRSA, no en AWS S3.
        Si access_url apunta a AWS, se registra un aviso y se retorna None.
    """
    out_dir = output_dir or RAW_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    # Aviso: servicio de recortes solo aplica a archivos on-premises IRSA
    if "irsa.ipac.caltech.edu" not in access_url:
        logger.warning(
            "El servicio de recortes IBE solo funciona con URLs on-premises de IRSA. "
            "URL recibida: %s — no se descargará.",
            access_url,
        )
        return None

    cutout_url = _build_cutout_url(access_url, ra, dec, size_deg)
    filename = _url_to_filename(access_url, ra, dec, size_deg)
    output_path = out_dir / filename

    # Evitar descargas duplicadas
    if skip_if_exists and _is_valid_fits(output_path):
        logger.info("Recorte ya existe y es válido: %s", output_path)
        return output_path

    logger.info("Descargando recorte FITS | URL=%s", cutout_url)

    last_error: Optional[Exception] = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.get(
                cutout_url,
                timeout=REQUEST_TIMEOUT,
                stream=True,
                headers={"User-Agent": "SPHEREx-DataModule/1.0 NASA-SpaceApps"},
            )
            response.raise_for_status()

            # Descargar en streaming para no saturar memoria
            with open(output_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            # Validar FITS descargado
            if _is_valid_fits(output_path):
                file_mb = output_path.stat().st_size / 1024 / 1024
                logger.info(
                    "Recorte descargado OK | %s (%.2f MB)", output_path.name, file_mb
                )
                return output_path
            else:
                logger.warning(
                    "Archivo descargado no es FITS válido (intento %d): %s",
                    attempt, output_path,
                )
                output_path.unlink(missing_ok=True)

        except requests.HTTPError as exc:
            last_error = exc
            if exc.response.status_code == 404:
                logger.error("Archivo no encontrado en IRSA (404): %s", cutout_url)
                return None
            logger.warning("HTTP error (intento %d/%d): %s", attempt, MAX_RETRIES, exc)
        except Exception as exc:
            last_error = exc
            logger.warning("Error de descarga (intento %d/%d): %s", attempt, MAX_RETRIES, exc)

        if attempt < MAX_RETRIES:
            time.sleep(RETRY_DELAY)

    logger.error(
        "No se pudo descargar el recorte tras %d intentos. Último error: %s",
        MAX_RETRIES, last_error,
    )
    return None


# ---------------------------------------------------------------------------
# download_observation
# ---------------------------------------------------------------------------

def download_observation(
    observation: ObservationRecord,
    cutout_size_deg: float = 0.05,
    output_dir: Optional[Path] = None,
) -> Optional[Path]:
    """
    Descarga el recorte FITS de una observación SPHEREx.

    Usa las coordenadas de la observación como centro del recorte.
    Actualiza observation.fits_path si la descarga es exitosa.

    Args:
        observation: Objeto ObservationRecord con access_url y coordenadas.
        cutout_size_deg: Tamaño del recorte en grados (por defecto 0.05° ≈ 3').
        output_dir: Directorio de salida. Por defecto usa RAW_DIR.

    Returns:
        Path al archivo FITS descargado, o None si falló.
    """
    if not observation.access_url:
        logger.warning("ObservationRecord %s no tiene access_url.", observation.obs_id)
        return None

    # Usar coordenadas de la observación; si no están disponibles, el recorte
    # puede usar las del campo (el servicio IBE recortará en torno al acceso)
    ra = observation.ra
    dec = observation.dec
    if ra is None or dec is None:
        logger.warning(
            "Observación %s sin coordenadas RA/Dec; no se puede descargar recorte.",
            observation.obs_id,
        )
        return None

    path = download_cutout(
        access_url=observation.access_url,
        ra=ra,
        dec=dec,
        size_deg=cutout_size_deg,
        output_dir=output_dir,
    )

    if path is not None:
        observation.fits_path = str(path)

    return path

