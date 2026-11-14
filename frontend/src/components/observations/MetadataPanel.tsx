import { FileText, ExternalLink } from "lucide-react";
import { SimulatedBadge } from "@/components/layout/Header";
import type { Observation } from "@/types/observation";
export function MetadataPanel({ observation: o }: { observation?: Observation | undefined }) {
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
                alt="Campo estelar generado, imagen simulada"
                className="preview-image"
                width={280}
                height={105}
              />
            ) : (
              <div className="preview-image empty-state">Imagen simulada no disponible.</div>
            )}
            <SimulatedBadge />
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
                        NASA · misión
                        <ExternalLink size={10} />
                      </a>
                    ) : k === "source_url" ? (
                      "No disponible"
                    ) : k === "preview_url" && v ? (
                      <a href={v} target="_blank" rel="noreferrer" className="text-primary">
                        Ver imagen simulada ↗
                      </a>
                    ) : k === "preview_url" ? (
                      "No disponible"
                    ) : typeof v === "number" ? (
                      v.toFixed(5)
                    ) : (
                      v
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-muted-foreground text-[9px] px-4 pb-4">
            Enlace de contexto de la misión, no procedencia de estos datos simulados.
          </p>
        </>
      ) : (
        <div className="empty-state">Selecciona una observación para ver sus metadatos.</div>
      )}
    </section>
  );
}
