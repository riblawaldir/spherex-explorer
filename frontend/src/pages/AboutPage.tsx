import { AlertTriangle, ExternalLink, Orbit } from "lucide-react";
import { SimulatedBadge } from "@/components/layout/Header";

export function AboutPage() {
  return (
    <main className="secondary-page">
      <Orbit size={42} className="text-primary mb-6" />
      <SimulatedBadge prototype />
      <h1 className="text-[40px] font-medium mt-6">SPHEREx Explorer</h1>
      <p className="text-muted-foreground text-base mt-4 max-w-2xl leading-7">
        Prototipo visual para NASA Space Apps Challenge 2026, desafío “Planet X and SPHEREx”. Una
        propuesta de exploración de observaciones astronómicas por coordenadas, bandas y fechas.
      </p>
      <div className="border-t border-border mt-10 pt-8">
        <h2 className="text-xl">Alcance del prototipo</h2>
        <p className="text-muted-foreground text-sm leading-7 mt-4 max-w-2xl">
          Todos los registros e imágenes son simulados. No existe conexión con NASA, cálculo
          científico ni autenticación. El mapa 2D es una representación ilustrativa; la esfera
          celeste y el visor temporal son espacios reservados para una integración posterior.
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
