import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { memo, useMemo } from "react";
import BackgroundWorld from "./BackgroundWorld";
import NodeIsland from "./NodeIsland";
import LinkCable from "./LinkCable";
import PacketFlow from "./PacketFlow";
import LinkEditor from "./interactions/LinkEditor";
import NodeDragger from "./interactions/NodeDragger";
import NetTicker from "./interactions/NetTicker";
import DropSpawner from "./interactions/DropSpawner";
import SceneLighting from "./SceneLighting";
import CameraController from "./CameraController";
import { useNet } from "@/store/netStore";

type CanvasRootProps = {
  children?: React.ReactNode;
};

function CanvasContent({ children }: CanvasRootProps) {
  const nodes = useNet((s) => s.nodes);
  const links = useNet((s) => s.links);
  const flows = useNet((s) => s.flows);
  const mode = useNet((s) => s.selected.mode);
  const clearSelection = useNet((s) => s.setSelected);

  const nodeList = useMemo(() => Object.values(nodes), [nodes]);
  const linkList = useMemo(() => Object.values(links), [links]);
  const flowList = useMemo(() => Object.values(flows), [flows]);

  return (
    <Canvas
      shadows
      camera={{ position: [0, 8, 16], fov: 55 }}
      gl={{ antialias: true, logarithmicDepthBuffer: true }}
      onPointerMissed={() => clearSelection({ mode: "idle", nodeId: undefined, linkId: undefined })}
    >
      <SceneLighting />
      <CameraController />
      <BackgroundWorld />
      {linkList.map((l) => (
        <LinkCable key={l.id} link={l} />
      ))}
      {nodeList.map((n) => (
        <NodeIsland key={n.id} node={n} />
      ))}
      {flowList.map((f) => (
        <PacketFlow key={f.id} flow={f} />
      ))}
      <LinkEditor />
      <NodeDragger />
      <DropSpawner />
      <NetTicker />
      {children}
      <OrbitControls makeDefault enabled={mode === "idle"} />
    </Canvas>
  );
}

export default memo(CanvasContent);
