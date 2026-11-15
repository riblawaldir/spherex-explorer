export function SkyView3DPlaceholder() {
  // TODO: integrar una visualización 3D; este componente permanece como placeholder.
  return (
    <div className="sphere-placeholder">
      <div className="wire-sphere" aria-hidden="true" />
      <div>
        <h2 className="text-xl font-semibold mb-3">Esfera celeste</h2>
        <p className="text-muted-foreground text-sm leading-6">
          Esfera celeste: representa posiciones RA/Dec, no distancias reales.
        </p>
        <p className="eyebrow mt-4">Vista 3D · espacio reservado</p>
      </div>
    </div>
  );
}
