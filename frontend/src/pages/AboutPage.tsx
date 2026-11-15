import { AlertTriangle, ExternalLink, Orbit } from "lucide-react";

export function AboutPage() {
  return (
    <main className="secondary-page">
      <Orbit size={28} className="text-primary mb-4" />
      <h1 className="text-2xl font-semibold tracking-tight">SPHEREx Explorer</h1>
      <p className="text-muted-foreground text-sm mt-3 max-w-2xl">
        Interfaz para explorar observaciones por coordenadas, bandas y fechas en el desafío “Planet
        X and SPHEREx” de NASA Space Apps Challenge 2026. Las posiciones del mapa son las RA/Dec que
        entrega la API. El fondo del mapa 2D es DSS2 Color, el HiPS ivo://CDS/P/DSS2/color
        servido por el espejo ESA de Aladin Lite: es contexto visual, no una imagen de SPHEREx.
      </p>
      <div className="border-t border-border mt-8 pt-6">
        <h2 className="text-lg font-semibold">Alcance</h2>
        <p className="text-muted-foreground text-sm mt-3 max-w-2xl">
          Los datos simulados solo aparecen si la aplicación se ejecuta con{" "}
          <span className="scientific">VITE_USE_MOCKS=true</span>, y en ese caso llevan la etiqueta
          DATOS SIMULADOS. Esta interfaz no declara hallazgos
          astronómicos. La vista 3D coloca esas mismas RA/Dec en una esfera y, aparte, un cubo
          espectral etiquetado como demo: no son distancias ni espectros de SPHEREx.
        </p>
        <a
          href="https://science.nasa.gov/mission/spherex/"
          target="_blank"
          rel="noreferrer"
          className="text-primary text-sm inline-flex gap-2 items-center mt-4"
        >
          Conocer la misión SPHEREx
          <ExternalLink size={13} />
        </a>
      </div>
      <div className="warning-banner">
        <AlertTriangle size={16} />
        Este prototipo no produce hallazgos ni resultados científicos.
      </div>
    </main>
  );
}
