import { createContext, useContext, useState, type ReactNode } from "react";
import type { Observation } from "@/types/observation";
const ExplorerContext = createContext<
  { comparison: Observation[]; setComparison: (o: Observation[]) => void } | undefined
>(undefined);
export function ExplorerProvider({ children }: { children: ReactNode }) {
  const [comparison, setComparison] = useState<Observation[]>([]);
  return (
    <ExplorerContext.Provider value={{ comparison, setComparison }}>
      {children}
    </ExplorerContext.Provider>
  );
}
export function useExplorer() {
  const context = useContext(ExplorerContext);
  if (!context) throw new Error("ExplorerProvider required");
  return context;
}
