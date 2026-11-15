import type { ViewerDensity } from "@/lib/viewerDensity";

export function ModeToggle({
  density,
  onChange,
}: {
  density: ViewerDensity;
  onChange: (density: ViewerDensity) => void;
}) {
  return (
    <div className="view-toggle" role="group" aria-label="Viewer density">
      {(["focus", "analysis"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          className={density === mode ? "selected" : undefined}
          aria-pressed={density === mode}
          onClick={() => onChange(mode)}
        >
          {mode === "focus" ? "Focus" : "Analysis"}
        </button>
      ))}
    </div>
  );
}
