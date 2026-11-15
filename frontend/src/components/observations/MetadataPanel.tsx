import type { ReactNode } from "react";
import { FileText, ExternalLink } from "lucide-react";
import { SimulatedBadge } from "@/components/layout/Header";
import { ProvenanceChip } from "./ProvenanceChip";
import { describeProvenance } from "@/lib/provenance";
import type { Observation } from "@/types/observation";

function formatMetadataValue(key: string, value: unknown): ReactNode {
  if (key === "provenance") {
    return (
      <span className="inline-flex flex-col items-end gap-1">
        <ProvenanceChip provenance={typeof value === "string" ? value : null} />
        <span className="text-[0.65rem] text-muted-foreground font-sans normal-case tracking-normal text-right max-w-[12rem]">
          {describeProvenance(typeof value === "string" ? value : null).title}
        </span>
      </span>
    );
  }
  if (key === "source_url") {
    if (typeof value === "string" && value) {
      return (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="text-primary inline-flex items-center gap-1"
        >
          Abrir fuente
          <ExternalLink size={10} />
        </a>
      );
    }
    return "No disponible";
  }
  if (key === "preview_url") {
    if (typeof value === "string" && value) {
      return (
        <a href={value} target="_blank" rel="noreferrer" className="text-primary">
          Abrir vista previa ↗
        </a>
      );
    }
    return "No disponible";
  }
  if (value == null || value === "") return "No disponible";
  if (typeof value === "number") return String(value);
  return String(value);
}

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
        {o ? (
          <span className="ml-auto">
            <ProvenanceChip provenance={o.provenance} />
          </span>
        ) : null}
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
                  <td>{formatMetadataValue(k, v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-muted-foreground text-xs leading-5 px-4 pb-4">
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
