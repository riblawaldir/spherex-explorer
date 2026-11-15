import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useExplorer } from "@/components/layout/ExplorerContext";
import { TemporalViewerSlot } from "@/components/layout/TemporalViewerSlot";

export function getComparisonSummary(count: number): string {
  if (count === 0) {
    return "Selecciona observaciones desde los resultados para recorrer su secuencia temporal.";
  }

  const noun = count === 1 ? "observación" : "observaciones";
  const participle = count === 1 ? "seleccionada" : "seleccionadas";
  return `${count} ${noun} ${participle} para recorrer en orden cronológico.`;
}

export function ComparisonPage() {
  const { comparison, comparisonIsSimulated } = useExplorer();

  return (
    <main className="secondary-page">
      <Link to="/" className="text-muted-foreground text-sm inline-flex items-center gap-2 mb-5">
        <ArrowLeft size={13} />
        Volver a explorar
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Comparación temporal</h1>
      <p className="text-muted-foreground text-sm mt-2">
        {getComparisonSummary(comparison.length)}
      </p>
      <TemporalViewerSlot observations={comparison} isSimulated={comparisonIsSimulated} />
    </main>
  );
}
