import { useEffect, useMemo, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { observationToMarker } from "@/lib/celestial";
import { contains, intersects, type Box, type ViewerFrame } from "./framing";

export interface ScreenLabel {
  id: string;
  text: string;
  position: [number, number, number];
  /** Hide the label when its point faces away from the camera (sphere surface). */
  facing?: boolean;
}

const SPHERE_GRID = [
  { ra: 0, dec: 0, text: "RA 0°" },
  { ra: 90, dec: 0, text: "RA 90°" },
  { ra: 180, dec: 0, text: "RA 180°" },
  { ra: 270, dec: 0, text: "RA 270°" },
  { ra: 0, dec: 60, text: "Dec +60°" },
  { ra: 0, dec: -60, text: "Dec −60°" },
];

export const SPHERE_LABELS: ScreenLabel[] = SPHERE_GRID.map((label) => {
  const point = observationToMarker(label, 1.04);
  return { id: label.text, text: label.text, position: [point.x, point.y, point.z], facing: true };
});

export const CUBE_LABELS: ScreenLabel[] = [
  { id: "ra", text: "RA", position: [1.27, 0, 0] },
  { id: "dec", text: "Dec", position: [0, 1.27, 0] },
  { id: "lambda", text: "λ (µm)", position: [0, 0, 1.27] },
];

const MIN_FACING = 0.25;
const PAD = 4;

/** Places DOM labels over the canvas, dropping any that leave the free region, hit an overlay or crowd another label. */
export function ScreenLabels({
  labels,
  layerRef,
  frameRef,
}: {
  labels: readonly ScreenLabel[];
  layerRef: RefObject<HTMLDivElement | null>;
  frameRef: RefObject<ViewerFrame | null>;
}) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  const point = useMemo(() => new THREE.Vector3(), []);
  const toCamera = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    invalidate();
  }, [labels, invalidate]);

  useFrame(() => {
    const layer = layerRef.current;
    const frame = frameRef.current;
    if (!layer) return;
    const spans = layer.children as HTMLCollectionOf<HTMLElement>;
    const candidates: { index: number; x: number; y: number; depth: number }[] = [];
    labels.forEach((label, index) => {
      const span = spans[index];
      if (!span) return;
      point.set(...label.position);
      if (label.facing) {
        toCamera.copy(camera.position).sub(point).normalize();
        if (toCamera.dot(point.clone().normalize()) < MIN_FACING) {
          span.style.visibility = "hidden";
          return;
        }
      }
      const depth = camera.position.distanceTo(point);
      point.project(camera);
      if (point.z > 1) {
        span.style.visibility = "hidden";
        return;
      }
      candidates.push({
        index,
        x: ((point.x + 1) / 2) * size.width,
        y: ((1 - point.y) / 2) * size.height,
        depth,
      });
    });
    candidates.sort((a, b) => a.depth - b.depth);
    const taken: Box[] = [...(frame?.blocked ?? [])];
    for (const candidate of candidates) {
      const span = spans[candidate.index];
      const width = span.offsetWidth;
      const height = span.offsetHeight;
      const box = {
        left: candidate.x - width / 2 - PAD,
        right: candidate.x + width / 2 + PAD,
        top: candidate.y - height / 2 - PAD,
        bottom: candidate.y + height / 2 + PAD,
      };
      const fits = !frame || contains(frame.region, box);
      if (!fits || taken.some((other) => intersects(other, box))) {
        span.style.visibility = "hidden";
        continue;
      }
      taken.push(box);
      span.style.transform = `translate(${candidate.x - width / 2}px, ${candidate.y - height / 2}px)`;
      span.style.visibility = "visible";
    }
  });

  return null;
}

const GIZMO_ARM = 18;

/** Drives the fixed-size SVG axis gizmo from the camera orientation. */
export function AxisGizmo({ svgRef }: { svgRef: RefObject<SVGSVGElement | null> }) {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const inverse = useMemo(() => new THREE.Quaternion(), []);
  const axis = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    invalidate();
  }, [invalidate]);

  useFrame(() => {
    const svg = svgRef.current;
    if (!svg) return;
    inverse.copy(camera.quaternion).invert();
    svg.querySelectorAll<SVGGElement>("[data-axis]").forEach((group) => {
      const index = Number(group.dataset.axis);
      axis.set(index === 0 ? 1 : 0, index === 1 ? 1 : 0, index === 2 ? 1 : 0).applyQuaternion(inverse);
      const x = axis.x * GIZMO_ARM;
      const y = -axis.y * GIZMO_ARM;
      const line = group.querySelector("line");
      const text = group.querySelector("text");
      line?.setAttribute("x2", x.toFixed(2));
      line?.setAttribute("y2", y.toFixed(2));
      text?.setAttribute("x", (x * 1.32).toFixed(2));
      text?.setAttribute("y", (y * 1.32).toFixed(2));
      group.style.opacity = axis.z < -0.2 ? "0.45" : "1";
    });
  });

  return null;
}

export function AxisGizmoSvg({ svgRef }: { svgRef: RefObject<SVGSVGElement | null> }) {
  return (
    <svg ref={svgRef} className="sky3d-gizmo" viewBox="-32 -32 64 64" width={64} height={64} aria-hidden="true">
      {(["X", "Y", "Z"] as const).map((label, index) => (
        <g key={label} data-axis={index} className={`sky3d-gizmo-axis axis-${label.toLowerCase()}`}>
          <line x1={0} y1={0} x2={0} y2={0} />
          <text textAnchor="middle" dominantBaseline="central">
            {label}
          </text>
        </g>
      ))}
    </svg>
  );
}
