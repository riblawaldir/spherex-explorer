// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/aladinClient", () => ({
  AladinMountCancelled: class AladinMountCancelled extends Error {},
  mountAladinMap: vi.fn(async () => {
    throw new Error("sin WebGL2");
  }),
}));

import { SkyMap2D } from "./SkyMap2D";
import type { Observation } from "@/types/observation";

const observation: Observation = {
  id: "OBS-001",
  observed_at: "2026-08-15T00:00:00Z",
  collection: "DR1",
  ra: 127.69444,
  dec: -39.1776,
  band: "B1",
  preview_url: null,
  source_url: null,
};

describe("respaldo del mapa 2D", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("usa las coordenadas reales y no afirma datos simulados si Aladin no carga", async () => {
    await act(async () => {
      root.render(
        createElement(SkyMap2D, {
          observations: [observation],
          onSelect: vi.fn(),
          coordinates: { ra: "127.69444", dec: "-39.17760", radius: "0.01" },
          hasSearched: true,
        }),
      );
    });
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (container.textContent?.includes("Aladin Lite no está disponible")) break;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }

    expect(container.textContent).toContain("Aladin Lite no está disponible");
    expect(container.textContent).toContain("imagen estática");
    expect(container.textContent).toContain("Radio de búsqueda");
    expect(container.querySelector("[aria-label*='OBS-001']")).not.toBeNull();
    expect(container.textContent).not.toContain("DATOS SIMULADOS");
  });
});
