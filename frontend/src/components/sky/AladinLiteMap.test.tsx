// @vitest-environment jsdom
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { controllers, mountAladinMap } = vi.hoisted(() => {
  const created: Array<{ destroy: ReturnType<typeof vi.fn> }> = [];
  const mount = vi.fn(async () => {
    const controller = {
      goto: vi.fn(),
      setFov: vi.fn(),
      getCenter: vi.fn(() => ({ ra: 127.69444, dec: -39.1776 })),
      getFov: vi.fn(() => ({ width: 0.35, height: 0.2 })),
      setSurvey: vi.fn(),
      setSearchCircle: vi.fn(),
      setMarkers: vi.fn(),
      subscribe: vi.fn(),
      destroy: vi.fn(),
    };
    created.push(controller);
    return controller;
  });
  return { controllers: created, mountAladinMap: mount };
});

vi.mock("@/lib/aladinClient", () => ({
  AladinMountCancelled: class AladinMountCancelled extends Error {},
  mountAladinMap,
}));

import AladinLiteMap from "./AladinLiteMap";

describe("AladinLiteMap", () => {
  let container: HTMLDivElement;
  let root: Root;
  let open = false;

  beforeEach(() => {
    controllers.length = 0;
    mountAladinMap.mockClear();
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    open = true;
  });

  afterEach(async () => {
    if (open) await act(async () => root.unmount());
    container.remove();
    open = false;
  });

  it("rotula el fondo DSS2 y destruye cada visor una sola vez", async () => {
    await act(async () => {
      root.render(
        createElement(
          StrictMode,
          null,
          createElement(AladinLiteMap, {
            observations: [],
            onSelect: vi.fn(),
            coordinates: { ra: "127.69444", dec: "-39.17760", radius: "0.01" },
          }),
        ),
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Loading background…");
    expect(container.textContent).toContain("DSS2 Color");
    expect(container.textContent).toContain("Search radius");
    expect(container.textContent).not.toContain("SIMULATED DATA");
    expect(mountAladinMap).toHaveBeenCalled();

    await act(async () => root.unmount());
    open = false;
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(controllers.length).toBeGreaterThan(0);
    for (const controller of controllers) {
      expect(controller.destroy).toHaveBeenCalledTimes(1);
    }
  });
});
