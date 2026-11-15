import { Compass } from "lucide-react";

interface RadiusInputProps {
  value: string;
  onChange: (val: string) => void;
  error?: string | undefined;
  disabled?: boolean;
}

const PRESET_RADII = [
  { label: "36″ (0.01°)", value: "0.01" },
  { label: "3′ (0.05°)", value: "0.05" },
  { label: "6′ (0.10°)", value: "0.10" },
  { label: "30′ (0.50°)", value: "0.50" },
];

export function RadiusInput({ value, onChange, error, disabled = false }: RadiusInputProps) {
  const numVal = parseFloat(value);
  const arcmin = !isNaN(numVal) && numVal > 0 ? (numVal * 60).toFixed(1) : null;
  const arcsec = !isNaN(numVal) && numVal > 0 ? Math.round(numVal * 3600) : null;

  return (
    <div className="mt-5">
      <label className="field-label flex items-center gap-1.5" htmlFor="radius">
        <Compass size={14} className="text-primary" />
        Search radius <span>/ degrees (°)</span>
      </label>

      <input
        id="radius"
        type="number"
        step="0.001"
        min="0.0001"
        max="5.0"
        placeholder="0.01"
        disabled={disabled}
        className={`field scientific ${error ? "field-error" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? "radius-error" : "radius-desc"}
      />

      {/* Accesos rápidos de radio */}
      <div className="flex gap-1.5 mt-2">
        {PRESET_RADII.map((r) => (
          <button
            key={r.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(r.value)}
            className={`scientific text-xs px-2 py-1 rounded border border-border transition-colors hover:border-primary/50 text-muted-foreground hover:text-foreground ${
              value === r.value ? "bg-primary/10 border-primary text-primary" : "bg-card/40"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {error ? (
        <p id="radius-error" role="alert" className="text-destructive text-xs mt-2">
          {error}
        </p>
      ) : (
        <p id="radius-desc" className="text-muted-foreground text-xs mt-1.5">
          {arcmin && (
            <span className="scientific mr-1">
              ≈ {arcmin}′ ({arcsec}″).
            </span>
          )}
          Search cone centered on RA/Dec (recommended max: 5.0°).
        </p>
      )}
    </div>
  );
}
