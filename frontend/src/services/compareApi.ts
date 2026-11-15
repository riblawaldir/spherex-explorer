/**
 * Client for GET /api/compare — Sprint 4 pair validation.
 * Surfaces comparable / not_comparable honestly; never invents residuals.
 */

import type { ApiCompareResponse, ApiStubNotImplemented } from "./apiTypes";

export interface CompareParams {
  obsIdA: string;
  obsIdB: string;
}

export type CompareApiResult =
  | { ok: true; status: 200; data: ApiCompareResponse }
  | {
      ok: false;
      status: number;
      detail: string;
      provenance: string;
    };

export interface CompareApiOptions {
  fetchImpl?: typeof fetch;
}

function asErrorPayload(
  status: number,
  body: unknown,
  fallback: string,
): CompareApiResult {
  const payload =
    body && typeof body === "object" ? (body as Partial<ApiStubNotImplemented>) : {};
  return {
    ok: false,
    status,
    detail:
      typeof payload.detail === "string" && payload.detail.trim()
        ? payload.detail
        : fallback,
    provenance:
      typeof payload.provenance === "string" && payload.provenance.trim()
        ? payload.provenance
        : "stub",
  };
}

/**
 * Validate a pair of obs_ids via the backend compare endpoint.
 */
export async function fetchCompare(
  params: CompareParams,
  options: CompareApiOptions = {},
): Promise<CompareApiResult> {
  const fetchFn = options.fetchImpl ?? fetch;
  const a = params.obsIdA.trim();
  const b = params.obsIdB.trim();

  if (!a || !b) {
    return {
      ok: false,
      status: 422,
      detail: "obs_id_a y obs_id_b son obligatorios.",
      provenance: "stub",
    };
  }
  if (a === b) {
    return {
      ok: false,
      status: 422,
      detail: "obs_id_a and obs_id_b must be different",
      provenance: "stub",
    };
  }

  const query = new URLSearchParams({ obs_id_a: a, obs_id_b: b });

  try {
    const res = await fetchFn(`/api/compare?${query.toString()}`, {
      headers: { Accept: "application/json" },
    });

    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    if (res.status === 200) {
      const data = body as ApiCompareResponse | null;
      if (
        !data ||
        typeof data !== "object" ||
        (data.status !== "comparable" && data.status !== "not_comparable") ||
        !Array.isArray(data.reasons) ||
        !data.alignment ||
        !data.diff
      ) {
        return {
          ok: false,
          status: 500,
          detail:
            "Formato de respuesta inválido: la API no devolvió CompareResponse.",
          provenance: "stub",
        };
      }
      return { ok: true, status: 200, data };
    }

    return asErrorPayload(
      res.status,
      body,
      res.status === 404
        ? `obs_id desconocido (HTTP ${res.status}).`
        : `Error al comparar observaciones (HTTP ${res.status}).`,
    );
  } catch (err) {
    return {
      ok: false,
      status: 0,
      detail:
        err instanceof Error
          ? `Error de red al consultar /api/compare: ${err.message}`
          : "Error de red inesperado al conectar con /api/compare.",
      provenance: "stub",
    };
  }
}
