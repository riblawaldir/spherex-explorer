import { spectralPosition } from "@/lib/spectralSpace";
import { Polyline } from "./lines";
import type { DemoSpectrumSample } from "./demoCube";
import type { ThemeColors } from "./themeColor";

export function SpectralCube({
  samples,
  center,
  bandId,
  colors,
  onSelect,
}: {
  samples: readonly DemoSpectrumSample[];
  center: { ra: number; dec: number; radiusDeg: number };
  bandId: string;
  colors: ThemeColors;
  onSelect: (id: string) => void;
}) {
  const visible = samples.filter((sample) => bandId === "all" || sample.bandId === bandId);
  return (
    <group>
      <Polyline positions={[0, 0, 0, 1.15, 0, 0]} color={colors.primary} />
      <Polyline positions={[0, 0, 0, 0, 1.15, 0]} color={colors.violet} />
      <Polyline positions={[0, 0, 0, 0, 0, 1.15]} color={colors.muted} />
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
