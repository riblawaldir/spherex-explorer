import { describe, expect, it } from "vitest";
import {
  angularSeparationDeg,
  graticulePositions,
  observationToMarker,
  raDecToUnitVector,
  searchCirclePositions,
  unitVectorToRaDec,
} from "./celestial";

function length(vector: { x: number; y: number; z: number }): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

describe("RA/Dec a vector unitario", () => {
  it("coloca el ecuador y los polos en la convención Y arriba", () => {
    expect(raDecToUnitVector(0, 0)).toEqual({ x: 0, y: 0, z: 1 });
    expect(raDecToUnitVector(90, 0).x).toBeCloseTo(1, 10);
    expect(raDecToUnitVector(90, 0).y).toBeCloseTo(0, 10);
    expect(raDecToUnitVector(90, 0).z).toBeCloseTo(0, 10);
    expect(raDecToUnitVector(180, 0).z).toBeCloseTo(-1, 10);
    expect(raDecToUnitVector(270, 0).x).toBeCloseTo(-1, 10);
    const north = raDecToUnitVector(0, 90);
    expect(north.y).toBeCloseTo(1, 10);
    expect(north.x).toBeCloseTo(0, 8);
    expect(north.z).toBeCloseTo(0, 8);
    expect(raDecToUnitVector(0, -90).y).toBeCloseTo(-1, 10);
    for (const ra of [0, 90, 180, 270]) {
      expect(length(raDecToUnitVector(ra, 0))).toBeCloseTo(1, 10);
    }
  });

  it("es un sistema dextrógiro: RA 90° × norte = RA 0°", () => {
    const ra90 = raDecToUnitVector(90, 0);
    const north = raDecToUnitVector(0, 90);
    const cross = {
      x: ra90.y * north.z - ra90.z * north.y,
      y: ra90.z * north.x - ra90.x * north.z,
      z: ra90.x * north.y - ra90.y * north.x,
    };
    const ra0 = raDecToUnitVector(0, 0);
    expect(cross.x).toBeCloseTo(ra0.x, 10);
    expect(cross.y).toBeCloseTo(ra0.y, 10);
    expect(cross.z).toBeCloseTo(ra0.z, 10);
  });

  it("envuelve la RA y no redondea la declinación al convertir un marcador", () => {
    const marker = observationToMarker({ ra: 370.5, dec: -39.1776004 }, 2);
    const roundTrip = unitVectorToRaDec(marker);
    expect(roundTrip.ra).toBeCloseTo(10.5, 6);
    expect(roundTrip.dec).toBeCloseTo(-39.1776004, 6);
    expect(length(marker)).toBeCloseTo(2, 8);
    expect(raDecToUnitVector(0, 95).y).toBeCloseTo(Math.sin((95 * Math.PI) / 180), 8);
    expect(observationToMarker({ ra: 127.6944441, dec: -39.1776004 })).toEqual(
      raDecToUnitVector(127.6944441, -39.1776004),
    );
  });

  it("dibuja el círculo de búsqueda a la separación angular pedida", () => {
    const flat = searchCirclePositions(10, 20, 2, 24);
    const center = raDecToUnitVector(10, 20);
    expect(flat.length).toBe(25 * 3);
    for (let index = 0; index < flat.length; index += 3) {
      const point = { x: flat[index] ?? 0, y: flat[index + 1] ?? 0, z: flat[index + 2] ?? 0 };
      expect(length(point)).toBeCloseTo(1, 6);
      expect(angularSeparationDeg(center, point)).toBeCloseTo(2, 4);
    }
    expect(graticulePositions().length % 6).toBe(0);
  });
});
