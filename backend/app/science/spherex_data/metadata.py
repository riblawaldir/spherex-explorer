"""
metadata.py — Extracción de metadatos de archivos FITS SPHEREx con AstroPy.

Implementa extract_metadata(fits_path) para leer cabeceras FITS reales.

SPHEREx produce archivos MEF (Multi-Extension FITS) con extensiones:
  - PRIMARY / IMAGE: datos de imagen espectral
  - FLAGS: máscara de píxeles
  - VARIANCE: varianza del ruido
  - ZODI: estimación de luz zodiacal
  - PSF: función de dispersión de punto
  - WCS-WAVE: información de longitudes de onda por canal

Referencia: https://irsa.ipac.caltech.edu/spherex-archive-documentation/
"""

import logging
from pathlib import Path
from typing import Optional

from astropy.io import fits
from astropy.wcs import WCS
from astropy.wcs.utils import proj_plane_pixel_scales

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Campos de cabecera FITS de SPHEREx conocidos
# (basados en documentación oficial y estructura de MEFs SPHEREx)
# ---------------------------------------------------------------------------
_HEADER_FIELDS = [
    "SIMPLE", "BITPIX", "NAXIS", "NAXIS1", "NAXIS2", "NAXIS3",
    "EXTEND", "DATE-OBS", "DATE-BEG", "DATE-END", "MJD-BEG", "MJD-END",
    "EXPTIME", "TELESCOP", "INSTRUME", "DETECTOR", "FILTER",
    "OBJECT", "TARGNAME",
    "CRVAL1", "CRVAL2", "CRPIX1", "CRPIX2", "CDELT1", "CDELT2",
    "CTYPE1", "CTYPE2", "EQUINOX", "RADESYS",
    "BUNIT", "BSCALE", "BZERO",
    "OBSID", "OBS_ID",
    # Campos propios de SPHEREx (pueden variar entre versiones del pipeline)
    "SPX_ORBT", "SPX_SCAN", "SPX_BAND", "SPX_CHAN",
]


def extract_metadata(fits_path: str | Path) -> dict:
    """
    Extrae metadatos de un archivo FITS SPHEREx usando AstroPy.

    Lee los headers de todas las extensiones del MEF y extrae:
    - Información general del archivo.
    - Cabeceras del HDU PRIMARY/IMAGE.
    - Información WCS si está disponible.
    - Resumen de todas las extensiones.

    Args:
        fits_path: Ruta al archivo FITS (local).

    Returns:
        Diccionario con metadatos extraídos.
        Los campos ausentes en el FITS se omiten (no se inventan valores).

    Raises:
        FileNotFoundError: Si el archivo no existe.
        OSError: Si AstroPy no puede abrir el archivo.
    """
    path = Path(fits_path)
    if not path.exists():
        raise FileNotFoundError(f"Archivo FITS no encontrado: {path}")

    logger.info("Extrayendo metadatos de %s", path)

    metadata: dict = {
        "fits_path": str(path),
        "file_size_bytes": path.stat().st_size,
        "extensions": [],
        "primary_header": {},
        "wcs": None,
        "observation": {},
        "instrument": {},
        "image": {},
    }

    try:
        with fits.open(path, memmap=True) as hdul:
            # 1. Resumen de extensiones
            metadata["extensions"] = [
                {
                    "index": i,
                    "name": ext.name,
                    "type": type(ext).__name__,
                    "shape": list(ext.shape) if hasattr(ext, "shape") else None,
                }
                for i, ext in enumerate(hdul)
            ]

            # PRIMARY puede estar vacío en un MEF. Conservamos su cabecera para
            # metadatos generales y elegimos por separado la extensión con imagen.
            primary_hdr = hdul[0].header
            images = [ext for ext in hdul if ext.name.upper() == 'IMAGE']
            if len(images) > 1:
                raise ValueError('Ambiguous IMAGE extensions')
            if images:
                image_hdu = images[0]
                if not isinstance(image_hdu, (fits.ImageHDU, fits.CompImageHDU)) or image_hdu.data is None or image_hdu.data.ndim != 2:
                    raise ValueError('IMAGE must contain a 2-D image')
            elif primary_hdr.get('NAXIS', 0) >= 2:
                image_hdu = hdul[0]
            else:
                candidates = [ext for ext in hdul[1:] if isinstance(ext, (fits.ImageHDU, fits.CompImageHDU))
                              and ext.name.upper() not in {'FLAGS', 'VARIANCE', 'ZODI'}
                              and ext.data is not None and ext.data.ndim == 2]
                if len(candidates) > 1:
                    raise ValueError('Ambiguous science image extensions')
                image_hdu = candidates[0] if candidates else None
            image_hdr = image_hdu.header if image_hdu is not None else primary_hdr
            metadata['header_conflicts'] = {}

            def selected_value(key):
                # IMAGE has precedence for its own observation; preserve both
                # values when PRIMARY disagrees so callers can review them.
                if key in image_hdr and key in primary_hdr and image_hdr[key] != primary_hdr[key]:
                    metadata['header_conflicts'][key] = {'primary': primary_hdr[key], 'image': image_hdr[key]}
                if key in image_hdr:
                    return image_hdr[key]
                return primary_hdr.get(key)

            # Extraer campos conocidos (solo los que existen en la cabecera)
            primary_dict = {}
            for field in _HEADER_FIELDS:
                if field in primary_hdr:
                    val = primary_hdr[field]
                    # Convertir a tipo Python nativo
                    if hasattr(val, "item"):
                        val = val.item()
                    primary_dict[field] = val
            metadata["primary_header"] = primary_dict

            # 3. Información de observación
            obs_info = {}
            obs_sources = {}
            for key_fits, key_out in [
                ("DATE-OBS", "date_obs"),
                ("DATE-BEG", "date_begin"),
                ("DATE-END", "date_end"),
                ("MJD-BEG", "mjd_begin"),
                ("MJD-END", "mjd_end"),
                ("EXPTIME", "exposure_time_s"),
                ("OBSID", "obs_id"),
                ("OBS_ID", "obs_id"),
                ("OBJECT", "object"),
                ("TARGNAME", "target_name"),
            ]:
                value = selected_value(key_fits)
                priority = 1 if key_fits in image_hdr else 0
                if value is not None and priority > obs_sources.get(key_out, -1):
                    obs_info[key_out] = value
                    obs_sources[key_out] = priority
            metadata["observation"] = obs_info
            aliases = {f'{source}.{key}': header[key]
                       for source, header in (('primary', primary_hdr), ('image', image_hdr))
                       for key in ('OBSID', 'OBS_ID') if key in header}
            if len(set(aliases.values())) > 1:
                metadata['header_conflicts']['obs_id'] = aliases

            # 4. Información de instrumento
            instr_info = {}
            for key_fits, key_out in [
                ("TELESCOP", "telescope"),
                ("INSTRUME", "instrument"),
                ("DETECTOR", "detector"),
                ("FILTER", "filter"),
                ("SPX_ORBT", "spherex_orbit"),
                ("SPX_SCAN", "spherex_scan"),
                ("SPX_BAND", "spherex_band"),
                ("SPX_CHAN", "spherex_channel"),
            ]:
                value = selected_value(key_fits)
                if value is not None:
                    instr_info[key_out] = value
            metadata["instrument"] = instr_info

            # 5. Dimensiones de imagen
            naxis = image_hdr.get("NAXIS", 0)
            img_info = {"naxis": naxis}
            for i in range(1, naxis + 1):
                key = f"NAXIS{i}"
                if key in image_hdr:
                    img_info[f"naxis{i}"] = image_hdr[key]
            metadata["image"] = img_info

            # 6. WCS — sistema de coordenadas astronómicas
            try:
                wcs = WCS(image_hdr, naxis=2)
                if wcs.is_celestial:
                    # Pixel coordinates are zero-based; center of an N-pixel
                    # axis is (N - 1) / 2.
                    n1 = image_hdr.get("NAXIS1", 1)
                    n2 = image_hdr.get("NAXIS2", 1)
                    cx, cy = (n1 - 1) / 2, (n2 - 1) / 2
                    sky = wcs.pixel_to_world(cx, cy)
                    pixel_scales = proj_plane_pixel_scales(wcs)
                    metadata["wcs"] = {
                        "is_celestial": True,
                        "ctype": [
                            image_hdr.get("CTYPE1"),
                            image_hdr.get("CTYPE2"),
                        ],
                        "center_ra_deg": float(sky.ra.deg),
                        "center_dec_deg": float(sky.dec.deg),
                        "pixel_scale_deg": float(abs(pixel_scales[0])),
                    }
                else:
                    metadata["wcs"] = {"is_celestial": False}
            except Exception as wcs_exc:
                logger.debug("WCS no disponible o inválido: %s", wcs_exc)
                metadata["wcs"] = {"is_celestial": False, "error": str(wcs_exc)}

    except OSError as exc:
        raise OSError(f"AstroPy no pudo abrir {path}: {exc}") from exc

    logger.info(
        "Metadatos extraídos | %d extensiones | obs_info=%s",
        len(metadata["extensions"]), metadata["observation"],
    )
    return metadata

