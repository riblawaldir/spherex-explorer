import { useEffect, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export interface CameraNudge {
  id: number;
  yaw: number;
  pitch: number;
  zoom: number;
}

type OrbitHandle = { target: THREE.Vector3; update: () => void };

export function CameraControls({
  flyTarget,
  resetToken,
  nudge,
  reducedMotion,
  onBusy,
  onPose,
}: {
  flyTarget: [number, number, number] | null;
  resetToken: number;
  nudge: CameraNudge | null;
  reducedMotion: boolean;
  onBusy: (busy: boolean) => void;
  onPose: (pose: { distance: number; fov: number }) => void;
}) {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const controls = useThree((state) => state.controls) as OrbitHandle | null;
  const flying = useRef(false);
  const skipReset = useRef(true);
  const desiredPos = useRef(new THREE.Vector3(0, 0.35, 2.6));
  const desiredTarget = useRef(new THREE.Vector3());
  const rest = useRef(new THREE.Vector3(0, 0.35, 2.6));
  const home = useRef(new THREE.Vector3(0, 0.35, reducedMotion ? 2.6 : 4.4));
  const intro = useRef(reducedMotion ? 0 : 1);

  const publish = () => {
    onPose({ distance: camera.position.length(), fov: camera.fov });
  };

  useEffect(() => {
    camera.position.copy(home.current);
    camera.lookAt(0, 0, 0);
    if (intro.current > 0) onBusy(true);
    else publish();
  }, [camera]);

  useEffect(() => {
    if (skipReset.current) {
      skipReset.current = false;
      return;
    }
    if (!controls) return;
    controls.target.set(0, 0, 0);
    camera.position.copy(rest.current);
    intro.current = 0;
    flying.current = false;
    controls.update();
    onBusy(false);
    publish();
  }, [resetToken]);

  useEffect(() => {
    if (!flyTarget || !controls) return;
    const unit = new THREE.Vector3(...flyTarget).normalize();
    desiredTarget.current.copy(unit).multiplyScalar(0.35);
    desiredPos.current.copy(unit).multiplyScalar(1.85);
    flying.current = true;
    intro.current = 0;
    onBusy(true);
  }, [flyTarget, controls]);

  useEffect(() => {
    if (!nudge || !controls) return;
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta += nudge.yaw * 0.18;
    spherical.phi = Math.min(Math.PI - 0.08, Math.max(0.08, spherical.phi + nudge.pitch * 0.14));
    spherical.radius = Math.min(8, Math.max(1.35, spherical.radius * (nudge.zoom || 1)));
    offset.setFromSpherical(spherical);
    camera.position.copy(controls.target).add(offset);
    controls.update();
    publish();
  }, [nudge]);

  useFrame((_, delta) => {
    if (!controls) return;
    if (intro.current > 0) {
      intro.current = Math.max(0, intro.current - delta / 0.9);
      camera.position.lerp(rest.current, 1 - Math.pow(0.02, delta));
      controls.target.set(0, 0, 0);
      controls.update();
      if (intro.current === 0) {
        onBusy(false);
        publish();
      }
      return;
    }
    if (!flying.current) return;
    const step = reducedMotion ? 1 : 1 - Math.exp(-delta * 3.2);
    camera.position.lerp(desiredPos.current, step);
    controls.target.lerp(desiredTarget.current, step);
    controls.update();
    if (camera.position.distanceTo(desiredPos.current) < 0.02) {
      flying.current = false;
      onBusy(false);
      publish();
    }
  });

  return (
    <OrbitControls
      makeDefault
      enablePan={false}
      enableDamping={!reducedMotion}
      dampingFactor={0.12}
      onStart={() => onBusy(true)}
      onEnd={() => {
        onBusy(false);
        publish();
      }}
    />
  );
}
