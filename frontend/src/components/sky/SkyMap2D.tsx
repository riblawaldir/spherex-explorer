import { lazy, Suspense, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Observation } from "@/types/observation";
import type { Coordinates } from "@/types/search";
import { ViewToggle } from "./ViewToggle";
import { SkyView3DPlaceholder } from "./SkyView3DPlaceholder";
import { SkyMapFallback } from "./SkyMapFallback";

const AladinLiteMap = lazy(() => import("./AladinLiteMap"));

export function SkyMap2D({
  observations,
  selectedId,
  onSelect,
  coordinates,
  compareIds = [],
  onToggleCompare,
  status = "ready",
  discardedCount = 0,
  isSimulated = false,
  errorMessage,
  hasSearched = false,
}: {
  observations: Observation[];
  selectedId?: string;
  onSelect: (id: string) => void;
  coordinates: Coordinates;
  compareIds?: string[];
  onToggleCompare?: (id: string) => void;
  status?: "loading" | "ready" | "error";
  discardedCount?: number;
  isSimulated?: boolean;
  errorMessage?: string;
  hasSearched?: boolean;
}) {
  const [view, setView] = useState<"2D" | "3D">("2D");
  const [aladinError, setAladinError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const shared = {
    observations,
    selectedId,
    compareIds,
    onSelect,
    onToggleCompare,
    coordinates,
    status,
    discardedCount,
    isSimulated,
    errorMessage,
    hasSearched,
  };

  return (
    <section className="map-panel" aria-label="Mapa celeste">
      <div className="map-toolbar">
        <ViewToggle view={view} onChange={setView} />
        <span className="map-title">
          MAPA CELESTE <span className="mx-2">/</span> ICRS · J2000
        </span>
      </div>

      {view === "3D" ? (
        <SkyView3DPlaceholder />
      ) : aladinError ? (
        <SkyMapFallback
          {...shared}
          failureMessage={aladinError}
          onRetry={() => {
            setAladinError(null);
            setRetryKey((value) => value + 1);
          }}
        />
      ) : (
        <Suspense
          fallback={
            <div className="map-loading" role="status">
              <Loader2 className="animate-spin text-primary" size={28} />
              <p>Cargando mapa…</p>
            </div>
          }
        >
          <AladinLiteMap
            key={retryKey}
            {...shared}
            onError={(error) => setAladinError(error.message)}
          />
        </Suspense>
      )}
    </section>
  );
}
