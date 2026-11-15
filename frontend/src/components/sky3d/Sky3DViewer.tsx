import { Component, useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import type { Observation } from "@/types/observation";
import type { Coordinates } from "@/types/search";
import { observationToMarker } from "@/lib/celestial";
import { parseSubmittedQuery } from "@/lib/aladinView";
import { createDemoSpectra } from "./demoCube";
import { DensityProvider, useDensity } from "./DensityContext";
import { Scene } from "./Scene";
import { ScreenDust } from "./ScreenDust";
import { readThemeColors, type ThemeColors } from "./themeColor";
import { ViewerInfo } from "./ViewerInfo";
import { ViewerToolbar, type Sky3DScene } from "./ViewerToolbar";
import type { CameraNudge } from "./CameraControls";

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

class CanvasGuard extends Component<
  { onFail: (message: string) => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    this.props.onFail(error.message || "WebGL failed");
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function ViewerBody({
  observations,
  selectedId,
  onSelect,
  coordinates,
  compareIds,
  isSimulated,
  hasSearched,
  onWebGLUnavailable,
}: {
  observations: Observation[];
  selectedId?: string;
  onSelect: (id: string) => void;
  coordinates: Coordinates;
  compareIds: readonly string[];
  isSimulated: boolean;
  hasSearched: boolean;
  onWebGLUnavailable: (message: string) => void;
}) {
  const { density, setDensity, toggleDensity } = useDensity();
  const [scene, setScene] = useState<Sky3DScene>("sphere");
  const [colors, setColors] = useState<ThemeColors | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [nudge, setNudge] = useState<CameraNudge | null>(null);
  const [cursor, setCursor] = useState<{ ra: number; dec: number } | null>(null);
  const [pose, setPose] = useState<{ distance: number; fov: number } | null>(null);
  const [bandId, setBandId] = useState("all");
  const query = parseSubmittedQuery(coordinates);
  const samples = useMemo(() => createDemoSpectra(observations), [observations]);
  const selected = observations.find((observation) => observation.id === selectedId);
  const flyTarget = useMemo(() => {
    if (!selected || scene !== "sphere") return null;
    const point = observationToMarker(selected, 1);
    return [point.x, point.y, point.z] as [number, number, number];
  }, [selected, scene]);

  useEffect(() => {
    setColors(readThemeColors());
  }, []);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMotion = () => setReducedMotion(motion.matches);
    applyMotion();
    motion.addEventListener("change", applyMotion);
    const applyHidden = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", applyHidden);
    return () => {
      motion.removeEventListener("change", applyMotion);
      document.removeEventListener("visibilitychange", applyHidden);
    };
  }, []);

  useEffect(() => {
    if (!detectWebGL()) onWebGLUnavailable("WebGL is unavailable. Showing the 2D map.");
  }, [onWebGLUnavailable]);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA") return;
    if (event.key === "a" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      toggleDensity();
      return;
    }
    const step = { ArrowLeft: [-1, 0, 1], ArrowRight: [1, 0, 1], ArrowUp: [0, -1, 1], ArrowDown: [0, 1, 1] } as const;
    if (event.key in step) {
      event.preventDefault();
      const [yaw, pitch, zoom] = step[event.key as keyof typeof step];
      setNudge((current) => ({ id: (current?.id ?? 0) + 1, yaw, pitch, zoom }));
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      setNudge((current) => ({ id: (current?.id ?? 0) + 1, yaw: 0, pitch: 0, zoom: 0.9 }));
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      setNudge((current) => ({ id: (current?.id ?? 0) + 1, yaw: 0, pitch: 0, zoom: 1.1 }));
    } else if (event.key === "0") {
      event.preventDefault();
      setResetToken((value) => value + 1);
    }
  }

  const analysis = density === "analysis";
  const centerText = query
    ? `RA ${query.ra.toFixed(5)}° · Dec ${query.dec.toFixed(5)}°`
    : "Search coordinates are not valid.";
  const summary = [
    scene === "sphere"
      ? `Celestial sphere with ${observations.length} observations at their RA/Dec. Not distances.`
      : `Spectral cube demo with ${samples.length} simulated samples. Not SPHEREx data.`,
    centerText,
    hasSearched && observations.length === 0 ? "No observations in this region." : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="sky3d-root"
      data-density={density}
      tabIndex={0}
      role="region"
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown + - 0 a"
      aria-label="3D sky viewer. Arrows rotate, plus and minus zoom, 0 resets, A toggles Focus and Analysis."
      onKeyDown={onKeyDown}
    >
      <p className="sr-only">{summary}</p>
      <ViewerToolbar
        scene={scene}
        density={density}
        onScene={setScene}
        onDensity={setDensity}
        onReset={() => setResetToken((value) => value + 1)}
      />
      {!colors && (
        <div className="sky3d-skeleton shimmer" role="status">
          Loading 3D view…
        </div>
      )}
      {colors && (
        <CanvasGuard onFail={onWebGLUnavailable}>
          <Canvas
            className="sky3d-canvas"
            camera={{ position: [0, 0.35, 2.6], fov: 45, near: 0.1, far: 20 }}
            dpr={[1, 1.5]}
            frameloop={hidden ? "never" : busy ? "always" : "demand"}
            gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
          >
            <Scene
              scene={scene}
              observations={observations}
              samples={samples}
              selectedId={selectedId}
              compareIds={compareIds}
              center={query}
              radiusDeg={query?.radiusDeg ?? null}
              bandId={bandId}
              colors={colors}
              analysis={analysis}
              reducedMotion={reducedMotion}
              flyTarget={flyTarget}
              resetToken={resetToken}
              nudge={nudge}
              onBusy={setBusy}
              onPose={setPose}
              onSelect={onSelect}
              onCursor={setCursor}
            />
          </Canvas>
        </CanvasGuard>
      )}
      {colors && <ScreenDust paused={reducedMotion || hidden} color={colors.foreground} />}
      <div className="sky3d-vignette" aria-hidden="true" />
      <div className="sky3d-status">
        <p className="scientific">{centerText}</p>
        {scene === "sphere" ? (
          <p>Celestial sphere: shows RA/Dec positions, not real distances.</p>
        ) : (
          <p>DEMO · SIMULATED DATA — not SPHEREx data</p>
        )}
        {isSimulated && <p className="sim-badge">SIMULATED DATA</p>}
        {hasSearched && observations.length === 0 && <p>No observations in this region.</p>}
      </div>
      <div className="sky3d-panel-slot" inert={!analysis}>
      <ViewerInfo
        center={query}
        radiusDeg={query?.radiusDeg ?? null}
        observationCount={observations.length}
        hasSearched={hasSearched}
        simulated={isSimulated}
        cursor={analysis ? cursor : null}
        pose={analysis ? pose : null}
        scene={scene}
        bandId={bandId}
        onBand={setBandId}
        demoCount={samples.length}
      />
      </div>
    </div>
  );
}

export default function Sky3DViewer(props: {
  observations: Observation[];
  selectedId?: string;
  onSelect: (id: string) => void;
  coordinates: Coordinates;
  compareIds?: readonly string[];
  isSimulated?: boolean;
  hasSearched?: boolean;
  onWebGLUnavailable?: (message: string) => void;
}) {
  return (
    <DensityProvider>
      <ViewerBody
        observations={props.observations}
        selectedId={props.selectedId}
        onSelect={props.onSelect}
        coordinates={props.coordinates}
        compareIds={props.compareIds ?? []}
        isSimulated={props.isSimulated ?? false}
        hasSearched={props.hasSearched ?? false}
        onWebGLUnavailable={props.onWebGLUnavailable ?? (() => undefined)}
      />
    </DensityProvider>
  );
}
