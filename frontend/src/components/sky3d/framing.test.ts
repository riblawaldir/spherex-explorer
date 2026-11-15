import { describe, expect, it } from "vitest";
import { centerOffset, contains, fitDistance, intersects } from "./framing";

describe("fitDistance", () => {
  it("makes the sphere silhouette span the shorter side of the fit box", () => {
    const fit = { left: 352, top: 110, right: 1088, bottom: 600 };
    const height = 650;
    const fov = 45;
    const radius = 1.05;
    const distance = fitDistance(radius, fov, height, fit, 8);
    const projectedHalf = radius / Math.sqrt(distance * distance - radius * radius);
    const pixels = (projectedHalf / Math.tan((fov * Math.PI) / 360)) * height;
    expect(pixels).toBeCloseTo(490 - 16, 3);
  });

  it("moves the camera back when the box shrinks", () => {
    const wide = fitDistance(1, 45, 600, { left: 0, top: 0, right: 600, bottom: 600 });
    const narrow = fitDistance(1, 45, 600, { left: 0, top: 0, right: 300, bottom: 600 });
    expect(narrow).toBeGreaterThan(wide);
  });
});

describe("centerOffset", () => {
  it("is zero for a centered box and shifts toward an off-center box", () => {
    expect(centerOffset(1000, 600, { left: 100, top: 100, right: 900, bottom: 500 })).toEqual({ x: 0, y: 0 });
    expect(centerOffset(1000, 600, { left: 0, top: 120, right: 1000, bottom: 560 })).toEqual({ x: 0, y: -40 });
  });
});

describe("box helpers", () => {
  const box = { left: 0, top: 0, right: 100, bottom: 50 };
  it("detects overlap and containment", () => {
    expect(intersects(box, { left: 90, top: 40, right: 120, bottom: 60 })).toBe(true);
    expect(intersects(box, { left: 100, top: 0, right: 120, bottom: 50 })).toBe(false);
    expect(contains(box, { left: 10, top: 10, right: 90, bottom: 40 })).toBe(true);
    expect(contains(box, { left: 10, top: 10, right: 110, bottom: 40 })).toBe(false);
  });
});
