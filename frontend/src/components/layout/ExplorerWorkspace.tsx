import { useNavigate } from "react-router-dom";
import { Crosshair } from "lucide-react";
import {
  defaultCoordinates,
  filterMockObservations,
} from "@/data/mockObservations";
import { validateCoordinatesStrict } from "@/lib/coordinates";
import { keepOrReplaceSelection, retainKnownIds } from "@/lib/selection";
import { fetchObservations } from "@/services/observationsApi";
import type { Coordinates, SearchFilters } from "@/types/search";
import { Sidebar } from "./Sidebar";
import { ResponsivePanel } from "./ResponsivePanel";
import { useExplorer } from "./ExplorerContext";
import { CoordinateSearch, SearchSubmitButton } from "@/components/search/CoordinateSearch";
import { FilterPanel } from "@/components/search/FilterPanel";
import { SkyMap2D } from "@/components/sky/SkyMap2D";
import { ResultsPanel } from "@/components/observations/ResultsPanel";
import { MetadataPanel } from "@/components/observations/MetadataPanel";

const SEARCH_FORM_ID = "coordinate-search-form";

export function ExplorerWorkspace() {
  const isMockMode = import.meta.env?.VITE_USE_MOCKS === "true";
  const navigate = useNavigate();
  const { workspace, setComparison, selectedId, setSelectedId, compareIds, setCompareIds, toggleCompareId } =
    useExplorer();
  const { coordinates, setCoordinates, submitted, setSubmitted, filters, setFilters,
    observations, setObservations, isSimulated, setIsSimulated, discarded, setDiscarded,
    errorMessage, setErrorMessage, status, setStatus, errors, setErrors, hasSearched, setHasSearched } = workspace;

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

    setStatus("loading");
    setErrorMessage(undefined);
    setHasSearched(true);

    // Si está explícitamente activado VITE_USE_MOCKS=true, usar fixtures locales
    if (isMockMode) {
      commitMock(coordinates, filters);
      setSubmitted({ ...coordinates });
      setStatus("ready");
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
        error instanceof Error ? error.message : "Unexpected error while connecting to the backend",
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
    <main className="explore-stage">
      <div className="workspace-heading">
        <div>
          <h1>Explore the sky</h1>
          <p>A new view of the universe, one observation at a time.</p>
        </div>
        <div className="eyebrow flex items-center gap-2">
          <Crosshair size={14} className="text-primary" />
          Coordinate exploration
        </div>
      </div>
      <div className="workspace-layout">
        <ResponsivePanel title="Search and filters" kind="search">
          <Sidebar footer={<SearchSubmitButton formId={SEARCH_FORM_ID} loading={status === "loading"} />}>
            <CoordinateSearch
              formId={SEARCH_FORM_ID}
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

        <ResponsivePanel title="Observations and metadata" kind="results">
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
              hasSearched={hasSearched}
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
