import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useNet } from "@/store/netStore";

export default function NodeDragger() {
  const { camera, gl, scene } = useThree();
  const dragging = useRef(false);
  const dragNode = useRef<string | null>(null);
  const offset = useRef(new THREE.Vector3());
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const mouse = useRef(new THREE.Vector2());
  const ray = useRef(new THREE.Raycaster());
  const setNodes = useNet.setState;
  const getNetState = useNet.getState;

  useEffect(() => {
    function screenToRay(e: PointerEvent) {
      const { clientWidth, clientHeight } = gl.domElement;
      mouse.current.set((e.clientX / clientWidth) * 2 - 1, -(e.clientY / clientHeight) * 2 + 1);
      ray.current.setFromCamera(mouse.current, camera);
    }

    function pickNode() {
      const intersects = ray.current.intersectObjects(scene.children, true);
      return intersects.find((i) => i.object.userData?.nodeId);
    }

    function onPointerDown(e: PointerEvent) {
      screenToRay(e);
      const hit = pickNode();
      const netState = getNetState();
      if (e.button === 2) {
        if (hit) {
          e.preventDefault();
          e.stopImmediatePropagation();
          const nodeId = hit.object.userData.nodeId as string;
          netState.showContextMenu(nodeId, e.clientX, e.clientY);
        }
        return;
      }
      if (e.button !== 0) return;

      if (netState.linkingFrom) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (hit) {
          const targetId = hit.object.userData.nodeId as string;
          if (targetId && targetId !== netState.linkingFrom) {
            const id = `L_${netState.linkingFrom}_${targetId}_${Date.now()}`;
            netState.addLink({ id, a: netState.linkingFrom, b: targetId, up: true, bandwidthMbps: 1000 });
          }
        }
        netState.endLink();
        return;
      }

      if (!hit) return;

      const { selected, nodes } = netState;
      if (selected.mode === "linking") return;

      e.preventDefault();
      e.stopImmediatePropagation();

      dragNode.current = hit.object.userData.nodeId;
      dragging.current = true;

      const pt = new THREE.Vector3();
      ray.current.ray.intersectPlane(plane.current, pt);
      const node = nodes[dragNode.current!];
      if (node) {
        const nodePos = new THREE.Vector3(...node.position);
        offset.current.copy(pt).sub(nodePos);
      } else {
        offset.current.set(0, 0, 0);
      }

      const net = getNetState();
      net.setSelected({ mode: "moving", nodeId: dragNode.current ?? undefined, linkId: undefined });
      // クリック開始時点でCLIのアクティブノードも切り替える
      net.setCliNode(dragNode.current ?? undefined);
    }

    function onPointerMove(e: PointerEvent) {
      if (!dragging.current || !dragNode.current) return;
      screenToRay(e);
      e.preventDefault();
      e.stopImmediatePropagation();

      const pt = new THREE.Vector3();
      ray.current.ray.intersectPlane(plane.current, pt);
      pt.sub(offset.current);

      setNodes((state) => {
        const nodes = { ...state.nodes };
        const node = nodes[dragNode.current!];
        if (node) {
          node.position = [pt.x, 0, pt.z];
        }
        return { nodes };
      });
    }

    function onPointerUp(e: PointerEvent) {
      if (!dragging.current) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const lastNode = dragNode.current ?? undefined;
      dragging.current = false;
      dragNode.current = null;
      const net = getNetState();
      net.setSelected({ mode: "idle", nodeId: lastNode, linkId: undefined });
      // ドラッグ終了時にもCLI対象を確定
      net.setCliNode(lastNode);
    }

    const opts: AddEventListenerOptions = { capture: true };
    gl.domElement.addEventListener("pointerdown", onPointerDown, opts);
    gl.domElement.addEventListener("pointermove", onPointerMove, opts);
    window.addEventListener("pointerup", onPointerUp, opts);

    return () => {
      gl.domElement.removeEventListener("pointerdown", onPointerDown, opts);
      gl.domElement.removeEventListener("pointermove", onPointerMove, opts);
      window.removeEventListener("pointerup", onPointerUp, opts);
    };
  }, [camera, gl, scene]);

  return null;
}
