/**
 * Servicio de acceso al endpoint /api/epochs con integración del adaptador
 * estricto Epoch -> Observation y manejo de estados (cargando, vacío, error).
 *
 * Cumple las reglas del NASA Space Apps Challenge:
 * - No inventa datos científicos.
 * - Los datos simulados solo se usan con VITE_USE_MOCKS=true y la etiqueta "DATOS SIMULADOS".
 * - Cualquier época con campos incompletos se descarta y se reporta en 'discarded'.
 */

import type { Observation } from "@/types/observation";
import type { ApiEpochsResponse } from "./apiTypes";
import {
  adaptEpochsToObservations,
  type DiscardedEpoch,
} from "./adapters/epochToObservation";
import { mockObservations } from "@/data/mockObservations";

export interface FetchObservationsParams {
  ra: number;
  dec: number;
  radiusArcsec?: number;
  band?: string;
}

export interface ObservationsApiResponse {
  status: "ready" | "empty" | "error";
  observations: Observation[];
  discarded: DiscardedEpoch[];
  provenance: string;
  isSimulated: boolean;
  error?: string;
}

export interface FetchObservationsOptions {
  fetchImpl?: typeof fetch;
  useMocks?: boolean;
}

/**
 * Consulta las observaciones reales/fixtures de la API mediante /api/epochs.
 */
export async function fetchObservations(
  params: FetchObservationsParams,
  options: FetchObservationsOptions = {},
): Promise<ObservationsApiResponse> {
  const fetchFn = options.fetchImpl ?? fetch;

  // Bandera de datos simulados: SOLO activa cuando VITE_USE_MOCKS=true o explicitamente solicitada
  const isMockExplicit =
    options.useMocks ??
    (typeof import.meta !== "undefined" &&
      import.meta.env?.VITE_USE_MOCKS === "true");

  if (isMockExplicit) {
    return {
      status: mockObservations.length > 0 ? "ready" : "empty",
      observations: mockObservations,
      discarded: [],
      provenance: "DATOS SIMULADOS",
      isSimulated: true,
    };
  }

  const radiusArcsec = params.radiusArcsec ?? 36; // 0.01 deg = 36 arcsec por defecto
  const query = new URLSearchParams({
    ra: params.ra.toString(),
    dec: params.dec.toString(),
    radius_arcsec: radiusArcsec.toString(),
  });

  if (params.band && params.band !== "all") {
    query.append("band", params.band);
  }

  try {
    const res = await fetchFn(`/api/epochs?${query.toString()}`, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      const errorMsg =
        res.status >= 500
          ? `Backend server error (HTTP ${res.status}).`
          : `Observation request failed (HTTP ${res.status}).`;

      return {
        status: "error",
        observations: [],
        discarded: [],
        provenance: "error",
        isSimulated: false,
        error: errorMsg,
      };
    }

    const json = (await res.json()) as ApiEpochsResponse;

    // Validación de la forma de la respuesta según openapi.yaml
    if (!json || typeof json !== "object" || !Array.isArray(json.epochs)) {
      return {
        status: "error",
        observations: [],
        discarded: [],
        provenance: "error",
        isSimulated: false,
        error:
          "Invalid response format: the API did not return the expected 'epochs' list.",
      };
    }

    const { observations, discarded } = adaptEpochsToObservations(json.epochs);
    const provenance = json.provenance ?? "stub";
    const isSimulated =
      provenance === "stub" ||
      provenance === "cached_sample" ||
      provenance.toLowerCase().includes("simulad");

    let status: "ready" | "empty" = "ready";
    if (observations.length === 0) {
      status = "empty";
    }

    return {
      status,
      observations,
      discarded,
      provenance,
      isSimulated,
    };
  } catch (err) {
    return {
      status: "error",
      observations: [],
      discarded: [],
      provenance: "error",
      isSimulated: false,
      error:
        err instanceof Error
          ? `Network error while querying /api/epochs: ${err.message}`
          : "Unexpected network error while connecting to /api/epochs.",
    };
  }
}
