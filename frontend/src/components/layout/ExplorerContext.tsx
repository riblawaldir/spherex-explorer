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
import { defaultCoordinates, emptyFilters, mockObservations } from "@/data/mockObservations";
import type { Coordinates, SearchFilters } from "@/types/search";
import type { DiscardedEpoch } from "@/services/adapters/epochToObservation";

function useWorkspaceState() {
  const isMockMode = import.meta.env?.VITE_USE_MOCKS === "true";
  const [coordinates, setCoordinates] = useState<Coordinates>({ ...defaultCoordinates });
  const [submitted, setSubmitted] = useState<Coordinates>({ ...defaultCoordinates });
  const [filters, setFilters] = useState<SearchFilters>({ ...emptyFilters });
  const [observations, setObservations] = useState<Observation[]>(isMockMode ? mockObservations : []);
  const [isSimulated, setIsSimulated] = useState(isMockMode);
  const [discarded, setDiscarded] = useState<DiscardedEpoch[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [status, setStatus] = useState<"ready" | "loading" | "error">("ready");
  const [errors, setErrors] = useState<Partial<Record<keyof Coordinates, string>>>({});
  const [hasSearched, setHasSearched] = useState(isMockMode);
  return { coordinates, setCoordinates, submitted, setSubmitted, filters, setFilters,
    observations, setObservations, isSimulated, setIsSimulated, discarded, setDiscarded,
    errorMessage, setErrorMessage, status, setStatus, errors, setErrors, hasSearched, setHasSearched };
}

export interface ExplorerContextValue {
  workspace: ReturnType<typeof useWorkspaceState>;
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
  const workspace = useWorkspaceState();
  const [comparison, setComparisonState] = useState<Observation[]>([]);
  const [comparisonIsSimulated, setComparisonIsSimulated] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>(
    import.meta.env?.VITE_USE_MOCKS === "true" ? mockObservations[0]?.id : undefined,
  );
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
      workspace,
      comparison,
      comparisonIsSimulated,
      setComparison,
      selectedId,
      setSelectedId,
      compareIds,
      setCompareIds,
      toggleCompareId,
    }),
    [workspace, comparison, comparisonIsSimulated, setComparison, selectedId, compareIds, toggleCompareId],
  );

  return <ExplorerContext.Provider value={value}>{children}</ExplorerContext.Provider>;
}

export function useExplorer() {
  const context = useContext(ExplorerContext);
  if (!context) throw new Error("ExplorerProvider required");
  return context;
}
