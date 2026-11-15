import { DEMO_BAND_WINDOWS } from "./demoCube";

export function ViewerInfo({
  center,
  radiusDeg,
  observationCount,
  hasSearched,
  simulated,
  cursor,
  pose,
  scene,
  bandId,
  onBand,
  demoCount,
}: {
  center: { ra: number; dec: number } | null;
  radiusDeg: number | null;
  observationCount: number;
  hasSearched: boolean;
  simulated: boolean;
  cursor: { ra: number; dec: number } | null;
  pose: { distance: number; fov: number } | null;
  scene: "sphere" | "cube";
  bandId: string;
  onBand: (bandId: string) => void;
  demoCount: number;
}) {
  const centerText = center
    ? `RA ${center.ra.toFixed(5)}° · Dec ${center.dec.toFixed(5)}°`
    : "Center unavailable";
  return (
    <aside className="sky3d-panel glass-panel" aria-label="3D view details">
      <p className="scientific">{centerText}</p>
      <p>Search radius: {radiusDeg == null ? "—" : `${radiusDeg.toFixed(5)}°`}</p>
      <p>
        Observations: {observationCount}
        {simulated ? " · simulated search" : " · positions from the current search"}
      </p>
      {simulated && <p className="sim-badge">DATOS SIMULADOS</p>}
      {scene === "sphere" && (
        <ul className="sky3d-legend">
          <li><i className="sky3d-swatch is-primary" /> Observation</li>
          <li><i className="sky3d-swatch is-violet" /> In comparison</li>
          <li><i className="sky3d-swatch is-selected" /> Selected</li>
          <li><i className="sky3d-swatch is-warning" /> Search radius</li>
        </ul>
      )}
      <p>Cursor: {cursor ? `RA ${cursor.ra.toFixed(5)}° · Dec ${cursor.dec.toFixed(5)}°` : "—"}</p>
      <p>
        Camera:{" "}
        {pose ? `distance ${pose.distance.toFixed(2)} · fov ${pose.fov.toFixed(0)}°` : "—"}
      </p>
      {scene === "cube" && (
        <>
          <p>Demo samples: {demoCount}. Not SPHEREx spectra.</p>
          <label className="field-label" htmlFor="demo-band">
            Demo band window
          </label>
          <select
            id="demo-band"
            className="field"
            value={bandId}
            onChange={(event) => onBand(event.target.value)}
          >
            <option value="all">All six windows</option>
            {DEMO_BAND_WINDOWS.map((band) => (
              <option key={band.id} value={band.id}>
                {band.label}
              </option>
            ))}
          </select>
        </>
      )}
      {hasSearched && observationCount === 0 && <p>No observations in this region.</p>}
      {!hasSearched && <p>No search yet.</p>}
    </aside>
  );
}
