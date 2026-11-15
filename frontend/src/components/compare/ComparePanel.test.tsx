import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ComparePanel } from "./ComparePanel";

describe("ComparePanel", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          obs_id_a: "a",
          obs_id_b: "b",
          status: "not_comparable",
          provenance: "stub",
          reasons: ["pair_not_comparable"],
          epoch_a: { obs_id: "a", provenance: "stub" },
          epoch_b: { obs_id: "b", provenance: "stub" },
          alignment: { status: "skipped", detail: "metadata" },
          diff: {
            status: "not_implemented",
            detail: "no residual",
            provenance: "stub",
          },
          checks: {},
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders pair inputs and honest copy without residual imagery", () => {
    const html = renderToStaticMarkup(
      <ComparePanel
        preferredIds={["stub-wise0855-001", "stub-wise0855-002"]}
        candidates={[
          {
            id: "stub-wise0855-001",
            observed_at: "2024-01-01T00:00:00.000Z",
            collection: null,
            ra: 1,
            dec: 2,
            band: "B1",
            preview_url: null,
            source_url: null,
            provenance: "cached_sample",
          },
          {
            id: "stub-wise0855-002",
            observed_at: "2024-01-02T00:00:00.000Z",
            collection: null,
            ra: 1.1,
            dec: 2.1,
            band: "B1",
            preview_url: null,
            source_url: null,
            provenance: "cached_sample",
          },
        ]}
      />,
    );
    expect(html).toContain("Validate pair");
    expect(html).toContain("/api/compare");
    expect(html).toContain("stub-wise0855-001");
    expect(html).toContain("stub-wise0855-002");
    expect(html).toContain("no invented residual images");
    expect(html).not.toContain("<img");
  });
});
