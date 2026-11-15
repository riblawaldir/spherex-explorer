export type ViewerDensity = "focus" | "analysis";

export const VIEWER_DENSITY_KEY = "spherex-viewer-density";

export interface DensityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readViewerDensity(storage: DensityStorage | null): ViewerDensity {
  try {
    const value = storage?.getItem(VIEWER_DENSITY_KEY);
    return value === "focus" || value === "analysis" ? value : "analysis";
  } catch {
    return "analysis";
  }
}

export function writeViewerDensity(storage: DensityStorage | null, density: ViewerDensity): void {
  try {
    storage?.setItem(VIEWER_DENSITY_KEY, density);
  } catch {
    // Private mode and blocked storage leave the choice in memory only.
  }
}

export function toggleViewerDensity(density: ViewerDensity): ViewerDensity {
  return density === "focus" ? "analysis" : "focus";
}
