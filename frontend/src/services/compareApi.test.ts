import { describe, expect, it, vi } from "vitest";
import { fetchCompare } from "./compareApi";

const sampleOk = {
  obs_id_a: "stub-wise0855-001",
  obs_id_b: "stub-wise0855-002",
  status: "not_comparable",
  provenance: "cached_sample",
  reasons: ["bandpass_match", "pair_not_comparable"],
  epoch_a: { obs_id: "stub-wise0855-001", provenance: "cached_sample" },
  epoch_b: { obs_id: "stub-wise0855-002", provenance: "cached_sample" },
  alignment: { status: "failed", detail: "no WCS" },
  diff: {
    status: "not_implemented",
    detail: "P5 scientific difference API not available",
    provenance: "stub",
  },
  checks: { bandpass_match: true },
};

describe("fetchCompare", () => {
  it("rejects identical ids without calling the network", async () => {
    const fetchImpl = vi.fn();
    const res = await fetchCompare(
      { obsIdA: "a", obsIdB: "a" },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(422);
      expect(res.detail).toMatch(/different/i);
    }
  });

  it("returns CompareResponse on HTTP 200", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => sampleOk,
    });
    const res = await fetchCompare(
      { obsIdA: "stub-wise0855-001", obsIdB: "stub-wise0855-002" },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.status).toBe("not_comparable");
      expect(res.data.diff.status).toBe("not_implemented");
      expect(res.data.provenance).toBe("cached_sample");
    }
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/compare?obs_id_a=stub-wise0855-001&obs_id_b=stub-wise0855-002",
      expect.any(Object),
    );
  });

  it("surfaces 404 detail from the API", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 404,
      ok: false,
      json: async () => ({
        detail: "Unknown obs_id(s): 'missing'",
        provenance: "stub",
      }),
    });
    const res = await fetchCompare(
      { obsIdA: "missing", obsIdB: "stub-wise0855-001" },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(404);
      expect(res.detail).toContain("Unknown obs_id");
      expect(res.provenance).toBe("stub");
    }
  });
});
