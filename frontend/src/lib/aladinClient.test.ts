// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  AladinMountCancelled,
  createAladinController,
  mountAladinWithNamespace,
} from "./aladinClient";
import { computeAladinViewParams } from "./aladinView";
import type { ObservationMarkerItem } from "./markerUtils";
import type {
  AladinCatalog,
  AladinGraphicOverlay,
  AladinInstance,
  AladinNamespace,
} from "./aladinTypes";

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function fakeNamespace() {
  const calls = {
    aladin: [] as Record<string, unknown>[],
    circle: [] as Array<{ ra: number; dec: number; radius: number }>,
    source: [] as Array<{ ra: number; dec: number; data?: Record<string, unknown> }>,
  };
  const overlay: AladinGraphicOverlay = {
    addFootprints: vi.fn(),
    removeAll: vi.fn(),
  };
  const catalog: AladinCatalog = {
    addSources: vi.fn(),
    removeAll: vi.fn(),
  };
  const instance: AladinInstance = {
    gotoRaDec: vi.fn(),
    setFoV: vi.fn(),
    getFov: vi.fn(() => [0.35, 0.22] as [number, number]),
    getRaDec: vi.fn(() => [10, -5] as [number, number]),
    setImageSurvey: vi.fn(),
    setCooGrid: vi.fn(),
    addCatalog: vi.fn(),
    removeCatalog: vi.fn(),
    addOverlay: vi.fn(),
    removeOverlay: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };
  const ready = deferred<void>();
  const namespace: AladinNamespace = {
    init: ready.promise,
    aladin: (container, options) => {
      calls.aladin.push({ container, ...options });
      return instance;
    },
    catalog: () => catalog,
    source: (ra, dec, data) => {
      calls.source.push({ ra, dec, data });
      return { ra, dec, data };
    },
    graphicOverlay: () => overlay,
    circle: (ra, dec, radius) => {
      calls.circle.push({ ra, dec, radius });
      return { ra, dec, radius };
    },
  };
  return { namespace, instance, catalog, overlay, calls, ready };
}

function marker(ra: number, dec: number, id: string): ObservationMarkerItem {
  return {
    key: id,
    ra,
    dec,
    observations: [
      {
        id,
        observed_at: "2026-01-01T00:00:00Z",
        collection: "DR1",
        ra,
        dec,
        band: "B1",
        preview_url: null,
        source_url: null,
      },
    ],
    count: 1,
    isGrouped: false,
    state: "normal",
    hasSelected: false,
    hasCompared: false,
    primaryObservation: {
      id,
      observed_at: "2026-01-01T00:00:00Z",
      collection: "DR1",
      ra,
      dec,
      band: "B1",
      preview_url: null,
      source_url: null,
    },
    label: id,
    color: "#38bdf8",
    shape: "circle",
    size: 12,
  };
}

describe("cliente de Aladin Lite", () => {
  it("no crea el visor si el montaje se cancela durante la inicialización", async () => {
    const { namespace, calls, ready } = fakeNamespace();
    const container = document.createElement("div");
    document.body.appendChild(container);
    let cancelled = false;
    const pending = mountAladinWithNamespace(
      namespace,
      container,
      { ra: 10, dec: -5, radiusDeg: 0.1, surveyId: "P/DSS2/color" },
      () => cancelled,
    );
    cancelled = true;
    ready.resolve();
    await expect(pending).rejects.toBeInstanceOf(AladinMountCancelled);
    expect(calls.aladin).toHaveLength(0);
    container.remove();
  });

  it("centra con los números de la consulta y el survey por defecto", async () => {
    const { namespace, instance, calls, ready } = fakeNamespace();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const pending = mountAladinWithNamespace(
      namespace,
      container,
      { ra: 127.6944441, dec: -39.1776004, radiusDeg: 0.1, surveyId: "P/DSS2/color" },
      () => false,
    );
    ready.resolve();
    await pending;
    const view = computeAladinViewParams(127.6944441, -39.1776004, 0.1);
    expect(calls.aladin[0]?.survey).toBe("P/DSS2/color");
    expect(calls.aladin[0]?.cooFrame).toBe("ICRSd");
    expect(instance.gotoRaDec).toHaveBeenCalledWith(view.ra, view.dec);
    expect(instance.setFoV).toHaveBeenCalledWith(view.fov);
    expect(instance.setCooGrid).toHaveBeenCalledWith({
      enabled: true,
      color: "#7eb8c9",
      opacity: 0.42,
      thickness: 1,
    });
    container.remove();
  });

  it("dibuja el radio pedido y los marcadores en su RA/Dec, y se destruye", () => {
    const { namespace, instance, catalog, overlay, calls } = fakeNamespace();
    const controller = createAladinController(namespace, instance);
    controller.setSearchCircle(15.5, -2.25, 0.01);
    expect(calls.circle).toEqual([{ ra: 15.5, dec: -2.25, radius: 0.01 }]);
    expect(overlay.addFootprints).toHaveBeenCalled();

    const click = vi.fn();
    controller.setMarkers([marker(15.5, -2.25, "OBS-9")], click);
    expect(catalog.addSources).toHaveBeenCalled();
    const sources = (catalog.addSources as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Array<{
      ra: number;
      dec: number;
    }>;
    expect(sources[0]).toMatchObject({ ra: 15.5, dec: -2.25 });

    controller.destroy();
    expect(instance.off).toHaveBeenCalledWith("positionChanged");
    expect(instance.removeOverlay).toHaveBeenCalledTimes(2);
  });
});
