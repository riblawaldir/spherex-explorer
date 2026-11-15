import { Link, NavLink } from "react-router-dom";
import { Compass, History, Info } from "lucide-react";
import logo from "@/assets/spherex-explorer-logo.png";
export function SimulatedBadge({ prototype = false }: { prototype?: boolean }) {
  return (
    <span className="sim-badge">
      <span className="badge-dot" />
      {prototype ? "PROTOTYPE · SIMULATED DATA" : "SIMULATED DATA"}
    </span>
  );
}
export function Header() {
  const showSimulated = import.meta.env.VITE_USE_MOCKS === "true";
  return (
    <header className="app-header">
      <Link to="/" className="brand" aria-label="SPHEREx Explorer, home">
        <img src={logo} alt="" className="brand-logo" width={244} height={54} />
      </Link>
      <nav className="main-nav" aria-label="Main navigation">
        <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
          <Compass size={15} />
          Explore
        </NavLink>
        <NavLink
          to="/comparacion"
          className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
        >
          <History size={15} />
          Temporal comparison
        </NavLink>
        <NavLink
          to="/acerca"
          className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
        >
          <Info size={15} />
          About
        </NavLink>
      </nav>
      <div className="header-badge">{showSimulated ? <SimulatedBadge prototype /> : null}</div>
    </header>
  );
}
