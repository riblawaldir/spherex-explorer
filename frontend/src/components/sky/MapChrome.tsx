import { formatCoordinatesDisplay } from "@/lib/aladinView";
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
      className="absolute top-16 left-3 z-30 w-72 max-w-[calc(100%-1.5rem)] rounded-lg border border-primary/40 bg-card/95 p-3 text-sm leading-5 shadow-xl"
      role="dialog"
      aria-label={`${marker.count} observations at the same position`}
    >
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-border pb-1.5">
        <p className="font-medium text-foreground">{marker.count} observations at this position</p>
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={onClose}>
          Close
        </Button>
      </div>
      <p className="scientific mb-2 text-xs text-muted-foreground">
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
                className={`scientific flex-1 rounded px-2 py-1.5 text-left text-xs ${
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
                  className={`rounded border px-2 py-1.5 text-xs ${
                    compared ? "border-violet bg-violet/20 text-foreground" : "border-border text-muted-foreground"
                  }`}
                  aria-pressed={compared}
                  onClick={() => onToggleCompare(observation.id)}
                >
                  {compared ? "In comparison" : "Compare"}
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
      {status === "loading" && <p>Searching observations…</p>}
      {status === "error" && (
        <p>Could not load results: {errorMessage || "the API could not be reached."}</p>
      )}
      {empty && <p>No observations in this region.</p>}
      {discardedCount > 0 && (
        <p>
          {discardedCount} {discardedCount === 1 ? "observation" : "observations"} discarded by the
          adapter (incomplete data). Not drawn.
        </p>
      )}
      {skippedCount > 0 && (
        <p>
          {skippedCount} {skippedCount === 1 ? "observation" : "observations"} without a finite RA/Dec:
          not drawn.
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
        Selected
      </span>
      <span>
        <i className="legend-dot" style={{ background: "#a855f7" }} />
        In comparison
      </span>
      {radiusDeg !== undefined && (
        <span>
          Search radius (<span className="scientific">{radiusDeg}°</span>)
        </span>
      )}
    </div>
  );
}

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
      <div className="scientific flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>{centerText ? `Center: ${centerText.decimal}` : "Center: —"}</span>
        {centerText && <span className="hidden md:inline">{centerText.sexagesimal}</span>}
        {cursorText && <span className="hidden sm:inline">Cursor: {cursorText.decimal}</span>}
        {isSimulated && <span className="sim-badge">SIMULATED DATA</span>}
      </div>
      <p className="max-w-full text-xs leading-5 text-muted-foreground">{background}</p>
    </div>
  );
}
