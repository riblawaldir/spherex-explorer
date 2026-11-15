import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  LocateFixed,
  Minus,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Observation } from "@/types/observation";
import type { Coordinates } from "@/types/search";
import {
  computeAladinViewParams,
  nextFov,
  panCenter,
  parseSubmittedQuery,
  projectFallbackPosition,
  unprojectFallbackPosition,
  type PanDirection,
} from "@/lib/aladinView";
import { transformObservationsToMarkers, type ObservationMarkerItem } from "@/lib/markerUtils";
import { interpretMarkerClick } from "@/lib/selection";
import { MapLegend, MapNotices, MapReadout, MarkerGroupPicker } from "./MapChrome";
import sky from "@/assets/simulated-sky.jpg";

export function SkyMapFallback({
  observations,
  selectedId,
  compareIds = [],
  onSelect,
  onToggleCompare,
  coordinates,
  failureMessage,
  onRetry,
  status = "ready",
  discardedCount = 0,
  isSimulated = false,
  errorMessage,
  hasSearched = false,
}: {
  observations: Observation[];
  selectedId?: string;
  compareIds?: string[];
  onSelect: (id: string) => void;
  onToggleCompare?: (id: string) => void;
  coordinates: Coordinates;
  failureMessage: string;
  onRetry: () => void;
  status?: "loading" | "ready" | "error";
  discardedCount?: number;
  isSimulated?: boolean;
  errorMessage?: string;
  hasSearched?: boolean;
}) {
  const query = parseSubmittedQuery(coordinates);
  const initial = query ? computeAladinViewParams(query.ra, query.dec, query.radiusDeg) : null;
  const [center, setCenter] = useState(initial ? { ra: initial.ra, dec: initial.dec } : null);
  const [fov, setFov] = useState(initial?.fov ?? 1);
  const [cursor, setCursor] = useState<{ ra: number; dec: number } | null>(null);
  const [activeGroup, setActiveGroup] = useState<ObservationMarkerItem | null>(null);
  const searchKey = query ? `${query.ra}|${query.dec}|${query.radiusDeg}` : "";
  const previousSearch = useRef<string | null>(null);
  const searchChanged = previousSearch.current !== searchKey;
  previousSearch.current = searchKey;
  const searchChangedRef = useRef(searchChanged);
  searchChangedRef.current = searchChanged;
  const observationsRef = useRef(observations);
  observationsRef.current = observations;
  const queryRef = useRef(query);
  queryRef.current = query;

  useEffect(() => {
    const current = queryRef.current;
    if (!current) return;
    const view = computeAladinViewParams(current.ra, current.dec, current.radiusDeg);
    setCenter({ ra: view.ra, dec: view.dec });
    setFov(view.fov);
  }, [searchKey]);

  useEffect(() => {
    if (searchChangedRef.current) return;
    const selected = observationsRef.current.find((observation) => observation.id === selectedId);
    if (!selected || !Number.isFinite(selected.ra) || !Number.isFinite(selected.dec)) return;
    setCenter({ ra: selected.ra, dec: selected.dec });
  }, [selectedId]);

  const plotted = status === "loading" ? [] : observations;
  const built = transformObservationsToMarkers(plotted, selectedId, compareIds);
  const placed = center
    ? built.markers.flatMap((marker) => {
        const point = projectFallbackPosition(marker.ra, marker.dec, center.ra, center.dec, fov);
        return point.inside ? [{ marker, point }] : [];
      })
    : [];
  const outside = built.markers.length - placed.length;
  const ring =
    query && center
      ? projectFallbackPosition(query.ra, query.dec, center.ra, center.dec, fov)
      : null;

  function activate(marker: ObservationMarkerItem) {
    const action = interpretMarkerClick(marker);
    if (action.type === "select") {
      setActiveGroup(null);
      onSelect(action.id);
      return;
    }
    setActiveGroup(marker);
  }

  function move(direction: PanDirection) {
    if (!center) return;
    setCenter(panCenter(center.ra, center.dec, fov, fov, direction));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, select, textarea")) return;
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      setFov((current) => nextFov(current, "in"));
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      setFov((current) => nextFov(current, "out"));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move("up");
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      move("down");
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      move("left");
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      move("right");
    } else if (event.key === "Home") {
      event.preventDefault();
      if (!query) return;
      const view = computeAladinViewParams(query.ra, query.dec, query.radiusDeg);
      setCenter({ ra: view.ra, dec: view.dec });
      setFov(view.fov);
    } else if (event.key === "Escape") {
      setActiveGroup(null);
    }
  }

  function onMouseMove(event: MouseEvent<HTMLDivElement>) {
    if (!center) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const xPercent = ((event.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((event.clientY - rect.top) / rect.height) * 100;
    setCursor(unprojectFallbackPosition(xPercent, yPercent, center.ra, center.dec, fov));
  }

  return (
    <div
      className="sky-map-root"
      tabIndex={0}
      role="region"
      aria-label="Fallback sky map view. Arrow keys to pan, plus and minus to zoom, Home to reset."
      onKeyDown={onKeyDown}
      onMouseMove={onMouseMove}
    >
      <div className="sky-scene">
        <img
          src={sky}
          className="sky-image"
          alt="Static fallback image. Not a HiPS survey and not SPHEREx data."
          width={1920}
          height={1088}
        />
        <div className="sky-grid" />
        {ring && query && (
          <div
            className="search-radius-ring"
            style={{
              left: `${ring.xPercent}%`,
              top: `${ring.yPercent}%`,
              width: `${(2 * query.radiusDeg / fov) * 100}%`,
            }}
            aria-hidden="true"
          />
        )}
        {placed.map(({ marker, point }) => (
          <Button
            key={marker.key}
            variant="ghost"
            type="button"
            title={marker.label}
            aria-label={
              marker.isGrouped
                ? `${marker.count} observations at RA ${marker.ra}° Dec ${marker.dec}°`
                : `Seleccionar ${marker.label}`
            }
            aria-pressed={marker.hasSelected}
            className={`map-marker ${marker.hasSelected ? "selected" : ""} ${
              marker.hasCompared ? "compared" : ""
            }`}
            style={{
              left: `${point.xPercent}%`,
              top: `${point.yPercent}%`,
              color: marker.color,
              borderColor: marker.color,
            }}
            onClick={() => activate(marker)}
          >
            {marker.isGrouped && <span className="marker-count">{marker.count}</span>}
          </Button>
        ))}
      </div>

      <div className="map-banner">
        <p>
          Aladin Lite is unavailable ({failureMessage}). Fallback view: positions use the real RA/Dec in a
          local projection. Background: static image, not a survey and not SPHEREx data.
        </p>
        <Button type="button" variant="ghost" size="sm" className="h-8" onClick={onRetry}>
          Retry Aladin Lite
        </Button>
      </div>

      <MapNotices
        className="below-banner"
        status={status}
        hasSearched={hasSearched}
        count={observations.length}
        discardedCount={discardedCount}
        skippedCount={built.skipped.length}
        errorMessage={errorMessage}
        queryError={query ? undefined : "Invalid search coordinates. The map has not moved."}
      />
      {outside > 0 && (
        <p className="map-outside">
          {outside} {outside === 1 ? "observation is" : "observations are"} outside this view. They remain
          in the results panel.
        </p>
      )}
      {activeGroup && (
        <MarkerGroupPicker
          marker={activeGroup}
          selectedId={selectedId}
          compareIds={compareIds}
          onSelect={onSelect}
          onToggleCompare={onToggleCompare}
          onClose={() => setActiveGroup(null)}
        />
      )}
      <div className="map-controls">
        <Button type="button" variant="ghost" size="icon" aria-label="Zoom in" onClick={() => setFov((current) => nextFov(current, "in"))}>
          <Plus />
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label="Zoom out" onClick={() => setFov((current) => nextFov(current, "out"))}>
          <Minus />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Reset view"
          onClick={() => {
            if (!query) return;
            const view = computeAladinViewParams(query.ra, query.dec, query.radiusDeg);
            setCenter({ ra: view.ra, dec: view.dec });
            setFov(view.fov);
          }}
        >
          <LocateFixed />
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label="Pan up" onClick={() => move("up")}>
          <ChevronUp />
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label="Pan down" onClick={() => move("down")}>
          <ChevronDown />
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label="Pan left" onClick={() => move("left")}>
          <ChevronLeft />
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label="Pan right" onClick={() => move("right")}>
          <ChevronRight />
        </Button>
      </div>
      <MapLegend markers={built.markers} radiusDeg={query?.radiusDeg} />
      <MapReadout
        center={center}
        cursor={cursor}
        isSimulated={isSimulated}
        background="Background: static fallback image. Not a HiPS survey and not SPHEREx data."
      />
    </div>
  );
}
