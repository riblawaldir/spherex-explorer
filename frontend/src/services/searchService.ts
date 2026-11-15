/**
 * Servicio de búsqueda y comunicación con el backend FastAPI (/api).
 * Respeta el contrato OpenAPI (openapi.yaml) y types/observation.ts.
 *
 * Maneja estados claros: cargando, éxito, vacío y error.
 * Garantiza que cualquier dato sintético o stub se identifique como "DATOS SIMULADOS".
 */

import type { Observation } from "@/types/observation";

export interface SearchHit {
  id: string;
  name: string;
  ra: number;
  dec: number;
  notes?: string;
}

export interface SearchResponseContract {
  hits: SearchHit[];
  provenance: string;
}

export interface EpochContract {
  obs_id: string;
  t_mjd: number | null;
  bandpass: string | null;
  wavelength_um: number | null;
  preview_url: string | null;
  provenance: string;
}

export interface EpochsResponseContract {
  epochs: EpochContract[];
  provenance: string;
}

export interface TargetContract {
  id: string;
  name: string;
  ra: number;
  dec: number;
  notes?: string;
}

export interface SearchQueryParams {
  ra?: number;
  dec?: number;
  radius_arcsec?: number;
  band?: string;
  q?: string;
}

export interface SearchServiceResult {
  success: boolean;
  observations: Observation[];
  hits?: SearchHit[];
  provenance: string;
  isSimulated: boolean;
  error?: string;
  backendAvailable: boolean;
}

/**
 * Consulta el catálogo de objetivos de prueba (/api/targets).
 */
export async function fetchTargets(fetchImpl = fetch): Promise<{
  success: boolean;
  targets: TargetContract[];
  error?: string;
}> {
  try {
    const res = await fetchImpl("/api/targets", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return {
        success: false,
        targets: [],
        error: `Error al obtener objetivos: HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as TargetContract[];
    return { success: true, targets: data };
  } catch (err) {
    return {
      success: false,
      targets: [],
      error: err instanceof Error ? err.message : "Error de red al consultar /api/targets",
    };
  }
}

/**
 * Realiza búsqueda por nombre de target o texto libre (/api/search?q=...).
 */
export async function searchByQuery(
  q: string,
  fetchImpl = fetch,
): Promise<{
  success: boolean;
  hits: SearchHit[];
  provenance: string;
  isSimulated: boolean;
  error?: string;
}> {
  try {
    const params = new URLSearchParams({ q });
    const res = await fetchImpl(`/api/search?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      return {
        success: false,
        hits: [],
        provenance: "error",
        isSimulated: false,
        error: `HTTP ${res.status}: Fallo en búsqueda por nombre`,
      };
    }

    const data = (await res.json()) as SearchResponseContract;
    const isSimulated =
      data.provenance?.toLowerCase().includes("stub") ||
      data.provenance?.toLowerCase().includes("simulad") ||
      true; // Sin datos reales confirmados de vuelo, todo dato actual es simulado/stub

    return {
      success: true,
      hits: data.hits ?? [],
      provenance: data.provenance ?? "stub",
      isSimulated,
    };
  } catch (err) {
    return {
      success: false,
      hits: [],
      provenance: "error",
      isSimulated: false,
      error: err instanceof Error ? err.message : "Error de red en /api/search",
    };
  }
}

/**
 * Realiza búsqueda por coordenadas celestes (RA/Dec) y radio.
 * Consulta /api/search y /api/epochs según openapi.yaml.
 */
export async function searchByCoordinates(
  params: {
    ra: number;
    dec: number;
    radiusDegrees?: number;
    band?: string;
  },
  fetchImpl = fetch,
): Promise<SearchServiceResult> {
  const radiusArcsec = (params.radiusDegrees ?? 0.01) * 3600;

  try {
    const query = new URLSearchParams({
      ra: params.ra.toString(),
      dec: params.dec.toString(),
      radius_arcsec: radiusArcsec.toString(),
    });
    if (params.band && params.band !== "all") {
      query.append("band", params.band);
    }

    const [epochsRes, searchRes] = await Promise.allSettled([
      fetchImpl(`/api/epochs?${query.toString()}`, { headers: { Accept: "application/json" } }),
      fetchImpl(`/api/search?ra=${params.ra}&dec=${params.dec}`, {
        headers: { Accept: "application/json" },
      }),
    ]);

    let epochs: EpochContract[] = [];
    let hits: SearchHit[] = [];
    let provenance = "stub";
    let backendAvailable = false;

    if (epochsRes.status === "fulfilled" && epochsRes.value.ok) {
      backendAvailable = true;
      const data = (await epochsRes.value.json()) as EpochsResponseContract;
      epochs = data.epochs ?? [];
      if (data.provenance) provenance = data.provenance;
    }

    if (searchRes.status === "fulfilled" && searchRes.value.ok) {
      backendAvailable = true;
      const data = (await searchRes.value.json()) as SearchResponseContract;
      hits = data.hits ?? [];
      if (data.provenance) provenance = data.provenance;
    }

    // Si el backend no respondió con 200 en epochs
    if (!backendAvailable) {
      return {
        success: false,
        observations: [],
        hits: [],
        provenance: "backend_unavailable",
        isSimulated: true,
        backendAvailable: false,
        error:
          "El backend FastAPI (/api) no está disponible en este momento. Verifique que el servicio esté ejecutándose en http://127.0.0.1:8000.",
      };
    }

    // Convertir épocas a tipo Observation compatible con el contrato
    const observations: Observation[] = epochs.map((ep, idx) => ({
      id: ep.obs_id || `OBS-${idx + 1}`,
      observed_at: ep.t_mjd
        ? new Date(Date.UTC(2026, 0, 1) + ep.t_mjd * 86400000).toISOString()
        : new Date().toISOString(),
      collection: ep.provenance || "SPHEREx-DR1",
      ra: params.ra,
      dec: params.dec,
      band: ep.bandpass || (ep.wavelength_um ? `${ep.wavelength_um.toFixed(2)}µm` : "B1"),
      preview_url: ep.preview_url ?? null,
      source_url: ep.obs_id ? `/api/preview/${ep.obs_id}` : null,
    }));

    return {
      success: true,
      observations,
      hits,
      provenance,
      isSimulated: true, // Datos marcados rigurosamente como SIMULADOS
      backendAvailable: true,
    };
  } catch (err) {
    return {
      success: false,
      observations: [],
      provenance: "error",
      isSimulated: true,
      backendAvailable: false,
      error: err instanceof Error ? err.message : "Error inesperado al conectar con el backend",
    };
  }
}

/**
 * Comprueba estado de salud del backend (/health).
 */
export async function checkBackendHealth(fetchImpl = fetch): Promise<boolean> {
  try {
    const res = await fetchImpl("/health");
    if (!res.ok) return false;
    const data = (await res.json()) as { status?: string };
    return data.status === "ok";
  } catch {
    return false;
  }
}
