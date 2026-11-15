/**
 * Selección y comparación. Funciones puras, sin estado de React.
 * La misma lista de ids alimenta el mapa y el panel de resultados.
 */

export function toggleCompareId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

export function retainKnownIds(ids: readonly string[], available: readonly { id: string }[]): string[] {
  const known = new Set(available.map((item) => item.id));
  return ids.filter((id) => known.has(id));
}

/** Conserva la selección si sigue en los resultados; si no, toma la primera fila. */
export function keepOrReplaceSelection(
  current: string | undefined,
  rows: readonly { id: string }[],
): string | undefined {
  if (current && rows.some((row) => row.id === current)) return current;
  return rows[0]?.id;
}

export type MarkerClick =
  | { type: "select"; id: string }
  | { type: "disambiguate" };

/**
 * Un marcador con una sola observación se selecciona.
 * Varias en el mismo punto abren un selector: no se elige una por defecto.
 */
export function interpretMarkerClick(marker: {
  observations: readonly { id: string }[];
}): MarkerClick {
  const only = marker.observations.length === 1 ? marker.observations[0] : undefined;
  if (only) return { type: "select", id: only.id };
  return { type: "disambiguate" };
}
