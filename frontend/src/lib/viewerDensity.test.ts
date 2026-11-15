import { describe, expect, it } from "vitest";
import {
  readViewerDensity,
  toggleViewerDensity,
  VIEWER_DENSITY_KEY,
  writeViewerDensity,
  type DensityStorage,
} from "./viewerDensity";

function memoryStorage(): DensityStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

describe("modo del visor 3D", () => {
  it("empieza en analysis y recuerda focus", () => {
    const storage = memoryStorage();
    expect(readViewerDensity(storage)).toBe("analysis");
    writeViewerDensity(storage, "focus");
    expect(storage.map.get(VIEWER_DENSITY_KEY)).toBe("focus");
    expect(readViewerDensity(storage)).toBe("focus");
    expect(toggleViewerDensity("focus")).toBe("analysis");
  });

  it("ignora un valor desconocido y un almacenamiento que falla", () => {
    const storage = memoryStorage();
    storage.setItem(VIEWER_DENSITY_KEY, "cinematic");
    expect(readViewerDensity(storage)).toBe("analysis");
    const blocked: DensityStorage = {
      getItem() {
        throw new Error("denied");
      },
      setItem() {
        throw new Error("denied");
      },
    };
    expect(readViewerDensity(blocked)).toBe("analysis");
    expect(() => writeViewerDensity(blocked, "focus")).not.toThrow();
  });
});
