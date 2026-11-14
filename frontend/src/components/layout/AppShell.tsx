import type { ReactNode } from "react";
import { Header } from "./Header";
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <Header />
      {children}
      <footer className="app-footer">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          ENTORNO DE SIMULACIÓN
        </span>
        <span>
          Planet X & SPHEREx <span className="mx-2">·</span> Space Apps 2026
        </span>
        <span>Sin conexión a servicios de NASA</span>
      </footer>
    </div>
  );
}
