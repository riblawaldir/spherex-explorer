import { Link, NavLink } from "react-router-dom";
import { Orbit, Compass, History, Info } from "lucide-react";
export function SimulatedBadge({ prototype = false }: { prototype?: boolean }) {
  return (
    <span className="sim-badge">
      <span className="badge-dot" />
      {prototype ? "PROTOTIPO · DATOS SIMULADOS" : "DATOS SIMULADOS"}
    </span>
  );
}
export function Header() {
  return (
    <header className="app-header">
      <Link to="/" className="brand" aria-label="SPHEREx Explorer, inicio">
        <span className="brand-icon">
          <Orbit size={35} />
        </span>
        <div>
          <div className="brand-name">
            SPHEREx <span>Explorer</span>
          </div>
          <div className="brand-caption">NASA SPACE APPS CHALLENGE 2026</div>
        </div>
      </Link>
      <nav className="main-nav" aria-label="Navegación principal">
        <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
          <Compass size={15} />
          Explorar
        </NavLink>
        <NavLink
          to="/comparacion"
          className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
        >
          <History size={15} />
          Comparación temporal
        </NavLink>
        <NavLink
          to="/acerca"
          className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
        >
          <Info size={15} />
          Acerca de
        </NavLink>
      </nav>
      <div className="header-badge">
        <SimulatedBadge prototype />
      </div>
    </header>
  );
}
