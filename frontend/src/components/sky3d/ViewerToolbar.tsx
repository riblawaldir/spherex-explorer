import type { Ref } from "react";
import { RotateCcw } from "lucide-react";
import type { ViewerDensity } from "@/lib/viewerDensity";
import { ModeToggle } from "./ModeToggle";

export type Sky3DScene = "sphere" | "cube";

export function ViewerToolbar({
  toolbarRef,
  scene,
  density,
  onScene,
  onDensity,
  onReset,
}: {
  toolbarRef?: Ref<HTMLDivElement>;
  scene: Sky3DScene;
  density: ViewerDensity;
  onScene: (scene: Sky3DScene) => void;
  onDensity: (density: ViewerDensity) => void;
  onReset: () => void;
}) {
  return (
    <div ref={toolbarRef} className="sky3d-toolbar">
      <div className="view-toggle" role="group" aria-label="3D view">
        <button
          type="button"
          className={scene === "sphere" ? "selected" : undefined}
          aria-pressed={scene === "sphere"}
          onClick={() => onScene("sphere")}
        >
          Sphere
        </button>
        <button
          type="button"
          className={scene === "cube" ? "selected" : undefined}
          aria-pressed={scene === "cube"}
          onClick={() => onScene("cube")}
        >
          Spectral cube
        </button>
      </div>
      <div className="sky3d-toolbar-actions">
        <ModeToggle density={density} onChange={onDensity} />
        <button type="button" className="sky3d-reset" onClick={onReset} aria-label="Reset view">
          <RotateCcw size={16} />
          Reset view
        </button>
      </div>
    </div>
  );
}
