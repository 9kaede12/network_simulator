import { create } from "zustand";
import { findShortestPath } from "@/lib/routing";
import type { Node3D, Link3D, PacketFlow3D } from "@/types/net";

export type LinkPulseState = {
  head: number;
  strength: number;
  dir: -1 | 1;
  color: string;
};

type Sel = { nodeId?: string; linkId?: string; mode: "idle" | "moving" | "linking" };

type NetState = {
  nodes: Record<string, Node3D>;
  links: Record<string, Link3D>;
  flows: Record<string, PacketFlow3D>;
  selected: Sel;
  cliNodeId?: string;
  linkingFrom?: string;
  contextMenu?: { visible: boolean; x: number; y: number; nodeId?: string };
  // ポートごとのIP設定
  ports: Record<string, Record<string, { mode: "dhcp" | "static"; ip?: string }>>;
  routingTable: Record<string, { dest: string; nextHop: string }[]>;
  linkPulse: Record<string, LinkPulseState[]>;
  addNode(n: Node3D): void;
  addLink(l: Link3D): void;
  removeNode(id: string): void;
  removeLink(id: string): void;
  removeLinksForNode(id: string): void;
  addFlow(f: PacketFlow3D): void;
  getPath(from: string, to: string): string[];
  clear(): void;
  recomputeRouting(): void;
  setSelected(s: Partial<Sel>): void;
  setCliNode(id?: string): void;
  beginLink(fromId: string): void;
  endLink(): void;
  showContextMenu(nodeId: string, x: number, y: number): void;
  hideContextMenu(): void;
  triggerLinkPulse(a: string, b: string, position?: number, color?: string): void;
  // ポート設定操作
  setPortMode(nodeId: string, port: string, mode: "dhcp" | "static"): void;
  setPortIp(nodeId: string, port: string, ip?: string): void;
  autoAssignIp(nodeId: string, port: string): void;
  tick(dt: number): void;
};

const computeRoutingTable = (
  nodes: Record<string, Node3D>,
  links: Record<string, Link3D>
): Record<string, { dest: string; nextHop: string }[]> => {
  const table: Record<string, { dest: string; nextHop: string }[]> = {};
  const nodeIds = Object.keys(nodes);

  nodeIds.forEach((src) => {
    const routes: { dest: string; nextHop: string }[] = [];
    nodeIds.forEach((dst) => {
      if (src === dst) return;
      const path = findShortestPath(src, dst, nodes, links);
      if (path.length >= 2) {
        routes.push({ dest: dst, nextHop: path[1] });
      }
    });
    table[src] = routes;
  });

  return table;
};

export const useNet = create<NetState>((set, get) => ({
  nodes: {},
  links: {},
  flows: {},
  selected: { mode: "idle" },
  cliNodeId: undefined,
  linkingFrom: undefined,
  contextMenu: { visible: false, x: 0, y: 0, nodeId: undefined },
  ports: {},
  routingTable: {},
  linkPulse: {},
  addNode: (n) =>
    set((state) => {
      const nodes = { ...state.nodes, [n.id]: n };
      const routingTable = computeRoutingTable(nodes, state.links);
      const nextState: Partial<NetState> = { nodes, routingTable };
      if (!state.cliNodeId) {
        nextState.cliNodeId = n.id;
      }
      return nextState;
    }),
  addLink: (l) =>
    set((state) => {
      const links = { ...state.links, [l.id]: l };
      const routingTable = computeRoutingTable(state.nodes, links);
      return { links, routingTable };
    }),
  removeNode: (id) =>
    set((state) => {
      if (!state.nodes[id]) return state;
      const nodes = { ...state.nodes };
      delete nodes[id];
      const links = { ...state.links };
      Object.entries(links).forEach(([linkId, link]) => {
        if (link.a === id || link.b === id) {
          delete links[linkId];
        }
      });
      const flows = Object.fromEntries(
        Object.entries(state.flows).filter(
          ([, flow]) => !flow.path.some(([a, b]) => a === id || b === id)
        )
      );
      const routingTable = computeRoutingTable(nodes, links);
      const cliNodeId = state.cliNodeId === id ? undefined : state.cliNodeId;
      const linkingFrom = state.linkingFrom === id ? undefined : state.linkingFrom;
      const selected: Sel =
        state.selected.nodeId === id
          ? { mode: "idle" }
          : { ...state.selected, nodeId: state.selected.nodeId === id ? undefined : state.selected.nodeId };
      return {
        nodes,
        links,
        flows,
        routingTable,
        cliNodeId,
        linkingFrom,
        selected,
      };
    }),
  removeLink: (id) =>
    set((state) => {
      if (!state.links[id]) return state;
      const links = { ...state.links };
      delete links[id];
      const routingTable = computeRoutingTable(state.nodes, links);
      return { links, routingTable };
    }),
  removeLinksForNode: (id) =>
    set((state) => {
      const links = Object.fromEntries(
        Object.entries(state.links).filter(([, link]) => link.a !== id && link.b !== id)
      );
      if (Object.keys(links).length === Object.keys(state.links).length) {
        return state;
      }
      const routingTable = computeRoutingTable(state.nodes, links);
      return { links, routingTable };
    }),
  addFlow: (f) =>
    set((state) => {
      if (state.flows[f.id]) {
        return {
          flows: {
            ...state.flows,
            [f.id]: { ...state.flows[f.id], ...f },
          },
        };
      }
      let path = f.path;
      if (path.length === 1) {
        const [from, to] = path[0];
        const hops = findShortestPath(from, to, state.nodes, state.links);
        if (hops.length >= 2) {
          path = hops.slice(0, -1).map((node, idx) => [node, hops[idx + 1]]);
        }
      }
      return {
        flows: {
          ...state.flows,
          [f.id]: {
            ...f,
            path,
          },
        },
      };
    }),
  getPath: (from, to) => findShortestPath(from, to, get().nodes, get().links),
  clear: () =>
    set(() => ({
      nodes: {},
      links: {},
      flows: {},
      selected: { mode: "idle" },
      cliNodeId: undefined,
      routingTable: {},
    })),
  recomputeRouting: () =>
    set(() => ({
      routingTable: computeRoutingTable(get().nodes, get().links),
    })),
  setSelected: (s) => set((state) => ({ selected: { ...state.selected, ...s } })),
  setCliNode: (id) => set(() => ({ cliNodeId: id })),
  beginLink: (fromId) =>
    set((state) => ({ linkingFrom: fromId, selected: { ...state.selected, nodeId: fromId, mode: "linking" } })),
  endLink: () => set((state) => ({ linkingFrom: undefined, selected: { ...state.selected, mode: "idle" } })),
  showContextMenu: (nodeId, x, y) => set(() => ({ contextMenu: { visible: true, x, y, nodeId } })),
  hideContextMenu: () => set(() => ({ contextMenu: { visible: false, x: 0, y: 0, nodeId: undefined } })),
  triggerLinkPulse: (a, b, position = 0, color = "#00ffff") =>
    set((state) => {
      const sorted = [a, b].sort();
      const key = `${sorted[0]}-${sorted[1]}`;
      const clamped = Math.min(1, Math.max(0, position));
      const forward = `${sorted[0]}-${sorted[1]}` === `${a}-${b}`;
      const head = forward ? clamped : 1 - clamped;
      const dir: -1 | 1 = forward ? 1 : -1;
      const existing = state.linkPulse[key] ?? [];
      const filtered = existing.filter((pulse) => pulse.strength > 0.05);
      filtered.push({ head, strength: 1, dir, color });
      return {
        linkPulse: {
          ...state.linkPulse,
          [key]: filtered,
        },
      };
    }),
  setPortMode: (nodeId, port, mode) =>
    set((state) => {
      const nodePorts = { ...(state.ports[nodeId] ?? {}) };
      const prev = nodePorts[port] ?? { mode: "dhcp" as const };
      nodePorts[port] = { mode, ip: mode === "dhcp" ? undefined : prev.ip };
      return { ports: { ...state.ports, [nodeId]: nodePorts } };
    }),
  setPortIp: (nodeId, port, ip) =>
    set((state) => {
      const nodePorts = { ...(state.ports[nodeId] ?? {}) };
      const prev = nodePorts[port] ?? { mode: "static" as const };
      nodePorts[port] = { ...prev, ip };
      return { ports: { ...state.ports, [nodeId]: nodePorts } };
    }),
  autoAssignIp: (nodeId, port) =>
    set((state) => {
      // 192.168.0.1 から順番に未使用を探す簡易実装
      const used = new Set<string>();
      Object.values(state.nodes).forEach((n) => n.ip && used.add(n.ip));
      Object.values(state.ports).forEach((m) =>
        Object.values(m).forEach((p) => p.ip && used.add(p.ip))
      );
      const nextIp = (() => {
        for (let a = 0; a <= 255; a++) {
          for (let b = 1; b <= 254; b++) {
            const candidate = `192.168.${a}.${b}`;
            if (!used.has(candidate)) return candidate;
          }
        }
        return undefined;
      })();
      if (!nextIp) return state;
      const nodePorts = { ...(state.ports[nodeId] ?? {}) };
      const prev = nodePorts[port] ?? { mode: "static" as const };
      nodePorts[port] = { ...prev, mode: "static", ip: nextIp };
      return { ports: { ...state.ports, [nodeId]: nodePorts } };
    }),
  tick: (dt) => {
    const speeds: Record<PacketFlow3D["proto"], number> = { ICMP: 0.4, TCP: 0.55, UDP: 0.7 };
    const nextFlows: Record<string, PacketFlow3D> = {};
    Object.values(get().flows).forEach((flow) => {
      const speed = speeds[flow.proto];
      const progress = flow.progress + dt * speed;
      if (progress < 1) {
        nextFlows[flow.id] = { ...flow, progress };
      }
    });

    const nextPulse: Record<string, LinkPulseState[]> = {};
    Object.entries(get().linkPulse).forEach(([key, pulses]) => {
      const updated = pulses
        .map((pulse) => ({
          head: pulse.head + dt * 1.4 * pulse.dir,
          strength: Math.max(0, pulse.strength - dt * 1.6),
          dir: pulse.dir,
          color: pulse.color,
        }))
        .filter((pulse) => pulse.strength > 0.05 && pulse.head >= -0.2 && pulse.head <= 1.2);
      if (updated.length) {
        nextPulse[key] = updated;
      }
    });

    set({ flows: nextFlows, linkPulse: nextPulse });
  },
}));
