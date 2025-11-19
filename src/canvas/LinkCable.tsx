import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useNet, type LinkPulseState } from "@/store/netStore";
import type { Link3D } from "@/types/net";
import * as THREE from "three";
import { flowColors } from "@/lib/flowColors";

const EMPTY_PULSES: LinkPulseState[] = [];
const MAX_PARTICLES = 120;
const TRAIL_STEPS = 6;
const STEP_OFFSET = 0.04;
const HEAD_SCALE = 0.32;
const SCALE_STEP = 0.03;

export default function LinkCable({ link }: { link: Link3D }) {
  const key = useMemo(() => [link.a, link.b].sort().join("-"), [link.a, link.b]);
  const pulses = useNet((s) => s.linkPulse[key] ?? EMPTY_PULSES);
  const { nodes } = useNet.getState();
  const geometryDirection = key === `${link.a}-${link.b}` ? 1 : -1;

  const start = nodes[link.a]?.position ?? [0, 0, 0];
  const end = nodes[link.b]?.position ?? [0, 0, 0];

  const { geometry, progressAttr, lineColor, curve } = useMemo(() => {
    const startVec = new THREE.Vector3(...start);
    const endVec = new THREE.Vector3(...end);

    const direction = endVec.clone().sub(startVec);
    const horizontal = direction.clone();
    horizontal.y = 0;
    if (horizontal.lengthSq() < 1e-6) {
      horizontal.set(1, 0, 0);
    }
    horizontal.normalize();

    const attach = Math.min(0.7, direction.length() * 0.35);
    const startAnchor = startVec.clone().add(horizontal.clone().multiplyScalar(attach));
    const endAnchor = endVec.clone().add(horizontal.clone().multiplyScalar(-attach));
    startAnchor.y = startVec.y + 0.05;
    endAnchor.y = endVec.y + 0.05;

    const span = startAnchor.distanceTo(endAnchor);
    const lift = Math.max(0.45, span * 0.2);

    const ctrl1 = startAnchor.clone().add(horizontal.clone().multiplyScalar(span * 0.25));
    ctrl1.y += lift;
    const ctrl2 = endAnchor.clone().add(horizontal.clone().multiplyScalar(-span * 0.25));
    ctrl2.y += lift;

    const curve = new THREE.CubicBezierCurve3(startAnchor, ctrl1, ctrl2, endAnchor);
    const tubularSegments = 60;
    const radialSegments = 16;
    const tube = new THREE.TubeGeometry(curve, tubularSegments, 0.08, radialSegments, false);

    const attr = new Float32Array((tubularSegments + 1) * (radialSegments + 1));
    let idx = 0;
    for (let i = 0; i <= tubularSegments; i += 1) {
      const t = i / tubularSegments;
      for (let j = 0; j <= radialSegments; j += 1) {
        attr[idx++] = t;
      }
    }

    const backgroundLineColor = new THREE.Color("#5cc9d1");
    return { geometry: tube, progressAttr: attr, lineColor: backgroundLineColor, curve };
  }, [start, end]);

  useEffect(() => {
    geometry.setAttribute("progress", new THREE.BufferAttribute(progressAttr, 1));
  }, [geometry, progressAttr]);

  const baseMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: lineColor.clone().multiplyScalar(0.14),
        emissive: lineColor.clone().multiplyScalar(0.05),
        emissiveIntensity: 0.2,
        metalness: 0.2,
        roughness: 0.45,
      }),
    [lineColor]
  );

  const particleMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const particleGeometry = useMemo(() => new THREE.SphereGeometry(0.18, 20, 20), []);
  const particleMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 1,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        vertexColors: false,
      }),
    []
  );
  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tempScale = useMemo(() => new THREE.Vector3(), []);
  const tempQuat = useMemo(() => new THREE.Quaternion(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);
  const pointBuffer = useMemo(() => new THREE.Vector3(), []);
  const tangentBuffer = useMemo(() => new THREE.Vector3(), []);
  const normalBuffer = useMemo(() => new THREE.Vector3(), []);
  const upVector = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  useEffect(() => {
    const mesh = particleMeshRef.current;
    if (mesh) {
      mesh.renderOrder = 5;
      // 明示的に instanceColor を確保して setColorAt を有効化
      const colors = new Float32Array(MAX_PARTICLES * 3);
      // @ts-ignore three type follows runtime
      mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
      mesh.count = 0;
    }
  }, []);

  useFrame(() => {
    const mesh = particleMeshRef.current;
    if (!mesh) return;
    let particleIndex = 0;
    pulses.forEach((pulse) => {
      if (particleIndex >= MAX_PARTICLES) return;
      const travelDir = pulse.dir * geometryDirection;
      const baseProgress = geometryDirection === 1 ? pulse.head : 1 - pulse.head;
      for (let i = 0; i < TRAIL_STEPS && particleIndex < MAX_PARTICLES; i += 1) {
        const offset = i * STEP_OFFSET;
        const t = baseProgress - travelDir * offset;
        if (t < -0.1 || t > 1.1) continue;
        const clampedT = THREE.MathUtils.clamp(t, 0, 1);
        curve.getPoint(clampedT, pointBuffer);
        curve.getTangent(clampedT, tangentBuffer).normalize();
        normalBuffer.crossVectors(upVector, tangentBuffer).normalize();
        if (!Number.isFinite(normalBuffer.lengthSq()) || normalBuffer.lengthSq() < 1e-4) {
          normalBuffer.set(1, 0, 0);
        }
        const intensity = Math.max(0, pulse.strength - i * 0.2);
        const scale = Math.max(0.08, HEAD_SCALE - i * SCALE_STEP) + intensity * 0.07;
        const offsetAmount = 0.075 + intensity * 0.05 + i * 0.012;
        pointBuffer.addScaledVector(normalBuffer, offsetAmount);
        pointBuffer.addScaledVector(upVector, 0.08 + intensity * 0.12 + i * 0.01);
        tempScale.set(scale, scale, scale);
        tempQuat.identity();
        tempMatrix.compose(pointBuffer, tempQuat, tempScale);
        mesh.setMatrixAt(particleIndex, tempMatrix);
        tempColor.set(pulse.color ?? flowColors.ICMP);
        const brightness = 1.5 + intensity * 2.5 - i * 0.12;
        tempColor.multiplyScalar(Math.max(0.6, brightness));
        mesh.setColorAt(particleIndex, tempColor);
        particleIndex += 1;
      }
    });
    mesh.count = particleIndex;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <group userData={{ linkId: link.id }}>
      <mesh geometry={geometry} material={baseMaterial} userData={{ linkId: link.id }} />
      <instancedMesh
        ref={particleMeshRef}
        args={[particleGeometry, particleMaterial, MAX_PARTICLES]}
        frustumCulled={false}
      />
    </group>
  );
}
