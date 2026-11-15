import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crosshair } from "lucide-react";
import {
  defaultCoordinates,
  emptyFilters,
  filterMockObservations,
  mockObservations,
} from "@/data/mockObservations";
import { validateCoordinatesStrict } from "@/lib/coordinates";
import { keepOrReplaceSelection, retainKnownIds } from "@/lib/selection";
import { fetchObservations } from "@/services/observationsApi";
import type { DiscardedEpoch } from "@/services/adapters/epochToObservation";
import type { Coordinates, SearchFilters } from "@/types/search";
import { Sidebar } from "./Sidebar";
import { ResponsivePanel } from "./ResponsivePanel";
import { useExplorer } from "./ExplorerContext";
import { CoordinateSearch } from "@/components/search/CoordinateSearch";
import { FilterPanel } from "@/components/search/FilterPanel";
import { SkyMap2D } from "@/components/sky/SkyMap2D";
import { ResultsPanel } from "@/components/observations/ResultsPanel";
import { MetadataPanel } from "@/components/observations/MetadataPanel";

export function ExplorerWorkspace() {
  const isMockMode = import.meta.env?.VITE_USE_MOCKS === "true";
  const [coordinates, setCoordinates] = useState<Coordinates>({ ...defaultCoordinates });
  const [submitted, setSubmitted] = useState<Coordinates>({ ...defaultCoordinates });
  const [filters, setFilters] = useState<SearchFilters>({ ...emptyFilters });
  const [observations, setObservations] = useState(isMockMode ? mockObservations : []);
  const [isSimulated, setIsSimulated] = useState(isMockMode);
  const [discarded, setDiscarded] = useState<DiscardedEpoch[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [status, setStatus] = useState<"ready" | "loading" | "error">("ready");
  const [errors, setErrors] = useState<Partial<Record<keyof Coordinates, string>>>({});
  const [hasSearched, setHasSearched] = useState(isMockMode);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seededSelection = useRef(false);
  const navigate = useNavigate();
  const { setComparison, selectedId, setSelectedId, compareIds, setCompareIds, toggleCompareId } =
    useExplorer();

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (seededSelection.current || !isMockMode) return;
    seededSelection.current = true;
    const first = mockObservations[0];
    if (first) setSelectedId(first.id);
  }, [isMockMode, setSelectedId]);

  function commitMock(c: Coordinates, f: SearchFilters) {
    const rows = filterMockObservations(c, f);
    setObservations(rows);
    setIsSimulated(true);
    setDiscarded([]);
    setSelectedId((previous) => keepOrReplaceSelection(previous, rows));
    setCompareIds((previous) => retainKnownIds(previous, rows));
  }

  async function search() {
    const validation = validateCoordinatesStrict(coordinates);
    setErrors(validation.errors);
    if (!validation.isValid || !validation.parsed) return;

    clearTimeout(timer.current);
    setStatus("loading");
    setErrorMessage(undefined);
    setHasSearched(true);

    // Si está explícitamente activado VITE_USE_MOCKS=true, usar fixtures locales
    if (isMockMode) {
      timer.current = setTimeout(() => {
        commitMock(coordinates, filters);
        setSubmitted({ ...coordinates });
        setStatus("ready");
      }, 300);
      return;
    }

    try {
      const radiusArcsec = validation.parsed.radius * 3600;
      const apiResult = await fetchObservations({
        ra: validation.parsed.ra,
        dec: validation.parsed.dec,
        radiusArcsec,
        band: filters.bands.length === 1 ? filters.bands[0] : undefined,
      });

      if (apiResult.status === "error") {
        setErrorMessage(apiResult.error);
        setObservations([]);
        setIsSimulated(false);
        setDiscarded(apiResult.discarded);
        setStatus("error");
      } else {
        setObservations(apiResult.observations);
        setIsSimulated(apiResult.isSimulated);
        setDiscarded(apiResult.discarded);
        setSelectedId(apiResult.observations[0]?.id);
        setCompareIds([]);
        setSubmitted({ ...coordinates });
        setStatus("ready");
      }
    } catch (error) {
      console.warn("Fallo al consultar /api/epochs:", error);
      setIsSimulated(false);
      setErrorMessage(
        error instanceof Error ? error.message : "Error inesperado al conectar con el backend",
      );
      setObservations([]);
      setDiscarded([]);
      setStatus("error");
    }
  }

  function handleReset() {
    setCoordinates({ ...defaultCoordinates });
    setErrors({});
    setDiscarded([]);
    setErrorMessage(undefined);
    if (isMockMode) {
      commitMock(defaultCoordinates, filters);
    } else {
      setObservations([]);
      setIsSimulated(false);
      setSelectedId(undefined);
      setCompareIds([]);
      setStatus("ready");
      setHasSearched(false);
    }
    setSubmitted({ ...defaultCoordinates });
  }

  return (
    <main>
      <div className="workspace-heading">
        <div>
          <h1>Explorar el cielo</h1>
          <p>Una nueva perspectiva del universo, observación a observación.</p>
        </div>
        <div className="eyebrow flex items-center gap-2">
          <Crosshair size={14} className="text-primary" />
          EXPLORACIÓN POR COORDENADAS
        </div>
      </div>
      <div className="workspace-layout">
        <ResponsivePanel title="Búsqueda y filtros" kind="search">
          <Sidebar>
            <CoordinateSearch
              coordinates={coordinates}
              onChange={setCoordinates}
              onSearch={search}
              loading={status === "loading"}
              errors={errors}
              onReset={handleReset}
            />
            <div className="search-divider" />
            <FilterPanel
              filters={filters}
              onChange={(f) => {
                clearTimeout(timer.current);
                setFilters(f);
                if (isMockMode) {
                  commitMock(submitted, f);
                  setStatus("ready");
                }
              }}
            />
          </Sidebar>
        </ResponsivePanel>

        <SkyMap2D
          observations={observations}
          selectedId={selectedId}
          onSelect={setSelectedId}
          coordinates={submitted}
          compareIds={compareIds}
          onToggleCompare={toggleCompareId}
          status={status}
          discardedCount={discarded.length}
          isSimulated={isSimulated}
          errorMessage={errorMessage}
          hasSearched={hasSearched}
        />

        <ResponsivePanel title="Observaciones y metadatos" kind="results">
          <aside className="right-sidebar">
            <ResultsPanel
              observations={observations}
              selectedId={selectedId}
              compareIds={compareIds}
              status={status}
              discarded={discarded}
              errorMessage={errorMessage}
              onSelect={setSelectedId}
              onCheck={toggleCompareId}
              onCompare={() => {
                setComparison(
                  observations.filter((o) => compareIds.includes(o.id)),
                  isSimulated,
                );
                navigate("/comparacion");
              }}
              onRetry={search}
              isSimulated={isSimulated}
            />
            <MetadataPanel
              observation={observations.find((o) => o.id === selectedId)}
              isSimulated={isSimulated}
            />
          </aside>
        </ResponsivePanel>
      </div>
    </main>
  );
}
