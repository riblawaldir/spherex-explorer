import {
  Component,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
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
import type { Box, ViewerFrame } from "./framing";
import { AxisGizmoSvg, CUBE_LABELS, SPHERE_LABELS, type ScreenLabel } from "./overlays";

const NO_LABELS: readonly ScreenLabel[] = [];
const OVERLAY_GAP = 8;

function relativeBox(element: Element, origin: DOMRect): Box {
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left - origin.left,
    top: rect.top - origin.top,
    right: rect.right - origin.left,
    bottom: rect.bottom - origin.top,
  };
}

function measureFrame(
  root: HTMLElement,
  toolbar: HTMLElement,
  status: HTMLElement,
  panel: HTMLElement | null,
  gizmo: Element | null,
  panelOpen: boolean,
): ViewerFrame {
  const origin = root.getBoundingClientRect();
  const top = relativeBox(toolbar, origin);
  const bottom = relativeBox(status, origin);
  const region = {
    left: top.left,
    right: top.right,
    top: top.bottom + OVERLAY_GAP,
    bottom: bottom.top - OVERLAY_GAP,
  };
  const fit = { ...region };
  const blocked: Box[] = [];
  if (gizmo) blocked.push(relativeBox(gizmo, origin));
  if (panel) {
    const box = relativeBox(panel, origin);
    blocked.push(box);
    const besideRight = box.left - OVERLAY_GAP;
    if (panelOpen && besideRight - region.left >= (region.bottom - region.top) * 0.85) fit.right = besideRight;
  }
  return { width: origin.width, height: origin.height, region, fit, blocked };
}

function sameBox(a: Box, b: Box): boolean {
  return (
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.right - b.right) < 0.5 &&
    Math.abs(a.bottom - b.bottom) < 0.5
  );
}

function sameFrame(a: ViewerFrame | null, b: ViewerFrame): boolean {
  return (
    a !== null &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5 &&
    sameBox(a.region, b.region) &&
    sameBox(a.fit, b.fit) &&
    a.blocked.length === b.blocked.length &&
    a.blocked.every((box, index) => sameBox(box, b.blocked[index]))
  );
}

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
  const [panelOpen, setPanelOpen] = useState(
    () => typeof window === "undefined" || !window.matchMedia("(max-width: 700px)").matches,
  );
  const [frame, setFrame] = useState<ViewerFrame | null>(null);
  const frameRef = useRef<ViewerFrame | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const gizmoRef = useRef<SVGSVGElement>(null);
  const labelLayerRef = useRef<HTMLDivElement>(null);
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

  const analysis = density === "analysis";

  useLayoutEffect(() => {
    const root = rootRef.current;
    const toolbar = toolbarRef.current;
    const status = statusRef.current;
    if (!root || !toolbar || !status) return;
    const measure = () => {
      const next = measureFrame(root, toolbar, status, analysis ? panelRef.current : null, gizmoRef.current, panelOpen);
      if (sameFrame(frameRef.current, next)) return;
      frameRef.current = next;
      setFrame(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const element of [root, toolbar, status, panelRef.current, gizmoRef.current]) {
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [analysis, panelOpen, scene]);

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

  const labels = analysis ? (scene === "sphere" ? SPHERE_LABELS : CUBE_LABELS) : NO_LABELS;
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
      ref={rootRef}
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
        toolbarRef={toolbarRef}
        scene={scene}
        density={density}
        onScene={(next) => {
          if (next === scene) return;
          setScene(next);
          setResetToken((value) => value + 1);
        }}
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
              frame={frame}
              frameRef={frameRef}
              labels={labels}
              labelLayerRef={labelLayerRef}
              gizmoRef={gizmoRef}
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
      <div ref={labelLayerRef} className="sky3d-labels" aria-hidden="true">
        {labels.map((label) => (
          <span key={label.id} className="sky3d-grid-label">
            {label.text}
          </span>
        ))}
      </div>
      <div className="sky3d-bottom">
        {analysis && <AxisGizmoSvg svgRef={gizmoRef} />}
        <div ref={statusRef} className="sky3d-status">
          <p className="scientific">{centerText}</p>
          {scene === "sphere" ? (
            <p>Celestial sphere: shows RA/Dec positions, not real distances.</p>
          ) : (
            <p>DEMO · SIMULATED DATA — not SPHEREx data</p>
          )}
          {isSimulated && <p className="sim-badge">SIMULATED DATA</p>}
          {hasSearched && observations.length === 0 && <p>No observations in this region.</p>}
        </div>
      </div>
      {analysis && (
        <div ref={panelRef} className="sky3d-panel-slot">
          <ViewerInfo
            open={panelOpen}
            onToggle={() => setPanelOpen((value) => !value)}
            radiusDeg={query?.radiusDeg ?? null}
            observationCount={observations.length}
            cursor={cursor}
            pose={pose}
            scene={scene}
            bandId={bandId}
            onBand={setBandId}
            demoCount={samples.length}
          />
        </div>
      )}
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
