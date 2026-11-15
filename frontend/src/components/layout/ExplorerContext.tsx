import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { Observation } from "@/types/observation";
import { toggleCompareId as toggleId } from "@/lib/selection";

export interface ExplorerContextValue {
  comparison: Observation[];
  comparisonIsSimulated: boolean;
  setComparison: (observations: Observation[], isSimulated?: boolean) => void;
  selectedId?: string;
  setSelectedId: Dispatch<SetStateAction<string | undefined>>;
  compareIds: string[];
  setCompareIds: Dispatch<SetStateAction<string[]>>;
  toggleCompareId: (id: string) => void;
}

const ExplorerContext = createContext<ExplorerContextValue | undefined>(undefined);

export function ExplorerProvider({ children }: { children: ReactNode }) {
  const [comparison, setComparisonState] = useState<Observation[]>([]);
  const [comparisonIsSimulated, setComparisonIsSimulated] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const setComparison = useCallback((observations: Observation[], isSimulated = false) => {
    setComparisonState(observations);
    setComparisonIsSimulated(isSimulated);
  }, []);

  const toggleCompareId = useCallback((id: string) => {
    setCompareIds((previous) => toggleId(previous, id));
  }, []);

  const value = useMemo(
    () => ({
      comparison,
      comparisonIsSimulated,
      setComparison,
      selectedId,
      setSelectedId,
      compareIds,
      setCompareIds,
      toggleCompareId,
    }),
    [comparison, comparisonIsSimulated, setComparison, selectedId, compareIds, toggleCompareId],
  );

  return <ExplorerContext.Provider value={value}>{children}</ExplorerContext.Provider>;
}

export function useExplorer() {
  const context = useContext(ExplorerContext);
  if (!context) throw new Error("ExplorerProvider required");
  return context;
}
