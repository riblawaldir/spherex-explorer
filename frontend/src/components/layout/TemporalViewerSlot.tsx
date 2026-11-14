import { Play, Pause, SkipBack, SkipForward, AlertTriangle, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimulatedBadge } from "@/components/layout/Header";
import type { Observation } from "@/types/observation";
export interface TemporalViewerSlotProps {
  observations: Observation[];
  selectedId?: string;
  onSelect?: (id: string) => void;
}
export function TemporalViewerSlot({ observations, selectedId }: TemporalViewerSlotProps) {
  return (
    <>
      <section className="glass-panel temporal-slot">
        <div className="flex items-center justify-between gap-3">
          <h2 className="panel-heading">
            <History />
            Visor temporal
          </h2>
          <SimulatedBadge />
        </div>
        <div className="temporal-image">
          <div className="text-center">
            <History size={28} className="mx-auto mb-4 opacity-40" />
            El visor temporal se integra aquí
          </div>
        </div>
        <div className="h-px bg-border mb-5" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {[
              { Icon: SkipBack, label: "Anterior" },
              { Icon: Play, label: "Play" },
              { Icon: Pause, label: "Pause" },
              { Icon: SkipForward, label: "Siguiente" },
            ].map(({ Icon, label }) => (
              <Button
                key={label}
                variant="ghost"
                size="icon"
                aria-label={label}
                title={label}
                disabled
              >
                <Icon />
              </Button>
            ))}
          </div>
          <div className="flex gap-3">
            <select aria-label="Velocidad" className="field w-20" disabled>
              <option>1×</option>
            </select>
            <Button variant="outline" disabled>
              Modo Blink
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground text-xs mt-4">
          {observations.length} observaciones simuladas{selectedId ? ` · ${selectedId}` : ""}
        </p>
      </section>
      <div className="warning-banner">
        <AlertTriangle size={18} className="shrink-0" />
        Una diferencia entre imágenes no implica un hallazgo astronómico sin validación científica.
      </div>
    </>
  );
}
