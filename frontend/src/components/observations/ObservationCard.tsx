import { Button } from "@/components/ui/button";
import type { Observation } from "@/types/observation";
export function ObservationCard({
  observation: o,
  active,
  checked,
  onSelect,
  onCheck,
}: {
  observation: Observation;
  active: boolean;
  checked: boolean;
  onSelect: (id: string) => void;
  onCheck: (id: string) => void;
}) {
  return (
    <article className={`observation-card ${active ? "selected" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onCheck(o.id)}
        aria-label={`Comparar ${o.id}`}
      />
      <Button
        variant="ghost"
        className="card-select"
        onClick={() => onSelect(o.id)}
        aria-pressed={active}
      >
        <div className="w-full">
          <div className="flex items-center justify-between gap-1">
            <span className="observation-date">{o.observed_at.slice(0, 10)}</span>
            <div className="flex gap-1">
              <span className="data-chip">{o.band}</span>
              <span className="scientific text-xs text-muted-foreground pt-0.5">
                {o.collection}
              </span>
            </div>
          </div>
          <p className="scientific text-xs text-muted-foreground mt-2">
            RA {o.ra.toFixed(5)}° <span className="mx-1">·</span> Dec {o.dec.toFixed(5)}°
          </p>
        </div>
      </Button>
    </article>
  );
}
