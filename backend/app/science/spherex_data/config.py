"""
config.py — Configuración centralizada del módulo SPHEREx Data Acquisition.

Fuentes verificadas:
  - IRSA SIA2: https://irsa.ipac.caltech.edu/SIA
  - IBE cutout service: https://irsa.ipac.caltech.edu/ibe/data/spherex/
  - Documentación oficial: https://irsa.ipac.caltech.edu/spherex-archive-documentation/
"""

from pathlib import Path

# ---------------------------------------------------------------------------
# Rutas de datos locales
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
SAMPLES_DIR = DATA_DIR / "samples"
METADATA_DIR = DATA_DIR / "metadata"

# Crear directorios si no existen
for _d in (RAW_DIR, SAMPLES_DIR, METADATA_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Colecciones SPHEREx en IRSA (SIA2) — verificadas en documentación oficial
# ---------------------------------------------------------------------------
SPHEREX_COLLECTIONS = {
    "dr1": "spherex_dr1",           # DR1 Wide Survey
    "dr1_deep": "spherex_dr1_deep", # DR1 Deep Survey (polos eclípticos)
    "qr3": "spherex_qr3",           # QR3 Wide Survey
    "qr3_deep": "spherex_qr3_deep", # QR3 Deep Survey
}

# Colecciones predeterminadas para búsquedas generales
DEFAULT_COLLECTIONS = ["spherex_dr1", "spherex_qr3"]

# ---------------------------------------------------------------------------
# Endpoints IRSA verificados
# ---------------------------------------------------------------------------
IRSA_SIA2_URL = "https://irsa.ipac.caltech.edu/SIA"
IRSA_IBE_BASE_URL = "https://irsa.ipac.caltech.edu/ibe/data/spherex/"

# ---------------------------------------------------------------------------
# Parámetros de red
# ---------------------------------------------------------------------------
REQUEST_TIMEOUT = 120          # segundos — MEFs SPHEREx pueden ser grandes
MAX_RETRIES = 3
RETRY_DELAY = 5                # segundos entre reintentos

# ---------------------------------------------------------------------------
# Coordenadas de ejemplo documentadas por IRSA
# (RA=127.69444, Dec=-39.17760, radio=0.01°)
# ---------------------------------------------------------------------------
EXAMPLE_RA = 127.69444
EXAMPLE_DEC = -39.17760
EXAMPLE_RADIUS_DEG = 0.01

# ---------------------------------------------------------------------------
# Límites de validación de coordenadas
# ---------------------------------------------------------------------------
RA_MIN, RA_MAX = 0.0, 360.0
DEC_MIN, DEC_MAX = -90.0, 90.0
RADIUS_MIN_DEG = 1e-5          # ~0.036 arcsec
RADIUS_MAX_DEG = 5.0           # límite razonable para evitar consultas masivas

# ---------------------------------------------------------------------------
# Columnas SIA2 que devuelve IRSA para SPHEREx
# (nombres verificados contra respuestas reales del servicio)
# ---------------------------------------------------------------------------
SIA2_COLUMNS = {
    "access_url": "access_url",
    "collection": "obs_collection",
    "obs_id": "obs_id",
    "ra": "s_ra",
    "dec": "s_dec",
    "t_min": "t_min",          # MJD inicio de observación
    "t_max": "t_max",          # MJD fin de observación
    "em_min": "em_min",        # longitud de onda mínima (metros)
    "em_max": "em_max",        # longitud de onda máxima (metros)
    "instrument": "instrument_name",
    "facility": "facility_name",
}

