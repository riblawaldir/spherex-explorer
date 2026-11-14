import { describe, it, expect } from "vitest";
import {
  defaultCoordinates,
  emptyFilters,
  validateCoordinates,
  filterMockObservations,
  canCompare,
} from "./mockObservations";
describe("Simulated observation rules", () => {
  it("preloads the requested coordinates and radius", () => {
    expect(defaultCoordinates).toEqual({ ra: "127.69444", dec: "-39.17760", radius: "0.01" });
  });
  it("accepts RA endpoints 0 and 360 and rejects outside that range", () => {
    for (const ra of ["0", "360"])
      expect(validateCoordinates({ ...defaultCoordinates, ra }).ra).toBeUndefined();
    for (const ra of ["-0.01", "360.01", ""])
      expect(validateCoordinates({ ...defaultCoordinates, ra }).ra).toBeDefined();
  });
  it("accepts Dec endpoints -90 and 90 and rejects outside that range", () => {
    for (const dec of ["-90", "90"])
      expect(validateCoordinates({ ...defaultCoordinates, dec }).dec).toBeUndefined();
    for (const dec of ["-90.01", "90.01", ""])
      expect(validateCoordinates({ ...defaultCoordinates, dec }).dec).toBeDefined();
  });
  it("requires at least two unique observations to compare", () => {
    expect(canCompare([])).toBe(false);
    expect(canCompare(["a"])).toBe(false);
    expect(canCompare(["a", "a"])).toBe(false);
    expect(canCompare(["a", "b"])).toBe(true);
  });
  it("applies and clears bands, dates and collection filters to mock rows", () => {
    expect(
      filterMockObservations(defaultCoordinates, { ...emptyFilters, bands: ["B2"] }).map(
        (o) => o.id,
      ),
    ).toEqual(["SPX-SIM-002"]);
    expect(
      filterMockObservations(defaultCoordinates, { ...emptyFilters, collection: "QR3" }).length,
    ).toBe(2);
    expect(
      filterMockObservations(defaultCoordinates, {
        ...emptyFilters,
        start: "2026-08-20",
        end: "2026-08-22",
      }).length,
    ).toBe(2);
    expect(filterMockObservations(defaultCoordinates, emptyFilters).length).toBe(6);
  });
  it("rejects a nonpositive radius", () => {
    expect(validateCoordinates({ ...defaultCoordinates, radius: "0" }).radius).toBeDefined();
  });
});
