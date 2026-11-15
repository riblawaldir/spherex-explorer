/**
 * Marcadores a partir de Observation[].
 * La posición dibujada es el ra/dec entregado, sin redondeo.
 * Solo se agrupan observaciones con exactamente la misma posición
 * (la RA se compara módulo 360°, que es el mismo meridiano).
 */

import type { Observation } from "@/types/observation";

export type MarkerVisualState = "normal" | "selected" | "compared" | "selected_and_compared";
export type MarkerShape = "circle" | "plus" | "rhomb";

export interface ObservationMarkerItem {
  key: string;
  ra: number;
  dec: number;
  observations: Observation[];
  count: number;
  isGrouped: boolean;
  state: MarkerVisualState;
  hasSelected: boolean;
  hasCompared: boolean;
  primaryObservation: Observation;
  label: string;
  color: string;
  shape: MarkerShape;
  size: number;
}

export interface MarkerBuild {
  markers: ObservationMarkerItem[];
  skipped: Observation[];
}

const COLLECTION_COLORS: Record<string, string> = {
  DR1: "#38bdf8",
  QR3: "#c084fc",
};

export function collectionColor(collection: string): string {
  return COLLECTION_COLORS[collection] ?? "#94a3b8";
}

/** Diferencia de RA en grados, plegada a [0, 180]. 0° y 360° coinciden. */
export function raSeparation(a: number, b: number): number {
  const raw = Math.abs(a - b) % 360;
  return Math.min(raw, 360 - raw);
}

export function sameSkyPosition(
  a: { ra: number; dec: number },
  b: { ra: number; dec: number },
): boolean {
  return a.dec === b.dec && raSeparation(a.ra, b.ra) === 0;
}

export function groupObservationsByPosition(observations: Observation[]): Observation[][] {
  const groups: Observation[][] = [];

  for (const observation of observations) {
    if (!Number.isFinite(observation.ra) || !Number.isFinite(observation.dec)) continue;
    const existing = groups.find((group) => group[0] && sameSkyPosition(group[0], observation));
    if (existing) existing.push(observation);
    else groups.push([observation]);
  }

  return groups;
}

function visualState(hasSelected: boolean, hasCompared: boolean): MarkerVisualState {
  if (hasSelected && hasCompared) return "selected_and_compared";
  if (hasSelected) return "selected";
  if (hasCompared) return "compared";
  return "normal";
}

function markerStyle(collection: string, state: MarkerVisualState, grouped: boolean): {
  color: string;
  shape: MarkerShape;
  size: number;
} {
  if (state === "selected_and_compared") return { color: "#f59e0b", shape: "rhomb", size: 18 };
  if (state === "selected") return { color: "#facc15", shape: "circle", size: 18 };
  if (state === "compared") return { color: "#a855f7", shape: "plus", size: 16 };
  return {
    color: collectionColor(collection),
    shape: "circle",
    size: grouped ? 16 : 12,
  };
}

export function transformObservationsToMarkers(
  observations: Observation[],
  selectedId?: string,
  compareIds: readonly string[] = [],
): MarkerBuild {
  const skipped = observations.filter(
    (observation) => !Number.isFinite(observation.ra) || !Number.isFinite(observation.dec),
  );
  const groups = groupObservationsByPosition(observations);

  const markers = groups.map((group) => {
    const primary = group[0] as Observation;
    const count = group.length;
    const isGrouped = count > 1;
    const hasSelected = group.some((observation) => observation.id === selectedId);
    const hasCompared = group.some((observation) => compareIds.includes(observation.id));
    const state = visualState(hasSelected, hasCompared);
    const style = markerStyle(primary.collection ?? "", state, isGrouped);

    return {
      key: isGrouped ? `group:${primary.ra}:${primary.dec}` : primary.id,
      ra: primary.ra,
      dec: primary.dec,
      observations: group,
      count,
      isGrouped,
      state,
      hasSelected,
      hasCompared,
      primaryObservation: primary,
      label: isGrouped ? `${count} observations at this position` : `${primary.id} · ${primary.band}`,
      color: style.color,
      shape: style.shape,
      size: style.size,
    };
  });

  return { markers, skipped };
}
