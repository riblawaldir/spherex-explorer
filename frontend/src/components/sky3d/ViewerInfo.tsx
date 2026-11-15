import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { DEMO_BAND_WINDOWS } from "./demoCube";

export function ViewerInfo({
  open,
  onToggle,
  radiusDeg,
  observationCount,
  cursor,
  pose,
  scene,
  bandId,
  onBand,
  demoCount,
}: {
  open: boolean;
  onToggle: () => void;
  radiusDeg: number | null;
  observationCount: number;
  cursor: { ra: number; dec: number } | null;
  pose: { distance: number; fov: number } | null;
  scene: "sphere" | "cube";
  bandId: string;
  onBand: (bandId: string) => void;
  demoCount: number;
}) {
  const bodyId = useId();
  return (
    <aside className="sky3d-panel glass-panel" aria-label="3D view details" data-open={open}>
      <button
        type="button"
        className="sky3d-panel-toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={onToggle}
      >
        View details
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      <div id={bodyId} className="sky3d-panel-body" hidden={!open}>
        <dl className="sky3d-facts">
          <dt>Radius</dt>
          <dd className="scientific">{radiusDeg == null ? "—" : `${radiusDeg.toFixed(5)}°`}</dd>
          <dt>{scene === "sphere" ? "Observations" : "Demo samples"}</dt>
          <dd className="scientific">{scene === "sphere" ? observationCount : demoCount}</dd>
          <dt>Cursor</dt>
          <dd className="scientific">{cursor ? `${cursor.ra.toFixed(3)}°, ${cursor.dec.toFixed(3)}°` : "—"}</dd>
          <dt>Camera</dt>
          <dd className="scientific">{pose ? `d ${pose.distance.toFixed(2)} · ${pose.fov.toFixed(0)}°` : "—"}</dd>
        </dl>
        {scene === "sphere" ? (
          <ul className="sky3d-legend">
            <li><i className="sky3d-swatch" /> Observation</li>
            <li><i className="sky3d-swatch is-selected" /> Selected</li>
            <li><i className="sky3d-swatch is-violet" /> In comparison</li>
            <li><i className="sky3d-swatch is-warning" /> Search radius</li>
          </ul>
        ) : (
          <>
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
      </div>
    </aside>
  );
}
