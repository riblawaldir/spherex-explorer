import sky from "@/assets/simulated-sky.jpg";
import type { Observation } from "@/types/observation";
import type { Coordinates, SearchFilters } from "@/types/search";

// DATOS SIMULADOS. These records, imagery and filtering are UI fixtures, not NASA observations.
// source_url is mission context only; it is NOT the provenance of a scientific observation.
export const mockObservations: Observation[] = [
  {
    id: "SPX-SIM-001",
    observed_at: "2026-08-15T04:32:18Z",
    collection: "DR1",
    ra: 127.69444,
    dec: -39.1776,
    band: "B1",
    preview_url: sky,
    source_url: "https://science.nasa.gov/mission/spherex/",
  },
  {
    id: "SPX-SIM-002",
    observed_at: "2026-08-17T06:14:02Z",
    collection: "DR1",
    ra: 127.6971,
    dec: -39.1752,
    band: "B2",
    preview_url: sky,
    source_url: "https://science.nasa.gov/mission/spherex/",
  },
  {
    id: "SPX-SIM-003",
    observed_at: "2026-08-20T02:48:35Z",
    collection: "QR3",
    ra: 127.6908,
    dec: -39.1791,
    band: "B3",
    preview_url: sky,
    source_url: "https://science.nasa.gov/mission/spherex/",
  },
  {
    id: "SPX-SIM-004",
    observed_at: "2026-08-22T09:21:44Z",
    collection: "DR1",
    ra: 127.6983,
    dec: -39.1802,
    band: "B4",
    preview_url: sky,
    source_url: "https://science.nasa.gov/mission/spherex/",
  },
  {
    id: "SPX-SIM-005",
    observed_at: "2026-08-25T03:56:10Z",
    collection: "QR3",
    ra: 127.6912,
    dec: -39.1748,
    band: "B5",
    preview_url: sky,
    source_url: "https://science.nasa.gov/mission/spherex/",
  },
  {
    id: "SPX-SIM-006",
    observed_at: "2026-08-28T07:12:09Z",
    collection: "DR1",
    ra: 127.6961,
    dec: -39.1812,
    band: "B6",
    preview_url: sky,
    source_url: "https://science.nasa.gov/mission/spherex/",
  },
];
export const defaultCoordinates: Coordinates = {
  ra: "127.69444",
  dec: "-39.17760",
  radius: "0.01",
};
export const emptyFilters: SearchFilters = { start: "", end: "", bands: [], collection: "all" };
export const availableBands = ["B1", "B2", "B3", "B4", "B5", "B6"];
export function validateCoordinates(c: Coordinates) {
  const errors: Partial<Record<keyof Coordinates, string>> = {};
  if (!c.ra.trim() || !Number.isFinite(Number(c.ra)) || Number(c.ra) < 0 || Number(c.ra) > 360)
    errors.ra = "RA must be between 0 and 360 degrees.";
  if (!c.dec.trim() || !Number.isFinite(Number(c.dec)) || Number(c.dec) < -90 || Number(c.dec) > 90)
    errors.dec = "Dec must be between −90 and 90 degrees.";
  if (!c.radius.trim() || !Number.isFinite(Number(c.radius)) || Number(c.radius) <= 0)
    errors.radius = "Radius must be greater than 0.";
  return errors;
}
// Simulated bounding-box fixture filtering only; not an astronomical cone search.
export function filterMockObservations(c: Coordinates, f: SearchFilters): Observation[] {
  if (Object.keys(validateCoordinates(c)).length) return [];
  return mockObservations.filter(
    (o) =>
      Math.abs(o.ra - Number(c.ra)) <= Number(c.radius) &&
      Math.abs(o.dec - Number(c.dec)) <= Number(c.radius) &&
      (!f.start || o.observed_at.slice(0, 10) >= f.start) &&
      (!f.end || o.observed_at.slice(0, 10) <= f.end) &&
      (!f.bands.length || f.bands.includes(o.band)) &&
      (f.collection === "all" || f.collection === o.collection),
  );
}
export function canCompare(ids: string[]) {
  return new Set(ids).size >= 2;
}
