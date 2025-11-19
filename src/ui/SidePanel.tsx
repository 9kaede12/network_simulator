import { useEffect, useMemo, useState } from "react";
import { useNet } from "@/store/netStore";
import type { Link3D, Node3D } from "@/types/net";

export default function SidePanel() {
  const { nodes, links, flows, routingTable, selected } = useNet();
  const clearSelection = useNet((s) => s.setSelected);
  const [time, setTime] = useState(Date.now());

  const nodeList = useMemo(() => Object.values(nodes), [nodes]);
  const selectedNode = selected.nodeId ? nodes[selected.nodeId] : undefined;
  const selectedLinks = useMemo<Link3D[]>(() => {
    if (!selectedNode) return [];
    return Object.values(links).filter((l) => l.a === selectedNode.id || l.b === selectedNode.id);
  }, [selectedNode, links]);

  const selectedPorts = useMemo(() => (selectedNode ? getPortsForNode(selectedNode) : []), [selectedNode]);

  useEffect(() => {
    const timer = window.setInterval(() => setTime(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        right: 0,
        top: 0,
        width: "280px",
        height: "100%",
        background: "rgba(4, 12, 18, 0.92)",
        color: "#00ffcc",
        fontFamily: "monospace",
        fontSize: "0.85rem",
        padding: "0.75rem",
        boxSizing: "border-box",
        overflowY: "auto",
        borderLeft: "1px solid rgba(0, 255, 204, 0.35)",
        backdropFilter: "blur(6px)",
      }}
      onMouseDownCapture={(e) => {
        if (e.button !== 0) return;
        // パネル内の操作（ボタンや入力など）では選択解除しない
        // 背景（この要素自身）をクリックしたときのみ解除
        if (e.currentTarget === e.target) {
          clearSelection({ mode: "idle", nodeId: undefined, linkId: undefined });
        }
      }}
    >
      {/* Node add UI moved to center panel NodePalette */}

      {selectedNode && (
        <section>
          <Header title="📋 Selected Node" />
          <div style={{ marginBottom: "0.35rem" }}>
            <strong>{selectedNode.name}</strong> ({selectedNode.kind})
          </div>
          <InfoLine label="ID" value={selectedNode.id} />
          <InfoLine
            label="Position"
            value={`(${selectedNode.position.map((v) => v.toFixed(2)).join(", ")})`}
          />
          {selectedNode.kind === "PC" && <InfoLine label="IP" value={selectedNode.ip ?? "-"} />}
          {selectedPorts.length > 0 && <PortsList node={selectedNode} ports={selectedPorts} />}
          <ConnectedNodesList selectedNode={selectedNode} links={selectedLinks} allNodes={nodes} />
        </section>
      )}

      {!selectedNode && (
        <section>
          <Header title="🖥️ Nodes" />
          {nodeList.map((n) => (
            <div key={n.id} style={{ marginBottom: "0.35rem" }}>
              • {n.name} ({n.kind})
              <br />
              <span style={{ opacity: 0.8, marginLeft: "0.6rem" }}>
                pos=({n.position.map((v) => v.toFixed(1)).join(", ")}) ip={n.ip ?? "none"}
              </span>
            </div>
          ))}
          {nodeList.length === 0 && <EmptyLine />}
        </section>
      )}

      {!selectedNode && (
        <section>
          <Header title="📘 Routing Summary" top />
          <RoutingSummary routingTable={routingTable} />
        </section>
      )}

      <section>
        <Header title="🔗 Links" top />
        {Object.values(links).map((l) => (
          <div key={l.id} style={{ marginBottom: "0.35rem" }}>
            {l.a} ⇄ {l.b} [{l.up ? "up" : "down"}] {l.bandwidthMbps} Mbps
            {l.subnet && (
              <div style={{ marginLeft: "0.6rem", opacity: 0.85 }}>
                subnet: {l.subnet.network}/{l.subnet.cidr}
              </div>
            )}
          </div>
        ))}
        {Object.keys(links).length === 0 && <EmptyLine />}
      </section>

      <section>
        <Header title="📡 Flows" top />
        {Object.values(flows).length === 0 && <div>None</div>}
        {Object.values(flows).map((f) => (
          <div key={f.id} style={{ marginBottom: "0.35rem" }}>
            {f.proto} {f.path.map(([a, b]) => `${a}→${b}`).join(" ")}{" "}
            ({Math.round(f.progress * 100)}%)
          </div>
        ))}
      </section>

      <footer style={{ marginTop: "1.2rem", fontSize: "0.7rem", opacity: 0.6 }}>
        updated: {new Date(time).toLocaleTimeString()}
      </footer>
    </div>
  );
}

function Header({ title, top }: { title: string; top?: boolean }) {
  return (
    <h3
      style={{
        borderBottom: "1px solid rgba(0, 255, 204, 0.4)",
        paddingBottom: "0.3rem",
        marginTop: top ? "1rem" : 0,
        marginBottom: "0.4rem",
        fontSize: "0.95rem",
      }}
    >
      {title}
    </h3>
  );
}

function EmptyLine() {
  return <div style={{ opacity: 0.7 }}>None</div>;
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ fontSize: "0.78rem", marginBottom: "0.25rem" }}>
      <span style={{ opacity: 0.7 }}>{label}: </span>
      <span>{value}</span>
    </div>
  );
}

const portCatalog: Record<Node3D["kind"], string[]> = {
  PC: ["eth0", "eth1"],
  ROUTER: ["Gig0/0", "Gig0/1", "Gig0/2", "Gig0/3"],
  SWITCH: Array.from({ length: 8 }, (_, idx) => `Fa0/${idx + 1}`),
  SERVER: ["eth0", "eth1"],
};

function getPortsForNode(node: Node3D): string[] {
  return portCatalog[node.kind] ?? [];
}

function PortsList({ node, ports }: { node: Node3D; ports: string[] }) {
  const portsState = useNet((s) => s.ports);
  const setMode = useNet((s) => s.setPortMode);
  const setIp = useNet((s) => s.setPortIp);
  const auto = useNet((s) => s.autoAssignIp);
  if (!ports.length) return null;
  const isL3 = node.kind === "ROUTER" || node.kind === "SWITCH" || node.kind === "SERVER" || node.kind === "PC";
  return (
    <div style={{ marginTop: "0.6rem" }}>
      <div style={{ fontWeight: 600, fontSize: "0.8rem", marginBottom: "0.2rem" }}>Available Ports</div>
      {ports.map((port) => {
        const cfg = portsState[node.id]?.[port] ?? { mode: "dhcp" as const };
        const ip = cfg.ip ?? "";
        return (
          <div key={port} style={{ marginBottom: "0.35rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <div style={{ minWidth: 64 }}>• {port}</div>
              {isL3 && (
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => setMode(node.id, port, "dhcp")}
                    style={{
                      padding: "0.15rem 0.35rem",
                      borderRadius: 4,
                      border: "1px solid rgba(0,255,204,0.35)",
                      background: cfg.mode === "dhcp" ? "rgba(0,255,204,0.25)" : "transparent",
                      color: "#00ffcc",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: "0.72rem",
                    }}
                  >
                    DHCP
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode(node.id, port, "static")}
                    style={{
                      padding: "0.15rem 0.35rem",
                      borderRadius: 4,
                      border: "1px solid rgba(0,255,204,0.35)",
                      background: cfg.mode === "static" ? "rgba(0,255,204,0.25)" : "transparent",
                      color: "#00ffcc",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: "0.72rem",
                    }}
                  >
                    Static
                  </button>
                </div>
              )}
            </div>
            {isL3 && cfg.mode === "static" && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginTop: "0.25rem", marginLeft: "1.2rem" }}>
                <input
                  type="text"
                  value={ip}
                  onChange={(e) => setIp(node.id, port, e.currentTarget.value)}
                  placeholder="192.168.0.10"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: "black",
                    color: "#00ffcc",
                    border: "1px solid rgba(0,255,204,0.35)",
                    borderRadius: 4,
                    padding: "0.2rem 0.35rem",
                    fontFamily: "monospace",
                    fontSize: "0.78rem",
                  }}
                />
                <button
                  type="button"
                  onClick={() => auto(node.id, port)}
                  style={{
                    padding: "0.2rem 0.45rem",
                    borderRadius: 4,
                    border: "1px solid rgba(0,255,204,0.35)",
                    background: "rgba(0,0,0,0.4)",
                    color: "#00ffcc",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: "0.72rem",
                  }}
                >
                  Auto
                </button>
              </div>
            )}
            {isL3 && cfg.mode === "dhcp" && (
              <div style={{ marginTop: "0.15rem", marginLeft: "1.2rem", opacity: 0.75, fontSize: "0.72rem" }}>
                IP: assigned by DHCP
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


function ConnectedNodesList({
  selectedNode,
  links,
  allNodes,
}: {
  selectedNode: { id: string };
  links: Link3D[];
  allNodes: Record<string, Node3D>;
}) {
  return (
    <div style={{ marginTop: "0.6rem" }}>
      <div style={{ fontWeight: 600, fontSize: "0.8rem", marginBottom: "0.2rem" }}>Connected Nodes</div>
      {links.length === 0 && <div style={{ opacity: 0.7 }}>No links</div>}
      {links.map((link) => {
        const peerId = link.a === selectedNode.id ? link.b : link.a;
        const peerNode = allNodes[peerId];
        const peerDisplay = peerNode ? `${peerNode.name} (${peerNode.kind})` : peerId;
        return (
          <div key={link.id} style={{ marginBottom: "0.2rem" }}>
            • {peerDisplay}
            {link.subnet && (
              <span style={{ marginLeft: 6, opacity: 0.85 }}>
                [{link.subnet.network}/{link.subnet.cidr}]
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}


// Button removed: node add UI relocated to NodePalette

type RoutingTable = Record<string, { dest: string; nextHop: string }[]>;

function RoutingSummary({ routingTable }: { routingTable: RoutingTable }) {
  const entries = Object.entries(routingTable ?? {});
  if (entries.length === 0) return <div>No routing data.</div>;

  return (
    <div>
      {entries.map(([node, routes]) => (
        <div key={node} style={{ marginBottom: "0.6rem" }}>
          <strong>{node}</strong>
          {routes.length === 0 && <div style={{ marginLeft: "0.6rem" }}>(no routes)</div>}
          {routes.map((route, idx) => (
            <div key={idx} style={{ marginLeft: "0.6rem" }}>
              → {route.dest} via {route.nextHop}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
