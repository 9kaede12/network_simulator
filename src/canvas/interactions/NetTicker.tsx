import { useFrame } from "@react-three/fiber";
import { useNet } from "@/store/netStore";

export default function NetTicker() {
  const tick = useNet((s) => s.tick);

  useFrame((_, delta) => {
    tick(delta);
  });

  return null;
}
