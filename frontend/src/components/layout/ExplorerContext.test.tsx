// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { ExplorerProvider, useExplorer } from "./ExplorerContext";

function Explore() {
  const { workspace, compareIds, setCompareIds } = useExplorer();
  const navigate = useNavigate();
  return <>
    <span>{workspace.coordinates.ra}|{workspace.filters.collection}|{workspace.observations.length}|{compareIds.join(",")}</span>
    <button onClick={() => {
      workspace.setCoordinates({ ...workspace.coordinates, ra: "133.79513" });
      workspace.setFilters({ ...workspace.filters, collection: "DR1" });
      workspace.setObservations([{ id: "first", observed_at: "2024-01-01", band: "B1", collection: null, ra: 133, dec: -7, preview_url: null, source_url: null }]);
      setCompareIds(["first"]);
    }}>Buscar</button>
    <button onClick={() => navigate("/comparacion")}>Comparar</button>
  </>;
}

function Compare() {
  const navigate = useNavigate();
  return <button onClick={() => navigate("/")}>Volver</button>;
}

describe("estado de exploración", () => {
  afterEach(() => { document.body.innerHTML = ""; });

  it("conserva campos, resultados y selección al navegar y volver", async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => root.render(<MemoryRouter><ExplorerProvider><Routes>
      <Route path="/" element={<Explore />} />
      <Route path="/comparacion" element={<Compare />} />
    </Routes></ExplorerProvider></MemoryRouter>));
    const click = async (text: string) => {
      const button = Array.from(container.querySelectorAll("button")).find((item) => item.textContent === text);
      if (!button) throw new Error(`No se encontró ${text}`);
      await act(async () => button.click());
    };
    await click("Buscar");
    await click("Comparar");
    await click("Volver");
    expect(container.textContent).toContain("133.79513|DR1|1|first");
    await act(async () => root.unmount());
  });
});
