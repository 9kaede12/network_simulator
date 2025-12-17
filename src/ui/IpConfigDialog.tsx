import { useEffect, useMemo, useState } from "react";
import { useNet } from "@/store/netStore";
import type { Node3D } from "@/types/net";

function getPortsForNode(node: Node3D | undefined): string[] {
  if (!node) return [];
  const catalog: Record<Node3D["kind"], string[]> = {
    PC: ["eth0", "eth1"],
    ROUTER: ["Gig0/0", "Gig0/1", "Gig0/2", "Gig0/3"],
    SWITCH: Array.from({ length: 8 }, (_, idx) => `Fa0/${idx + 1}`),
    SERVER: ["eth0", "eth1"],
  };
  return catalog[node.kind] ?? [];
}

export default function IpConfigDialog() {
  const nodeId = useNet((s) => s.ipDialogNodeId);
  const nodes = useNet((s) => s.nodes);
  const links = useNet((s) => s.links);
  const portsState = useNet((s) => s.ports);
  const setPortMode = useNet((s) => s.setPortMode);
  const setIp = useNet((s) => s.setPortIp);
  const setMask = useNet((s) => s.setPortMask);
  const hide = useNet((s) => s.hideIpDialog);

  const node = nodeId ? nodes[nodeId] : undefined;
  const nodeLinks = useMemo(
    () => (node ? Object.values(links).filter((l) => l.a === node.id || l.b === node.id) : []),
    [links, node]
  );
  const ports = useMemo(() => {
    if (!node) return [];
    const base = getPortsForNode(node);
    if (nodeLinks.length === 0) return [];
    return base.filter((_, idx) => nodeLinks[idx]);
  }, [node, nodeLinks]);

  const [selectedPort, setSelectedPort] = useState<string>("");
  const [ipInput, setIpInput] = useState("");
  const [cidrInput, setCidrInput] = useState<24 | 30>(24);
  const [mode, setMode] = useState<"dhcp" | "static">("static");

  useEffect(() => {
    if (!node) return;
    const firstPort = ports[0] ?? "";
    setSelectedPort(firstPort);
  }, [node, ports]);

  useEffect(() => {
    if (!nodeId || !selectedPort) return;
    const cfg = portsState[nodeId]?.[selectedPort];
    setIpInput(cfg?.ip ?? "");
    const cidr = (cfg?.maskCidr ?? 24) as 24 | 30;
    setCidrInput(cidr);
    setMode(cfg?.mode ?? "static");
  }, [nodeId, selectedPort, portsState]);

  if (!nodeId || !node) return null;

  const allocateNextIp = (): string | undefined => {
    if (!nodeId || !node) return undefined;
    if (node.kind === "ROUTER") {
      const usedGlobal = new Set<string>();
      Object.values(nodes).forEach((n) => n.ip && usedGlobal.add(n.ip));
      Object.values(portsState).forEach((m) =>
        Object.values(m).forEach((p) => p.ip && usedGlobal.add(p.ip ?? ""))
      );
      for (let a = 0; a <= 255; a += 1) {
        for (let b = 1; b <= 254; b += 1) {
          const candidate = `192.168.${a}.${b}`;
          if (!usedGlobal.has(candidate)) return candidate;
        }
      }
      return undefined;
    }

    const neighbors: Record<string, string[]> = {};
    Object.values(nodes).forEach((n) => {
      if (n.kind === "ROUTER") return;
      neighbors[n.id] = [];
    });
    Object.values(links).forEach((link) => {
      const aNode = nodes[link.a];
      const bNode = nodes[link.b];
      if (!aNode || !bNode) return;
      if (aNode.kind === "ROUTER" || bNode.kind === "ROUTER") return;
      neighbors[link.a]?.push(link.b);
      neighbors[link.b]?.push(link.a);
    });

    const visited = new Set<string>();
    const queue: string[] = [];
    visited.add(nodeId);
    queue.push(nodeId);
    const component: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift() as string;
      component.push(current);
      (neighbors[current] ?? []).forEach((next) => {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      });
    }

    component.sort();
    const key = component.join(",");
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
      hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    }
    const segmentIndex = (hash % 200) + 1;

    const used = new Set<string>();
    const registerIfSameSegment = (ip?: string) => {
      if (!ip) return;
      const parts = ip.split(".").map((v) => Number(v));
      if (parts.length === 4 && parts[2] === segmentIndex) {
        used.add(ip);
      }
    };
    Object.values(nodes).forEach((n) => registerIfSameSegment(n.ip));
    Object.values(portsState).forEach((m) =>
      Object.values(m).forEach((p) => registerIfSameSegment(p.ip))
    );

    for (let host = 1; host <= 254; host += 1) {
      const candidate = `192.168.${segmentIndex}.${host}`;
      if (!used.has(candidate)) return candidate;
    }
    return undefined;
  };

  const selectDhcp = () => {
    setMode("dhcp");
    if (!ipInput) {
      const next = allocateNextIp();
      if (next) {
        setIpInput(next);
      }
    }
  };

  const selectStatic = () => {
    setMode("static");
    // Staticを選んだらIP欄を空にして手入力しやすくする
    setIpInput("");
  };

  const onSave = () => {
    if (!selectedPort) {
      hide();
      return;
    }
    if (mode === "static" && !ipInput) {
      hide();
      return;
    }
    setPortMode(node.id, selectedPort, mode);
    if (ipInput) {
      setIp(node.id, selectedPort, ipInput);
    }
    setMask(node.id, selectedPort, cidrInput);
    hide();
  };

  const onCancel = () => hide();

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.45)",
        zIndex: 1200,
      }}
      onMouseDown={onCancel}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          minWidth: 280,
          maxWidth: 340,
          background: "rgba(4,12,18,0.98)",
          borderRadius: 10,
          border: "1px solid rgba(0,255,204,0.55)",
          padding: "0.9rem 1rem",
          color: "#00ffcc",
          fontFamily: "monospace",
          boxShadow: "0 10px 28px rgba(0,0,0,0.55)",
        }}
      >
        <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem" }}>
          Add IP address
        </div>
        <div style={{ fontSize: "0.8rem", marginBottom: "0.4rem" }}>Node: {node.name}</div>
        <div style={{ marginBottom: "0.5rem" }}>
          <div style={{ fontSize: "0.75rem", opacity: 0.8, marginBottom: "0.2rem" }}>Port</div>
          <select
            value={selectedPort}
            onChange={(e) => setSelectedPort(e.currentTarget.value)}
            style={{
              width: "100%",
              background: "black",
              color: "#00ffcc",
              borderRadius: 4,
              border: "1px solid rgba(0,255,204,0.45)",
              padding: "0.25rem 0.35rem",
              fontFamily: "monospace",
              fontSize: "0.8rem",
            }}
          >
            {ports.map((p, idx) => {
              const link = nodeLinks[idx];
              const peerId = link ? (link.a === node.id ? link.b : link.a) : undefined;
              const peerName = peerId ? nodes[peerId]?.name ?? peerId : "";
              const label = peerName ? `${p} (connected to ${peerName})` : p;
              return (
                <option key={p} value={p}>
                  {label}
                </option>
              );
            })}
            {ports.length === 0 && <option value="">(no connected ports)</option>}
          </select>
        </div>
        <div style={{ marginBottom: "0.5rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "0.2rem",
            }}
          >
            <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>IP address</div>
            <div style={{ display: "flex", gap: 4 }}>
              <button
                type="button"
                onClick={selectDhcp}
                style={{
                  padding: "0.12rem 0.35rem",
                  borderRadius: 4,
                  border: "1px solid rgba(0,255,204,0.35)",
                  background: mode === "dhcp" ? "rgba(0,255,204,0.25)" : "transparent",
                  color: "#00ffcc",
                  cursor: "pointer",
                  fontFamily: "monospace",
                  fontSize: "0.72rem",
                }}
              >
                DHCP
              </button>
              <button
                type="button"
                onClick={selectStatic}
                style={{
                  padding: "0.12rem 0.35rem",
                  borderRadius: 4,
                  border: "1px solid rgba(0,255,204,0.35)",
                  background: mode === "static" ? "rgba(0,255,204,0.25)" : "transparent",
                  color: "#00ffcc",
                  cursor: "pointer",
                  fontFamily: "monospace",
                  fontSize: "0.72rem",
                }}
              >
                Static
              </button>
            </div>
          </div>
          <input
            type="text"
            value={ipInput}
            onChange={(e) => setIpInput(e.currentTarget.value)}
            placeholder={mode === "dhcp" ? "assigned by DHCP" : "192.168.0.10"}
            disabled={mode === "dhcp"}
            style={{
              width: "100%",
              background: "black",
              color: "#00ffcc",
              borderRadius: 4,
              border: "1px solid rgba(0,255,204,0.45)",
              padding: "0.25rem 0.35rem",
              fontFamily: "monospace",
              fontSize: "0.8rem",
            }}
          />
        </div>
        <div style={{ marginBottom: "0.8rem" }}>
          <div style={{ fontSize: "0.75rem", opacity: 0.8, marginBottom: "0.2rem" }}>Subnet</div>
          <select
            value={cidrInput}
            onChange={(e) => setCidrInput(Number(e.currentTarget.value) as 24 | 30)}
            style={{
              width: "100%",
              background: "black",
              color: "#00ffcc",
              borderRadius: 4,
              border: "1px solid rgba(0,255,204,0.45)",
              padding: "0.25rem 0.35rem",
              fontFamily: "monospace",
              fontSize: "0.8rem",
            }}
          >
            <option value={24}>/24 (255.255.255.0)</option>
            <option value={30}>/30 (255.255.255.252)</option>
          </select>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "0.25rem 0.6rem",
              borderRadius: 4,
              border: "1px solid rgba(0,255,204,0.3)",
              background: "transparent",
              color: "#00ffcc",
              cursor: "pointer",
              fontFamily: "monospace",
              fontSize: "0.78rem",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            style={{
              padding: "0.25rem 0.7rem",
              borderRadius: 4,
              border: "1px solid rgba(0,255,204,0.7)",
              background: "rgba(0,255,204,0.15)",
              color: "#00ffcc",
              cursor: "pointer",
              fontFamily: "monospace",
              fontSize: "0.78rem",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
