import { describe, expect, it } from "vitest";
import { spectralPosition, wavelengthToAxis } from "./spectralSpace";

describe("espacio del cubo espectral", () => {
  it("apoya el eje Z en la ventana publicada 0.75–5 µm, no en una intensidad", () => {
    expect(wavelengthToAxis(0.75)).toBeCloseTo(-1, 10);
    expect(wavelengthToAxis(5)).toBeCloseTo(1, 10);
    expect(wavelengthToAxis((0.75 + 5) / 2)).toBeCloseTo(0, 10);
  });

  it("no usa la amplitud como posición", () => {
    const center = { ra: 10, dec: -20, radiusDeg: 1 };
    const first = spectralPosition(10.2, -19.8, 2.4, center);
    const second = spectralPosition(10.2, -19.8, 2.4, center);
    expect(second).toEqual(first);
    expect(first.x).not.toBe(0);
    expect(first.z).toBeCloseTo(wavelengthToAxis(2.4), 10);
  });
});
