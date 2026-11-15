import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProvenanceChip } from "./ProvenanceChip";

describe("ProvenanceChip", () => {
  it("renders stub token without claiming NASA live", () => {
    const html = renderToStaticMarkup(<ProvenanceChip provenance="stub" />);
    expect(html).toContain("stub");
    expect(html).toContain('data-provenance="stub"');
    expect(html.toLowerCase()).not.toContain("nasa live");
  });

  it("renders honest unknown when provenance is missing", () => {
    const html = renderToStaticMarkup(<ProvenanceChip provenance={null} />);
    expect(html).toContain("sin provenance");
    expect(html).toContain('data-provenance="unknown"');
  });

  it("renders live token for live rows", () => {
    const html = renderToStaticMarkup(<ProvenanceChip provenance="live" />);
    expect(html).toContain(">live<");
    expect(html).toContain('data-provenance="live"');
  });
});
