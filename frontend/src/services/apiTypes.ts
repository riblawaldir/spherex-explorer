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

  /* Optional live-only fields (OpenAPI Sprint 2+). Fixtures omit them;
   * never invent DR1/QR3 or URLs when absent. */
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
