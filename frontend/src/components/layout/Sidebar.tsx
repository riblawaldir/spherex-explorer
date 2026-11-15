import { Info } from "lucide-react";
import type { ReactNode } from "react";
export function Sidebar({ children }: { children: ReactNode }) {
  return (
    <aside className="left-sidebar">
      <div className="glass-panel search-panel">{children}</div>
      <div className="sidebar-note">
        <Info size={14} className="shrink-0 mt-1" />
        <p>
          El fondo del mapa es un survey de contexto visual, no una imagen de SPHEREx. Las posiciones
          usan la RA/Dec de cada observación. Si hay datos simulados, aparecen con la etiqueta DATOS
          SIMULADOS.
        </p>
      </div>
    </aside>
  );
}
