/**
 * RA/Dec to a unit vector. Right-handed, Y up.
 * North celestial pole is +Y. RA 0°, Dec 0° is +Z.
 * RA increases toward +X (RA 90° is +X).
 * The radius is the drawing radius of the sphere, not a distance in space.
 */

export interface SkyVector {
  x: number;
  y: number;
  z: number;
}

const DEG = Math.PI / 180;

export function normalizeRa(ra: number): number {
  const wrapped = ra % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

export function raDecToUnitVector(ra: number, dec: number): SkyVector {
  const raRad = normalizeRa(ra) * DEG;
  const decRad = dec * DEG;
  const cosDec = Math.cos(decRad);
  return {
    x: cosDec * Math.sin(raRad),
    y: Math.sin(decRad),
    z: cosDec * Math.cos(raRad),
  };
}

export function scaleVector(vector: SkyVector, radius: number): SkyVector {
  return { x: vector.x * radius, y: vector.y * radius, z: vector.z * radius };
}

/** Marker position on the sphere. ra/dec are not rounded. */
export function observationToMarker(
  observation: { ra: number; dec: number },
  radius = 1,
): SkyVector {
  return scaleVector(raDecToUnitVector(observation.ra, observation.dec), radius);
}

export function unitVectorToRaDec(vector: SkyVector): { ra: number; dec: number } {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  const y = Math.min(1, Math.max(-1, vector.y / length));
  const dec = Math.asin(y) / DEG;
  let ra = Math.atan2(vector.x / length, vector.z / length) / DEG;
  if (ra < 0) ra += 360;
  return { ra, dec };
}

export function angularSeparationDeg(a: SkyVector, b: SkyVector): number {
  const dot = Math.min(1, Math.max(-1, a.x * b.x + a.y * b.y + a.z * b.z));
  return Math.acos(dot) / DEG;
}

function cross(a: SkyVector, b: SkyVector): SkyVector {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function normalize(vector: SkyVector): SkyVector {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return scaleVector(vector, 1 / length);
}

function add(a: SkyVector, b: SkyVector, c: SkyVector): SkyVector {
  return { x: a.x + b.x + c.x, y: a.y + b.y + c.y, z: a.z + b.z + c.z };
}

/** Closed ring on the sphere. radiusDeg is the search radius, not a footprint. */
export function searchCirclePositions(
  ra: number,
  dec: number,
  radiusDeg: number,
  samples = 96,
): number[] {
  const center = raDecToUnitVector(ra, dec);
  const hint = Math.abs(center.y) > 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const east = normalize(cross(hint, center));
  const north = normalize(cross(center, east));
  const angle = radiusDeg * DEG;
  const positions: number[] = [];
  for (let index = 0; index <= samples; index += 1) {
    const turn = (index / samples) * Math.PI * 2;
    const point = add(
      scaleVector(center, Math.cos(angle)),
      scaleVector(east, Math.sin(angle) * Math.cos(turn)),
      scaleVector(north, Math.sin(angle) * Math.sin(turn)),
    );
    positions.push(point.x, point.y, point.z);
  }
  return positions;
}

/** RA/Dec graticule as line-segment positions on the unit sphere. */
export function graticulePositions(stepDeg = 30, segments = 48): number[] {
  const positions: number[] = [];
  const push = (ra: number, dec: number, ra2: number, dec2: number) => {
    const a = raDecToUnitVector(ra, dec);
    const b = raDecToUnitVector(ra2, dec2);
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
  };
  for (let ra = 0; ra < 360; ra += stepDeg) {
    for (let index = 0; index < segments; index += 1) {
      const dec0 = -90 + (180 * index) / segments;
      const dec1 = -90 + (180 * (index + 1)) / segments;
      push(ra, dec0, ra, dec1);
    }
  }
  for (let dec = -60; dec <= 60; dec += stepDeg) {
    for (let index = 0; index < segments; index += 1) {
      const ra0 = (360 * index) / segments;
      const ra1 = (360 * (index + 1)) / segments;
      push(ra0, dec, ra1, dec);
    }
  }
  return positions;
}
