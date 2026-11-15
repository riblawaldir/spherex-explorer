import { FileText, ExternalLink } from "lucide-react";
import { SimulatedBadge } from "@/components/layout/Header";
import type { Observation } from "@/types/observation";
export function MetadataPanel({
  observation: o,
  isSimulated = false,
}: {
  observation?: Observation | undefined;
  isSimulated?: boolean;
}) {
  return (
    <section className="glass-panel metadata-panel">
      <h2 className="panel-heading metadata-title">
        <FileText />
        Metadatos de observación
      </h2>
      {o ? (
        <>
          <div className="preview-wrap">
            {o.preview_url ? (
              <img
                src={o.preview_url}
                alt={isSimulated ? "Vista previa simulada" : "Vista previa de la observación"}
                className="preview-image"
                width={280}
                height={105}
              />
            ) : (
              <div className="preview-image empty-state">Vista previa no disponible.</div>
            )}
            {isSimulated && <SimulatedBadge />}
          </div>
          <table className="metadata-table">
            <tbody>
              {Object.entries(o).map(([k, v]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td>
                    {k === "source_url" && v ? (
                      <a
                        href={v}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary inline-flex items-center gap-1"
                      >
                        Abrir fuente
                        <ExternalLink size={10} />
                      </a>
                    ) : k === "source_url" ? (
                      "No disponible"
                    ) : k === "preview_url" && v ? (
                      <a href={v} target="_blank" rel="noreferrer" className="text-primary">
                        Abrir vista previa ↗
                      </a>
                    ) : k === "preview_url" ? (
                      "No disponible"
                    ) : typeof v === "number" ? (
                      String(v)
                    ) : (
                      v
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-muted-foreground text-[9px] px-4 pb-4">
            {isSimulated
              ? "Registro simulado. El enlace es contexto de la misión, no la procedencia de estos datos."
              : "Valores entregados por la API. El enlace es la fuente indicada en source_url."}
          </p>
        </>
      ) : (
        <div className="empty-state">Selecciona una observación para ver sus metadatos.</div>
      )}
    </section>
  );
}
