// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObservationCard } from "./ObservationCard";
import type { Observation } from "@/types/observation";

const sample: Observation = {
  id: "stub-wise0855-001",
  observed_at: "2026-01-15T12:00:00Z",
  collection: "DR1",
  ra: 133.79513,
  dec: -7.24459,
  band: "SPHEREx-B1",
  preview_url: null,
  source_url: null,
  provenance: "cached_sample",
};

describe("ObservationCard", () => {
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

  it("muestra obs_id de forma legible, no solo en aria-label", async () => {
    await act(async () => {
      root.render(
        createElement(ObservationCard, {
          observation: sample,
          active: false,
          checked: false,
          onSelect: vi.fn(),
          onCheck: vi.fn(),
        }),
      );
    });

    expect(container.textContent).toContain("obs_id");
    expect(container.textContent).toContain("stub-wise0855-001");
    expect(container.querySelector(".observation-obs-id")?.textContent).toContain(
      "stub-wise0855-001",
    );
  });
});
