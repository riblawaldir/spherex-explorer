import type { RefObject } from "react";
import type { Observation } from "@/types/observation";
import type { DemoSpectrumSample } from "./demoCube";
import type { ThemeColors } from "./themeColor";
import { CelestialSphere } from "./CelestialSphere";
import { SpectralCube } from "./SpectralCube";
import { CameraControls, ViewFraming, type CameraNudge } from "./CameraControls";
import { fitDistance, type ViewerFrame } from "./framing";
import { AxisGizmo, ScreenLabels, type ScreenLabel } from "./overlays";

const FOV = 45;
const SCENE_RADIUS = { sphere: 1.05, cube: 1.3 } as const;
const REST_DIRECTION = { sphere: [0, 0.35, 2.6], cube: [2.2, 1.1, 1.7] } as const;

export function Scene({
  scene,
  observations,
  samples,
  selectedId,
  compareIds,
  center,
  radiusDeg,
  bandId,
  colors,
  analysis,
  reducedMotion,
  flyTarget,
  resetToken,
  nudge,
  frame,
  frameRef,
  labels,
  labelLayerRef,
  gizmoRef,
  onBusy,
  onPose,
  onSelect,
  onCursor,
}: {
  scene: "sphere" | "cube";
  observations: Observation[];
  samples: readonly DemoSpectrumSample[];
  selectedId?: string;
  compareIds: readonly string[];
  center: { ra: number; dec: number; radiusDeg: number } | null;
  radiusDeg: number | null;
  bandId: string;
  colors: ThemeColors;
  analysis: boolean;
  reducedMotion: boolean;
  flyTarget: [number, number, number] | null;
  resetToken: number;
  nudge: CameraNudge | null;
  frame: ViewerFrame | null;
  frameRef: RefObject<ViewerFrame | null>;
  labels: readonly ScreenLabel[];
  labelLayerRef: RefObject<HTMLDivElement | null>;
  gizmoRef: RefObject<SVGSVGElement | null>;
  onBusy: (busy: boolean) => void;
  onPose: (pose: { distance: number; fov: number }) => void;
  onSelect: (id: string) => void;
  onCursor: (cursor: { ra: number; dec: number } | null) => void;
}) {
  const distance = frame ? fitDistance(SCENE_RADIUS[scene], FOV, frame.height, frame.fit) : 2.6;
  return (
    <>
      <color attach="background" args={[colors.background]} />
      <fogExp2 attach="fog" args={[colors.background, reducedMotion ? 0 : 0.04]} />
      <ViewFraming fit={frame?.fit ?? null} />
      <CameraControls
        restDirection={REST_DIRECTION[scene]}
        fitDistance={distance}
        flyTarget={flyTarget}
        resetToken={resetToken}
        nudge={nudge}
        reducedMotion={reducedMotion}
        onBusy={onBusy}
        onPose={onPose}
      />
      {scene === "sphere" ? (
        <CelestialSphere
          observations={observations}
          selectedId={selectedId}
          compareIds={compareIds}
          center={center}
          radiusDeg={radiusDeg}
          colors={colors}
          reducedMotion={reducedMotion}
          onSelect={onSelect}
          onCursor={onCursor}
        />
      ) : (
        center && (
          <SpectralCube samples={samples} center={center} bandId={bandId} colors={colors} onSelect={onSelect} />
        )
      )}
      <ScreenLabels labels={labels} layerRef={labelLayerRef} frameRef={frameRef} />
      {analysis && <AxisGizmo svgRef={gizmoRef} />}
    </>
  );
}
