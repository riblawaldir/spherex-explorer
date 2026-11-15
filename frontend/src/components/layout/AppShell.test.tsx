// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./Header", () => ({
  Header: () => createElement("header", null, "header"),
}));

describe("AppShell footer mode", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.resetModules();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllEnvs();
  });

  it("en modo API no afirma simulación NASA live", async () => {
    vi.stubEnv("VITE_USE_MOCKS", "");
    const { AppShell } = await import("./AppShell");
    await act(async () => {
      root.render(createElement(AppShell, null, createElement("main", null, "body")));
    });
    expect(container.textContent).toContain("API local / fixtures");
    expect(container.textContent).toContain("no live NASA IRSA");
    expect(container.textContent).not.toContain("Entorno de simulación");
  });

  it("con VITE_USE_MOCKS declara simulación sin NASA", async () => {
    vi.stubEnv("VITE_USE_MOCKS", "true");
    const { AppShell } = await import("./AppShell");
    await act(async () => {
      root.render(createElement(AppShell, null, createElement("main", null, "body")));
    });
    expect(container.textContent).toContain("Entorno de simulación");
    expect(container.textContent).toContain("Sin conexión a servicios de NASA");
  });
});
