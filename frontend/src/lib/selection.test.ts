import { describe, expect, it } from "vitest";
import {
  interpretMarkerClick,
  keepOrReplaceSelection,
  retainKnownIds,
  toggleCompareId,
} from "./selection";

describe("selección del mapa", () => {
  it("agrega y quita un id de comparación sin tocar el resto", () => {
    expect(toggleCompareId(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleCompareId(["a", "b"], "a")).toEqual(["b"]);
  });

  it("descarta ids que ya no están en los resultados", () => {
    expect(retainKnownIds(["a", "b", "c"], [{ id: "c" }, { id: "a" }])).toEqual(["a", "c"]);
  });

  it("mantiene la selección vigente o cae en la primera observación", () => {
    expect(keepOrReplaceSelection("b", [{ id: "a" }, { id: "b" }])).toBe("b");
    expect(keepOrReplaceSelection("z", [{ id: "a" }])).toBe("a");
    expect(keepOrReplaceSelection("z", [])).toBeUndefined();
  });

  it("selecciona un marcador único y pide desambiguar un grupo", () => {
    expect(interpretMarkerClick({ observations: [{ id: "obs-1" }] })).toEqual({
      type: "select",
      id: "obs-1",
    });
    expect(
      interpretMarkerClick({ observations: [{ id: "obs-1" }, { id: "obs-2" }] }),
    ).toEqual({ type: "disambiguate" });
  });
});
