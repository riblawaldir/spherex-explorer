import { useState, useId } from "react";
import { Crosshair, Search, LoaderCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadiusInput } from "./RadiusInput";
import { TargetPresets } from "./TargetPresets";
import {
  degreesToHMS,
  degreesToDMS,
  parseAndValidateRA,
  parseAndValidateDec,
  type PresetTarget,
} from "@/lib/coordinates";
import type { Coordinates } from "@/types/search";

interface CoordinateSearchProps {
  coordinates: Coordinates;
  onChange: (c: Coordinates) => void;
  onSearch: () => void;
  loading: boolean;
  errors: Partial<Record<keyof Coordinates, string>>;
  onReset?: () => void;
}

export function CoordinateSearch({
  coordinates,
  onChange,
  onSearch,
  loading,
  errors,
  onReset,
}: CoordinateSearchProps) {
  const [selectedTargetId, setSelectedTargetId] = useState<string | undefined>();
  const raErrorId = useId();
  const decErrorId = useId();

  // Calcular equivalencias sexagesimales dinámicas para asistencia visual
  const numRa = parseFloat(coordinates.ra);
  const hmsHint =
    !isNaN(numRa) && numRa >= 0 && numRa <= 360 ? degreesToHMS(numRa) : null;

  const numDec = parseFloat(coordinates.dec);
  const dmsHint =
    !isNaN(numDec) && numDec >= -90 && numDec <= 90 ? degreesToDMS(numDec) : null;

  const handleRaChange = (val: string) => {
    setSelectedTargetId(undefined);
    // Si el usuario pega o escribe formato sexagesimal (e.g. "18:00:00" o "18h"), intentar convertir
    if (val.includes(":") || val.toLowerCase().includes("h")) {
      const parsed = parseAndValidateRA(val);
      if (parsed.valid && parsed.degrees !== undefined) {
        onChange({ ...coordinates, ra: parsed.degrees.toFixed(5) });
        return;
      }
    }
    onChange({ ...coordinates, ra: val });
  };

  const handleDecChange = (val: string) => {
    setSelectedTargetId(undefined);
    if (
      val.includes(":") ||
      val.includes("°") ||
      val.includes("'") ||
      val.toLowerCase().includes("d")
    ) {
      const parsed = parseAndValidateDec(val);
      if (parsed.valid && parsed.degrees !== undefined) {
        onChange({ ...coordinates, dec: parsed.degrees.toFixed(5) });
        return;
      }
    }
    onChange({ ...coordinates, dec: val });
  };

  const handleSelectPreset = (newCoords: Coordinates, target: PresetTarget) => {
    setSelectedTargetId(target.id);
    onChange(newCoords);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSearch();
      }}
      noValidate
      aria-label="Formulario de búsqueda por coordenadas celestes"
    >
      <div className="flex items-center justify-between">
        <h2 className="panel-heading">
          <Crosshair className="text-primary" />
          Buscar coordenadas
        </h2>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            disabled={loading}
            title="Restablecer coordenadas predeterminadas"
            className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 transition-colors"
          >
            <RotateCcw size={11} />
            Reset
          </button>
        )}
      </div>

      <p className="text-muted-foreground text-sm leading-6 mt-2 mb-4">
        Consulta observaciones astronómicas en coordenadas ecuatoriales (ICRS · J2000).
      </p>

      {/* Selector de objetivos astronómicos predefinidos */}
      <TargetPresets
        onSelectTarget={handleSelectPreset}
        selectedTargetId={selectedTargetId}
        disabled={loading}
      />

      <div className="grid grid-cols-2 gap-3 mt-4">
        {/* Campo RA */}
        <div>
          <label htmlFor="ra-input" className="field-label">
            RA <span>/ grados (°)</span>
          </label>
          <input
            id="ra-input"
            className={`field scientific ${errors.ra ? "field-error" : ""}`}
            type="text"
            inputMode="decimal"
            placeholder="0.0 a 360.0"
            disabled={loading}
            value={coordinates.ra}
            onChange={(e) => handleRaChange(e.target.value)}
            aria-invalid={!!errors.ra}
            aria-describedby={errors.ra ? raErrorId : undefined}
          />
          {errors.ra ? (
            <p id={raErrorId} role="alert" className="text-destructive text-xs mt-1.5">
              {errors.ra}
            </p>
          ) : (
            <span className="text-muted-foreground text-xs leading-5 block mt-1.5">
              {hmsHint ? <span className="scientific">{hmsHint}</span> : "Rango: 0° a 360° (o HH:MM:SS)"}
            </span>
          )}
        </div>

        {/* Campo Dec */}
        <div>
          <label htmlFor="dec-input" className="field-label">
            DEC <span>/ grados (°)</span>
          </label>
          <input
            id="dec-input"
            className={`field scientific ${errors.dec ? "field-error" : ""}`}
            type="text"
            inputMode="decimal"
            placeholder="-90.0 a +90.0"
            disabled={loading}
            value={coordinates.dec}
            onChange={(e) => handleDecChange(e.target.value)}
            aria-invalid={!!errors.dec}
            aria-describedby={errors.dec ? decErrorId : undefined}
          />
          {errors.dec ? (
            <p id={decErrorId} role="alert" className="text-destructive text-xs mt-1.5">
              {errors.dec}
            </p>
          ) : (
            <span className="text-muted-foreground text-xs leading-5 block mt-1.5">
              {dmsHint ? <span className="scientific">{dmsHint}</span> : "Rango: −90° a +90° (o ±DD:MM:SS)"}
            </span>
          )}
        </div>
      </div>

      {/* Campo Radio */}
      <RadiusInput
        value={coordinates.radius}
        onChange={(radius) => onChange({ ...coordinates, radius })}
        error={errors.radius}
        disabled={loading}
      />

      <Button
        type="submit"
        variant="brand"
        className="w-full mt-5 h-11 font-medium"
        disabled={loading}
      >
        {loading ? (
          <>
            <LoaderCircle className="animate-spin" size={14} />
            Buscando observaciones…
          </>
        ) : (
          <>
            <Search size={14} />
            Buscar observaciones
          </>
        )}
      </Button>
    </form>
  );
}
