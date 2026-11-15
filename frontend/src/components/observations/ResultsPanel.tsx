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
  hasSearched = false,
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
  hasSearched?: boolean;
}) {
  return (
    <section className="glass-panel results-panel" aria-label="Observations panel">
      <div className="results-head">
        <h2 className="panel-heading">
          <ListFilter />
          Observations{" "}
          <span className="data-chip">{observations.length}</span>
        </h2>
        {isSimulated && <SimulatedBadge />}
      </div>
      <p className="px-[14px] text-xs text-muted-foreground">
        Select observations to compare.
      </p>

      {/* Aviso discreto de observaciones descartadas por datos incompletos de la API */}
      {discarded && discarded.length > 0 && (
        <div className="mx-3 my-2 text-xs rounded border border-warning/30 bg-warning/5 px-2.5 py-1.5 text-muted-foreground">
          <details className="group">
            <summary className="cursor-pointer select-none font-medium flex items-center justify-between text-warning/90 hover:text-warning">
              <span className="flex items-center gap-1.5">
                <AlertCircle size={12} className="text-warning flex-shrink-0" />
                {discarded.length} observation{discarded.length > 1 ? "s" : ""} discarded
                because of incomplete data
              </span>
              <span className="text-xs text-muted-foreground group-open:rotate-180 transition-transform">
                ▼
              </span>
            </summary>
            <ul className="mt-2 space-y-1.5 pl-1 max-h-28 overflow-y-auto text-xs leading-5 border-t border-border/50 pt-1.5">
              {discarded.map((d, idx) => (
                <li key={idx} className="leading-tight">
                  <span className="scientific text-foreground font-medium">
                    {d.obs_id || "No obs_id"}
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
          <div aria-label="Loading observations">
            {[1, 2, 3].map((i) => (
              <div key={i} className="shimmer" />
            ))}
          </div>
        ) : status === "error" ? (
          <div className="empty-state">
            <p className="text-destructive font-medium mb-1">Could not load observations</p>
            <p className="text-muted-foreground text-sm mb-3">
              {errorMessage || "Could not connect to the FastAPI backend (/api)."}
            </p>
            <Button variant="ghost" onClick={onRetry}>
              <RefreshCw />
              Retry
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
        ) : !hasSearched ? (
          <div className="empty-state">
            <p>No search yet.</p>
            <p className="mt-2">Enter coordinates and press Search.</p>
          </div>
        ) : (
          <div className="empty-state">
            <SearchX className="mx-auto mb-3" />
            <p>No observations in this region.</p>
            <p className="mt-2">Widen the radius or clear the filters.</p>
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="text-muted-foreground text-xs mb-2 flex justify-between gap-2">
          <span>{compareIds.length} selected</span>
          <span>Minimum 2 observations</span>
        </div>
        <Button
          variant="outline"
          className="w-full bg-transparent"
          disabled={!canCompare(compareIds) || status === "loading"}
          onClick={onCompare}
        >
          Compare in temporal viewer
          <ArrowRight />
        </Button>
      </div>
    </section>
  );
}
