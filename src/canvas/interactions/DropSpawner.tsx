import { useEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useNet } from "@/store/netStore";
import type { Node3D, NodeKind } from "@/types/net";

export default function DropSpawner() {
  const { camera, gl } = useThree();
  const addNode = useNet((s) => s.addNode);
  const nodes = useNet((s) => s.nodes);

  useEffect(() => {
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const mouse = new THREE.Vector2();
    const ray = new THREE.Raycaster();
    const pt = new THREE.Vector3();

    const getNextId = (kind: NodeKind) => {
      const prefix = kind === "PC" ? "PC" : kind === "SWITCH" ? "SW" : kind === "ROUTER" ? "R" : kind;
      let max = 0;
      Object.values(nodes).forEach((n) => {
        if (n.id.startsWith(prefix)) {
          const num = parseInt(n.id.slice(prefix.length), 10);
          if (!Number.isNaN(num)) max = Math.max(max, num);
        }
      });
      return `${prefix}${max + 1}`;
    };

    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      if (e.dataTransfer.types.includes("application/x-node-kind")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }
    };

    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      const kindStr = e.dataTransfer.getData("application/x-node-kind") as NodeKind;
      if (!kindStr) return;
      e.preventDefault();

      const rect = gl.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(mouse, camera);
      ray.ray.intersectPlane(plane, pt);

      const id = getNextId(kindStr);
      const n: Node3D = {
        id,
        kind: kindStr,
        name: id,
        position: [pt.x, 0, pt.z],
      };
      addNode(n);
    };

    const el = gl.domElement;
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("drop", onDrop);
    };
  }, [camera, gl, addNode, nodes]);

  return null;
}

