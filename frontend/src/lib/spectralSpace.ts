/**
 * Layout of the demo spectral cube.
 * X and Y are angular offsets from the search center (degrees, scaled into the cube).
 * Z is wavelength normalized across the published SPHEREx window 0.75–5.0 µm.
 * Amplitude is never a coordinate.
 *
 * Window: IRSA SPHEREx mission page and JPL (0.75–5 µm, 102 channels).
 * https://irsa.ipac.caltech.edu/Missions/spherex.html
 * https://science.jpl.nasa.gov/projects/SPHEREx/
 */

export const DOCUMENTED_WAVELENGTH_UM = { min: 0.75, max: 5 } as const;

export interface SpectralPoint {
  x: number;
  y: number;
  z: number;
}

function wrapSignedRa(ra: number): number {
  const wrapped = ((ra + 180) % 360 + 360) % 360;
  return wrapped - 180;
}

export function wavelengthToAxis(wavelengthUm: number): number {
  const { min, max } = DOCUMENTED_WAVELENGTH_UM;
  const span = max - min;
  return ((wavelengthUm - min) / span) * 2 - 1;
}

export function spectralPosition(
  ra: number,
  dec: number,
  wavelengthUm: number,
  center: { ra: number; dec: number; radiusDeg: number },
): SpectralPoint {
  const scale = 0.85 / Math.max(center.radiusDeg, 0.05);
  const x = Math.min(1, Math.max(-1, wrapSignedRa(ra - center.ra) * scale));
  const y = Math.min(1, Math.max(-1, (dec - center.dec) * scale));
  return { x, y, z: wavelengthToAxis(wavelengthUm) };
}
