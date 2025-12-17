import type { Node3D, Link3D } from "@/types/net";
import type { SwitchVlanConfig } from "@/store/netStore";

const portCatalog: Record<Node3D["kind"], string[]> = {
  PC: ["eth0", "eth1"],
  ROUTER: ["Gig0/0", "Gig0/1", "Gig0/2", "Gig0/3"],
  SWITCH: Array.from({ length: 8 }, (_, idx) => `Fa0/${idx + 1}`),
  SERVER: ["eth0", "eth1"],
};

function getPortsForNode(node: Node3D): string[] {
  return portCatalog[node.kind] ?? [];
}

function getPortForLink(
  switchId: string,
  link: Link3D,
  allLinks: Record<string, Link3D>,
  nodes: Record<string, Node3D>
): string | null {
  const node = nodes[switchId];
  if (!node) return null;
  const ports = getPortsForNode(node);
  
  // ノードに接続されているリンクを取得し、ID順でソート
  const nodeLinks = Object.values(allLinks)
    .filter((l) => (l.a === switchId || l.b === switchId) && l.up)
    .sort((a, b) => a.id.localeCompare(b.id));
  
  const linkIndex = nodeLinks.findIndex((l) => l.id === link.id);
  if (linkIndex >= 0 && linkIndex < ports.length) {
    return ports[linkIndex];
  }
  
  return null;
}

function getSourceVlan(
  nodeId: string,
  nodes: Record<string, Node3D>,
  links: Record<string, Link3D>,
  switchConfigs: Record<string, SwitchVlanConfig>
): number | null {
  const node = nodes[nodeId];
  if (!node) return null;
  
  // PCやROUTERなどのエンドデバイスの場合、接続されているスイッチポートのVLANを取得
  const nodeLinks = Object.values(links).filter((l) => (l.a === nodeId || l.b === nodeId) && l.up);
  if (nodeLinks.length === 0) return null;
  
  // 最初のリンクを使用
  const firstLink = nodeLinks[0];
  const peerId = firstLink.a === nodeId ? firstLink.b : firstLink.a;
  const peerNode = nodes[peerId];
  
  if (peerNode?.kind === "SWITCH") {
    const config = switchConfigs[peerId];
    if (!config) return null;
    
    const portName = getPortForLink(peerId, firstLink, links, nodes);
    if (!portName) return null;
    
    const portConfig = config.switchports[portName];
    if (portConfig?.mode === "access") {
      return portConfig.accessVlan ?? 1;
    }
  }
  
  return null;
}

function buildAdjacency(
  nodes: Record<string, Node3D>,
  links: Record<string, Link3D>,
  sourceVlan: number | null,
  switchConfigs: Record<string, SwitchVlanConfig>
) {
  const adj: Record<string, string[]> = {};
  Object.keys(nodes).forEach((id) => {
    adj[id] = [];
  });

  Object.values(links).forEach((link) => {
    if (!link.up) return;
    
    // VLAN分離チェック
    if (sourceVlan !== null) {
      const aNode = nodes[link.a];
      const bNode = nodes[link.b];
      
      // スイッチ間のリンクの場合、VLANをチェック
      if (aNode?.kind === "SWITCH" && bNode?.kind === "SWITCH") {
        // トランクポートの場合は、許可されたVLANをチェック
        const aConfig = switchConfigs[link.a];
        const bConfig = switchConfigs[link.b];
        // 簡易実装: トランクポートのチェックは省略
      } else if (aNode?.kind === "SWITCH" || bNode?.kind === "SWITCH") {
        // スイッチとエンドデバイスの間のリンク
        const switchId = aNode?.kind === "SWITCH" ? link.a : link.b;
        const config = switchConfigs[switchId];
        if (config) {
          const portName = getPortForLink(switchId, link, links, nodes);
          if (portName) {
            const portConfig = config.switchports[portName];
            if (portConfig?.mode === "access") {
              const portVlan = portConfig.accessVlan ?? 1;
              if (portVlan !== sourceVlan) {
                // VLANが異なる場合はリンクを追加しない
                return;
              }
            }
          }
        }
      }
    }
    
    if (adj[link.a]) adj[link.a].push(link.b);
    if (adj[link.b]) adj[link.b].push(link.a);
  });

  return adj;
}

export function findShortestPath(
  from: string,
  to: string,
  nodes: Record<string, Node3D>,
  links: Record<string, Link3D>,
  switchConfigs?: Record<string, SwitchVlanConfig>
): string[] {
  if (!nodes[from] || !nodes[to]) return [];
  if (from === to) return [from];

  // ソースノードのVLANを取得
  const sourceVlan = switchConfigs
    ? getSourceVlan(from, nodes, links, switchConfigs)
    : null;

  const adj = buildAdjacency(nodes, links, sourceVlan, switchConfigs ?? {});
  const queue: string[][] = [[from]];
  const visited = new Set<string>([from]);

  while (queue.length) {
    const path = queue.shift()!;
    const tail = path[path.length - 1];
    if (tail === to) return path;

    const neighbors = adj[tail] ?? [];
    neighbors.forEach((next) => {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([...path, next]);
      }
    });
  }

  return [];
}
