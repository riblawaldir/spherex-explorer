import { lazy, Suspense, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Observation } from "@/types/observation";
import type { Coordinates } from "@/types/search";
import { ViewToggle } from "./ViewToggle";
import { SkyMapFallback } from "./SkyMapFallback";

const AladinLiteMap = lazy(() => import("./AladinLiteMap"));
const Sky3DViewer = lazy(() => import("@/components/sky3d/Sky3DViewer"));

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
  const [webglNotice, setWebglNotice] = useState<string | null>(null);
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
          Mapa celeste <span className="mx-2">·</span> ICRS · J2000
        </span>
      </div>

      {webglNotice && view === "2D" && (
        <div className="map-notices" role="status">
          <p>{webglNotice}</p>
        </div>
      )}
      {view === "3D" ? (
        <Suspense
          fallback={
            <div className="map-loading" role="status">
              <Loader2 className="animate-spin text-primary" size={28} />
              <p>Loading 3D view…</p>
            </div>
          }
        >
          <Sky3DViewer
            observations={observations}
            selectedId={selectedId}
            onSelect={onSelect}
            coordinates={coordinates}
            compareIds={compareIds}
            isSimulated={isSimulated}
            hasSearched={hasSearched}
            onWebGLUnavailable={(message) => {
              setWebglNotice(message);
              setView("2D");
            }}
          />
        </Suspense>
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
