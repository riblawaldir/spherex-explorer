import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Loader2,
  LocateFixed,
  Minus,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Observation } from "@/types/observation";
import type { Coordinates } from "@/types/search";
import {
  AladinMountCancelled,
  bindAladinSize,
  mountAladinMap,
  type AladinController,
} from "@/lib/aladinClient";
import {
  computeAladinViewParams,
  DEFAULT_ALADIN_SURVEY,
  nextFov,
  panCenter,
  parseSubmittedQuery,
  surveyBackgroundLabel,
  surveyTileSeen,
  SURVEY_TILE_WAIT_MS,
  type PanDirection,
  type SurveyBackgroundState,
} from "@/lib/aladinView";
import { transformObservationsToMarkers, type ObservationMarkerItem } from "@/lib/markerUtils";
import { interpretMarkerClick } from "@/lib/selection";
import { MapLegend, MapNotices, MapReadout, MarkerGroupPicker } from "./MapChrome";

export default function AladinLiteMap({
  observations,
  selectedId,
  compareIds = [],
  onSelect,
  onToggleCompare,
  coordinates,
  onError,
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
  onError?: (error: Error) => void;
  status?: "loading" | "ready" | "error";
  discardedCount?: number;
  isSimulated?: boolean;
  errorMessage?: string;
  hasSearched?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<AladinController | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const observationsRef = useRef(observations);
  observationsRef.current = status === "loading" ? [] : observations;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const compareRef = useRef(compareIds);
  compareRef.current = compareIds;

  const query = parseSubmittedQuery(coordinates);
  const queryRef = useRef(query);
  queryRef.current = query;
  const searchKey = query ? `${query.ra}|${query.dec}|${query.radiusDeg}` : "";
  const previousSearch = useRef<string | null>(null);
  const searchChanged = previousSearch.current !== searchKey;
  previousSearch.current = searchKey;
  const searchChangedRef = useRef(searchChanged);
  searchChangedRef.current = searchChanged;

  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [fitsLayerStatus, setFitsLayerStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [backgroundState, setBackgroundState] = useState<SurveyBackgroundState>("loading");
  const [center, setCenter] = useState<{ ra: number; dec: number } | null>(
    query ? { ra: query.ra, dec: query.dec } : null,
  );
  const [cursor, setCursor] = useState<{ ra: number; dec: number } | null>(null);
  const [activeGroup, setActiveGroup] = useState<ObservationMarkerItem | null>(null);

  function publishMarkers(controller: AladinController) {
    const { markers } = transformObservationsToMarkers(
      observationsRef.current,
      selectedRef.current,
      compareRef.current,
    );
    controller.setMarkers(markers, (marker) => {
      const action = interpretMarkerClick(marker);
      if (action.type === "select") {
        setActiveGroup(null);
        onSelectRef.current(action.id);
        return;
      }
      setActiveGroup(marker);
    });
  }

  function publishQuery(controller: AladinController, current: NonNullable<typeof query>) {
    const view = computeAladinViewParams(current.ra, current.dec, current.radiusDeg);
    controller.goto(view.ra, view.dec);
    controller.setFov(view.fov);
    controller.setSearchCircle(current.ra, current.dec, current.radiusDeg);
    setCenter({ ra: view.ra, dec: view.dec });
  }

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;
    let cancelled = false;
    let stopSize = () => {};

    async function start(mountPoint: HTMLElement) {
      const current = queryRef.current;
      if (!current) {
        setLoading(false);
        onErrorRef.current?.(new Error("The query does not have a valid RA, Dec, and radius."));
        return;
      }
      try {
        setLoading(true);
        const controller = await mountAladinMap(
          mountPoint,
          {
            ra: current.ra,
            dec: current.dec,
            radiusDeg: current.radiusDeg,
            surveyId: DEFAULT_ALADIN_SURVEY,
          },
          () => cancelled,
        );
        if (cancelled) {
          controller.destroy();
          return;
        }
        controllerRef.current = controller;
        try {
          stopSize = bindAladinSize(mountPoint);
        } catch {
          stopSize = () => {};
        }
        controller.subscribe((event) => {
          if (cancelled) return;
          if (event.type === "center") setCenter({ ra: event.ra, dec: event.dec });
          if (event.type === "cursor") setCursor({ ra: event.ra, dec: event.dec });
        });
        const latest = queryRef.current ?? current;
        publishQuery(controller, latest);
        publishMarkers(controller);
        setReady(true);
        setLoading(false);
      } catch (error) {
        controllerRef.current?.destroy();
        controllerRef.current = null;
        if (cancelled || error instanceof AladinMountCancelled) return;
        setLoading(false);
        onErrorRef.current?.(error instanceof Error ? error : new Error(String(error)));
      }
    }

    void start(host);
    return () => {
      cancelled = true;
      try {
        stopSize();
      } catch {
        // El observador de tamaño ya no está activo.
      }
      try {
        controllerRef.current?.destroy();
      } catch {
        // No impedir el cambio de vista si Aladin falla al cerrarse.
      }
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    let stopped = false;
    let observer: PerformanceObserver | null = null;
    let timer = 0;
    const urls = () => performance.getEntriesByType("resource").map((entry) => entry.name);
    const finish = (state: SurveyBackgroundState) => {
      if (stopped) return;
      setBackgroundState(state);
      if (state === "ready") {
        stopped = true;
        observer?.disconnect();
        window.clearTimeout(timer);
      }
    };
    const mark = () => {
      const seen = urls();
      if (surveyTileSeen(seen, DEFAULT_ALADIN_SURVEY)) {
        finish("ready");
        return;
      }
    };
    try {
      observer = new PerformanceObserver(mark);
      observer.observe({ type: "resource", buffered: true });
    } catch {
      observer = null;
    }
    mark();
    timer = window.setTimeout(() => {
      finish(surveyTileSeen(urls(), DEFAULT_ALADIN_SURVEY) ? "ready" : "unavailable");
    }, SURVEY_TILE_WAIT_MS);
    return () => {
      stopped = true;
      observer?.disconnect();
      window.clearTimeout(timer);
    };
  }, [ready]);

  useEffect(() => {
    const controller = controllerRef.current;
    const current = queryRef.current;
    if (!controller || !current) return;
    publishQuery(controller, current);
  }, [searchKey, ready]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || searchChangedRef.current) return;
    const selected = observationsRef.current.find((observation) => observation.id === selectedId);
    if (!selected || !Number.isFinite(selected.ra) || !Number.isFinite(selected.dec)) return;
    controller.goto(selected.ra, selected.dec);
    setCenter({ ra: selected.ra, dec: selected.dec });
  }, [selectedId]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    publishMarkers(controller);
  }, [observations, selectedId, compareIds, ready, status]);

  useEffect(() => {
    const controller = controllerRef.current;
    const selected = observations.find((observation) => observation.id === selectedId);
    if (!ready || !controller || !selected?.preview_url || isSimulated) {
      controller?.clearFitsOverlay?.();
      setFitsLayerStatus("idle");
      return;
    }
    const abort = new AbortController();
    let active = true;
    let objectUrl: string | undefined;
    setFitsLayerStatus("loading");
    void fetch(`/api/overlay/${encodeURIComponent(selected.id)}`, { signal: abort.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Capa FITS no disponible");
        return response.blob();
      })
      .then((blob) => {
        if (!active) return;
        if (!controller.showFitsOverlay) throw new Error("Visor FITS no disponible");
        objectUrl = URL.createObjectURL(blob);
        controller.showFitsOverlay(objectUrl, () => {
          if (active) setFitsLayerStatus("ready");
        }, () => {
          if (active) setFitsLayerStatus("error");
        });
      })
      .catch(() => { if (active) setFitsLayerStatus("error"); });
    return () => {
      active = false;
      abort.abort();
      controller.clearFitsOverlay?.();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ready, selectedId, observations, isSimulated]);

  const built = transformObservationsToMarkers(
    status === "loading" ? [] : observations,
    selectedId,
    compareIds,
  );

  function zoom(direction: "in" | "out") {
    const controller = controllerRef.current;
    if (!controller) return;
    controller.setFov(nextFov(controller.getFov().width, direction));
  }

  function move(direction: PanDirection) {
    const controller = controllerRef.current;
    if (!controller) return;
    const current = controller.getCenter();
    const fov = controller.getFov();
    const next = panCenter(current.ra, current.dec, fov.width, fov.height, direction);
    controller.goto(next.ra, next.dec);
    setCenter(next);
  }

  function resetView() {
    const controller = controllerRef.current;
    const current = queryRef.current;
    if (!controller || !current) return;
    publishQuery(controller, current);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, select, textarea")) return;
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoom("in");
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      zoom("out");
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
      resetView();
    } else if (event.key === "Escape") {
      setActiveGroup(null);
    }
  }

  return (
    <div
      className="sky-map-root"
      tabIndex={0}
      role="region"
      aria-label="Aladin Lite sky map. Arrow keys to pan, plus and minus to zoom, Home to reset to the search."
      onKeyDown={onKeyDown}
    >
      <div ref={containerRef} className="aladin-host" />
      {fitsLayerStatus !== "idle" && (
        <div className="absolute left-4 top-16 z-10 rounded bg-black/80 px-3 py-2 text-xs text-white" role="status">
          {fitsLayerStatus === "loading" ? "Loading FITS cutout…" : fitsLayerStatus === "ready" ? "FITS cutout placed by WCS" : "The FITS cutout could not be shown on the map."}
        </div>
      )}
      {loading && (
        <div className="map-loading" role="status">
          <Loader2 className="animate-spin text-primary" size={28} />
          <p>Loading Aladin Lite map…</p>
        </div>
      )}
      {backgroundState === "loading" && (
        <div className="survey-status" role="status">
          <p>Loading background…</p>
        </div>
      )}
      {backgroundState === "unavailable" && (
        <div className="survey-status survey-status-fallback" role="status">
          <p>Sky background unavailable; markers remain active.</p>
        </div>
      )}
      <MapNotices
        status={status}
        hasSearched={hasSearched}
        count={observations.length}
        discardedCount={discardedCount}
        skippedCount={built.skipped.length}
        errorMessage={errorMessage}
        queryError={query ? undefined : "Invalid search coordinates. The map has not moved."}
      />
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
        <Button type="button" variant="ghost" size="icon" aria-label="Zoom in" onClick={() => zoom("in")}>
          <Plus />
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label="Zoom out" onClick={() => zoom("out")}>
          <Minus />
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label="Reset view" onClick={resetView}>
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
        background={surveyBackgroundLabel(backgroundState)}
      />
    </div>
  );
}
