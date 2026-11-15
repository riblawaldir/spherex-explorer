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
        Observation metadata
      </h2>
      {o ? (
        <>
          <div className="preview-wrap">
            {o.preview_url ? (
              <img
                src={o.preview_url}
                alt={isSimulated ? "Simulated preview" : "Observation preview"}
                className="preview-image"
                width={280}
                height={105}
              />
            ) : (
              <div className="preview-image empty-state">Preview not available.</div>
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
                        Open source
                        <ExternalLink size={10} />
                      </a>
                    ) : k === "source_url" ? (
                      "Not available"
                    ) : k === "preview_url" && v ? (
                      <a href={v} target="_blank" rel="noreferrer" className="text-primary">
                        Open preview ↗
                      </a>
                    ) : k === "preview_url" ? (
                      "Not available"
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
          <p className="text-muted-foreground text-xs leading-5 px-4 pb-4">
            {isSimulated
              ? "Simulated record. The link is mission context, not the provenance of this data."
              : "Values returned by the API. The link is the source given in source_url."}
          </p>
        </>
      ) : (
        <div className="empty-state">Select an observation to see its metadata.</div>
      )}
    </section>
  );
}
