import { useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Polyline, SegmentLines } from "./lines";
import {
  graticulePositions,
  observationToMarker,
  searchCirclePositions,
  unitVectorToRaDec,
} from "@/lib/celestial";
import type { Observation } from "@/types/observation";
import type { ThemeColors } from "./themeColor";

const MARKER_RADIUS = 1.02;

function Marker({
  observation,
  selected,
  compared,
  reducedMotion,
  colors,
  onSelect,
}: {
  observation: Observation;
  selected: boolean;
  compared: boolean;
  reducedMotion: boolean;
  colors: ThemeColors;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const position = observationToMarker(observation, MARKER_RADIUS);
  const color = selected ? colors.primary : compared ? colors.violet : colors.foreground;
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const scale = selected && !reducedMotion ? 1 + Math.sin(clock.elapsedTime * 2.2) * 0.12 : 1;
    mesh.scale.setScalar(scale);
  });
  return (
    <group position={[position.x, position.y, position.z]}>
      {selected && (
        <mesh>
          <sphereGeometry args={[0.05, 18, 18]} />
          <meshBasicMaterial color={colors.primary} transparent opacity={0.22} depthWrite={false} />
        </mesh>
      )}
      <mesh
        ref={ref}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(observation.id);
        }}
      >
        <sphereGeometry args={[0.02, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

const GRID_LABELS = [
  { ra: 0, dec: 0, text: "RA 0°" },
  { ra: 90, dec: 0, text: "RA 90°" },
  { ra: 180, dec: 0, text: "RA 180°" },
  { ra: 270, dec: 0, text: "RA 270°" },
  { ra: 0, dec: 60, text: "Dec +60°" },
  { ra: 0, dec: -60, text: "Dec −60°" },
];

export function CelestialSphere({
  observations,
  selectedId,
  compareIds,
  center,
  radiusDeg,
  colors,
  showLabels,
  reducedMotion,
  onSelect,
  onCursor,
}: {
  observations: Observation[];
  selectedId?: string;
  compareIds: readonly string[];
  center: { ra: number; dec: number } | null;
  radiusDeg: number | null;
  colors: ThemeColors;
  showLabels: boolean;
  reducedMotion: boolean;
  onSelect: (id: string) => void;
  onCursor: (cursor: { ra: number; dec: number } | null) => void;
}) {
  const grid = useMemo(() => graticulePositions(), []);
  const circle = useMemo(
    () => (center && radiusDeg != null ? searchCirclePositions(center.ra, center.dec, radiusDeg) : []),
    [center, radiusDeg],
  );
  return (
    <group>
      <mesh
        onPointerMove={(event) => {
          event.stopPropagation();
          onCursor(unitVectorToRaDec(event.point));
        }}
        onPointerOut={() => onCursor(null)}
      >
        <sphereGeometry args={[0.995, 48, 32]} />
        <meshBasicMaterial color={colors.background} />
      </mesh>
      <SegmentLines positions={grid} color={colors.primary} opacity={0.38} />
      {circle.length > 0 && <Polyline positions={circle} color={colors.warning} />}
      {showLabels &&
        GRID_LABELS.map((label) => {
          const point = observationToMarker(label, 1.08);
          return (
            <Html key={label.text} position={[point.x, point.y, point.z]} center distanceFactor={8} style={{ pointerEvents: "none" }}>
              <span className="sky3d-grid-label">{label.text}</span>
            </Html>
          );
        })}
      {observations.map((observation) => (
        <Marker
          key={observation.id}
          observation={observation}
          selected={observation.id === selectedId}
          compared={compareIds.includes(observation.id)}
          reducedMotion={reducedMotion}
          colors={colors}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}
