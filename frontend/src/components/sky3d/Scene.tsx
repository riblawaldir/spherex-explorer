import { useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Observation } from "@/types/observation";
import type { DemoSpectrumSample } from "./demoCube";
import type { ThemeColors } from "./themeColor";
import { Polyline } from "./lines";
import { CelestialSphere } from "./CelestialSphere";
import { SpectralCube } from "./SpectralCube";
import { CameraControls, type CameraNudge } from "./CameraControls";

function AxisGizmo({ colors }: { colors: ThemeColors }) {
  const ref = useRef<THREE.Group>(null);
  const camera = useThree((state) => state.camera);
  const offset = useMemo(() => new THREE.Vector3(0.62, -0.42, -1.5), []);
  const scratch = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const group = ref.current;
    if (!group) return;
    scratch.copy(offset).applyQuaternion(camera.quaternion).add(camera.position);
    group.position.copy(scratch);
    group.quaternion.identity();
  });
  const arm = (end: [number, number, number], color: string, label: string) => (
    <group key={label}>
      <Polyline positions={[0, 0, 0, ...end]} color={color} />
      <Html position={end} center zIndexRange={[1, 0]} style={{ pointerEvents: "none" }}>
        <span className="sky3d-grid-label">{label}</span>
      </Html>
    </group>
  );
  return (
    <group ref={ref} scale={0.16}>
      {arm([1, 0, 0], colors.primary, "X")}
      {arm([0, 1, 0], colors.violet, "Y")}
      {arm([0, 0, 1], colors.muted, "Z")}
    </group>
  );
}

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
  onBusy: (busy: boolean) => void;
  onPose: (pose: { distance: number; fov: number }) => void;
  onSelect: (id: string) => void;
  onCursor: (cursor: { ra: number; dec: number } | null) => void;
}) {
  return (
    <>
      <color attach="background" args={[colors.background]} />
      <fogExp2 attach="fog" args={[colors.background, reducedMotion ? 0 : 0.04]} />
      <CameraControls
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
          showLabels={analysis}
          reducedMotion={reducedMotion}
          onSelect={onSelect}
          onCursor={onCursor}
        />
      ) : (
        center && (
          <SpectralCube
            samples={samples}
            center={center}
            bandId={bandId}
            colors={colors}
            showLabels={analysis}
            onSelect={onSelect}
          />
        )
      )}
      {analysis && <AxisGizmo colors={colors} />}
    </>
  );
}
