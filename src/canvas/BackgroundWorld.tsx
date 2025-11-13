import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { theme } from "@/lib/theme";

const vertexShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;
    pos.z += sin((pos.x + uTime) * 0.3) * 0.2;
    pos.z += cos((pos.y + uTime * 0.7) * 0.2) * 0.2;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uLineColor;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec3 base = mix(uColorA, uColorB, vUv.y);
    vec2 grid = fract(vUv * 40.0);
    float line = step(grid.x, 0.015) + step(grid.y, 0.015);
    float intensity = smoothstep(0.0, 1.0, sin(vUv.y * 3.14159 + uTime));
    vec3 color = base + line * uLineColor * intensity * 0.8;
    gl_FragColor = vec4(color, 1.0);
  }
`;

export default function BackgroundWorld() {
  const mesh = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>>(null!);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    const material = mesh.current.material;
    material.uniforms.uTime.value += delta * 0.5;
  });

  return (
    <mesh ref={mesh} rotation-x={-Math.PI / 2} position={[0, -1, 0]}>
      <planeGeometry args={[500, 500, 256, 256]} />
      <shaderMaterial
        uniforms={{
          uTime: { value: 0 },
          uColorA: { value: new THREE.Color("#060013") },
          uColorB: { value: new THREE.Color("#190a40") },
          uLineColor: { value: new THREE.Color(theme.neonBlue) },
        }}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
