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

const BASE_NODE_COLORS = new Set(["#ffb703", "#8ecae6", "#adb5bd", "#90be6d"].map((c) => c.toLowerCase()));

const hslToHex = (hue: number, saturation: number, lightness: number) => {
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const h = hue / 60;
  const x = c * (1 - Math.abs((h % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (h >= 0 && h < 1) {
    r = c;
    g = x;
  } else if (h >= 1 && h < 2) {
    r = x;
    g = c;
  } else if (h >= 2 && h < 3) {
    g = c;
    b = x;
  } else if (h >= 3 && h < 4) {
    g = x;
    b = c;
  } else if (h >= 4 && h < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const m = lightness - c / 2;
  const toHex = (value: number) => Math.round((value + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const stringHash = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const pickVlanColor = (key: string, taken: Set<string>) => {
  const baseHash = stringHash(key) || 1;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const hue = (baseHash + attempt * 73) % 360;
    const color = hslToHex(hue, 0.78, 0.48).toLowerCase();
    if (!taken.has(color) && !BASE_NODE_COLORS.has(color)) {
      taken.add(color);
      return color;
    }
  }
  return "#ff4f8b";
};

export const ensureVlanColorMap = (
  vlans: string[],
  base?: Record<string, string>
): Record<string, string> => {
  const result: Record<string, string> = {};
  const taken = new Set<string>();
  Object.entries(base ?? {}).forEach(([name, color]) => {
    if (!name || !color) return;
    const normalized = color.toLowerCase();
    if (BASE_NODE_COLORS.has(normalized)) return;
    if (taken.has(normalized)) return;
    result[name] = color;
    taken.add(normalized);
  });
  vlans.forEach((name) => {
    if (!name) return;
    if (!result[name]) {
      const hex = pickVlanColor(name, taken);
      result[name] = hex;
    }
  });
  return result;
};

type VlanType = "normal" | "primary" | "community" | "isolated";

export type SwitchportConfig = {
  mode?: "access" | "trunk" | "private-host" | "private-promiscuous";
  trunkAllowedVlans?: number[];
  trunkNativeVlan?: number;
  trunkPruningVlans?: number[];
  dot1qNativeVlan?: number;
  accessVlan?: number;
  priorityExtend?: { cos?: number; trust?: boolean };
  privateRole?: "host" | "promiscuous";
  privatePrimary?: number;
  privateSecondaries?: number[];
  privateMapping?: { primary: number; secondaries: number[] };
  vtp?: {
    mode?: "server" | "client" | "transparent" | "off";
    domain?: string;
    password?: string;
    pruning?: boolean;
    version?: number;
  };
};

export type SwitchVlanConfig = {
  vlanDatabase: Record<number, { id: number; name?: string; type: VlanType }>;
  vlanInterfaces: Record<number, { id: number; name?: string }>;
  privateVlanAssociations: { primary: number; secondaries: number[] }[];
  debugModules: string[];
  dot1qTagNative: boolean;
  switchports: Record<string, SwitchportConfig>;
  vtp: {
    domain?: string;
    password?: string;
    mode: "server" | "client" | "transparent" | "off";
    pruning: boolean;
    version: number;
    primary: boolean;
    devices: string[];
    interfaces: string[];
    counters: {
      summary: number;
      subset: number;
      req: number;
      join: number;
    };
    lastCleared?: string;
  };
};

const createDefaultSwitchConfig = (): SwitchVlanConfig => ({
  vlanDatabase: {
    1: { id: 1, name: "default", type: "normal" },
  },
  vlanInterfaces: {},
  privateVlanAssociations: [],
  debugModules: [],
  dot1qTagNative: false,
  switchports: {},
  vtp: {
    mode: "server",
    pruning: false,
    version: 3,
    primary: false,
    devices: [],
    interfaces: [],
    counters: {
      summary: 0,
      subset: 0,
      req: 0,
      join: 0,
    },
    lastCleared: undefined,
  },
});

const cloneSwitchConfig = (cfg: SwitchVlanConfig): SwitchVlanConfig => {
  if (typeof structuredClone === "function") {
    return structuredClone(cfg);
  }
  return JSON.parse(JSON.stringify(cfg)) as SwitchVlanConfig;
};

type NetState = {
  nodes: Record<string, Node3D>;
  links: Record<string, Link3D>;
  flows: Record<string, PacketFlow3D>;
  selected: Sel;
  cliNodeId?: string;
  linkingFrom?: string;
  contextMenu?: { visible: boolean; x: number; y: number; nodeId?: string };
  // ポートごとのIP設定
  ports: Record<string, Record<string, { mode: "dhcp" | "static"; ip?: string; maskCidr?: number }>>;
  // IP設定ダイアログの対象ノード
  ipDialogNodeId?: string;
  // UI: サブネットドラッグ時にケーブル上にいるか
  dragOverLink: boolean;
  dragHoverLinkId?: string;
  // UI: 右上パレットの開閉状態
  activePalette: "node" | "subnet" | null;
  // VLAN関連
  vlans: string[];
  activeVlanName?: string;
  nodeVlans: Record<string, string[]>;
  vlanColors: Record<string, string>;
  switchConfigs: Record<string, SwitchVlanConfig>;
  routerVlanWarning: boolean;
  routingTable: Record<string, { dest: string; nextHop: string }[]>;
  linkPulse: Record<string, LinkPulseState[]>;
  subnetCursor24: number;
  subnetCursor30: number;
  addNode(n: Node3D): void;
  addLink(l: Link3D): void;
  removeNode(id: string): void;
  removeLink(id: string): void;
  removeLinksForNode(id: string): void;
  assignSubnetToLink(linkId: string, cidr: number): void;
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
  setPortMask(nodeId: string, port: string, cidr?: number): void;
  autoAssignIp(nodeId: string, port: string): void;
  setLinkStatus(linkId: string, up: boolean): void;
  addVlan(name: string): void;
  setActiveVlan(name?: string): void;
  assignVlanToNode(nodeId: string, vlanName: string): void;
  setRouterVlanWarning(flag: boolean): void;
  getSwitchConfig(nodeId: string): SwitchVlanConfig;
  updateSwitchConfig(nodeId: string, mutator: (cfg: SwitchVlanConfig) => void): void;
  // IP設定ダイアログ制御
  showIpDialog(nodeId: string): void;
  hideIpDialog(): void;
  setDragOverLink(active: boolean): void;
  setDragHoverLink(id?: string): void;
  setActivePalette(palette: "node" | "subnet" | null): void;
  tick(dt: number): void;
};

// ノード間のセグメントごとにDHCP用のネットワークを分けるヘルパー
const getSegmentIndex = (state: NetState, nodeId: string): number | undefined => {
  const origin = state.nodes[nodeId];
  if (!origin) return undefined;
  if (origin.kind === "ROUTER") return undefined;

  const neighbors: Record<string, string[]> = {};
  Object.values(state.nodes).forEach((n) => {
    if (n.kind === "ROUTER") return;
    neighbors[n.id] = [];
  });
  Object.values(state.links).forEach((link) => {
    const aNode = state.nodes[link.a];
    const bNode = state.nodes[link.b];
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
  const idx = (hash % 200) + 1; // 1〜200 を利用
  return idx;
};

// セグメント単位で 192.168.X.Y の未使用IPを探す
const allocateNextIp = (state: NetState, nodeId: string): string | undefined => {
  const node = state.nodes[nodeId];
  if (!node) return undefined;

  const segmentIndex = getSegmentIndex(state, nodeId);

  // ルーターなどセグメント未定義の場合は従来どおりグローバルに割り当て
  if (typeof segmentIndex === "undefined") {
    const usedGlobal = new Set<string>();
    Object.values(state.nodes).forEach((n) => n.ip && usedGlobal.add(n.ip));
    Object.values(state.ports).forEach((m) =>
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

  const used = new Set<string>();
  const registerIfSameSegment = (ip?: string) => {
    if (!ip) return;
    const parts = ip.split(".").map((v) => Number(v));
    if (parts.length === 4 && parts[2] === segmentIndex) {
      used.add(ip);
    }
  };

  Object.values(state.nodes).forEach((n) => registerIfSameSegment(n.ip));
  Object.values(state.ports).forEach((m) =>
    Object.values(m).forEach((p) => registerIfSameSegment(p.ip))
  );

  for (let host = 1; host <= 254; host += 1) {
    const candidate = `192.168.${segmentIndex}.${host}`;
    if (!used.has(candidate)) return candidate;
  }
  return undefined;
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
  dragOverLink: false,
  dragHoverLinkId: undefined,
  activePalette: null,
  vlans: [],
  activeVlanName: undefined,
  nodeVlans: {},
  vlanColors: {},
  switchConfigs: {},
  routerVlanWarning: false,
  // サブネット自動割当用カーソル
  subnetCursor24: 0,
  subnetCursor30: 0,
  routingTable: {},
  linkPulse: {},
  addNode: (n) =>
    set((state) => {
      const nodes = { ...state.nodes, [n.id]: n };
      const routingTable = computeRoutingTable(nodes, state.links);
      const nextState: Partial<NetState> = { nodes, routingTable };
      if (n.kind === "SWITCH" && !state.switchConfigs[n.id]) {
        nextState.switchConfigs = {
          ...state.switchConfigs,
          [n.id]: createDefaultSwitchConfig(),
        };
      }
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
  const ports = { ...state.ports };
  delete ports[id];
  const nodeVlans = { ...state.nodeVlans };
  delete nodeVlans[id];
  const switchConfigs = { ...state.switchConfigs };
  delete switchConfigs[id];
  return {
    nodes,
    links,
    flows,
    routingTable,
    cliNodeId,
    linkingFrom,
    selected,
    ports,
    nodeVlans,
    switchConfigs,
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
  assignSubnetToLink: (linkId, cidr) =>
    set((state) => {
      const link = state.links[linkId];
      if (!link) return state;
      // ネットワーク決定（簡易: 10.0.0.0/8 内で連番）
      let network = "";
      if (cidr === 30) {
        const n = state.subnetCursor30;
        const third = (n * 4) % 256;
        const second = Math.floor((n * 4) / 256) % 256;
        network = `10.${second}.${third}.0`;
      } else if (cidr === 24) {
        const n = state.subnetCursor24 % 256;
        network = `10.${n}.0.0`;
      } else {
        // 未対応CIDRは/30扱い
        const n = state.subnetCursor30;
        const third = (n * 4) % 256;
        const second = Math.floor((n * 4) / 256) % 256;
        network = `10.${second}.${third}.0`;
        cidr = 30;
      }

      const nextLink = { ...state.links[linkId], subnet: { network, cidr } } as Link3D;
      const links = { ...state.links, [linkId]: nextLink };

      // サブネット設定時に、両端ノードのDHCPポートへIPを自動割り当て
      const ports = { ...state.ports };
      const [na, nb, nc, nd] = network.split(".").map((v) => parseInt(v, 10));
      const hostIps: string[] = [];
      if (!Number.isNaN(na) && !Number.isNaN(nb) && !Number.isNaN(nc) && !Number.isNaN(nd)) {
        // シンプルにネットワーク+1, +2 をホストアドレスとして利用
        hostIps.push(`${na}.${nb}.${nc}.${nd + 1}`);
        hostIps.push(`${na}.${nb}.${nc}.${nd + 2}`);
      }

      const assignIpToDhcpPort = (nodeId: string, ip: string | undefined) => {
        if (!ip) return;
        const nodePorts = { ...(ports[nodeId] ?? {}) };
        const entries = Object.entries(nodePorts);
        for (const [p, cfg] of entries) {
          if (cfg.mode === "dhcp" && !cfg.ip) {
            nodePorts[p] = { ...cfg, ip };
            ports[nodeId] = nodePorts;
            return;
          }
        }
      };

      if (hostIps.length >= 2) {
        assignIpToDhcpPort(link.a, hostIps[0]);
        assignIpToDhcpPort(link.b, hostIps[1]);
      }

      const cursor24 = cidr === 24 ? state.subnetCursor24 + 1 : state.subnetCursor24;
      const cursor30 = cidr === 30 ? state.subnetCursor30 + 1 : state.subnetCursor30;
      return { links, ports, subnetCursor24: cursor24, subnetCursor30: cursor30 } as Partial<NetState>;
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
      ports: {},
      vlans: [],
      activeVlanName: undefined,
      nodeVlans: {},
      vlanColors: {},
      switchConfigs: {},
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
      nodePorts[port] = { mode, ip: mode === "dhcp" ? undefined : prev.ip, maskCidr: prev.maskCidr };
      return { ports: { ...state.ports, [nodeId]: nodePorts } };
    }),
  setPortIp: (nodeId, port, ip) =>
    set((state) => {
      const nodePorts = { ...(state.ports[nodeId] ?? {}) };
      const prev = nodePorts[port] ?? { mode: "static" as const };
      nodePorts[port] = { ...prev, ip };
      return { ports: { ...state.ports, [nodeId]: nodePorts } };
    }),
  setPortMask: (nodeId, port, cidr) =>
    set((state) => {
      const nodePorts = { ...(state.ports[nodeId] ?? {}) };
      const prev = nodePorts[port] ?? { mode: "static" as const };
      nodePorts[port] = { ...prev, maskCidr: cidr };
      return { ports: { ...state.ports, [nodeId]: nodePorts } };
    }),
  autoAssignIp: (nodeId, port) =>
    set((state) => {
      const nextIp = allocateNextIp(state as NetState, nodeId);
      if (!nextIp) return state;
      const nodePorts = { ...(state.ports[nodeId] ?? {}) };
      const prev = nodePorts[port] ?? { mode: "static" as const };
      nodePorts[port] = { ...prev, mode: "static", ip: nextIp };
      return { ports: { ...state.ports, [nodeId]: nodePorts } };
    }),
  addVlan: (name) =>
    set((state) => {
      const trimmed = name.trim();
      if (!trimmed) return state;
      if (state.vlans.includes(trimmed)) return state;
      const nextVlans = [...state.vlans, trimmed];
      const nextColors = ensureVlanColorMap(nextVlans, state.vlanColors);
      return {
        vlans: nextVlans,
        vlanColors: nextColors,
      };
    }),
  setActiveVlan: (name) => set(() => ({ activeVlanName: name })),
  assignVlanToNode: (nodeId, vlanName) =>
    set((state) => {
      const trimmed = vlanName.trim();
      if (!trimmed) return state;
      const current = state.nodeVlans[nodeId] ?? [];
      if (current.includes(trimmed)) return state;
      const nextNodeVlans = {
        nodeVlans: {
          ...state.nodeVlans,
          [nodeId]: [...current, trimmed],
        },
      };

      const nodes = { ...state.nodes };
      const node = nodes[nodeId];
      if (!node) {
        return { ...state, ...nextNodeVlans };
      }
      const vlanIdMatch = trimmed.match(/\d+/);
      if (!vlanIdMatch) {
        return { ...state, ...nextNodeVlans };
      }
      const vlanId = Number(vlanIdMatch[0]);
      if (!Number.isFinite(vlanId)) {
        return { ...state, ...nextNodeVlans };
      }
      const existingVlans = node.vlans ?? [];
      if (!existingVlans.includes(vlanId)) {
        nodes[nodeId] = {
          ...node,
          vlans: [...existingVlans, vlanId],
        };
      }
      return {
        ...state,
        ...nextNodeVlans,
        nodes,
      };
    }),
  getSwitchConfig: (nodeId) => {
    const state = get();
    if (state.switchConfigs[nodeId]) {
      return state.switchConfigs[nodeId];
    }
    const cfg = createDefaultSwitchConfig();
    set((prev) => ({
      switchConfigs: {
        ...prev.switchConfigs,
        [nodeId]: cfg,
      },
    }));
    return cfg;
  },
  updateSwitchConfig: (nodeId, mutator) =>
    set((state) => {
      const current = state.switchConfigs[nodeId] ?? createDefaultSwitchConfig();
      const next = cloneSwitchConfig(current);
      mutator(next);
      return {
        switchConfigs: {
          ...state.switchConfigs,
          [nodeId]: next,
        },
      };
    }),
  setLinkStatus: (linkId, up) =>
    set((state) => {
      const link = state.links[linkId];
      if (!link) return state;
      return { links: { ...state.links, [linkId]: { ...link, up } } };
    }),
  setRouterVlanWarning: (flag) =>
    set((state) => (state.routerVlanWarning === flag ? state : { routerVlanWarning: flag })),
  showIpDialog: (nodeId) => set(() => ({ ipDialogNodeId: nodeId })),
  hideIpDialog: () => set(() => ({ ipDialogNodeId: undefined })),
  setDragOverLink: (active) =>
    set((state) => (state.dragOverLink === active ? state : { dragOverLink: active })),
  setDragHoverLink: (id) => set((state) => (state.dragHoverLinkId === id ? state : { dragHoverLinkId: id })),
  setActivePalette: (palette) => set((state) => (state.activePalette === palette ? state : { activePalette: palette })),
  tick: (dt) => {
    const state = get();
    const hasFlows = Object.keys(state.flows).length > 0;
    const hasPulse = Object.keys(state.linkPulse).length > 0;
    if (!hasFlows && !hasPulse) return;

    const speeds: Record<PacketFlow3D["proto"], number> = { ICMP: 0.4, TCP: 0.55, UDP: 0.7 };
    const updates: Partial<NetState> = {};

    if (hasFlows) {
      const nextFlows: Record<string, PacketFlow3D> = {};
      Object.values(state.flows).forEach((flow) => {
        const speed = speeds[flow.proto] ?? speeds.ICMP;
        const progress = flow.progress + dt * speed;
        if (progress < 1) {
          nextFlows[flow.id] = { ...flow, progress };
        }
      });
      updates.flows = nextFlows;
    }

    if (hasPulse) {
      const nextPulse: Record<string, LinkPulseState[]> = {};
      Object.entries(state.linkPulse).forEach(([key, pulses]) => {
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
      updates.linkPulse = nextPulse;
    }

    set(updates);
  },
}));
