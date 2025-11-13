import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { PacketFlow3D } from "@/types/net";
import { useNet } from "@/store/netStore";
import { flowColors } from "@/lib/flowColors";

export default function PacketFlow({ flow }: { flow: PacketFlow3D }) {
  const triggerPulse = useNet((s) => s.triggerLinkPulse);

  const pathLength = flow.path.length;
  const lastSegment = useRef<number>(-1);
  const lastProgress = useRef<number>(-1);
  const waitingKey = useRef<string | null>(null);
  const waitingCooldown = useRef<number>(0);

  useEffect(() => {
    lastSegment.current = -1;
    lastProgress.current = -1;
    waitingKey.current = null;
    waitingCooldown.current = 0;
  }, [flow.id]);

  useFrame((_, delta) => {
    if (!pathLength) return;
    const total = flow.progress * pathLength;
    const segment = Math.min(Math.floor(total), pathLength - 1);
    const localProgress = total - segment;
    const netState = useNet.getState();

    if (waitingKey.current) {
      const pulses = netState.linkPulse[waitingKey.current];
      if (pulses && pulses.length > 0) {
        return;
      }
      waitingKey.current = null;
      waitingCooldown.current = 0.45;
    }

    if (waitingCooldown.current > 0) {
      waitingCooldown.current = Math.max(0, waitingCooldown.current - delta);
      if (waitingCooldown.current > 0) {
        return;
      }
    }

    if (lastSegment.current >= 0 && segment !== lastSegment.current) {
      const [prevA, prevB] = flow.path[lastSegment.current] ?? [];
      if (prevA && prevB) {
        const prevKey = [prevA, prevB].sort().join("-");
        const prevPulse = netState.linkPulse[prevKey];
        if (prevPulse && prevPulse.length > 0) {
          waitingKey.current = prevKey;
          return;
        }
      }
    }

    const [a, b] = flow.path[segment] ?? [];
    if (a && b) {
      if (segment !== lastSegment.current || Math.abs(localProgress - lastProgress.current) > 0.08) {
        triggerPulse(a, b, localProgress, flowColors[flow.proto] ?? "#00ffff");
        lastSegment.current = segment;
        lastProgress.current = localProgress;
      }
    }
  });

  return null;
}
