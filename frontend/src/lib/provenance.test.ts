import { describe, expect, it } from "vitest";
import { describeProvenance, normalizeProvenance } from "./provenance";

describe("normalizeProvenance", () => {
  it("keeps known API tokens", () => {
    expect(normalizeProvenance("stub")).toBe("stub");
    expect(normalizeProvenance("cached_sample")).toBe("cached_sample");
    expect(normalizeProvenance("live")).toBe("live");
    expect(normalizeProvenance("irsa_verified_local")).toBe("irsa_verified_local");
    expect(normalizeProvenance("local_real_fits")).toBe("local_real_fits");

  });

  it("does not invent values for empty or opaque strings", () => {
    expect(normalizeProvenance(null)).toBe("unknown");
    expect(normalizeProvenance(undefined)).toBe("unknown");
    expect(normalizeProvenance("")).toBe("unknown");
    expect(normalizeProvenance("  ")).toBe("unknown");
    expect(normalizeProvenance("DATOS SIMULADOS")).toBe("unknown");
  });
});

describe("describeProvenance", () => {
  it("never labels stub or cached_sample as NASA live", () => {
    expect(describeProvenance("stub").title.toLowerCase()).not.toContain(
      "irsa en vivo",
    );
    expect(describeProvenance("cached_sample").title.toLowerCase()).toContain(
      "no es consulta irsa",
    );
    expect(describeProvenance("live").token).toBe("live");
    expect(describeProvenance("irsa_verified_local").token).toBe("IRSA local verificado");
    expect(describeProvenance("irsa_verified_local").title).toContain("no es una consulta en vivo");
    expect(describeProvenance("local_real_fits").token).toBe("local_real_fits");
    expect(describeProvenance("local_real_fits").title.toLowerCase()).toContain(
      "no es una consulta irsa",
    );

  });
});
