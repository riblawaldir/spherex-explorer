import { Html } from "@react-three/drei";
import { spectralPosition } from "@/lib/spectralSpace";
import { Polyline } from "./lines";
import type { DemoSpectrumSample } from "./demoCube";
import type { ThemeColors } from "./themeColor";

function Axis({
  end,
  color,
  label,
}: {
  end: [number, number, number];
  color: string;
  label: string;
}) {
  const positions = [0, 0, 0, ...end];
  return (
    <group>
      <Polyline positions={positions} color={color} />
      <Html position={end} center zIndexRange={[1, 0]} style={{ pointerEvents: "none" }}>
        <span className="sky3d-grid-label">{label}</span>
      </Html>
    </group>
  );
}

export function SpectralCube({
  samples,
  center,
  bandId,
  colors,
  showLabels,
  onSelect,
}: {
  samples: readonly DemoSpectrumSample[];
  center: { ra: number; dec: number; radiusDeg: number };
  bandId: string;
  colors: ThemeColors;
  showLabels: boolean;
  onSelect: (id: string) => void;
}) {
  const visible = samples.filter((sample) => bandId === "all" || sample.bandId === bandId);
  return (
    <group>
      <Axis end={[1.15, 0, 0]} color={colors.primary} label={showLabels ? "RA" : ""} />
      <Axis end={[0, 1.15, 0]} color={colors.violet} label={showLabels ? "Dec" : ""} />
      <Axis end={[0, 0, 1.15]} color={colors.muted} label={showLabels ? "λ (µm)" : ""} />
      {visible.map((sample) => {
        const point = spectralPosition(sample.ra, sample.dec, sample.wavelengthUm, center);
        return (
          <mesh
            key={`${sample.observationId}-${sample.bandId}`}
            position={[point.x, point.y, point.z]}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(sample.observationId);
            }}
          >
            <sphereGeometry args={[0.045, 12, 12]} />
            <meshBasicMaterial
              color={colors.primary}
              transparent
              opacity={0.35 + sample.amplitude * 0.6}
            />
          </mesh>
        );
      })}
    </group>
  );
}
