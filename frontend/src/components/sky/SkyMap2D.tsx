import { useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import {
  Plus,
  Minus,
  LocateFixed,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import sky from "@/assets/simulated-sky.jpg";
import type { Observation } from "@/types/observation";
import type { Coordinates } from "@/types/search";
import { ViewToggle } from "./ViewToggle";
import { SkyView3DPlaceholder } from "./SkyView3DPlaceholder";
export function SkyMap2D({
  observations,
  selectedId,
  onSelect,
  coordinates,
}: {
  observations: Observation[];
  selectedId?: string | undefined;
  onSelect: (id: string) => void;
  coordinates: Coordinates;
}) {
  const [view, setView] = useState<"2D" | "3D">("2D");
  const [scale, setScale] = useState(1);
  // TODO: integrar Aladin Lite aquí. All markers are illustrative, not scientifically projected.
  return (
    <section className="map-panel" aria-label="Mapa celeste simulado">
      <div className="map-toolbar">
        <ViewToggle view={view} onChange={setView} />
        <span className="map-title">
          MAPA CELESTE <span className="mx-2">/</span> ICRS · J2000
        </span>
      </div>
      {view === "3D" ? (
        <SkyView3DPlaceholder />
      ) : (
        <TransformWrapper
          minScale={1}
          maxScale={4}
          initialScale={1}
          wheel={{ step: 0.05 }}
          onTransform={(_, state) => setScale(state.scale)}
          panning={{ excluded: ["button"] }}
        >
          {({ zoomIn, zoomOut, resetTransform, setTransform, instance }) => (
            <>
              <TransformComponent
                wrapperStyle={{ width: "100%", height: "100%" }}
                contentStyle={{ width: "100%", height: "100%" }}
              >
                <div className="sky-scene">
                  <img
                    src={sky}
                    className="sky-image"
                    alt="Campo estelar simulado"
                    width={1920}
                    height={1088}
                  />
                  <div className="sky-grid" />
                  <div className="target-reticle" />
                  {observations.map((o, i) => (
                    <Button
                      variant="ghost"
                      key={o.id}
                      title={`${o.id} · ${o.band}`}
                      aria-label={`Seleccionar marcador ${o.id}`}
                      onClick={() => onSelect(o.id)}
                      className={`map-marker ${selectedId === o.id ? "selected" : ""} ${o.collection === "QR3" ? "violet-marker" : ""}`}
                      style={{
                        left: `${[50, 67, 30, 72, 38, 56][i % 6]}%`,
                        top: `${[47, 32, 39, 61, 70, 73][i % 6]}%`,
                      }}
                    >
                      {selectedId === o.id && (
                        <span className="marker-label">
                          {o.id} · {o.band}
                        </span>
                      )}
                    </Button>
                  ))}
                </div>
              </TransformComponent>
              <div className="map-controls">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Acercar"
                  aria-label="Acercar"
                  onClick={() => zoomIn()}
                >
                  <Plus />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Alejar"
                  aria-label="Alejar"
                  onClick={() => zoomOut()}
                >
                  <Minus />
                </Button>
                <div className="border-t border-border" />
                <Button
                  variant="ghost"
                  size="icon"
                  title="Centrar mapa"
                  aria-label="Centrar mapa"
                  onClick={() => resetTransform()}
                >
                  <LocateFixed />
                </Button>
                <div className="border-t border-border" />
                {[
                  { Icon: ChevronUp, x: 0, y: 50, label: "Desplazar arriba" },
                  { Icon: ChevronDown, x: 0, y: -50, label: "Desplazar abajo" },
                  { Icon: ChevronLeft, x: 50, y: 0, label: "Desplazar izquierda" },
                  { Icon: ChevronRight, x: -50, y: 0, label: "Desplazar derecha" },
                ].map(({ Icon, x, y, label }) => (
                  <Button
                    key={label}
                    variant="ghost"
                    size="icon"
                    title={label}
                    aria-label={label}
                    onClick={() =>
                      setTransform(
                        instance.state.positionX + x,
                        instance.state.positionY + y,
                        scale,
                      )
                    }
                  >
                    <Icon />
                  </Button>
                ))}
              </div>
            </>
          )}
        </TransformWrapper>
      )}
      <div className="map-legend">
        <span>
          <i className="legend-dot" />
          DR1
        </span>
        <span>
          <i className="legend-dot violet" />
          QR3
        </span>
        <span className="text-warning">DATOS SIMULADOS</span>
      </div>
      <div className="map-status">
        <span>
          RA {Number(coordinates.ra).toFixed(5)}°{" "}
          <span className="mx-2">DEC {Number(coordinates.dec).toFixed(5)}°</span>
        </span>
        <span>
          {view === "2D" ? `${scale.toFixed(1)}×` : "3D"} <span className="mx-2">·</span> ICRS
        </span>
      </div>
    </section>
  );
}
