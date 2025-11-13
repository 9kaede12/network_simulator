import { Text } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useMemo, useState } from "react";
import { useNet } from "@/store/netStore";
import type { Node3D } from "@/types/net";

export default function NodeIsland({ node }: { node: Node3D }) {
  const setSel = useNet((s) => s.setSelected);
  const setCliNode = useNet((s) => s.setCliNode);
  const selected = useNet((s) => s.selected);
  const [hovered, setHovered] = useState(false);

  const baseColor = useMemo(
    () =>
      (
        {
          ROUTER: "#ffb703",
          SWITCH: "#8ecae6",
          PC: "#adb5bd",
          SERVER: "#90be6d",
        } as const
      )[node.kind],
    [node.kind]
  );
  const isActive = selected.nodeId === node.id;
  const isMoving = selected.mode === "moving" && isActive;
  const position: [number, number, number] = [
    node.position[0],
    node.position[1] + (isMoving ? 0.2 : 0),
    node.position[2],
  ];
  const emissive = hovered || isActive ? "#00f5ff" : "#000000";
  const emissiveIntensity = hovered ? 0.6 : isActive ? (isMoving ? 0.6 : 0.35) : 0;

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setSel({ nodeId: node.id, linkId: undefined, mode: "idle" });
    setCliNode(node.id);
  };

  const showMenu = useNet((s) => s.showContextMenu);
  const onContextMenu = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    e.preventDefault();
    showMenu(node.id, e.nativeEvent.clientX, e.nativeEvent.clientY);
  };

  return (
    <group position={position} onClick={onClick} onContextMenu={onContextMenu}>
      <mesh
        userData={{ nodeId: node.id }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <cylinderGeometry args={[0.9, 1.0, 0.4, 24]} />
        <meshStandardMaterial
          color={baseColor}
          metalness={0.2}
          roughness={0.6}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>
      <Text position={[0, 0.6, 0]} fontSize={0.25} color="white" anchorX="center" anchorY="middle">
        {node.name}
      </Text>
    </group>
  );
}
