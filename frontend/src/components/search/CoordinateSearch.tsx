import { Crosshair, Search, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadiusInput } from "./RadiusInput";
import type { Coordinates } from "@/types/search";
export function CoordinateSearch({
  coordinates,
  onChange,
  onSearch,
  loading,
  errors,
}: {
  coordinates: Coordinates;
  onChange: (c: Coordinates) => void;
  onSearch: () => void;
  loading: boolean;
  errors: Partial<Record<keyof Coordinates, string>>;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSearch();
      }}
      noValidate
    >
      <h2 className="panel-heading">
        <Crosshair />
        Buscar coordenadas
      </h2>
      <p className="text-muted-foreground text-[11px] mt-2 mb-6">
        Encuentra observaciones en una región del cielo.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {(["ra", "dec"] as const).map((k) => (
          <div key={k}>
            <label htmlFor={k} className="field-label">
              {k.toUpperCase()} <span> / grados</span>
            </label>
            <input
              className={`field ${errors[k] ? "field-error" : ""}`}
              id={k}
              type="number"
              step="0.00001"
              value={coordinates[k]}
              onChange={(e) => onChange({ ...coordinates, [k]: e.target.value })}
              aria-invalid={!!errors[k]}
              aria-describedby={errors[k] ? `${k}-error` : undefined}
            />
            {errors[k] && (
              <p id={`${k}-error`} className="text-destructive text-xs mt-2">
                {errors[k]}
              </p>
            )}
          </div>
        ))}
      </div>
      <RadiusInput
        value={coordinates.radius}
        onChange={(radius) => onChange({ ...coordinates, radius })}
        error={errors.radius}
      />
      <Button
        type="submit"
        variant="brand"
        className="w-full mt-5 text-[11px] h-10"
        disabled={loading}
      >
        {loading ? <LoaderCircle className="animate-spin" /> : <Search />}
        {loading ? "Buscando observaciones…" : "Buscar observaciones"}
      </Button>
    </form>
  );
}
