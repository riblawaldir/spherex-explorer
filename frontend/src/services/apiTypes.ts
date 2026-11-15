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
  warning?: string;
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

export interface ApiEpochSnapshot {
  obs_id: string;
  ra?: number | null;
  dec?: number | null;
  t_mjd?: number | null;
  bandpass?: string | null;
  wavelength_um?: number | null;
  preview_url?: string | null;
  provenance: "stub" | "cached_sample" | "live" | string;
  collection?: string | null;
  source_url?: string | null;
}

export interface ApiAlignmentReport {
  status: "ok" | "failed" | "skipped" | "unavailable" | string;
  detail: string;
  common_coverage_percent?: number | null;
  units_compatible?: boolean | null;
  reference_unit?: string | null;
  target_unit?: string | null;
  reference_hdu?: number | null;
  target_hdu?: number | null;
  warnings?: string[];
}

export interface ApiDiffReport {
  status: "not_implemented" | "skipped" | "unavailable" | string;
  detail: string;
  provenance: string;
}

/** OpenAPI CompareResponse from GET /api/compare */
export interface ApiCompareResponse {
  obs_id_a: string;
  obs_id_b: string;
  status: "comparable" | "not_comparable";
  provenance: "stub" | "cached_sample" | "live" | string;
  reasons: string[];
  epoch_a: ApiEpochSnapshot;
  epoch_b: ApiEpochSnapshot;
  alignment: ApiAlignmentReport;
  diff: ApiDiffReport;
  checks: Record<string, unknown>;
}
