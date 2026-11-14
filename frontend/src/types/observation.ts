/** Shared JSON contract; URLs may be absent. Coordinates are in degrees. */
export interface Observation {
  id: string
  observed_at: string
  collection: string
  ra: number
  dec: number
  band: string
  preview_url: string | null
  source_url: string | null
}
