import { describe, expect, it } from "vitest";
import { createDemoSpectra, DEMO_BAND_WINDOWS } from "./demoCube";

describe("cubo demo", () => {
  const observations = [
    { id: "OBS-001", ra: 127.6944441, dec: -39.1776004 },
    { id: "OBS-002", ra: 10, dec: 20 },
  ];

  it("repite la misma secuencia y no inventa 102 canales", () => {
    const first = createDemoSpectra(observations);
    const second = createDemoSpectra(observations);
    expect(second).toEqual(first);
    expect(first).toHaveLength(observations.length * DEMO_BAND_WINDOWS.length);
    expect(DEMO_BAND_WINDOWS).toHaveLength(6);
    expect(first.every((sample) => sample.source === "demo")).toBe(true);
    expect(new Set(first.map((sample) => sample.wavelengthUm)).size).toBe(6);
  });

  it("cambia con el identificador y conserva la RA/Dec real", () => {
    const samples = createDemoSpectra(observations);
    const first = samples.find((sample) => sample.observationId === "OBS-001");
    const other = samples.find((sample) => sample.observationId === "OBS-002");
    expect(first?.ra).toBe(127.6944441);
    expect(first?.dec).toBe(-39.1776004);
    expect(first?.amplitude).not.toBe(other?.amplitude);
    expect(createDemoSpectra([{ id: "bad", ra: Number.NaN, dec: 0 }])).toEqual([]);
  });
});
