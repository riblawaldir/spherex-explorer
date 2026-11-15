/** Shared JSON contract; URLs may be absent. Coordinates are in degrees. */
export interface Observation {
  id: string
  observed_at: string
  /** Present only when the API supplies it (live IRSA); fixtures omit this. */
  collection: string | null
  ra: number
  dec: number
  band: string
  preview_url: string | null
  source_url: string | null
  /** Per-epoch API provenance when present; never invented. */
  provenance?: string | null
}
