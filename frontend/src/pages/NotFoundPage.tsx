import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="scientific text-muted-foreground">404</h1>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Página no encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La página que buscas no existe o se ha movido.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Volver a explorar
          </Link>
        </div>
      </div>
    </main>
  );
}
