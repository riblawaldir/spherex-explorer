import { ListFilter, ArrowRight, RefreshCw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimulatedBadge } from "@/components/layout/Header";
import { canCompare } from "@/data/mockObservations";
import { ObservationCard } from "./ObservationCard";
import type { Observation } from "@/types/observation";
export function ResultsPanel({
  observations,
  selectedId,
  compareIds,
  status,
  onSelect,
  onCheck,
  onCompare,
  onRetry,
}: {
  observations: Observation[];
  selectedId?: string | undefined;
  compareIds: string[];
  status: "loading" | "ready" | "error";
  onSelect: (id: string) => void;
  onCheck: (id: string) => void;
  onCompare: () => void;
  onRetry: () => void;
}) {
  return (
    <section className="glass-panel results-panel">
      <div className="results-head">
        <h2 className="panel-heading">
          <ListFilter />
          Observaciones{" "}
          <span className="data-chip">{observations.length.toString().padStart(2, "0")}</span>
        </h2>
        <SimulatedBadge />
      </div>
      <p className="px-[18px] text-[10px] text-muted-foreground">
        Selecciona observaciones para comparar.
      </p>
      <div className="results-list">
        {status === "loading" ? (
          <div aria-label="Cargando observaciones">
            {[1, 2, 3].map((i) => (
              <div key={i} className="shimmer" />
            ))}
          </div>
        ) : status === "error" ? (
          <div className="empty-state">
            <p>No se pudo completar la búsqueda simulada.</p>
            <Button variant="ghost" onClick={onRetry}>
              <RefreshCw />
              Reintentar
            </Button>
          </div>
        ) : observations.length ? (
          observations.map((o) => (
            <ObservationCard
              key={o.id}
              observation={o}
              active={o.id === selectedId}
              checked={compareIds.includes(o.id)}
              onSelect={onSelect}
              onCheck={onCheck}
            />
          ))
        ) : (
          <div className="empty-state">
            <SearchX className="mx-auto mb-3" />
            <p>Sin observaciones en esta región.</p>
            <p className="mt-2">Amplía el radio o limpia los filtros.</p>
          </div>
        )}
      </div>
      <div className="border-t border-border p-3">
        <div className="text-muted-foreground text-[10px] mb-3 flex justify-between">
          <span>{compareIds.length} seleccionadas</span>
          <span>Mínimo 2 observaciones</span>
        </div>
        <Button
          variant="outline"
          className="w-full text-[10px] h-9 bg-transparent"
          disabled={!canCompare(compareIds) || status === "loading"}
          onClick={onCompare}
        >
          Comparar en visor temporal
          <ArrowRight />
        </Button>
      </div>
    </section>
  );
}
