import type { ReactNode } from "react";
import { Header } from "./Header";

function footerModeLabel(): { environment: string; connectivity: string } {
  const useMocks = import.meta.env.VITE_USE_MOCKS === "true";
  if (useMocks) {
    return {
      environment: "Entorno de simulación (VITE_USE_MOCKS)",
      connectivity: "Sin conexión a servicios de NASA",
    };
  }
  return {
    environment: "API local / fixtures",
    connectivity: "Datos vía backend (no live NASA IRSA)",
  };
}

export function AppShell({ children }: { children: ReactNode }) {
  const mode = footerModeLabel();
  return (
    <div className="app-shell">
      <Header />
      {children}
      <footer className="app-footer">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          {mode.environment}
        </span>
        <span>
          Planet X & SPHEREx <span className="mx-2">·</span> Space Apps 2026
        </span>
        <span>{mode.connectivity}</span>
      </footer>
    </div>
  );
}
