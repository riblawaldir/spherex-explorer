import { Info } from "lucide-react";
import type { ReactNode } from "react";
export function Sidebar({ children }: { children: ReactNode }) {
  return (
    <aside className="left-sidebar">
      <div className="glass-panel search-panel">{children}</div>
      <div className="sidebar-note">
        <Info size={14} className="shrink-0 mt-1" />
        <p>
          Las observaciones y las imágenes de este prototipo son simuladas. No representan datos
          científicos reales.
        </p>
      </div>
    </aside>
  );
}
