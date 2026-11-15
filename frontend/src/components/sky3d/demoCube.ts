/**
 * Deterministic DEMO spectra. Not SPHEREx measurements and not the 102 flight channels.
 *
 * The wavelength window is the one published by IRSA and JPL: 0.75–5.0 µm,
 * six detector bands. Each sample sits at the midpoint of one published window.
 * https://irsa.ipac.caltech.edu/Missions/spherex.html
 * https://science.jpl.nasa.gov/projects/SPHEREx/
 */

export interface DemoBandWindow {
  id: string;
  label: string;
  wavelengthUm: number;
}

export const DEMO_BAND_WINDOWS: readonly DemoBandWindow[] = [
  { id: "window-1", label: "0.75–1.1 µm window", wavelengthUm: 0.925 },
  { id: "window-2", label: "1.1–1.6 µm window", wavelengthUm: 1.35 },
  { id: "window-3", label: "1.6–2.4 µm window", wavelengthUm: 2 },
  { id: "window-4", label: "2.4–3.8 µm window", wavelengthUm: 3.1 },
  { id: "window-5", label: "3.8–4.4 µm window", wavelengthUm: 4.1 },
  { id: "window-6", label: "4.4–5.0 µm window", wavelengthUm: 4.7 },
];

export interface DemoSpectrumSample {
  source: "demo";
  observationId: string;
  ra: number;
  dec: number;
  wavelengthUm: number;
  /** Relative demo amplitude, 0–1. Not a flux and not a distance. */
  amplitude: number;
  bandId: string;
  bandLabel: string;
}

const DEMO_SEED = 0x53504858;

function hashString(value: string): number {
  let hash = DEMO_SEED;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function createDemoSpectra(
  observations: readonly { id: string; ra: number; dec: number }[],
): DemoSpectrumSample[] {
  const samples: DemoSpectrumSample[] = [];
  for (const observation of observations) {
    if (!Number.isFinite(observation.ra) || !Number.isFinite(observation.dec)) continue;
    const random = mulberry32(hashString(observation.id));
    for (const band of DEMO_BAND_WINDOWS) {
      samples.push({
        source: "demo",
        observationId: observation.id,
        ra: observation.ra,
        dec: observation.dec,
        wavelengthUm: band.wavelengthUm,
        amplitude: random(),
        bandId: band.id,
        bandLabel: band.label,
      });
    }
  }
  return samples;
}
