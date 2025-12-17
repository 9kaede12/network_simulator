import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useNet } from "@/store/netStore";

export default function LinkEditor() {
  const { camera, gl, scene } = useThree();
  const linking = useRef(false);
  const startNode = useRef<string | null>(null);
  const tempLine = useRef<THREE.Line | null>(null);

  const addLink = useNet((s) => s.addLink);
  const nodes = useNet((s) => s.nodes);
  const setSelected = useNet((s) => s.setSelected);
  const getState = useNet.getState;
  const linkingFromId = useNet((s) => s.linkingFrom);

  useEffect(() => {
    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const updateMouseFromEvent = (e: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    // 現状はキャンバスから直接リンク開始するUIは使っていないため、
    // 常に false を返すスタブとして定義しておく
    const isLinkButton = () => false;

    function onPointerDown(e: PointerEvent) {
      if (!isLinkButton()) return;
      updateMouseFromEvent(e);
      ray.setFromCamera(mouse, camera);

      const intersects = ray.intersectObjects(scene.children, true);
      const nodeMesh = intersects.find((i) => i.object.userData?.nodeId);
      if (nodeMesh) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const nodeId = nodeMesh.object.userData.nodeId;
        startNode.current = nodeId;
        linking.current = true;
        setSelected({ mode: "linking", nodeId, linkId: undefined });

        const geom = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(),
          new THREE.Vector3(),
        ]);
        const mat = new THREE.LineBasicMaterial({ color: "#00b4d8" });
        const line = new THREE.Line(geom, mat);
        tempLine.current = line;
        scene.add(line);
      }
    }

    function onPointerMove(e: PointerEvent) {
      // ストアからのリンク開始（コンテキストメニュー経由）に対応
      if (!linking.current && !tempLine.current) {
        const from = getState().linkingFrom;
        if (from) {
      linking.current = true;
      startNode.current = from;
      const geom = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(),
            new THREE.Vector3(),
          ]);
          const mat = new THREE.LineBasicMaterial({ color: "#00b4d8" });
          const line = new THREE.Line(geom, mat);
          tempLine.current = line;
          scene.add(line);
          setSelected({ mode: "linking", nodeId: from, linkId: undefined });
        }
      }
      if (!linking.current || !tempLine.current) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const geom = tempLine.current.geometry as THREE.BufferGeometry;
      const pos = geom.attributes.position as THREE.BufferAttribute;

      const startPos =
        startNode.current && nodes[startNode.current]
          ? new THREE.Vector3(...nodes[startNode.current].position)
          : new THREE.Vector3();

      updateMouseFromEvent(e);
      ray.setFromCamera(mouse, camera);

      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const pt = new THREE.Vector3();
      ray.ray.intersectPlane(plane, pt);

      pos.setXYZ(0, startPos.x, startPos.y, startPos.z);
      pos.setXYZ(1, pt.x, pt.y, pt.z);
      pos.needsUpdate = true;
    }

    function onPointerUp(e: PointerEvent) {
      if (!linking.current || !startNode.current || !tempLine.current) return;
      if (!getState().linkingFrom) {
        // 既に他経路で完了済み
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      updateMouseFromEvent(e);
      ray.setFromCamera(mouse, camera);

      const intersects = ray.intersectObjects(scene.children, true);
      const target = intersects.find(
        (i) => i.object.userData?.nodeId && i.object.userData.nodeId !== startNode.current
      );

      if (target) {
        const endId = target.object.userData.nodeId;
        const id = `L_${startNode.current}_${endId}_${Date.now()}`;
        addLink({
          id,
          a: startNode.current,
          b: endId,
          up: true,
          bandwidthMbps: 1000,
        });
      }

      if (tempLine.current) {
        scene.remove(tempLine.current);
        tempLine.current.geometry.dispose();
        (tempLine.current.material as THREE.Material).dispose();
        tempLine.current = null;
      }

      linking.current = false;
      startNode.current = null;
      setSelected({ mode: "idle", nodeId: undefined, linkId: undefined });
      // ストアのリンク状態を終了
      getState().endLink();
    }

    const listenerOpts: AddEventListenerOptions = { capture: true };

    const cancelContextMenu = (e: MouseEvent) => {
      // ブラウザのデフォルトは抑止するが、NodeIsland 側の onContextMenu は有効
      e.preventDefault();
    };

    gl.domElement.addEventListener("pointerdown", onPointerDown, listenerOpts);
    // ポインターがキャンバス外にあっても追従できるよう window で監視
    window.addEventListener("pointermove", onPointerMove, listenerOpts);
    window.addEventListener("pointerup", onPointerUp, listenerOpts);
    gl.domElement.addEventListener("contextmenu", cancelContextMenu);

    return () => {
      gl.domElement.removeEventListener("pointerdown", onPointerDown, listenerOpts);
      window.removeEventListener("pointermove", onPointerMove, listenerOpts);
      window.removeEventListener("pointerup", onPointerUp, listenerOpts);
      gl.domElement.removeEventListener("contextmenu", cancelContextMenu);

      if (tempLine.current) {
        scene.remove(tempLine.current);
        tempLine.current.geometry.dispose();
        (tempLine.current.material as THREE.Material).dispose();
        tempLine.current = null;
      }
    };
  }, [camera, gl, scene, addLink, nodes, setSelected, getState]);

  // ストアの linkingFrom 変化を即時反映（ポインタ移動を待たずに仮ケーブルを出す）
  useEffect(() => {
    if (linkingFromId && !linking.current && !tempLine.current) {
      const from = linkingFromId;
      const start = nodes[from]?.position ?? [0, 0, 0];
      const geom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(start[0], start[1], start[2]),
        new THREE.Vector3(start[0], start[1], start[2]),
      ]);
      const mat = new THREE.LineBasicMaterial({ color: "#00b4d8" });
      const line = new THREE.Line(geom, mat);
      tempLine.current = line;
      scene.add(line);
      startNode.current = from;
      linking.current = true;
      setSelected({ mode: "linking", nodeId: from, linkId: undefined });
      gl.domElement.style.cursor = "crosshair";
    } else if (!linkingFromId && linking.current) {
      if (tempLine.current) {
        scene.remove(tempLine.current);
        tempLine.current.geometry.dispose();
        (tempLine.current.material as THREE.Material).dispose();
        tempLine.current = null;
      }
      linking.current = false;
      startNode.current = null;
      setSelected({ mode: "idle", nodeId: undefined, linkId: undefined });
      gl.domElement.style.cursor = "auto";
    }
  }, [linkingFromId, nodes, scene, gl, setSelected]);

  return null;
}
