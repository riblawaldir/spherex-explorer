import { Box, Grid2X2 } from "lucide-react";
import { Button } from "@/components/ui/button";
export function ViewToggle({
  view,
  onChange,
}: {
  view: "2D" | "3D";
  onChange: (v: "2D" | "3D") => void;
}) {
  return (
    <div className="view-toggle">
      {(["2D", "3D"] as const).map((v) => (
        <Button
          key={v}
          variant="ghost"
          size="sm"
          className={view === v ? "selected" : undefined}
          aria-pressed={view === v}
          onClick={() => onChange(v)}
        >
          {v === "2D" ? <Grid2X2 size={12} /> : <Box size={12} />} {v}
        </Button>
      ))}
    </div>
  );
}
