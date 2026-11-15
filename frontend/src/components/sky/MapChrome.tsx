import {
  ALADIN_SURVEYS,
  DEFAULT_ALADIN_SURVEY,
  formatCoordinatesDisplay,
} from "@/lib/aladinView";
import { collectionColor, type ObservationMarkerItem } from "@/lib/markerUtils";
import { Button } from "@/components/ui/button";

export function MarkerGroupPicker({
  marker,
  selectedId,
  compareIds,
  onSelect,
  onToggleCompare,
  onClose,
}: {
  marker: ObservationMarkerItem;
  selectedId?: string;
  compareIds: readonly string[];
  onSelect: (id: string) => void;
  onToggleCompare?: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute top-16 left-3 z-30 w-64 max-w-[calc(100%-1.5rem)] rounded-lg border border-primary/40 bg-card/95 p-3 text-[11px] shadow-xl"
      role="dialog"
      aria-label={`${marker.count} observaciones en la misma posición`}
    >
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-border pb-1.5">
        <p className="font-medium text-foreground">{marker.count} observaciones en esta posición</p>
        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={onClose}>
          Cerrar
        </Button>
      </div>
      <p className="mb-2 font-mono text-[10px] text-muted-foreground">
        RA {marker.ra}° · Dec {marker.dec}°
      </p>
      <ul className="max-h-40 space-y-1 overflow-y-auto">
        {marker.observations.map((observation) => {
          const selected = observation.id === selectedId;
          const compared = compareIds.includes(observation.id);
          return (
            <li key={observation.id} className="flex items-center gap-1">
              <button
                type="button"
                className={`flex-1 rounded px-1.5 py-1 text-left font-mono text-[10px] ${
                  selected ? "border border-primary/50 bg-primary/15" : "bg-secondary/40"
                }`}
                onClick={() => {
                  onSelect(observation.id);
                  onClose();
                }}
              >
                {observation.id}
                <span className="ml-1 text-muted-foreground">
                  {observation.band} · {observation.collection}
                </span>
              </button>
              {onToggleCompare && (
                <button
                  type="button"
                  className={`rounded border px-1.5 py-1 text-[9px] ${
                    compared ? "border-violet bg-violet/20 text-foreground" : "border-border text-muted-foreground"
                  }`}
                  aria-pressed={compared}
                  onClick={() => onToggleCompare(observation.id)}
                >
                  {compared ? "En comparación" : "Comparar"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function MapNotices({
  status = "ready",
  hasSearched = false,
  count,
  discardedCount = 0,
  skippedCount = 0,
  errorMessage,
  queryError,
  className = "",
}: {
  status?: "loading" | "ready" | "error";
  hasSearched?: boolean;
  count: number;
  discardedCount?: number;
  skippedCount?: number;
  errorMessage?: string;
  queryError?: string;
  className?: string;
}) {
  const empty = hasSearched && status === "ready" && count === 0;
  if (!queryError && status === "ready" && !empty && discardedCount === 0 && skippedCount === 0) {
    return null;
  }

  return (
    <div className={`map-notices ${className}`.trim()} aria-live="polite">
      {queryError && <p>{queryError}</p>}
      {status === "loading" && <p>Buscando observaciones…</p>}
      {status === "error" && (
        <p>Error al cargar resultados: {errorMessage || "no se pudo consultar la API."}</p>
      )}
      {empty && <p>Sin observaciones en esta región.</p>}
      {discardedCount > 0 && (
        <p>
          {discardedCount} {discardedCount === 1 ? "observación descartada" : "observaciones descartadas"} por
          el adaptador (datos incompletos). No se dibujan.
        </p>
      )}
      {skippedCount > 0 && (
        <p>
          {skippedCount} {skippedCount === 1 ? "observación" : "observaciones"} sin RA/Dec finita: no se
          dibujan.
        </p>
      )}
    </div>
  );
}

export function MapLegend({
  markers,
  radiusDeg,
}: {
  markers: readonly ObservationMarkerItem[];
  radiusDeg?: number;
}) {
  const collections = [...new Set(markers.map((marker) => marker.primaryObservation.collection))];
  return (
    <div className="map-legend z-10 max-w-[75%] flex-wrap">
      {collections.map((collection) => (
        <span key={collection}>
          <i className="legend-dot" style={{ background: collectionColor(collection) }} />
          {collection}
        </span>
      ))}
      <span>
        <i className="legend-dot" style={{ background: "#facc15" }} />
        Seleccionada
      </span>
      <span>
        <i className="legend-dot" style={{ background: "#a855f7" }} />
        En comparación
      </span>
      {radiusDeg !== undefined && <span>Radio de búsqueda ({radiusDeg}°)</span>}
    </div>
  );
}

const DEFAULT_SURVEY = ALADIN_SURVEYS[DEFAULT_ALADIN_SURVEY];

export function MapReadout({
  center,
  cursor,
  isSimulated,
  background,
}: {
  center: { ra: number; dec: number } | null;
  cursor: { ra: number; dec: number } | null;
  isSimulated?: boolean;
  background: string;
}) {
  const centerText = center ? formatCoordinatesDisplay(center.ra, center.dec) : null;
  const cursorText = cursor ? formatCoordinatesDisplay(cursor.ra, cursor.dec) : null;
  return (
    <div className="map-status z-10 flex-wrap gap-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono">
        <span>{centerText ? `Centro: ${centerText.decimal}` : "Centro: —"}</span>
        {centerText && <span className="hidden md:inline">{centerText.sexagesimal}</span>}
        {cursorText && <span className="hidden sm:inline">Cursor: {cursorText.decimal}</span>}
        {isSimulated && <span className="sim-badge">DATOS SIMULADOS</span>}
      </div>
      <p className="max-w-full text-[9px] text-muted-foreground">{background}</p>
    </div>
  );
}

export function surveyBackgroundLabel(): string {
  const survey = DEFAULT_SURVEY;
  return `Fondo: ${survey?.name ?? "DSS2 Color"} (${DEFAULT_ALADIN_SURVEY}). Contexto visual; no son datos de SPHEREx.`;
}
