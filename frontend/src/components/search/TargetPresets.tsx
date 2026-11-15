import { Sparkles } from "lucide-react";
import { PRESET_TARGETS, type PresetTarget } from "@/lib/coordinates";
import type { Coordinates } from "@/types/search";

interface TargetPresetsProps {
  onSelectTarget: (coords: Coordinates, target: PresetTarget) => void;
  selectedTargetId?: string;
  disabled?: boolean;
}

export function TargetPresets({
  onSelectTarget,
  selectedTargetId,
  disabled = false,
}: TargetPresetsProps) {
  return (
    <div className="mt-4">
      <div className="mb-2">
        <label className="field-label mb-1 flex items-center gap-1.5" htmlFor="target-preset-select">
          <Sparkles size={14} className="text-primary" />
          Reference targets
        </label>
        <span className="text-xs leading-5 text-muted-foreground">SPHEREx / calibration</span>
      </div>

      <select
        id="target-preset-select"
        className="field cursor-pointer"
        disabled={disabled}
        value={selectedTargetId ?? ""}
        onChange={(e) => {
          const target = PRESET_TARGETS.find((t) => t.id === e.target.value);
          if (target) {
            onSelectTarget(
              {
                ra: target.ra.toFixed(5),
                dec: target.dec.toFixed(5),
                radius: target.radius.toString(),
              },
              target,
            );
          }
        }}
      >
        <option value="" disabled>
          Select a known target…
        </option>
        {PRESET_TARGETS.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} (RA {t.ra.toFixed(2)}°, Dec {t.dec > 0 ? `+${t.dec.toFixed(2)}` : t.dec.toFixed(2)}°)
          </option>
        ))}
      </select>

      {/* Chips rápidos para los 3 principales */}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {PRESET_TARGETS.slice(0, 3).map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={disabled}
            onClick={() =>
              onSelectTarget(
                {
                  ra: t.ra.toFixed(5),
                  dec: t.dec.toFixed(5),
                  radius: t.radius.toString(),
                },
                t,
              )
            }
            title={t.description}
            className={`scientific text-xs px-2 py-1 rounded border border-border transition-colors hover:border-primary/50 text-muted-foreground hover:text-foreground ${
              selectedTargetId === t.id ? "bg-primary/10 border-primary text-primary" : "bg-card/50"
            }`}
          >
            {t.id.replace("SPX-", "")}
          </button>
        ))}
      </div>
    </div>
  );
}
