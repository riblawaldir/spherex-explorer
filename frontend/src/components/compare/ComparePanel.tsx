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

const EMPTY_CANDIDATES: Observation[] = [];
const EMPTY_IDS: string[] = [];

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
  const geometricOnly = data.science?.photometric_equivalence === false;
  const comparable = data.status === "comparable" && !geometricOnly;
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
      {geometricOnly ? (
        <p className="mt-2 text-muted-foreground text-xs">
          El estado {data.status} describe metadatos y geometría. No es
          equivalencia fotométrica ni variabilidad.
        </p>
      ) : null}
      <p className="mt-2 text-muted-foreground text-xs">
        Par <span className="font-mono text-foreground">{data.obs_id_a}</span>
        {" · "}
        <span className="font-mono text-foreground">{data.obs_id_b}</span>
      </p>
    </div>
  );
}

export function ComparePanel({
  candidates = EMPTY_CANDIDATES,
  preferredIds = EMPTY_IDS,
}: ComparePanelProps) {
  const defaults = useMemo(
    () => pickDefaults(preferredIds, candidates),
    [preferredIds, candidates],
  );
  const [obsIdA, setObsIdA] = useState(defaults[0]);
  const [obsIdB, setObsIdB] = useState(defaults[1]);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [result, setResult] = useState<CompareApiResult | null>(null);
  const [scientific, setScientific] = useState<{status: string; criteria: Array<{name: string; status: string; reason: string; limitations: string[]}>} | null>(null);
  const [scientificError, setScientificError] = useState<string | null>(null);
  const [realData, setRealData] = useState<Array<{obs_id: string; collection: string; detector: string; date_obs: string; size_bytes: number; sha256: string; source_url: string; extensions: Array<{name: string; bunit: string | null; wcs_status: string}>}>>([]);

  useEffect(() => {
    fetch('/api/real-data-demo').then(response => response.ok ? response.json() : null)
      .then(data => { if (data && Array.isArray(data.observations)) setRealData(data.observations); })
      .catch(() => setRealData([]));
  }, []);

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
    setScientific(null);
    setScientificError(null);
    const [next, science] = await Promise.all([
      fetchCompare({ obsIdA, obsIdB }),
      fetch('/api/scientific-validation', { method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({observation_1: obsIdA.trim(), observation_2: obsIdB.trim()}) })
        .then(async response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
        .catch(error => { setScientificError(String(error)); return null; }),
    ]);
    setResult(next);
    setScientific(science);
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
            con dos <span className="font-mono text-xs">obs_id</span>.
            El resultado de compare describe la alineación técnica. La validación
            científica se informa por separado y puede requerir revisión, sin imágenes residuales inventadas.
            Comparable no es equivalencia fotométrica ni una detección de variabilidad.

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
      {realData.length === 2 ? <div className="mt-4 rounded border border-border p-3 text-sm">
        <h3 className="font-medium">Datos IRSA locales verificados</h3>
        <p>Recortes verificados por SHA-256; los enlaces conducen a las imágenes originales de IRSA.</p>
        <button type="button" className="underline" onClick={() => {setObsIdA(realData[0]!.obs_id); setObsIdB(realData[1]!.obs_id);}}>Seleccionar los dos recortes</button>
        {realData.map(item => <details key={item.obs_id} className="mt-2"><summary>{item.obs_id} · {item.collection} · {item.detector}</summary>
          <p>{item.date_obs} · {item.size_bytes} bytes</p><p className="break-all">SHA-256: {item.sha256}</p>
          <a href={item.source_url} target="_blank" rel="noreferrer" className="underline">Producto original IRSA</a>
          <p>{item.extensions.map(h => `${h.name}${h.bunit ? ` (${h.bunit})` : ''} [${h.wcs_status}]`).join(' · ')}</p>
          <img src={`/api/preview/${encodeURIComponent(item.obs_id)}`} alt={`Vista previa de ${item.obs_id}`} className="max-w-48" />
        </details>)}
      </div> : null}
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
          <p className="text-sm font-medium">Resultado técnico — no certifica compatibilidad científica</p>
          <StatusBanner result={result} />
          <div className="rounded border border-border px-3 py-2 text-sm" aria-label="Validación científica">
            <h3 className="font-medium">Validación científica</h3>
            {scientific ? <><p>{scientific.status}</p><ul>{scientific.criteria.map(c => <li key={c.name}><strong>{c.name}: {c.status}</strong> — {c.reason} {c.limitations.join(' ')}</li>)}</ul></> : <p>{scientificError || 'No disponible'}</p>}
          </div>
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

              {result.data.science ? (
                <div className="rounded border border-warning/30 bg-warning/5 px-3 py-2 text-sm">
                  <h3 className="text-sm font-medium mb-1">
                    Estado científico
                    {result.data.science.category
                      ? ` · categoría ${result.data.science.category}`
                      : ""}
                  </h3>
                  <p className="text-muted-foreground text-xs leading-5">
                    Espectro: {result.data.science.spectral_comparability ?? "not_certified"}.
                    Resta validada: {result.data.science.subtraction_validated ? "sí" : "no"}.
                    Variabilidad evaluada:{" "}
                    {result.data.science.variability_assessed ? "sí" : "no"}.
                  </p>
                  {result.data.science.warnings && result.data.science.warnings.length > 0 ? (
                    <ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground">
                      {result.data.science.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

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
