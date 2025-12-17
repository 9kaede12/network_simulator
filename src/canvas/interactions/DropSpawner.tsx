import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useNet } from "@/store/netStore";
import type { Node3D, NodeKind } from "@/types/net";

export default function DropSpawner() {
  const { camera, gl, scene } = useThree();
  const addNode = useNet((s) => s.addNode);
  const assignSubnet = useNet((s) => s.assignSubnetToLink);
  const setDragOverLink = useNet((s) => s.setDragOverLink);
  const setDragHoverLink = useNet((s) => s.setDragHoverLink);
  const nodes = useNet((s) => s.nodes);
  const nodesRef = useRef(nodes);
  const hoverLinkId = useNet((s) => s.dragHoverLinkId);
  const hoverRef = useRef(hoverLinkId);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    hoverRef.current = hoverLinkId;
  }, [hoverLinkId]);

  useEffect(() => {
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const mouse = new THREE.Vector2();
    const ray = new THREE.Raycaster();
    const pt = new THREE.Vector3();

    const getNextId = (kind: NodeKind) => {
      const currentNodes = nodesRef.current;
      const prefix = kind === "PC" ? "PC" : kind === "SWITCH" ? "SW" : kind === "ROUTER" ? "R" : kind;
      let max = 0;
      Object.values(currentNodes).forEach((n) => {
        if (n.id.startsWith(prefix)) {
          const num = parseInt(n.id.slice(prefix.length), 10);
          if (!Number.isNaN(num)) max = Math.max(max, num);
        }
      });
      return `${prefix}${max + 1}`;
    };

    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      if (
        e.dataTransfer.types.includes("application/x-node-kind") ||
        e.dataTransfer.types.includes("application/x-subnet")
      ) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        // サブネットカードをドラッグ中は、ケーブル上かどうかを検出してフラグ更新
        if (e.dataTransfer.types.includes("application/x-subnet")) {
          const rect = gl.domElement.getBoundingClientRect();
          mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          ray.setFromCamera(mouse, camera);
          const intersects = ray.intersectObjects(scene.children, true);
          const hit = intersects.find((i) => i.object.userData?.linkId);
          if (hit) {
            const linkId = hit.object.userData.linkId as string;
            setDragOverLink(true);
            setDragHoverLink(linkId);
          } else {
            setDragOverLink(false);
            setDragHoverLink(undefined);
          }
        } else {
          setDragOverLink(false);
          setDragHoverLink(undefined);
        }
      }
    };

    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      const subnetStr = e.dataTransfer.getData("application/x-subnet");
      if (subnetStr) {
        e.preventDefault();
        const { cidr } = JSON.parse(subnetStr) as { cidr: number };

        // ドロップ時には、直前の dragover で検出して保持しているリンクIDをそのまま利用することで
        // 重いレイキャストを避け、UIの引っ掛かりを抑える
        const linkId = hoverRef.current;
        if (linkId) {
          assignSubnet(linkId, cidr);
        }
        setDragOverLink(false);
        setDragHoverLink(undefined);
        return;
      }

      const kindStr = e.dataTransfer.getData("application/x-node-kind") as NodeKind;
      if (kindStr) {
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
      }
      setDragOverLink(false);
      setDragHoverLink(undefined);
    };

    const el = gl.domElement;
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("drop", onDrop);
    const onDragLeave = () => {
      setDragOverLink(false);
      setDragHoverLink(undefined);
    };
    el.addEventListener("dragleave", onDragLeave);
    return () => {
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("drop", onDrop);
      el.removeEventListener("dragleave", onDragLeave);
    };
  }, [camera, gl, scene, addNode, assignSubnet, setDragOverLink, setDragHoverLink]);

  return null;
}
