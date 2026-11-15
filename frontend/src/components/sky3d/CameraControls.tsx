import { useEffect, useLayoutEffect, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { centerOffset, type Box } from "./framing";

export interface CameraNudge {
  id: number;
  yaw: number;
  pitch: number;
  zoom: number;
}

type OrbitHandle = { target: THREE.Vector3; update: () => void };

/** Shifts the projection so the scene centers inside `fit` instead of the full canvas. */
export function ViewFraming({ fit }: { fit: Box | null }) {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);

  useLayoutEffect(() => {
    if (!fit || size.width === 0 || size.height === 0) return;
    const { x, y } = centerOffset(size.width, size.height, fit);
    camera.setViewOffset(size.width, size.height, x, y, size.width, size.height);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, fit, size.width, size.height, invalidate]);

  useEffect(
    () => () => {
      camera.clearViewOffset();
    },
    [camera],
  );

  return null;
}

export function CameraControls({
  restDirection,
  fitDistance,
  flyTarget,
  resetToken,
  nudge,
  reducedMotion,
  onBusy,
  onPose,
}: {
  restDirection: readonly [number, number, number];
  fitDistance: number;
  flyTarget: [number, number, number] | null;
  resetToken: number;
  nudge: CameraNudge | null;
  reducedMotion: boolean;
  onBusy: (busy: boolean) => void;
  onPose: (pose: { distance: number; fov: number }) => void;
}) {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const controls = useThree((state) => state.controls) as OrbitHandle | null;
  const invalidate = useThree((state) => state.invalidate);
  const flying = useRef(false);
  const userMoved = useRef(false);
  const skipReset = useRef(true);
  const fit = useRef(fitDistance);
  const direction = useRef(restDirection);
  const desiredPos = useRef(new THREE.Vector3());
  const intro = useRef(reducedMotion ? 0 : 1);
  fit.current = fitDistance;
  direction.current = restDirection;

  const rest = () => new THREE.Vector3(...direction.current).normalize().multiplyScalar(fit.current);

  const publish = () => {
    onPose({ distance: camera.position.length(), fov: camera.fov });
  };

  useEffect(() => {
    camera.position.copy(rest().multiplyScalar(intro.current > 0 ? 1.7 : 1));
    camera.lookAt(0, 0, 0);
    if (intro.current > 0) onBusy(true);
    else publish();
  }, [camera]);

  useEffect(() => {
    if (intro.current > 0 || flying.current || userMoved.current) return;
    camera.position.setLength(fitDistance);
    controls?.update();
    invalidate();
    publish();
  }, [fitDistance]);

  useEffect(() => {
    if (skipReset.current) {
      skipReset.current = false;
      return;
    }
    if (!controls) return;
    controls.target.set(0, 0, 0);
    camera.position.copy(rest());
    intro.current = 0;
    flying.current = false;
    userMoved.current = false;
    controls.update();
    onBusy(false);
    publish();
  }, [resetToken]);

  useEffect(() => {
    if (!flyTarget || !controls) return;
    desiredPos.current.set(...flyTarget).normalize().multiplyScalar(fit.current);
    flying.current = true;
    userMoved.current = false;
    intro.current = 0;
    onBusy(true);
  }, [flyTarget, controls]);

  useEffect(() => {
    if (!nudge || !controls) return;
    userMoved.current = true;
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta += nudge.yaw * 0.18;
    spherical.phi = Math.min(Math.PI - 0.08, Math.max(0.08, spherical.phi + nudge.pitch * 0.14));
    spherical.radius = Math.min(12, Math.max(1.35, spherical.radius * (nudge.zoom || 1)));
    offset.setFromSpherical(spherical);
    camera.position.copy(controls.target).add(offset);
    controls.update();
    publish();
  }, [nudge]);

  useFrame((_, delta) => {
    if (!controls) return;
    if (intro.current > 0) {
      intro.current = Math.max(0, intro.current - delta / 0.9);
      camera.position.lerp(rest(), 1 - Math.pow(0.02, delta));
      controls.target.set(0, 0, 0);
      controls.update();
      if (intro.current === 0) {
        camera.position.copy(rest());
        controls.update();
        onBusy(false);
        publish();
      }
      return;
    }
    if (!flying.current) return;
    desiredPos.current.setLength(fit.current);
    const step = reducedMotion ? 1 : 1 - Math.exp(-delta * 3.2);
    const length = THREE.MathUtils.lerp(camera.position.length(), fit.current, step);
    const direction = camera.position.clone().normalize();
    const turn = new THREE.Quaternion().setFromUnitVectors(direction, desiredPos.current.clone().normalize());
    direction.applyQuaternion(new THREE.Quaternion().slerp(turn, step));
    camera.position.copy(direction.multiplyScalar(length));
    controls.target.lerp(new THREE.Vector3(), step);
    controls.update();
    if (camera.position.distanceTo(desiredPos.current) < 0.02) {
      camera.position.copy(desiredPos.current);
      controls.target.set(0, 0, 0);
      controls.update();
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
      minDistance={1.35}
      maxDistance={12}
      onStart={() => {
        userMoved.current = true;
        onBusy(true);
      }}
      onEnd={() => {
        onBusy(false);
        publish();
      }}
    />
  );
}
