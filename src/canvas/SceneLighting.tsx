import { theme } from "@/lib/theme";

export default function SceneLighting() {
  return (
    <>
      <color attach="background" args={[theme.bg]} />
      <fog attach="fog" args={[theme.bg, 12, 110]} />
      <ambientLight intensity={0.3} color={theme.neonBlue} />
      <directionalLight position={[5, 15, 5]} intensity={1.2} color={theme.neonBlue} />
      <pointLight position={[0, 8, 0]} intensity={0.5} color={theme.neonBlue} distance={40} />
    </>
  );
}
