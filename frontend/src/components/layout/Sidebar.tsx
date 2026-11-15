import { Info } from "lucide-react";
import type { ReactNode } from "react";
export function Sidebar({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <aside className="left-sidebar">
      <div className="glass-panel search-panel">
        <div className="search-panel-body">{children}</div>
        {footer && <div className="search-panel-footer">{footer}</div>}
      </div>
      <div className="sidebar-note">
        <Info size={14} className="shrink-0 mt-1" />
        <p>
          The map background is a visual-context survey, not a SPHEREx image. Positions use each
          observation's RA/Dec. Simulated data, if any, carries the SIMULATED DATA label.
        </p>
      </div>
    </aside>
  );
}
