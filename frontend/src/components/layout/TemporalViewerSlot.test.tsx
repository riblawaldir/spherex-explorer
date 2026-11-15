// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TemporalViewerSlot } from "./TemporalViewerSlot";
import type { Observation } from "@/types/observation";

function observation(
  id: string,
  observed_at: string,
  preview_url: string | null = `https://images.example/${id}.png`,
): Observation {
  return {
    id,
    observed_at,
    collection: "TEST",
    ra: 127.69444,
    dec: -39.1776,
    band: "B1",
    preview_url,
    source_url: null,
  };
}

describe("TemporalViewerSlot", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  async function render(
    observations: Observation[],
    selectedId?: string,
    isSimulated = false,
  ) {
    await act(async () => {
      root.render(createElement(TemporalViewerSlot, { observations, selectedId, isSimulated }));
    });
  }

  function button(label: string): HTMLButtonElement {
    const found = Array.from(container.querySelectorAll("button")).find(
      (element) => element.getAttribute("aria-label") === label || element.textContent?.includes(label),
    );
    if (!(found instanceof HTMLButtonElement)) throw new Error(`Button not found: ${label}`);
    return found;
  }

  async function click(label: string) {
    await act(async () => button(label).dispatchEvent(new MouseEvent("click", { bubbles: true })));
  }

  function imageAlt(): string | null {
    return container.querySelector("img")?.getAttribute("alt") ?? null;
  }

  it("orders observations by date and supports previous/next navigation", async () => {
    await render([
      observation("later", "2026-08-20T00:00:00Z"),
      observation("earlier", "2026-08-15T00:00:00Z"),
    ]);

    expect(imageAlt()).toContain("earlier");
    await click("Next");
    expect(imageAlt()).toContain("later");
    await click("Previous");
    expect(imageAlt()).toContain("earlier");
  });

  it("lets the timeline select an observation in chronological order", async () => {
    await render([
      observation("later", "2026-08-20T00:00:00Z"),
      observation("earlier", "2026-08-15T00:00:00Z"),
    ]);

    const timeline = container.querySelector(
      '[aria-label="Observation timeline"]',
    ) as HTMLInputElement;
    expect(timeline.value).toBe("0");
    expect(timeline.getAttribute("aria-valuetext")).toContain("Aug 15, 2026");

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      valueSetter?.call(timeline, "1");
      timeline.dispatchEvent(new Event("input", { bubbles: true }));
      timeline.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(imageAlt()).toContain("later");
    expect(container.textContent).toContain("2 / 2");
    expect(timeline.getAttribute("aria-valuetext")).toContain("Aug 20, 2026");
  });

  it("labels fixtures as simulated and leaves API observations unmarked", async () => {
    const rows = [observation("one", "2026-08-15T00:00:00Z")];

    await render(rows, undefined, true);
    expect(container.textContent).toContain("SIMULATED DATA");
    expect(container.textContent).toContain("1 simulated observation");

    await render(rows);
    expect(container.textContent).not.toContain("SIMULATED DATA");
    expect(container.textContent).toContain("1 observation · one");
  });

  it("provides zoom and recenter controls for the displayed image", async () => {
    await render([observation("one", "2026-08-15T00:00:00Z")]);

    expect(button("Zoom in on image").disabled).toBe(false);
    expect(button("Zoom out of image").disabled).toBe(true);
    expect(button("Center image").disabled).toBe(false);
    expect(container.textContent).toContain("1.0×");
  });

  it("shows a loading status until the selected preview loads", async () => {
    await render([observation("loading", "2026-08-15T00:00:00Z")]);
    expect(container.textContent).toContain("Loading preview…");

    const image = container.querySelector("img");
    await act(async () => image?.dispatchEvent(new Event("load")));
    expect(container.textContent).not.toContain("Loading preview…");
  });

  it("plays at the selected speed and pauses cleanly", async () => {
    vi.useFakeTimers();
    await render([
      observation("one", "2026-08-15T00:00:00Z"),
      observation("two", "2026-08-16T00:00:00Z"),
      observation("three", "2026-08-17T00:00:00Z"),
    ]);

    const speed = container.querySelector("#temporal-playback-speed") as HTMLSelectElement;
    await act(async () => {
      speed.value = "2";
      speed.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await click("Play");
    await act(async () => vi.advanceTimersByTimeAsync(500));
    expect(imageAlt()).toContain("two");

    await click("Pause");
    await act(async () => vi.advanceTimersByTimeAsync(1500));
    expect(imageAlt()).toContain("two");
    expect(button("Play").disabled).toBe(false);
  });

  it("alternates between two previews in Blink mode", async () => {
    vi.useFakeTimers();
    await render([
      observation("first", "2026-08-15T00:00:00Z"),
      observation("second", "2026-08-16T00:00:00Z"),
    ]);

    await click("Blink mode");
    expect(imageAlt()).toContain("first");
    await act(async () => vi.advanceTimersByTimeAsync(500));
    expect(imageAlt()).toContain("second");
    await click("Stop Blink");
    expect(button("Blink mode").disabled).toBe(false);
  });

  it("shows empty, missing-preview, invalid-date, and failed-image states", async () => {
    await render([]);
    expect(container.textContent).toContain("No observations to show.");
    expect(button("Next").disabled).toBe(true);

    await render([observation("missing", "not-a-date", null)]);
    expect(container.textContent).toContain("This observation has no image URL available.");
    expect(container.textContent).toContain("Date not available");

    await render([observation("broken", "2026-08-15T00:00:00Z")]);
    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    await act(async () => image?.dispatchEvent(new Event("error")));
    expect(container.textContent).toContain("The preview for this observation could not be loaded.");
  });

  it("stops playback and clears its timer when the list shrinks to one observation", async () => {
    vi.useFakeTimers();
    const twoObservations = [
      observation("first", "2026-08-15T00:00:00Z"),
      observation("second", "2026-08-16T00:00:00Z"),
    ];
    await render(twoObservations);
    await click("Play");
    expect(vi.getTimerCount()).toBe(1);

    await render([twoObservations[0]]);
    expect(vi.getTimerCount()).toBe(0);
    expect(button("Pause").disabled).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(imageAlt()).toContain("first");
  });
});
