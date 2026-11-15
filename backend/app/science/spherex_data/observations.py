"""
observations.py — Organización temporal y compatibilidad de observaciones SPHEREx.

Implementa organize_observations(observations) para:
  - Ordenar por fecha de observación.
  - Agrupar por región y banda espectral.
  - Identificar pares comparables para análisis temporal.
  - Advertir sobre incompatibilidades entre colecciones (DR1 vs QR2).

Nota IRSA: DR1 y QR3 son el conjunto recomendado para trabajo nuevo.
No se deben mezclar QR2 con DR1/QR3 sin decisión explícita por diferencias
de calibración. Referencia: https://irsa.ipac.caltech.edu/spherex-archive-documentation/
"""

import logging
from dataclasses import dataclass
from typing import Optional

from .search import ObservationRecord

logger = logging.getLogger(__name__)

# Colecciones que pueden mezclarse sin advertencia
_COMPATIBLE_COLLECTION_GROUPS = [
    {"spherex_dr1", "spherex_qr3"},
    {"spherex_dr1_deep", "spherex_qr3_deep"},
]

# Colecciones que NO deben mezclarse con las anteriores (calibración diferente)
_INCOMPATIBLE_COLLECTIONS = {"spherex_qr2", "spherex_qr2_deep", "spherex_qr1"}


@dataclass
class ObservationGroup:
    """Grupo de observaciones de la misma región y banda espectral."""
    band_label: Optional[str]
    collection_group: str              # 'wide' o 'deep'
    observations: list[ObservationRecord]
    is_comparable: bool = False        # True si hay ≥2 épocas comparables

    def to_dict(self) -> dict:
        return {
            "band_label": self.band_label,
            "collection_group": self.collection_group,
            "count": len(self.observations),
            "is_comparable": self.is_comparable,
            "observations": [o.to_dict() for o in self.observations],
        }


def _collection_group(collection: str) -> str:
    """Clasifica una colección como 'wide', 'deep' o 'unknown'."""
    if "deep" in collection:
        return "deep"
    if collection in {"spherex_dr1", "spherex_qr3", "spherex_qr2"}:
        return "wide"
    return "unknown"


def _check_collection_compatibility(collections: set[str]) -> list[str]:
    """
    Verifica compatibilidad entre colecciones.

    Returns:
        Lista de mensajes de advertencia (vacía si todo es compatible).
    """
    warnings = []
    incompatible_found = collections & _INCOMPATIBLE_COLLECTIONS
    if incompatible_found:
        warnings.append(
            f"Las colecciones {incompatible_found} (QR1/QR2) tienen calibración "
            "diferente a DR1/QR3. IRSA recomienda no mezclarlas sin análisis explícito."
        )
    # Comprobar mezcla deep/wide
    has_wide = any("deep" not in c for c in collections)
    has_deep = any("deep" in c for c in collections)
    if has_wide and has_deep:
        warnings.append(
            "Se están mezclando observaciones del survey Wide y Deep. "
            "Verificar que la comparación sea intencional."
        )
    return warnings


def organize_observations(
    observations: list[ObservationRecord],
    *, max_pairs: int = 10000,
) -> dict:
    """
    Organiza observaciones SPHEREx cronológicamente e identifica pares comparables.

    Args:
        observations: Lista de ObservationRecord (de search_observations).

    Returns:
        Diccionario con:
        - 'sorted_observations': todas las obs ordenadas por fecha ascendente.
        - 'groups': observaciones agrupadas por banda espectral y tipo de survey.
        - 'comparable_pairs': pares de observaciones con la misma banda y tipo.
        - 'warnings': avisos de incompatibilidad entre colecciones.
        - 'statistics': resumen estadístico.
    """
    if isinstance(max_pairs, bool) or not isinstance(max_pairs, int) or max_pairs < 0:
        raise ValueError('max_pairs must be a nonnegative integer')
    if not observations:
        logger.info("organize_observations: lista de observaciones vacía.")
        return {
            "sorted_observations": [],
            "groups": [],
            "comparable_pairs": [],
            "warnings": [],
            "statistics": {"total": 0, "groups": 0, "comparable_pairs": 0,
                           "candidate_pairs_total": 0, "candidate_pairs_truncated": False,
                           "collections_present": [], "date_range_mjd": None},
        }

    # 1. Ordenar cronológicamente (observaciones sin fecha van al final)
    sorted_obs = sorted(
        observations,
        key=lambda o: o.t_min_mjd if o.t_min_mjd is not None else float("inf"),
    )
    logger.info("Observaciones ordenadas cronológicamente: %d", len(sorted_obs))

    # 2. Detectar colecciones presentes y verificar compatibilidad
    all_collections = {o.collection for o in sorted_obs}
    warnings = _check_collection_compatibility(all_collections)
    warnings.append('Grupos y pares son candidatos por tiempo y banda, no comparabilidad científica validada.')
    for w in warnings:
        logger.warning(w)

    # 3. Agrupar por (band_label, collection_group)
    groups_dict: dict[tuple, list[ObservationRecord]] = {}
    for obs in sorted_obs:
        key = (obs.band_label, _collection_group(obs.collection))
        groups_dict.setdefault(key, []).append(obs)

    groups = []
    comparable_pairs = []
    total_candidates = 0

    for (band_label, coll_group), obs_list in groups_dict.items():
        # A URL identifies the product; without one, OBSID + detector +
        # collection is sufficient. Never deduplicate an unknown identity.
        unique_products = []
        seen = set()
        for o in obs_list:
            if o.t_min_mjd is None:
                continue
            if o.access_url:
                identity = ('url', o.collection, o.access_url)
            elif o.obs_id and o.collection and o.detector:
                identity = ('product', o.collection, o.obs_id, o.detector)
            else:
                identity = None
                warnings.append('Product identity incomplete; observation retained without deduplication.')
            if identity is not None and identity in seen:
                continue
            if identity is not None:
                seen.add(identity)
            unique_products.append(o)
        is_comparable = len(unique_products) >= 2

        group = ObservationGroup(
            band_label=band_label,
            collection_group=coll_group,
            observations=obs_list,
            is_comparable=is_comparable,
        )
        groups.append(group)

        # Generar pares candidatos de productos distintos, incluso con igual MJD.
        if is_comparable:
            epoch_sorted = sorted(unique_products, key=lambda o: o.t_min_mjd)
            total_candidates += len(epoch_sorted) * (len(epoch_sorted) - 1) // 2
            for i in range(len(epoch_sorted)):
                if len(comparable_pairs) >= max_pairs:
                    break
                for j in range(i + 1, len(epoch_sorted)):
                    if len(comparable_pairs) >= max_pairs:
                        break
                    comparable_pairs.append({
                        "band_label": band_label,
                        "collection_group": coll_group,
                        "observation_1": epoch_sorted[i].to_dict(),
                        "observation_2": epoch_sorted[j].to_dict(),
                        "delta_days": (
                            epoch_sorted[j].t_min_mjd - epoch_sorted[i].t_min_mjd
                            if epoch_sorted[i].t_min_mjd is not None and epoch_sorted[j].t_min_mjd is not None
                            else None
                        ),
                    })

    if total_candidates > len(comparable_pairs):
        warnings.append(f'Candidate pair list truncated: {len(comparable_pairs)} of {total_candidates}; max_pairs={max_pairs}.')
    logger.info(
        "Grupos: %d | Pares comparables: %d",
        len(groups), len(comparable_pairs),
    )

    return {
        "sorted_observations": [o.to_dict() for o in sorted_obs],
        "groups": [g.to_dict() for g in groups],
        "comparable_pairs": comparable_pairs,
        "warnings": warnings,
        "statistics": {
            "total": len(sorted_obs),
            "groups": len(groups),
            "comparable_pairs": len(comparable_pairs),
            "candidate_pairs_total": total_candidates,
            "candidate_pairs_truncated": total_candidates > len(comparable_pairs),
            "collections_present": list(all_collections),
            "date_range_mjd": {
                "first": sorted_obs[0].t_min_mjd,
                "last": sorted_obs[-1].t_min_mjd,
            } if sorted_obs and sorted_obs[0].t_min_mjd is not None else None,
        },
    }

