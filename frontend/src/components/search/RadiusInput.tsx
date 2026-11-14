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
      <div className="flex items-center justify-between mb-2">
        <label className="field-label mb-0 flex items-center gap-1.5" htmlFor="radius">
          <Compass size={11} className="text-primary" />
          RADIO DE BÚSQUEDA <span>/ grados (°)</span>
        </label>
        {arcmin && (
          <span className="text-[10px] font-mono text-muted-foreground">
            ≈ {arcmin}′ ({arcsec}″)
          </span>
        )}
      </div>

      <input
        id="radius"
        type="number"
        step="0.001"
        min="0.0001"
        max="5.0"
        placeholder="0.01"
        disabled={disabled}
        className={`field ${error ? "field-error" : ""}`}
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
            className={`text-[9px] font-mono px-1.5 py-0.5 rounded border border-border transition-colors hover:border-primary/50 text-muted-foreground hover:text-foreground ${
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
        <p id="radius-desc" className="text-muted-foreground text-[10px] mt-2">
          Cono de búsqueda centrado en RA/Dec (máx. recomendado: 5.0°).
        </p>
      )}
    </div>
  );
}
