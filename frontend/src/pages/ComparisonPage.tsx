import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useExplorer } from "@/components/layout/ExplorerContext";
import { TemporalViewerSlot } from "@/components/layout/TemporalViewerSlot";

export function getComparisonSummary(count: number): string {
  if (count === 0) {
    return "Select observations from the results to step through their time sequence.";
  }

  const noun = count === 1 ? "observation" : "observations";
  return `${count} ${noun} selected to step through in chronological order.`;
}

export function ComparisonPage() {
  const { comparison, comparisonIsSimulated } = useExplorer();

  return (
    <main className="secondary-page">
      <Link to="/" className="text-muted-foreground text-sm inline-flex items-center gap-2 mb-5">
        <ArrowLeft size={13} />
        Back to explore
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Temporal comparison</h1>
      <p className="text-muted-foreground text-sm mt-2">
        {getComparisonSummary(comparison.length)}
      </p>
      <TemporalViewerSlot observations={comparison} isSimulated={comparisonIsSimulated} />
    </main>
  );
}
