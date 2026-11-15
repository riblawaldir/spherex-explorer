import { createContext, useContext, useState, type ReactNode } from "react";
import type { Observation } from "@/types/observation";
const ExplorerContext = createContext<
  {
    comparison: Observation[];
    comparisonIsSimulated: boolean;
    setComparison: (observations: Observation[], isSimulated?: boolean) => void;
  } | undefined
>(undefined);
export function ExplorerProvider({ children }: { children: ReactNode }) {
  const [comparison, setComparison] = useState<Observation[]>([]);
  const [comparisonIsSimulated, setComparisonIsSimulated] = useState(false);
  function updateComparison(observations: Observation[], isSimulated = false) {
    setComparison(observations);
    setComparisonIsSimulated(isSimulated);
  }
  return (
    <ExplorerContext.Provider
      value={{ comparison, comparisonIsSimulated, setComparison: updateComparison }}
    >
      {children}
    </ExplorerContext.Provider>
  );
}
export function useExplorer() {
  const context = useContext(ExplorerContext);
  if (!context) throw new Error("ExplorerProvider required");
  return context;
}
