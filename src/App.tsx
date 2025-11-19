import CanvasRoot from "@/canvas/CanvasRoot";
import { useNet } from "@/store/netStore";
import { useEffect } from "react";
import CLIConsole from "@/ui/CLIConsole";
import SidePanel from "@/ui/SidePanel";
import MissionPanel from "@/ui/MissionPanel";
import { playWaveLoop } from "@/lib/sound";
import NodePalette from "@/ui/NodePalette";
import SubnetPalette from "@/ui/SubnetPalette";
import NodeContextMenu from "@/ui/NodeContextMenu";

export default function App() {
  const addNode = useNet((s) => s.addNode);
  const addLink = useNet((s) => s.addLink);
  const recomputeRouting = useNet((s) => s.recomputeRouting);

  useEffect(() => {
    addNode({ id: "PC1", kind: "PC", name: "PC1", position: [-4, 0, 0] });
    addNode({ id: "R1", kind: "ROUTER", name: "R1", position: [0, 0, 0] });
    addNode({ id: "PC2", kind: "PC", name: "PC2", position: [4, 0, 0] });
    addLink({ id: "L1", a: "PC1", b: "R1", up: true, bandwidthMbps: 100 });
    addLink({ id: "L2", a: "R1", b: "PC2", up: true, bandwidthMbps: 100 });
    recomputeRouting();
  }, [addNode, addLink, recomputeRouting]);

  useEffect(() => {
    const stop = playWaveLoop();
    return stop;
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#061b2b",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <CanvasRoot />
      <NodePalette />
      <SubnetPalette />
      <NodeContextMenu />
      <CLIConsole />
      <SidePanel />
      <MissionPanel />
    </div>
  );
}
