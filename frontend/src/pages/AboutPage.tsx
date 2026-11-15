import { AlertTriangle, ExternalLink, Orbit } from "lucide-react";

export function AboutPage() {
  return (
    <main className="secondary-page">
      <Orbit size={42} className="text-primary mb-6" />
      <h1 className="text-[40px] font-medium mt-6">SPHEREx Explorer</h1>
      <p className="text-muted-foreground text-base mt-4 max-w-2xl leading-7">
        Interfaz para explorar observaciones por coordenadas, bandas y fechas en el desafío “Planet
        X and SPHEREx” de NASA Space Apps Challenge 2026. Las posiciones del mapa son las RA/Dec que
        entrega la API. El fondo del mapa 2D es el survey HiPS DSS2 Color de Aladin Lite: es
        contexto visual, no una imagen de SPHEREx.
      </p>
      <div className="border-t border-border mt-10 pt-8">
        <h2 className="text-xl">Alcance</h2>
        <p className="text-muted-foreground text-sm leading-7 mt-4 max-w-2xl">
          Los datos simulados solo aparecen si la aplicación se ejecuta con VITE_USE_MOCKS=true, y
          en ese caso llevan la etiqueta DATOS SIMULADOS. Esta interfaz no declara hallazgos
          astronómicos. La vista 3D todavía es un espacio reservado.
        </p>
        <a
          href="https://science.nasa.gov/mission/spherex/"
          target="_blank"
          rel="noreferrer"
          className="text-primary text-sm inline-flex gap-2 items-center mt-6"
        >
          Conocer la misión SPHEREx
          <ExternalLink size={14} />
        </a>
      </div>
      <div className="warning-banner">
        <AlertTriangle size={18} />
        Este prototipo no produce hallazgos ni resultados científicos.
      </div>
    </main>
  );
}
