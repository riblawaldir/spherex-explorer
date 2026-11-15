// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SkyMap2D } from "./SkyMap2D";
import type { Observation } from "@/types/observation";

// Mock del componente AladinLiteMap para probar aislamiento y renderizado en jsdom
vi.mock("./AladinLiteMap", () => ({
  default: ({
    observations,
    selectedId,
  }: {
    observations: Observation[];
    selectedId?: string;
  }) =>
    createElement(
      "div",
      { "data-testid": "mock-aladin-map" },
      createElement("span", null, "Aladin Map Rendered"),
      createElement("span", null, `Total obs: ${observations.length}`),
      createElement("span", null, `Selected: ${selectedId || "none"}`),
    ),
}));

describe("SkyMap2D Component (Sprint 4.1)", () => {
  let container: HTMLDivElement;
  let root: Root;

  const dummyCoords = { ra: "127.69444", dec: "-39.17760", radius: "0.01" };
  const mockObservations: Observation[] = [
    {
      id: "OBS-001",
      observed_at: "2026-08-15T00:00:00Z",
      collection: "DR1",
      ra: 127.69444,
      dec: -39.1776,
      band: "B1",
      preview_url: null,
      source_url: null,
    },
  ];

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
    document.body.innerHTML = "";
  });

  async function renderComponent(
    obs = mockObservations,
    selected?: string,
    onSelect = vi.fn(),
  ) {
    await act(async () => {
      root.render(
        createElement(SkyMap2D, {
          observations: obs,
          selectedId: selected,
          onSelect,
          coordinates: dummyCoords,
        }),
      );
    });
  }

  it("renderiza el encabezado del mapa celeste y el conmutador de vista", async () => {
    await renderComponent();
    expect(container.textContent).toContain("MAPA CELESTE");
    expect(container.textContent).toContain("2D");
    expect(container.textContent).toContain("3D");
  });

  it("muestra el mapa 2D y conserva el conmutador al pasar por la vista 3D", async () => {
    await renderComponent(mockObservations, "OBS-001");
    expect(container.querySelector('[data-testid="mock-aladin-map"]')).not.toBeNull();

    const threeD = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("3D"),
    );
    await act(async () => {
      threeD?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.textContent).toContain("no distancias reales");

    const twoD = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("2D"),
    );
    await act(async () => {
      twoD?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector('[data-testid="mock-aladin-map"]')).not.toBeNull();
    expect(container.textContent).toContain("Selected: OBS-001");
  });
});
