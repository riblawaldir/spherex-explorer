/**
 * Vista de Aladin Lite a partir de una consulta (ra, dec, radius_deg).
 * No modifica las coordenadas de las observaciones: solo calcula la cámara.
 *
 * Documentación de Aladin Lite v3:
 * el identificador por defecto es "P/DSS2/color"
 * (https://aladin.cds.unistra.fr/AladinLite/doc/API/).
 * Ese identificador apunta a https://alasky.cds.unistra.fr/DSS/DSSColor,
 * que en este entorno responde 404. El mismo HiPS (ivo://CDS/P/DSS2/color)
 * sí se sirve desde el espejo de la ESA, host permitido por Aladin Lite.
 * setFoV(número) fija el campo de visión en grados.
 */

import { degreesToDMS, degreesToHMS, validateCoordinatesStrict } from "./coordinates";
import type { Coordinates } from "@/types/search";

export interface AladinSurveyInfo {
  id: string;
  name: string;
  description: string;
}

/**
 * Mismo HiPS que P/DSS2/color (ivo://CDS/P/DSS2/color), servido por el espejo
 * skies.esac.esa.int. Es contexto visual óptico, no una imagen de SPHEREx.
 */
export const DEFAULT_ALADIN_SURVEY = "https://skies.esac.esa.int/DSSColor";

export const ALADIN_SURVEYS: Record<string, AladinSurveyInfo> = {
  [DEFAULT_ALADIN_SURVEY]: {
    id: DEFAULT_ALADIN_SURVEY,
    name: "DSS2 Color",
    description:
      "Digitized Sky Survey 2 en color, espejo ESA de ivo://CDS/P/DSS2/color. Fondo visual, no datos de SPHEREx.",
  },
};

export type SurveyBackgroundState = "loading" | "ready" | "unavailable";

/** Una tesela HiPS real, no el fichero properties ni el HTML de respaldo. */
export function surveyTileSeen(urls: readonly string[], surveyUrl: string): boolean {
  let host = "";
  try {
    host = new URL(surveyUrl).host;
  } catch {
    return false;
  }
  return urls.some(
    (url) => url.includes(host) && /\/Norder\d+\/.+\.(jpe?g|png|webp)(?:\?|$)/i.test(url),
  );
}

export function surveyBackgroundLabel(state: SurveyBackgroundState = "ready"): string {
  if (state === "unavailable") {
    return "Fondo del cielo no disponible; los marcadores siguen activos.";
  }
  const survey = ALADIN_SURVEYS[DEFAULT_ALADIN_SURVEY];
  const place = `${survey?.name ?? "DSS2 Color"} (${DEFAULT_ALADIN_SURVEY})`;
  if (state === "loading") {
    return `Cargando fondo… ${place}. Contexto visual; no son datos de SPHEREx.`;
  }
  return `Fondo: ${place}. Contexto visual; no son datos de SPHEREx.`;
}

/**
 * El diámetro angular del círculo de búsqueda es 2 × radio.
 * El FoV horizontal de Aladin muestra ese diámetro con un margen de 1.75,
 * de modo que el círculo ocupa 1/1.75 ≈ 57 % del ancho y cabe completo.
 *
 *   fov = clamp(2 × radiusDeg × 1.75, 0.02°, 180°)
 *
 * 0.02° es el zoom mínimo de la cámara para radios diminutos.
 * No cambia el radio dibujado ni las coordenadas.
 */
export const SEARCH_FOV_DIAMETER_MARGIN = 1.75;
export const MIN_FOV_DEG = 0.02;
export const MAX_FOV_DEG = 180;

export interface AladinViewParams {
  ra: number;
  dec: number;
  fov: number;
  radiusDeg: number;
}

export interface AladinViewOptions {
  marginMultiplier?: number;
  minFov?: number;
  maxFov?: number;
}

/** RA equivalente en [0, 360). 370° y 10° son el mismo meridiano. */
export function normalizeRa(ra: number): number {
  if (!Number.isFinite(ra)) return ra;
  return ((ra % 360) + 360) % 360;
}

export function computeAladinViewParams(
  ra: number,
  dec: number,
  radiusDeg: number,
  options: AladinViewOptions = {},
): AladinViewParams {
  if (!Number.isFinite(ra) || !Number.isFinite(dec) || !Number.isFinite(radiusDeg)) {
    throw new Error("RA, Dec y el radio deben ser números finitos.");
  }

  const margin = options.marginMultiplier ?? SEARCH_FOV_DIAMETER_MARGIN;
  const minFov = options.minFov ?? MIN_FOV_DEG;
  const maxFov = options.maxFov ?? MAX_FOV_DEG;
  const diameter = 2 * Math.abs(radiusDeg);
  const fov = Math.min(maxFov, Math.max(minFov, diameter * margin));

  return {
    ra: normalizeRa(ra),
    dec,
    fov,
    radiusDeg,
  };
}

export interface ParsedSearchQuery {
  ra: number;
  dec: number;
  radiusDeg: number;
}

/** Usa el mismo validador que el buscador. No sustituye una consulta inválida por 0,0. */
export function parseSubmittedQuery(coordinates: Coordinates): ParsedSearchQuery | null {
  const parsed = validateCoordinatesStrict(coordinates);
  if (!parsed.isValid || !parsed.parsed) return null;
  return {
    ra: parsed.parsed.ra,
    dec: parsed.parsed.dec,
    radiusDeg: parsed.parsed.radius,
  };
}

export function formatCoordinatesDisplay(ra: number, dec: number): {
  decimal: string;
  sexagesimal: string;
} {
  const normRa = normalizeRa(ra);
  const sign = dec >= 0 ? "+" : "";
  return {
    decimal: `RA ${normRa.toFixed(5)}° · DEC ${sign}${dec.toFixed(5)}°`,
    sexagesimal: `${degreesToHMS(normRa)} · ${degreesToDMS(dec)}`,
  };
}

export type PanDirection = "left" | "right" | "up" | "down";

/**
 * Desplaza el centro de la vista. En el cielo, la RA crece hacia la izquierda
 * (este a la izquierda), igual que Aladin Lite.
 * El paso en RA se divide por cos(dec) para que el desplazamiento angular
 * sea parecido al de Dec. Cerca de los polos se limita el factor.
 * Esto no altera RA/Dec de ninguna observación.
 */
export function panCenter(
  ra: number,
  dec: number,
  fovWidth: number,
  fovHeight: number,
  direction: PanDirection,
  fraction = 0.2,
): { ra: number; dec: number } {
  const cos = Math.cos((dec * Math.PI) / 180);
  const raScale = Math.max(Math.abs(cos), 0.05);
  let nextRa = ra;
  let nextDec = dec;
  if (direction === "left") nextRa = ra + (fovWidth * fraction) / raScale;
  if (direction === "right") nextRa = ra - (fovWidth * fraction) / raScale;
  if (direction === "up") nextDec = dec + fovHeight * fraction;
  if (direction === "down") nextDec = dec - fovHeight * fraction;
  return {
    ra: normalizeRa(nextRa),
    dec: Math.max(-89, Math.min(89, nextDec)),
  };
}

export function nextFov(current: number, direction: "in" | "out"): number {
  const factor = direction === "in" ? 1 / 1.4 : 1.4;
  const width = Number.isFinite(current) && current > 0 ? current : MIN_FOV_DEG;
  return Math.min(MAX_FOV_DEG, Math.max(MIN_FOV_DEG, width * factor));
}

/**
 * Proyección local de respaldo cuando Aladin Lite no carga.
 * x crece hacia la derecha y la RA hacia la izquierda.
 * y crece hacia abajo; la Dec crece hacia arriba.
 * El resultado está en porcentaje del ancho/alto del visor.
 */
export function projectFallbackPosition(
  ra: number,
  dec: number,
  centerRa: number,
  centerDec: number,
  fovDeg: number,
): { xPercent: number; yPercent: number; inside: boolean } {
  const span = fovDeg > 0 ? fovDeg : MIN_FOV_DEG;
  let deltaRa = normalizeRa(ra) - normalizeRa(centerRa);
  if (deltaRa > 180) deltaRa -= 360;
  if (deltaRa < -180) deltaRa += 360;
  const east = deltaRa * Math.cos((centerDec * Math.PI) / 180);
  const north = dec - centerDec;
  const xPercent = 50 - (east / span) * 100;
  const yPercent = 50 - (north / span) * 100;
  const inside = xPercent >= 0 && xPercent <= 100 && yPercent >= 0 && yPercent <= 100;
  return { xPercent, yPercent, inside };
}

/** Inversa de projectFallbackPosition. Sirve para el cursor de la vista de respaldo. */
export function unprojectFallbackPosition(
  xPercent: number,
  yPercent: number,
  centerRa: number,
  centerDec: number,
  fovDeg: number,
): { ra: number; dec: number } {
  const span = fovDeg > 0 ? fovDeg : MIN_FOV_DEG;
  const east = ((50 - xPercent) / 100) * span;
  const north = ((50 - yPercent) / 100) * span;
  const cos = Math.cos((centerDec * Math.PI) / 180);
  const deltaRa = Math.abs(cos) < 1e-6 ? 0 : east / cos;
  return { ra: normalizeRa(centerRa + deltaRa), dec: centerDec + north };
}
