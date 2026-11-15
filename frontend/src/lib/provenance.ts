/** Honest provenance labels for API Epoch.provenance — never invent NASA live. */

export type KnownProvenance = "stub" | "cached_sample" | "live" | "irsa_verified_local" | "local_real_fits";
export type ProvenanceKind = KnownProvenance | "unknown";

export interface ProvenanceInfo {
  kind: ProvenanceKind;
  /** Short chip token shown in UI (matches API enum when known). */
  token: string;
  /** One-line explanation; never claims fixtures are NASA live. */
  title: string;
}

const KNOWN: ReadonlySet<string> = new Set(["stub", "cached_sample", "live", "irsa_verified_local", "local_real_fits"]);

/**
 * Normalize a raw provenance string from the API.
 * Unknown / empty values stay `unknown` — we do not invent stub/live.
 */
export function normalizeProvenance(
  raw: string | null | undefined,
): ProvenanceKind {
  if (typeof raw !== "string") return "unknown";
  const value = raw.trim();
  if (!value) return "unknown";
  if (KNOWN.has(value)) return value as KnownProvenance;
  return "unknown";
}

export function describeProvenance(
  raw: string | null | undefined,
): ProvenanceInfo {
  const kind = normalizeProvenance(raw);
  switch (kind) {
    case "stub":
      return {
        kind,
        token: "stub",
        title: "Fixture etiquetado — no es dato NASA en vivo",
      };
    case "cached_sample":
      return {
        kind,
        token: "cached_sample",
        title: "Muestra local en caché — no es consulta IRSA en vivo",
      };
    case "live":
      return {
        kind,
        token: "live",
        title: "Fila obtenida vía consulta IRSA en vivo",
      };
    case "irsa_verified_local":
      return { kind, token: "IRSA local verificado", title: "Recorte IRSA local verificado por SHA-256; no es una consulta en vivo" };
    case "local_real_fits":
      return {
        kind,
        token: "local_real_fits",
        title:
          "FITS real autorizado en esta máquina — no es una consulta IRSA en vivo",
      };

    default:
      return {
        kind: "unknown",
        token: "sin provenance",
        title: "La API no envió provenance para esta observación",
      };
  }
}
