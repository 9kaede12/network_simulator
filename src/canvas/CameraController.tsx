import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export default function CameraController() {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls);

  const animating = useRef(true);
  const elapsed = useRef(0);
  const from = useRef(new THREE.Vector3(0, 24, 40));
  const to = useRef(new THREE.Vector3(0, 8, 16));

  useEffect(() => {
    camera.position.copy(from.current);
    camera.lookAt(0, 0, 0);
    (controls as { update?: () => void } | undefined)?.update?.();
    animating.current = true;
    elapsed.current = 0;
  }, [camera, controls]);

  useFrame((_, delta) => {
    if (!animating.current) return;
    elapsed.current += delta;
    const duration = 3.0;
    const t = Math.min(elapsed.current / duration, 1);
    const ease = t < 1 ? 1 - Math.pow(1 - t, 3) : 1;
    camera.position.lerpVectors(from.current, to.current, ease);
    camera.lookAt(0, 0, 0);
    (controls as { update?: () => void } | undefined)?.update?.();
    if (t >= 1) animating.current = false;
  });

  return null;
}
