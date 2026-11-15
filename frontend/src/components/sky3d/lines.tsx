import { useEffect, useMemo } from "react";
import * as THREE from "three";

function dispose(object: THREE.Line | THREE.LineSegments) {
  object.geometry.dispose();
  const material = object.material;
  if (Array.isArray(material)) material.forEach((item) => item.dispose());
  else material.dispose();
}

export function Polyline({ positions, color }: { positions: number[]; color: string }) {
  const signature = positions.join(",");
  const object = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
    return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color }));
  }, [signature, color]);
  useEffect(() => () => dispose(object), [object]);
  return <primitive object={object} />;
}

export function SegmentLines({
  positions,
  color,
  opacity = 1,
}: {
  positions: number[];
  color: string;
  opacity?: number;
}) {
  const signature = positions.join(",");
  const object = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
    return new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }),
    );
  }, [signature, color, opacity]);
  useEffect(() => () => dispose(object), [object]);
  return <primitive object={object} />;
}
