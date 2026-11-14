export function RadiusInput({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string | undefined;
}) {
  return (
    <div className="mt-5">
      <label className="field-label" htmlFor="radius">
        RADIO <span> / grados</span>
      </label>
      <input
        id="radius"
        type="number"
        step="0.001"
        className={`field ${error ? "field-error" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? "radius-error" : undefined}
      />
      {error ? (
        <p id="radius-error" className="text-destructive text-xs mt-2">
          {error}
        </p>
      ) : (
        <p className="text-muted-foreground text-[10px] mt-2">
          Área de búsqueda alrededor de las coordenadas.
        </p>
      )}
    </div>
  );
}
