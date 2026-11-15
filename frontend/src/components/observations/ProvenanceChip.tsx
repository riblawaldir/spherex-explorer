import { cn } from "@/lib/utils";
import { describeProvenance, type ProvenanceKind } from "@/lib/provenance";

const toneClass: Record<ProvenanceKind, string> = {
  stub: "border-warning/30 bg-warning/10 text-warning",
  cached_sample: "border-border bg-secondary text-muted-foreground",
  live: "border-success/30 bg-success/10 text-success",
  unknown: "border-border bg-muted/40 text-muted-foreground",
};

export function ProvenanceChip({
  provenance,
  className,
}: {
  provenance?: string | null;
  className?: string;
}) {
  const info = describeProvenance(provenance);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[0.65rem] font-medium tracking-normal leading-none whitespace-nowrap",
        toneClass[info.kind],
        className,
      )}
      title={info.title}
      aria-label={`Provenance: ${info.token}. ${info.title}`}
      data-provenance={info.kind}
    >
      {info.token}
    </span>
  );
}
