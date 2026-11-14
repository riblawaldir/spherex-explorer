import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crosshair } from "lucide-react";
import {
  defaultCoordinates,
  emptyFilters,
  filterMockObservations,
  mockObservations,
  validateCoordinates,
} from "@/data/mockObservations";
import type { Coordinates, SearchFilters } from "@/types/search";
import { Sidebar } from "./Sidebar";
import { ResponsivePanel } from './ResponsivePanel';
import { useExplorer } from "./ExplorerContext";
import { CoordinateSearch } from "@/components/search/CoordinateSearch";
import { FilterPanel } from "@/components/search/FilterPanel";
import { SkyMap2D } from "@/components/sky/SkyMap2D";
import { ResultsPanel } from "@/components/observations/ResultsPanel";
import { MetadataPanel } from "@/components/observations/MetadataPanel";
export function ExplorerWorkspace() {
  const [coordinates, setCoordinates] = useState<Coordinates>({ ...defaultCoordinates });
  const [submitted, setSubmitted] = useState<Coordinates>({ ...defaultCoordinates });
  const [filters, setFilters] = useState<SearchFilters>({ ...emptyFilters });
  const [observations, setObservations] = useState(mockObservations);
  const [status, setStatus] = useState<"ready" | "loading" | "error">("ready");
  const [errors, setErrors] = useState<Partial<Record<keyof Coordinates, string>>>({});
  const [selectedId, setSelectedId] = useState<string | undefined>(mockObservations[0]?.id);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const navigate = useNavigate();
  const { setComparison } = useExplorer();
  useEffect(() => () => clearTimeout(timer.current), []);
  function commit(c: Coordinates, f: SearchFilters) {
    const rows = filterMockObservations(c, f);
    setObservations(rows);
    setSelectedId((previous) => (rows.some((o) => o.id === previous) ? previous : rows[0]?.id));
    setCompareIds((previous) => previous.filter((id) => rows.some((o) => o.id === id)));
  }
  function search() {
    const nextErrors = validateCoordinates(coordinates);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    clearTimeout(timer.current);
    setStatus("loading");
    timer.current = setTimeout(() => {
      try {
        commit(coordinates, filters);
        setSubmitted({ ...coordinates });
        setStatus("ready");
      } catch (error) {
        console.error("No se pudo completar la búsqueda simulada.", error);
        setStatus("error");
      }
    }, 850);
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
        <ResponsivePanel title="Búsqueda y filtros" kind="search"><Sidebar>
          <CoordinateSearch
            coordinates={coordinates}
            onChange={setCoordinates}
            onSearch={search}
            loading={status === "loading"}
            errors={errors}
          />
          <div className="search-divider" />
          <FilterPanel
            filters={filters}
            onChange={(f) => {
              clearTimeout(timer.current);
              setFilters(f);
              commit(submitted, f);
              setStatus("ready");
            }}
          />
        </Sidebar></ResponsivePanel>
        <SkyMap2D
          observations={status === "loading" ? [] : observations}
          selectedId={selectedId}
          onSelect={setSelectedId}
          coordinates={submitted}
        />
        <ResponsivePanel title="Observaciones y metadatos" kind="results"><aside className="right-sidebar">
          <ResultsPanel
            observations={observations}
            selectedId={selectedId}
            compareIds={compareIds}
            status={status}
            onSelect={setSelectedId}
            onCheck={(id) =>
              setCompareIds((prev) =>
                prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
              )
            }
            onCompare={() => {
              setComparison(observations.filter((o) => compareIds.includes(o.id)));
              navigate("/comparacion");
            }}
            onRetry={search}
          />
          <MetadataPanel observation={observations.find((o) => o.id === selectedId)} />
        </aside></ResponsivePanel>
      </div>
    </main>
  );
}
