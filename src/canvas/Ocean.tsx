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
    pos.z += sin((pos.x + uTime * 0.8) * 0.5) * 0.2;
    pos.z += cos((pos.y + uTime * 0.6) * 0.4) * 0.2;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uGridIntensity;
  varying vec2 vUv;
  void main() {
    vec2 grid = fract(vUv * 50.0);
    float line = step(grid.x, 0.02) + step(grid.y, 0.02);
    vec3 gridColor = mix(uColor1, uColor2, smoothstep(0.0, 1.0, vUv.y));
    float glow = line * uGridIntensity;
    vec3 finalColor = gridColor + glow * vec3(0.0, 1.0, 1.0);
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export default function Ocean() {
  const mesh = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>>(null!);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    const material = mesh.current.material;
    material.uniforms.uTime.value += delta * 0.8;
  });

  return (
    <mesh ref={mesh} rotation-x={-Math.PI / 2} position={[0, -0.5, 0]} receiveShadow>
      <planeGeometry args={[200, 200, 256, 256]} />
      <shaderMaterial
        uniforms={{
          uTime: { value: 0 },
          uColor1: { value: new THREE.Color(theme.gridBase) },
          uColor2: { value: new THREE.Color(theme.neonBlue) },
          uGridIntensity: { value: 0.35 },
        }}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
