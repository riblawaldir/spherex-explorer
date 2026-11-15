import { describe, expect, it } from "vitest";
import { getComparisonSummary } from "./ComparisonPage";

describe("getComparisonSummary", () => {
  it("guides the user when no observations were selected", () => {
    expect(getComparisonSummary(0)).toBe(
      "Select observations from the results to step through their time sequence.",
    );
  });

  it("uses singular wording for one observation", () => {
    expect(getComparisonSummary(1)).toBe(
      "1 observation selected to step through in chronological order.",
    );
  });

  it("uses plural wording for multiple observations", () => {
    expect(getComparisonSummary(3)).toBe(
      "3 observations selected to step through in chronological order.",
    );
  });
});
