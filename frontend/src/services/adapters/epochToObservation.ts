/**
 * Adaptador puro: convierte objetos Epoch de la API FastAPI a Observation del frontend.
 *
 * Reglas estrictas:
 * 1. obs_id -> id.
 * 2. t_mjd -> observed_at (ISO 8601 UTC) usando la fórmula unixMs = (mjd - 40587) * 86400000.
 * 3. bandpass -> band.
 * 4. Para ra, dec, collection, source_url, preview_url y provenance usar ÚNICAMENTE los
 *    valores que traiga la API. Jamás inventar coordenadas, colecciones ni URLs simuladas.
 * 5. Si falta un campo requerido (obs_id, t_mjd, bandpass, ra, dec), la época se descarta.
 * 6. collection / source_url son opcionales (null si ausentes); no provocan descarte.
 */

import type { Observation } from "@/types/observation";
import type { ApiEpoch } from "@/services/apiTypes";

export interface DiscardedEpoch {
  obs_id: string | null;
  reasons: string[];
}

export interface AdaptationResult {
  observations: Observation[];
  discarded: DiscardedEpoch[];
}

/**
 * Convierte un valor MJD a cadena ISO 8601 UTC usando la fórmula estándar:
 * unixMs = (mjd - 40587) * 86400000
 */
export function mjdToIsoUtc(mjd: number): string {
  const unixMs = (mjd - 40587) * 86400000;
  return new Date(unixMs).toISOString();
}

/**
 * Adapta un solo Epoch a Observation.
 * Si no cumple con todos los campos requeridos, retorna las razones de descarte.
 */
export function adaptSingleEpoch(raw: unknown): {
  observation?: Observation;
  discarded?: DiscardedEpoch;
} {
  const reasons: string[] = [];

  if (!raw || typeof raw !== "object") {
    return {
      discarded: {
        obs_id: null,
        reasons: ["The Epoch is null or not a valid object."],
      },
    };
  }

  const epoch = raw as Partial<ApiEpoch> & Record<string, unknown>;

  // 1. obs_id -> id
  const obsId = typeof epoch.obs_id === "string" ? epoch.obs_id.trim() : null;
  if (!obsId) {
    reasons.push("obs_id missing or invalid (must be a non-empty string).");
  }

  // 2. t_mjd -> observed_at
  let observedAt: string | null = null;
  if (
    typeof epoch.t_mjd !== "number" ||
    !Number.isFinite(epoch.t_mjd) ||
    Number.isNaN(epoch.t_mjd)
  ) {
    reasons.push("t_mjd missing, null, or not numeric (a finite MJD is required).");
  } else {
    try {
      observedAt = mjdToIsoUtc(epoch.t_mjd);
    } catch {
      reasons.push("No se pudo calcular la fecha ISO a partir de t_mjd.");
    }
  }

  // 3. bandpass -> band
  const band = typeof epoch.bandpass === "string" ? epoch.bandpass.trim() : null;
  if (!band) {
    reasons.push("bandpass missing or invalid (must be a non-empty string).");
  }

  // 4. ra (0 a 360 grados) — nullable en OpenAPI; sin valor válido se descarta
  const ra = epoch.ra;
  if (
    typeof ra !== "number" ||
    !Number.isFinite(ra) ||
    Number.isNaN(ra) ||
    ra < 0 ||
    ra > 360
  ) {
    reasons.push("ra missing or outside the range [0, 360] degrees.");
  }

  // 5. dec (-90 a 90 grados)
  const dec = epoch.dec;
  if (
    typeof dec !== "number" ||
    !Number.isFinite(dec) ||
    Number.isNaN(dec) ||
    dec < -90 ||
    dec > 90
  ) {
    reasons.push("dec missing or outside the range [-90, 90] degrees.");
  }

  // 6. collection (opcional: null si ausente/vacío; nunca se inventa DR1/QR3)
  const collection =
    typeof epoch.collection === "string" && epoch.collection.trim() !== ""
      ? epoch.collection.trim()
      : null;

  // 7. source_url (opcional: null si ausente/vacío; nunca se inventan URLs)
  const sourceUrl =
    typeof epoch.source_url === "string" && epoch.source_url.trim() !== ""
      ? epoch.source_url.trim()
      : null;

  // 8. preview_url (nullable: si no existe, es null; no se inventa imagen simulada)
  const previewUrl =
    typeof epoch.preview_url === "string" && epoch.preview_url.trim() !== ""
      ? epoch.preview_url.trim()
      : null;

  // 9. provenance (passthrough opcional; no se inventa)
  const provenance =
    typeof epoch.provenance === "string" && epoch.provenance.trim() !== ""
      ? epoch.provenance.trim()
      : null;

  if (reasons.length > 0 || !obsId || !observedAt || !band) {
    return {
      discarded: {
        obs_id: obsId,
        reasons,
      },
    };
  }

  // ra/dec already validated above when reasons is empty
  return {
    observation: {
      id: obsId,
      observed_at: observedAt,
      collection,
      ra: ra as number,
      dec: dec as number,
      band,
      preview_url: previewUrl,
      source_url: sourceUrl,
      provenance,
    },
  };
}

/**
 * Convierte un arreglo de Epochs a Observations, recopilando todas las épocas
 * descartadas con sus respectivos motivos.
 */
export function adaptEpochsToObservations(rawEpochs: unknown): AdaptationResult {
  if (!Array.isArray(rawEpochs)) {
    return {
      observations: [],
      discarded: [
        {
          obs_id: null,
          reasons: ["The response does not contain a valid list of epochs."],
        },
      ],
    };
  }

  const observations: Observation[] = [];
  const discarded: DiscardedEpoch[] = [];

  for (const raw of rawEpochs) {
    const result = adaptSingleEpoch(raw);
    if (result.observation) {
      observations.push(result.observation);
    } else if (result.discarded) {
      discarded.push(result.discarded);
    }
  }

  return {
    observations,
    discarded,
  };
}
