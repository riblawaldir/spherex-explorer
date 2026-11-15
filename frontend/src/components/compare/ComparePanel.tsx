import { useEffect, useMemo, useState } from "react";
import { GitCompareArrows, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProvenanceChip } from "@/components/observations/ProvenanceChip";
import { fetchCompare, type CompareApiResult } from "@/services/compareApi";
import type { Observation } from "@/types/observation";

export interface ComparePanelProps {
  /** Candidate obs_ids from current selection / results (may be empty). */
  candidates?: Observation[];
  /** Prefill from checkbox selection when exactly two (or more) are chosen. */
  preferredIds?: string[];
}

function pickDefaults(preferred: string[], candidates: Observation[]): [string, string] {
  const fromPreferred = preferred.filter(Boolean);
  if (fromPreferred.length >= 2) {
    return [fromPreferred[0]!, fromPreferred[1]!];
  }
  const ids = candidates.map((o) => o.id);
  if (ids.length >= 2) return [ids[0]!, ids[1]!];
  if (ids.length === 1) return [ids[0]!, ""];
  return ["", ""];
}

function StatusBanner({ result }: { result: CompareApiResult }) {
  if (!result.ok) {
    return (
      <div
        className="rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
        role="alert"
      >
        <p className="font-medium text-destructive">
          No se pudo comparar (HTTP {result.status || "—"})
        </p>
        <p className="mt-1 text-muted-foreground">{result.detail}</p>
        <div className="mt-2">
          <ProvenanceChip provenance={result.provenance} />
        </div>
      </div>
    );
  }

  const { data } = result;
  const comparable = data.status === "comparable";
  return (
    <div
      className={
        comparable
          ? "rounded border border-success/30 bg-success/5 px-3 py-2 text-sm"
          : "rounded border border-warning/30 bg-warning/5 px-3 py-2 text-sm"
      }
      role="status"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={
            comparable
              ? "font-mono text-sm font-semibold text-success"
              : "font-mono text-sm font-semibold text-warning"
          }
        >
          {data.status}
        </span>
        <ProvenanceChip provenance={data.provenance} />
      </div>
      <p className="mt-2 text-muted-foreground text-xs">
        Par <span className="font-mono text-foreground">{data.obs_id_a}</span>
        {" · "}
        <span className="font-mono text-foreground">{data.obs_id_b}</span>
      </p>
    </div>
  );
}

export function ComparePanel({
  candidates = [],
  preferredIds = [],
}: ComparePanelProps) {
  const defaults = useMemo(
    () => pickDefaults(preferredIds, candidates),
    [preferredIds, candidates],
  );
  const [obsIdA, setObsIdA] = useState(defaults[0]);
  const [obsIdB, setObsIdB] = useState(defaults[1]);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [result, setResult] = useState<CompareApiResult | null>(null);

  useEffect(() => {
    setObsIdA(defaults[0]);
    setObsIdB(defaults[1]);
  }, [defaults]);

  const optionIds = useMemo(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const id of [...preferredIds, ...candidates.map((c) => c.id)]) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    return ids;
  }, [preferredIds, candidates]);

  async function runCompare() {
    setStatus("loading");
    setResult(null);
    const next = await fetchCompare({ obsIdA, obsIdB });
    setResult(next);
    setStatus("done");
  }

  return (
    <section
      className="glass-panel mt-6 p-5"
      aria-label="Validación de par (API compare)"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <GitCompareArrows size={18} className="text-primary" />
            Validar par
          </h2>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
            Llama a <span className="font-mono text-xs">GET /api/compare</span>{" "}
            con dos <span className="font-mono text-xs">obs_id</span>. Muestra
            comparable / not_comparable, razones y estado de alineación/diff tal
            como responde el backend — sin imágenes residuales inventadas.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="compare-obs-a">obs_id_a</Label>
          <Input
            id="compare-obs-a"
            list="compare-obs-options"
            value={obsIdA}
            onChange={(e) => setObsIdA(e.target.value)}
            placeholder="stub-wise0855-001"
            className="font-mono text-sm"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="compare-obs-b">obs_id_b</Label>
          <Input
            id="compare-obs-b"
            list="compare-obs-options"
            value={obsIdB}
            onChange={(e) => setObsIdB(e.target.value)}
            placeholder="stub-wise0855-002"
            className="font-mono text-sm"
            autoComplete="off"
          />
        </div>
      </div>
      <datalist id="compare-obs-options">
        {optionIds.map((id) => (
          <option key={id} value={id} />
        ))}
      </datalist>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={runCompare}
          disabled={status === "loading" || !obsIdA.trim() || !obsIdB.trim()}
        >
          {status === "loading" ? (
            <>
              <RefreshCw className="animate-spin" />
              Consultando…
            </>
          ) : (
            <>
              <GitCompareArrows />
              Comparar vía API
            </>
          )}
        </Button>
        {optionIds.length >= 2 ? (
          <p className="text-xs text-muted-foreground">
            Sugerencias desde la selección actual ({optionIds.length}).
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Puedes pegar ids de fixtures conocidos aunque no estén en resultados.
          </p>
        )}
      </div>

      {result ? (
        <div className="mt-4 space-y-3">
          <StatusBanner result={result} />
          {result.ok ? (
            <>
              <div>
                <h3 className="text-sm font-medium mb-1">reasons</h3>
                <ul className="flex flex-wrap gap-1.5">
                  {result.data.reasons.map((reason) => (
                    <li
                      key={reason}
                      className="font-mono text-[0.7rem] rounded border border-border bg-secondary/60 px-1.5 py-0.5"
                    >
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded border border-border px-3 py-2 text-sm">
                  <h3 className="text-sm font-medium mb-1">alignment</h3>
                  <p className="font-mono text-xs">
                    status: {result.data.alignment.status}
                  </p>
                  <p className="text-muted-foreground text-xs mt-1 leading-5">
                    {result.data.alignment.detail}
                  </p>
                </div>
                <div className="rounded border border-border px-3 py-2 text-sm">
                  <h3 className="text-sm font-medium mb-1">diff</h3>
                  <p className="font-mono text-xs">
                    status: {result.data.diff.status}
                  </p>
                  <p className="text-muted-foreground text-xs mt-1 leading-5">
                    {result.data.diff.detail}
                  </p>
                  <div className="mt-2">
                    <ProvenanceChip provenance={result.data.diff.provenance} />
                  </div>
                  {result.data.diff.status === "not_implemented" ? (
                    <p className="mt-2 text-[0.7rem] text-muted-foreground">
                      Sin imagen residual: el backend no implementa diferencia
                      científica aún.
                    </p>
                  ) : null}
                </div>
              </div>

              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer select-none font-medium text-foreground">
                  checks (máquina)
                </summary>
                <pre className="mt-2 overflow-x-auto rounded border border-border bg-secondary/40 p-2 font-mono text-[0.65rem] leading-4">
                  {JSON.stringify(result.data.checks, null, 2)}
                </pre>
              </details>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
