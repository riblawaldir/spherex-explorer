import { describe, expect, it } from "vitest";
import { getComparisonSummary } from "./ComparisonPage";

describe("getComparisonSummary", () => {
  it("guides the user when no observations were selected", () => {
    expect(getComparisonSummary(0)).toBe(
      "Selecciona observaciones desde los resultados para recorrer su secuencia temporal.",
    );
  });

  it("uses singular wording for one observation", () => {
    expect(getComparisonSummary(1)).toBe(
      "1 observación seleccionada para recorrer en orden cronológico.",
    );
  });

  it("uses plural wording for multiple observations", () => {
    expect(getComparisonSummary(3)).toBe(
      "3 observaciones seleccionadas para recorrer en orden cronológico.",
    );
  });
});
