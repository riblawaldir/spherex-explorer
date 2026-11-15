import { ListFilter, ArrowRight, RefreshCw, SearchX, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimulatedBadge } from "@/components/layout/Header";
import { canCompare } from "@/data/mockObservations";
import { ObservationCard } from "./ObservationCard";
import type { Observation } from "@/types/observation";
import type { DiscardedEpoch } from "@/services/adapters/epochToObservation";

export function ResultsPanel({
  observations,
  selectedId,
  compareIds,
  status,
  discarded = [],
  errorMessage,
  onSelect,
  onCheck,
  onCompare,
  onRetry,
  isSimulated = false,
}: {
  observations: Observation[];
  selectedId?: string | undefined;
  compareIds: string[];
  status: "loading" | "ready" | "error";
  discarded?: DiscardedEpoch[];
  errorMessage?: string;
  onSelect: (id: string) => void;
  onCheck: (id: string) => void;
  onCompare: () => void;
  onRetry: () => void;
  isSimulated?: boolean;
}) {
  return (
    <section className="glass-panel results-panel" aria-label="Panel de observaciones">
      <div className="results-head">
        <h2 className="panel-heading">
          <ListFilter />
          Observaciones{" "}
          <span className="data-chip">{observations.length.toString().padStart(2, "0")}</span>
        </h2>
        {isSimulated && <SimulatedBadge />}
      </div>
      <p className="px-[18px] text-sm text-muted-foreground">
        Selecciona observaciones para comparar.
      </p>

      {/* Aviso discreto de observaciones descartadas por datos incompletos de la API */}
      {discarded && discarded.length > 0 && (
        <div className="mx-3 my-2 text-sm leading-5 rounded border border-warning/30 bg-warning/5 px-2.5 py-1.5 text-muted-foreground">
          <details className="group">
            <summary className="cursor-pointer select-none font-medium flex items-center justify-between text-warning/90 hover:text-warning">
              <span className="flex items-center gap-1.5">
                <AlertCircle size={12} className="text-warning flex-shrink-0" />
                {discarded.length} observación{discarded.length > 1 ? "es" : ""} descartada
                {discarded.length > 1 ? "s" : ""} por datos incompletos
              </span>
              <span className="text-xs text-muted-foreground group-open:rotate-180 transition-transform">
                ▼
              </span>
            </summary>
            <ul className="mt-2 space-y-1.5 pl-1 max-h-28 overflow-y-auto text-xs leading-5 border-t border-border/50 pt-1.5">
              {discarded.map((d, idx) => (
                <li key={idx} className="leading-tight">
                  <span className="scientific text-foreground font-medium">
                    {d.obs_id || "Sin obs_id"}
                  </span>
                  : <span className="text-muted-foreground">{d.reasons.join(" · ")}</span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}

      <div className="results-list">
        {status === "loading" ? (
          <div aria-label="Cargando observaciones">
            {[1, 2, 3].map((i) => (
              <div key={i} className="shimmer" />
            ))}
          </div>
        ) : status === "error" ? (
          <div className="empty-state">
            <p className="text-destructive font-medium mb-1">Error al consultar observaciones</p>
            <p className="text-muted-foreground text-sm mb-3">
              {errorMessage || "No se pudo conectar con el backend FastAPI (/api)."}
            </p>
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
        <div className="text-muted-foreground text-sm mb-3 flex justify-between">
          <span>{compareIds.length} seleccionadas</span>
          <span>Mínimo 2 observaciones</span>
        </div>
        <Button
          variant="outline"
          className="w-full h-10 bg-transparent"
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
