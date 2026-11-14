/**
 * Tipos oficiales de la API FastAPI de SPHEREx Explorer, copiados fielmente de openapi.yaml.
 * NO mezclar con el modelo de dominio interno del frontend (Observation de types/observation.ts).
 */

export interface ApiEpoch {
  obs_id: string;
  ra?: number | null;
  dec?: number | null;
  t_mjd?: number | null;
  bandpass?: string | null;
  wavelength_um?: number | null;
  preview_url?: string | null;
  provenance: "stub" | "cached_sample" | string;

  /* =========================================================================
   * CAMPOS PENDIENTES DE CONFIRMAR CON EL INTEGRANTE 3 (Backend FastAPI):
   * En openapi.yaml actual (v0.1.1-sprint1), 'collection' y 'source_url'
   * NO existen en el esquema Epoch ("intentionally absent until real metadata exists").
   * Se incluyen como opcionales en la interfaz para permitir que el adaptador
   * los consuma cuando el backend empiece a enviarlos.
   * ========================================================================= */
  collection?: string | null;
  source_url?: string | null;
}

export interface ApiEpochsResponse {
  epochs: ApiEpoch[];
  provenance: "stub" | "cached_sample" | string;
}

export interface ApiTarget {
  id: string;
  name: string;
  ra: number;
  dec: number;
  notes?: string;
}

export interface ApiSearchHit {
  id: string;
  name: string;
  ra: number;
  dec: number;
  notes?: string;
}

export interface ApiSearchResponse {
  hits: ApiSearchHit[];
  provenance: "stub" | "cached_sample" | string;
}

export interface ApiStubNotImplemented {
  detail: string;
  provenance: string;
}
