import { SlidersHorizontal, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { availableBands, emptyFilters } from "@/data/mockObservations";
import type { SearchFilters } from "@/types/search";
export function FilterPanel({
  filters,
  onChange,
}: {
  filters: SearchFilters;
  onChange: (f: SearchFilters) => void;
}) {
  return (
    <section>
      <div className="panel-heading mb-5">
        <SlidersHorizontal />
        <h2>Filtros de observación</h2>
      </div>
      <label className="field-label" htmlFor="date-start">
        RANGO DE FECHAS
      </label>
      <input
        aria-label="Fecha inicial"
        id="date-start"
        className="field"
        type="date"
        value={filters.start}
        max={filters.end || undefined}
        onChange={(e) => onChange({ ...filters, start: e.target.value })}
      />
      <div className="text-center text-muted-foreground text-[9px] my-1">hasta</div>
      <input
        aria-label="Fecha final"
        className="field"
        type="date"
        value={filters.end}
        min={filters.start || undefined}
        onChange={(e) => onChange({ ...filters, end: e.target.value })}
      />
      <p className="field-label mt-5">BANDAS ESPECTRALES</p>
      <div className="grid grid-cols-3 gap-2">
        {availableBands.map((b) => (
          <Button
            key={b}
            variant="ghost"
            aria-pressed={filters.bands.includes(b)}
            className={`band-chip ${filters.bands.includes(b) ? "selected" : ""}`}
            onClick={() =>
              onChange({
                ...filters,
                bands: filters.bands.includes(b)
                  ? filters.bands.filter((v) => v !== b)
                  : [...filters.bands, b],
              })
            }
          >
            {b}
          </Button>
        ))}
      </div>
      <label className="field-label mt-5" htmlFor="collection">
        COLECCIÓN
      </label>
      <select
        id="collection"
        className="field"
        value={filters.collection}
        onChange={(e) => onChange({ ...filters, collection: e.target.value })}
      >
        <option value="all">Todas las colecciones</option>
        <option value="DR1">DR1</option>
        <option value="QR3">QR3</option>
      </select>
      <Button
        variant="ghost"
        className="w-full mt-4 text-muted-foreground text-[11px]"
        onClick={() => onChange({ ...emptyFilters })}
      >
        <RotateCcw size={12} />
        Limpiar filtros
      </Button>
    </section>
  );
}
