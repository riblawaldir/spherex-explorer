import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  readViewerDensity,
  toggleViewerDensity,
  writeViewerDensity,
  type ViewerDensity,
} from "@/lib/viewerDensity";

interface DensityContextValue {
  density: ViewerDensity;
  setDensity: (density: ViewerDensity) => void;
  toggleDensity: () => void;
}

const DensityContext = createContext<DensityContextValue | undefined>(undefined);

export function DensityProvider({ children }: { children: ReactNode }) {
  const [density, setDensityState] = useState<ViewerDensity>(() =>
    readViewerDensity(typeof window === "undefined" ? null : window.localStorage),
  );

  const setDensity = useCallback((value: ViewerDensity) => {
    setDensityState(value);
    writeViewerDensity(typeof window === "undefined" ? null : window.localStorage, value);
  }, []);

  const toggleDensity = useCallback(() => {
    setDensityState((current) => {
      const next = toggleViewerDensity(current);
      writeViewerDensity(typeof window === "undefined" ? null : window.localStorage, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ density, setDensity, toggleDensity }),
    [density, setDensity, toggleDensity],
  );

  return <DensityContext.Provider value={value}>{children}</DensityContext.Provider>;
}

export function useDensity() {
  const context = useContext(DensityContext);
  if (!context) throw new Error("DensityProvider required");
  return context;
}
