import { AlertTriangle, ExternalLink, Orbit } from "lucide-react";

export function AboutPage() {
  return (
    <main className="secondary-page">
      <Orbit size={28} className="text-primary mb-4" />
      <h1 className="text-2xl font-semibold tracking-tight">SPHEREx Explorer</h1>
      <p className="text-muted-foreground text-sm mt-3 max-w-2xl">
        An interface for exploring observations by coordinates, bands, and dates for the “Planet X
        and SPHEREx” challenge of the NASA Space Apps Challenge 2026. Map positions are the RA/Dec
        returned by the API. The 2D map background is DSS2 Color, the HiPS ivo://CDS/P/DSS2/color
        served by the ESA mirror of Aladin Lite: it is visual context, not a SPHEREx image.
      </p>
      <div className="border-t border-border mt-8 pt-6">
        <h2 className="text-lg font-semibold">Scope</h2>
        <p className="text-muted-foreground text-sm mt-3 max-w-2xl">
          Simulated data appears only when the app runs with{" "}
          <span className="scientific">VITE_USE_MOCKS=true</span>, and then it carries the SIMULATED
          DATA label. This interface makes no astronomical discoveries. The 3D view places those
          same RA/Dec on a sphere and, separately, shows a spectral cube labeled as a demo: they are
          neither distances nor SPHEREx spectra.
        </p>
        <a
          href="https://science.nasa.gov/mission/spherex/"
          target="_blank"
          rel="noreferrer"
          className="text-primary text-sm inline-flex gap-2 items-center mt-4"
        >
          Learn about the SPHEREx mission
          <ExternalLink size={13} />
        </a>
      </div>
      <div className="warning-banner">
        <AlertTriangle size={16} />
        This prototype does not produce scientific findings or results.
      </div>
    </main>
  );
}
