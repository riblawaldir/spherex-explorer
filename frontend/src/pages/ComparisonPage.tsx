import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useExplorer } from "@/components/layout/ExplorerContext";
import { TemporalViewerSlot } from "@/components/layout/TemporalViewerSlot";

export function ComparisonPage() {
  const { comparison, comparisonIsSimulated } = useExplorer();

  return (
    <main className="secondary-page">
      <Link to="/" className="text-muted-foreground text-xs inline-flex items-center gap-2 mb-7">
        <ArrowLeft size={14} />
        Volver a explorar
      </Link>
      <h1 className="text-[28px] font-medium">Comparación temporal</h1>
      <p className="text-muted-foreground text-sm mt-3">
        Observaciones seleccionadas · espacio reservado
      </p>
      <TemporalViewerSlot observations={comparison} isSimulated={comparisonIsSimulated} />
    </main>
  );
}
