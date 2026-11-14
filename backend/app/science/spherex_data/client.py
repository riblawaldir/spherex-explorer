"""
client.py — Cliente IRSA SIA2 para SPHEREx.

Gestiona la comunicación con el servicio SIA2 de IRSA usando astroquery.
Implementa reintentos, validación de respuestas y manejo de errores de red.

Servicio oficial: https://irsa.ipac.caltech.edu/SIA
Documentación astroquery IRSA: https://astroquery.readthedocs.io/en/latest/ipac/irsa/irsa.html
"""

import logging
import time
from typing import Optional

import astropy.units as u
from astropy.coordinates import SkyCoord
from astropy.table import Table
from astropy.utils.data import conf as astropy_conf
from astroquery.ipac.irsa import Irsa

from .config import (
    DEFAULT_COLLECTIONS,
    MAX_RETRIES,
    REQUEST_TIMEOUT,
    RETRY_DELAY,
    SPHEREX_COLLECTIONS,
)

logger = logging.getLogger(__name__)

# Aumentar timeout de astropy para archivos MEF grandes de SPHEREx
astropy_conf.remote_timeout = REQUEST_TIMEOUT


class IRSAClient:
    """
    Cliente para el servicio SIA2 de IRSA.

    Encapsula las consultas a astroquery.ipac.irsa.Irsa y añade
    reintentos, logging y normalización de resultados.
    """

    def __init__(
        self,
        collections: Optional[list[str]] = None,
        timeout: int = REQUEST_TIMEOUT,
        max_retries: int = MAX_RETRIES,
    ):
        """
        Args:
            collections: Lista de colecciones SPHEREx a consultar.
                         Si es None, usa DEFAULT_COLLECTIONS.
            timeout: Timeout en segundos para peticiones HTTP.
            max_retries: Número de reintentos ante fallos transitorios.
        """
        self.collections = collections or DEFAULT_COLLECTIONS
        self.timeout = timeout
        self.max_retries = max_retries

        # Configurar timeout global de astropy
        astropy_conf.remote_timeout = timeout

        logger.info(
            "IRSAClient inicializado | colecciones=%s | timeout=%ds",
            self.collections,
            self.timeout,
        )

    def query_sia(
        self,
        ra: float,
        dec: float,
        radius_deg: float,
        collections: Optional[list[str]] = None,
    ) -> Table:
        """
        Consulta el servicio SIA2 de IRSA para las colecciones SPHEREx.

        Args:
            ra: Ascensión recta en grados decimales (J2000).
            dec: Declinación en grados decimales (J2000).
            radius_deg: Radio de búsqueda en grados.
            collections: Colecciones a consultar. Usa las del cliente si es None.

        Returns:
            astropy.table.Table con los resultados del servicio SIA2.
            Puede ser una tabla vacía si no hay observaciones.

        Raises:
            ConnectionError: Si falla la conexión tras los reintentos.
            ValueError: Si la respuesta del servicio es inesperada.
        """
        target_collections = collections or self.collections
        coord = SkyCoord(ra=ra * u.deg, dec=dec * u.deg, frame="icrs")
        radius = radius_deg * u.deg

        logger.info(
            "Consultando SIA2 | RA=%.5f Dec=%.5f radio=%.4f° | colecciones=%s",
            ra, dec, radius_deg, target_collections,
        )

        last_error: Optional[Exception] = None
        for attempt in range(1, self.max_retries + 1):
            try:
                result = Irsa.query_sia(
                    pos=(coord, radius),
                    collection=target_collections,
                )
                n_rows = len(result) if result is not None else 0
                logger.info("SIA2 devolvió %d observaciones (intento %d)", n_rows, attempt)
                return result if result is not None else Table()

            except Exception as exc:
                last_error = exc
                error_str = str(exc)
                # Errores transitorios del proxy de IRSA (502/503): reintentar con
                # espera progresiva. Son comunes en el endpoint /SIA/capabilities.
                is_proxy_error = any(
                    code in error_str for code in ("502", "503", "Proxy Error")
                )
                wait = RETRY_DELAY * attempt if is_proxy_error else RETRY_DELAY
                logger.warning(
                    "Error en consulta SIA2 (intento %d/%d)%s: %s",
                    attempt, self.max_retries,
                    " [proxy transitorio]" if is_proxy_error else "",
                    exc,
                )
                if attempt < self.max_retries:
                    time.sleep(wait)

        raise ConnectionError(
            f"No se pudo conectar al servicio SIA2 de IRSA tras "
            f"{self.max_retries} intentos. Último error: {last_error}"
        ) from last_error

    def list_spherex_collections(self) -> list[str]:
        """
        Devuelve la lista de colecciones SPHEREx conocidas en IRSA.

        Note:
            Los nombres de colecciones están verificados contra la documentación
            oficial de IRSA. Este método no hace una petición HTTP; retorna la
            configuración conocida.
        """
        return list(SPHEREX_COLLECTIONS.values())

    @staticmethod
    def get_collection_description(collection_key: str) -> str:
        """Retorna una descripción de la colección dado su clave corta."""
        descriptions = {
            "dr1": "SPHEREx Data Release 1 — Wide Survey",
            "dr1_deep": "SPHEREx DR1 — Deep Survey (polos eclípticos N/S)",
            "qr3": "SPHEREx Quick Release 3 — Wide Survey",
            "qr3_deep": "SPHEREx QR3 — Deep Survey (polos eclípticos N/S)",
        }
        return descriptions.get(collection_key, "Colección SPHEREx desconocida")
