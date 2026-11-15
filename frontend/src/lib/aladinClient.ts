/**
 * Adaptador fino sobre Aladin Lite v3.
 * El componente React y las pruebas hablan con AladinController, no con el paquete.
 */

import { computeAladinViewParams } from "./aladinView";
import type { ObservationMarkerItem } from "./markerUtils";
import type {
  AladinCatalog,
  AladinGraphicOverlay,
  AladinInstance,
  AladinNamespace,
  AladinSource,
} from "./aladinTypes";

export class AladinMountCancelled extends Error {
  constructor() {
    super("Inicialización de Aladin Lite cancelada.");
    this.name = "AladinMountCancelled";
  }
}

export interface AladinViewRequest {
  ra: number;
  dec: number;
  radiusDeg: number;
  surveyId: string;
}

export interface AladinController {
  goto(ra: number, dec: number): void;
  setFov(widthDeg: number): void;
  getCenter(): { ra: number; dec: number };
  getFov(): { width: number; height: number };
  setSurvey(surveyId: string): void;
  /**
   * Drop the HiPS base layer and block Aladin from re-loading DEFAULT DSS
   * (offline failure otherwise loops: ESA fail → P/DSS2/color → fail → …).
   */
  clearSurvey(): void;
  setSearchCircle(ra: number, dec: number, radiusDeg: number): void;
  setMarkers(
    markers: readonly ObservationMarkerItem[],
    onClick: (marker: ObservationMarkerItem) => void,
  ): void;
  subscribe(listener: (event: AladinViewEvent) => void): void;
  destroy(): void;
}

export type AladinViewEvent =
  | { type: "center"; ra: number; dec: number }
  | { type: "cursor"; ra: number; dec: number }
  | { type: "fov"; width: number; height: number };

const ALADIN_OPTIONS = {
  cooFrame: "ICRSd",
  showCooGrid: true,
  showCooGridControl: false,
  showSimbadPointerControl: false,
  showFullscreenControl: false,
  showZoomControl: false,
  showLayersControl: false,
  showGotoControl: false,
  showShareControl: false,
  showStatusBar: false,
  showFrame: false,
  showFov: false,
  showCooLocation: false,
  showProjectionControl: false,
  showContextMenu: false,
  showReticle: false,
  backgroundColor: "#070b16",
} as const;

function readPair(value: unknown): [number, number] | null {
  if (Array.isArray(value) && value.length >= 2) {
    const first = Number(value[0]);
    const second = Number(value[1]);
    if (Number.isFinite(first) && Number.isFinite(second)) return [first, second];
  }
  return null;
}

function readFov(value: unknown): { width: number; height: number } {
  const pair = readPair(value);
  if (pair) return { width: pair[0], height: pair[1] };
  if (typeof value === "number" && Number.isFinite(value)) return { width: value, height: value };
  throw new Error("Aladin Lite no devolvió un campo de visión numérico.");
}

function readRaDec(payload: unknown): { ra: number; dec: number } | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as { ra?: unknown; dec?: unknown };
  if (typeof record.ra !== "number" || typeof record.dec !== "number") return null;
  if (!Number.isFinite(record.ra) || !Number.isFinite(record.dec)) return null;
  return { ra: record.ra, dec: record.dec };
}

function sourceKey(source: unknown): string | undefined {
  if (!source || typeof source !== "object") return undefined;
  const data = (source as AladinSource).data;
  const key = data?.markerKey;
  return typeof key === "string" ? key : undefined;
}

/**
 * Aladin Lite re-loads P/DSS2/color when a HiPS layer fails and the view is empty.
 * Offline that becomes an unbounded retry storm. Patch survey setters to no-op and
 * remove the current base layer so markers stay on a quiet solid background.
 */
export function silenceHiPSRetries(instance: AladinInstance): void {
  const noop = () => undefined;
  instance.setImageSurvey = noop as AladinInstance["setImageSurvey"];
  if (typeof instance.setImageLayer === "function") {
    instance.setImageLayer = noop as NonNullable<AladinInstance["setImageLayer"]>;
  }
  if (typeof instance.setBaseImageLayer === "function") {
    instance.setBaseImageLayer = noop as NonNullable<AladinInstance["setBaseImageLayer"]>;
  }

  try {
    const base = instance.getBaseImageLayer?.();
    const layerId =
      (typeof base?.layer === "string" && base.layer) ||
      (typeof base?.id === "string" && base.id) ||
      undefined;
    if (layerId && typeof instance.removeImageLayer === "function") {
      instance.removeImageLayer(layerId);
    }
  } catch {
    // El fondo ya puede haberse descartado; los marcadores siguen usable.
  }
}

export function createAladinController(
  A: AladinNamespace,
  instance: AladinInstance,
): AladinController {
  let catalog: AladinCatalog | null = null;
  let overlay: AladinGraphicOverlay | null = null;
  let destroyed = false;
  let clickHandler: (marker: ObservationMarkerItem) => void = () => {};
  const markerByKey = new Map<string, ObservationMarkerItem>();
  const listeners = new Set<(event: AladinViewEvent) => void>();

  const emit = (event: AladinViewEvent) => {
    for (const listener of listeners) listener(event);
  };

  instance.on("positionChanged", (payload) => {
    const center = readRaDec(payload);
    if (center) emit({ type: "center", ra: center.ra, dec: center.dec });
  });
  instance.on("mouseMove", (payload) => {
    const cursor = readRaDec(payload);
    if (cursor) emit({ type: "cursor", ra: cursor.ra, dec: cursor.dec });
  });
  instance.on("zoomChanged", () => {
    try {
      const fov = readFov(instance.getFov());
      emit({ type: "fov", width: fov.width, height: fov.height });
      const center = readPair(instance.getRaDec());
      if (center) emit({ type: "center", ra: center[0], dec: center[1] });
    } catch {
      // El visor sigue usable aunque un evento de zoom no traiga números.
    }
  });

  return {
    goto(ra, dec) {
      instance.gotoRaDec(ra, dec);
    },
    setFov(widthDeg) {
      instance.setFoV(widthDeg);
    },
    getCenter() {
      const center = readPair(instance.getRaDec());
      if (!center) throw new Error("Aladin Lite no devolvió el centro RA/Dec.");
      return { ra: center[0], dec: center[1] };
    },
    getFov() {
      return readFov(instance.getFov());
    },
    setSurvey(surveyId) {
      instance.setImageSurvey(surveyId);
    },
    clearSurvey() {
      silenceHiPSRetries(instance);
    },
    setSearchCircle(ra, dec, radiusDeg) {
      if (!overlay) {
        overlay = A.graphicOverlay({ name: "Radio de búsqueda", color: "#22d3ee" });
        instance.addOverlay(overlay);
      }
      overlay.removeAll();
      if (!(radiusDeg > 0)) return;
      const circle = A.circle(ra, dec, radiusDeg, {
        color: "#22d3ee",
        fill: true,
        fillColor: "rgba(34, 211, 238, 0.12)",
        lineWidth: 2,
      });
      overlay.addFootprints([circle]);
    },
    setMarkers(markers, onClick) {
      clickHandler = onClick;
      markerByKey.clear();
      for (const marker of markers) markerByKey.set(marker.key, marker);

      if (!catalog) {
        catalog = A.catalog({
          name: "Observaciones",
          readOnly: true,
          shape: (source: unknown) => {
            const key = sourceKey(source);
            return (key && markerByKey.get(key)?.shape) || "circle";
          },
          sourceSize: (source: unknown) => {
            const key = sourceKey(source);
            return (key && markerByKey.get(key)?.size) || 12;
          },
          color: (source: unknown) => {
            const key = sourceKey(source);
            return (key && markerByKey.get(key)?.color) || "#38bdf8";
          },
          displayLabel: true,
          labelColumn: "label",
          labelColor: "#e2e8f0",
          labelFont: "11px sans-serif",
          onClick: (source: unknown) => {
            const key = sourceKey(source);
            const marker = key ? markerByKey.get(key) : undefined;
            if (marker) clickHandler(marker);
          },
        });
        instance.addCatalog(catalog);
      }

      catalog.removeAll();
      catalog.addSources(
        markers.map((marker) =>
          A.source(marker.ra, marker.dec, {
            markerKey: marker.key,
            label: marker.isGrouped ? String(marker.count) : "",
            color: marker.color,
            count: marker.count,
          }),
        ),
      );
    },
    subscribe(listener) {
      listeners.add(listener);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      listeners.clear();
      try {
        instance.off("positionChanged");
        instance.off("mouseMove");
        instance.off("zoomChanged");
        if (catalog) instance.removeOverlay(catalog);
        if (overlay) instance.removeOverlay(overlay);
      } catch {
        // Aladin puede fallar al soltar WebGL durante el desmontaje.
      }
      catalog = null;
      overlay = null;
    },
  };
}

export async function mountAladinWithNamespace(
  A: AladinNamespace,
  container: HTMLElement,
  request: AladinViewRequest,
  isCancelled: () => boolean,
): Promise<AladinController> {
  await Promise.resolve(A.init);
  if (isCancelled() || !container.isConnected) throw new AladinMountCancelled();

  const view = computeAladinViewParams(request.ra, request.dec, request.radiusDeg);
  const parent = container.parentElement;
  container.style.position = "absolute";
  container.style.inset = "0";
  container.style.width = "100%";
  container.style.height = parent && parent.clientHeight > 0 ? `${parent.clientHeight}px` : "100%";
  container.replaceChildren();
  const instance = A.aladin(container, {
    ...ALADIN_OPTIONS,
    survey: request.surveyId,
    fov: view.fov,
    target: `${view.ra} ${view.dec}`,
  });

  if (isCancelled()) {
    instance.off("positionChanged");
    instance.off("mouseMove");
    instance.off("zoomChanged");
    throw new AladinMountCancelled();
  }

  // gotoRaDec/setFoV reciben los números de la consulta, no el texto de target.
  instance.gotoRaDec(view.ra, view.dec);
  instance.setFoV(view.fov);
  // El trazo por defecto del bundle es rgb(150, 150, 220). setCooGrid es la API
  // oficial (Aladin.prototype.setCooGrid → view.setGridOptions).
  instance.setCooGrid({
    enabled: true,
    color: "#7eb8c9",
    opacity: 0.42,
    thickness: 1,
  });
  return createAladinController(A, instance);
}

/** Mantiene el contenedor del tamaño del panel. Aladin mide el div en píxeles. */
export function bindAladinSize(container: HTMLElement): () => void {
  const parent = container.parentElement;
  if (!parent || typeof ResizeObserver === "undefined") return () => {};

  const apply = () => {
    if (parent.clientWidth > 0) container.style.width = `${parent.clientWidth}px`;
    if (parent.clientHeight > 0) container.style.height = `${parent.clientHeight}px`;
  };

  try {
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(parent);
    return () => observer.disconnect();
  } catch {
    return () => {};
  }
}

export async function loadAladinNamespace(): Promise<AladinNamespace> {
  const imported = (await import("aladin-lite")) as { default?: AladinNamespace };
  const namespace = imported.default;
  if (!namespace || typeof namespace.aladin !== "function" || !namespace.init) {
    throw new Error("Aladin Lite no expuso la API de inicialización.");
  }
  return namespace;
}

export async function mountAladinMap(
  container: HTMLElement,
  request: AladinViewRequest,
  isCancelled: () => boolean,
): Promise<AladinController> {
  let namespace: AladinNamespace;
  try {
    namespace = await loadAladinNamespace();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "error desconocido";
    throw new Error(`No se pudo cargar Aladin Lite (${reason}).`);
  }
  return mountAladinWithNamespace(namespace, container, request, isCancelled);
}
