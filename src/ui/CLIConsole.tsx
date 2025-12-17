import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onMessage, connectWS, sendCommand } from "@/lib/ws";
import { useNet } from "@/store/netStore";
import { useMission } from "@/store/missionStore";
import { playPing, playMissionComplete } from "@/lib/sound";
import type { Mission } from "@/missions/missions";
import type { Node3D } from "@/types/net";
import type { SwitchVlanConfig } from "@/store/netStore";

type CliMode = "user" | "privileged" | "config" | "interface";

type CommandDefinition = {
  id: string;
  command: string;
  description: string;
  patterns: string[][];
  modes: CliMode[];
  group: {
    node: string;
    section: string;
  };
};

const COMMAND_DEFINITIONS: CommandDefinition[] = [
  {
    id: "enable",
    command: "enable",
    description: "特権EXECモードに入る",
    patterns: [["enable"]],
    modes: ["user", "privileged", "config", "interface"],
    group: { node: "共通", section: "基本操作" },
  },
  {
    id: "disable",
    command: "disable",
    description: "ユーザEXECモードへ戻る",
    patterns: [["disable"]],
    modes: ["privileged", "config", "interface"],
    group: { node: "共通", section: "基本操作" },
  },
  {
    id: "configureTerminal",
    command: "configure terminal",
    description: "グローバル設定モードへ移行",
    patterns: [
      ["configure", "terminal"],
      ["conf", "t"],
    ],
    modes: ["privileged", "config", "interface"],
    group: { node: "共通", section: "基本操作" },
  },
  {
    id: "interface",
    command: "interface <ポート>",
    description: "物理インターフェース設定モードに入る",
    patterns: [["interface"]],
    modes: ["config", "interface"],
    group: { node: "共通", section: "インターフェース操作" },
  },
  {
    id: "interfaceVlan",
    command: "interface vlan <ID>",
    description: "VLANインターフェースを編集",
    patterns: [["interface", "vlan"]],
    modes: ["config", "interface"],
    group: { node: "スイッチ", section: "VLAN/インターフェース" },
  },
  {
    id: "exit",
    command: "exit",
    description: "一段階上のモードへ戻る",
    patterns: [["exit"]],
    modes: ["privileged", "config", "interface"],
    group: { node: "共通", section: "基本操作" },
  },
  {
    id: "end",
    command: "end",
    description: "特権EXECモードへ戻る",
    patterns: [["end"]],
    modes: ["config", "interface"],
    group: { node: "共通", section: "基本操作" },
  },
  {
    id: "show",
    command: "show",
    description: "利用可能な show コマンドを表示",
    patterns: [["show"]],
    modes: ["user", "privileged", "config", "interface"],
    group: { node: "共通", section: "監視/表示" },
  },
  {
    id: "showIp",
    command: "show ip",
    description: "show ip サブコマンドを確認",
    patterns: [["show", "ip"]],
    modes: ["user", "privileged", "config", "interface"],
    group: { node: "共通", section: "監視/表示" },
  },
  {
    id: "showIpInterfaceBrief",
    command: "show ip interface brief",
    description: "各ポートのIPと状態を表示",
    patterns: [
      ["show", "ip", "interface", "brief"],
      ["show", "ip", "int", "brief"],
    ],
    modes: ["user", "privileged", "config", "interface"],
    group: { node: "共通", section: "監視/表示" },
  },
  {
    id: "ipAddress",
    command: "ip address <IP> <MASK>",
    description: "インターフェースにIP/MASKを設定",
    patterns: [["ip", "address"]],
    modes: ["interface"],
    group: { node: "共通", section: "インターフェース操作" },
  },
  {
    id: "noIpAddress",
    command: "no ip address",
    description: "インターフェースのIP設定を削除",
    patterns: [["no", "ip", "address"]],
    modes: ["interface"],
    group: { node: "共通", section: "インターフェース操作" },
  },
  {
    id: "shutdown",
    command: "shutdown",
    description: "インターフェースを shutdown",
    patterns: [["shutdown"]],
    modes: ["interface"],
    group: { node: "共通", section: "インターフェース操作" },
  },
  {
    id: "noShutdown",
    command: "no shutdown",
    description: "インターフェースを no shutdown",
    patterns: [["no", "shutdown"]],
    modes: ["interface"],
    group: { node: "共通", section: "インターフェース操作" },
  },
  {
    id: "help",
    command: "help / ?",
    description: "利用可能な主なコマンドを表示",
    patterns: [["help"]],
    modes: ["user", "privileged", "config", "interface"],
    group: { node: "共通", section: "基本操作" },
  },
  {
    id: "clearVtpCounters",
    command: "clear vtp counters",
    description: "VTPとプルーニングカウンタをクリア",
    patterns: [["clear", "vtp", "counters"]],
    modes: ["privileged", "config", "interface"],
    group: { node: "スイッチ", section: "VTP" },
  },
  {
    id: "debugSwVlan",
    command: "debug sw-vlan [options]",
    description: "VLANマネージャのデバッグを有効化",
    patterns: [["debug", "sw-vlan"]],
    modes: ["privileged", "config", "interface"],
    group: { node: "スイッチ", section: "VLAN/デバッグ" },
  },
  {
    id: "showInterfacesPvlanMapping",
    command: "show interfaces private-vlan mapping",
    description: "SVIのプライベートVLANマッピングを表示",
    patterns: [["show", "interfaces", "private-vlan", "mapping"]],
    modes: ["privileged", "config", "interface"],
    group: { node: "スイッチ", section: "プライベートVLAN" },
  },
  {
    id: "showVlan",
    command: "show vlan [options]",
    description: "VLAN情報を表示",
    patterns: [["show", "vlan"]],
    modes: ["privileged", "config", "interface"],
    group: { node: "スイッチ", section: "VLAN 基本" },
  },
  {
    id: "showVtp",
    command: "show vtp [options]",
    description: "VTPステータス/統計を表示",
    patterns: [["show", "vtp"]],
    modes: ["privileged", "config", "interface"],
    group: { node: "スイッチ", section: "VTP" },
  },
  {
    id: "vtpPrimary",
    command: "vtp primary",
    description: "VTPプライマリサーバに昇格",
    patterns: [["vtp", "primary"]],
    modes: ["privileged", "config", "interface"],
    group: { node: "スイッチ", section: "VTP" },
  },
  {
    id: "vtpBase",
    command: "vtp ...",
    description: "VTPモード/ドメイン/パスワード等を設定",
    patterns: [["vtp"]],
    modes: ["privileged", "config", "interface"],
    group: { node: "スイッチ", section: "VTP" },
  },
  {
    id: "noVtpPruning",
    command: "no vtp pruning",
    description: "VTPプルーニングを無効化",
    patterns: [["no", "vtp", "pruning"]],
    modes: ["privileged", "config", "interface"],
    group: { node: "スイッチ", section: "VTP" },
  },
  {
    id: "vlanDot1qTagNative",
    command: "vlan dot1q tag native",
    description: "ネイティブVLANへのtaggingを有効化",
    patterns: [["vlan", "dot1q", "tag", "native"]],
    modes: ["privileged", "config", "interface"],
    group: { node: "スイッチ", section: "VLAN 拡張" },
  },
  {
    id: "noVlanDot1qTagNative",
    command: "no vlan dot1q tag native",
    description: "ネイティブVLANへのtaggingを無効化",
    patterns: [["no", "vlan", "dot1q", "tag", "native"]],
    modes: ["privileged", "config", "interface"],
    group: { node: "スイッチ", section: "VLAN 拡張" },
  },
  {
    id: "vlanDefine",
    command: "vlan <ID[,ID2]|ID-Range>",
    description: "VLANを作成し必要なら名前を付ける",
    patterns: [["vlan"]],
    modes: ["privileged", "config", "interface"],
    group: { node: "スイッチ", section: "VLAN 基本" },
  },
  {
    id: "privateVlanPrimary",
    command: "private-vlan primary <ID>",
    description: "プライベートVLANをプライマリ化",
    patterns: [["private-vlan", "primary"]],
    modes: ["privileged", "config", "interface"],
    group: { node: "スイッチ", section: "プライベートVLAN" },
  },
  {
    id: "privateVlanCommunity",
    command: "private-vlan community <ID>",
    description: "プライベートVLANをコミュニティ化",
    patterns: [["private-vlan", "community"]],
    modes: ["privileged", "config", "interface"],
    group: { node: "スイッチ", section: "プライベートVLAN" },
  },
  {
    id: "privateVlanIsolated",
    command: "private-vlan isolated <ID>",
    description: "プライベートVLANをアイソレーテッド化",
    patterns: [["private-vlan", "isolated"]],
    modes: ["privileged", "config", "interface"],
    group: { node: "スイッチ", section: "プライベートVLAN" },
  },
  {
    id: "privateVlanAssociation",
    command: "private-vlan association <PRIM> <SEC_LIST>",
    description: "プライマリとセカンダリの関連付け",
    patterns: [["private-vlan", "association"]],
    modes: ["privileged", "config", "interface"],
    group: { node: "スイッチ", section: "プライベートVLAN" },
  },
  {
    id: "privateVlanMapping",
    command: "private-vlan mapping [<PRIM>] <SEC_LIST>",
    description: "インターフェース別プライベートVLAN割り当て",
    patterns: [["private-vlan", "mapping"]],
    modes: ["privileged", "config", "interface"],
    group: { node: "スイッチ", section: "プライベートVLAN" },
  },
  {
    id: "switchportModePrivateVlan",
    command: "switchport mode private-vlan <host|promiscuous>",
    description: "Private-VLANポートモードを設定",
    patterns: [["switchport", "mode", "private-vlan"]],
    modes: ["interface"],
    group: { node: "スイッチ", section: "プライベートVLAN" },
  },
  {
    id: "switchportPriorityExtend",
    command: "switchport priority extend [cos|trust]",
    description: "タグなしフレームの優先度を指定",
    patterns: [["switchport", "priority", "extend"]],
    modes: ["interface"],
    group: { node: "スイッチ", section: "スイッチポート/トランク" },
  },
  {
    id: "noSwitchportPriorityExtend",
    command: "no switchport priority extend",
    description: "priority extend設定を削除",
    patterns: [["no", "switchport", "priority", "extend"]],
    modes: ["interface"],
    group: { node: "スイッチ", section: "スイッチポート/トランク" },
  },
  {
    id: "switchportTrunkAllowed",
    command: "switchport trunk allowed vlan <LIST>",
    description: "トランクで許可するVLANを設定",
    patterns: [["switchport", "trunk", "allowed", "vlan"]],
    modes: ["interface"],
    group: { node: "スイッチ", section: "スイッチポート/トランク" },
  },
  {
    id: "switchportTrunkNative",
    command: "switchport trunk native vlan <ID>",
    description: "トランクのネイティブVLANを設定",
    patterns: [["switchport", "trunk", "native", "vlan"]],
    modes: ["interface"],
    group: { node: "スイッチ", section: "スイッチポート/トランク" },
  },
  {
    id: "switchportTrunkPruning",
    command: "switchport trunk pruning vlan <LIST>",
    description: "トランクのプルーニング対象VLANを設定",
    patterns: [["switchport", "trunk", "pruning", "vlan"]],
    modes: ["interface"],
    group: { node: "スイッチ", section: "スイッチポート/トランク" },
  },
  {
    id: "dot1qVlanNative",
    command: "dot1q vlan native <ID>",
    description: "インターフェースのネイティブVLANを設定",
    patterns: [["dot1q", "vlan", "native"]],
    modes: ["interface"],
    group: { node: "スイッチ", section: "スイッチポート/トランク" },
  },
];

const COMMAND_PATTERN_MAP = COMMAND_DEFINITIONS.reduce(
  (acc, def) => {
    acc[def.id] = def.patterns;
    return acc;
  },
  {} as Record<string, string[][]>
);

type CommandListGroup = {
  node: string;
  sections: { section: string; commands: { id: string; command: string; description: string }[] }[];
};

const COMMAND_GROUPED_LIST: CommandListGroup[] = (() => {
  const nodeOrder: string[] = [];
  const nodeMap = new Map<
    string,
    { sectionOrder: string[]; sectionMap: Map<string, CommandDefinition[]> }
  >();
  COMMAND_DEFINITIONS.forEach((def) => {
    const nodeKey = def.group.node;
    if (!nodeMap.has(nodeKey)) {
      nodeMap.set(nodeKey, { sectionOrder: [], sectionMap: new Map() });
      nodeOrder.push(nodeKey);
    }
    const entry = nodeMap.get(nodeKey)!;
    const sectionKey = def.group.section;
    if (!entry.sectionMap.has(sectionKey)) {
      entry.sectionMap.set(sectionKey, []);
      entry.sectionOrder.push(sectionKey);
    }
    entry.sectionMap.get(sectionKey)!.push(def);
  });
  return nodeOrder.map((nodeKey) => {
    const entry = nodeMap.get(nodeKey)!;
    const sections = entry.sectionOrder.map((section) => ({
      section,
      commands: entry.sectionMap.get(section)!.map(({ id, command, description }) => ({
        id,
        command,
        description,
      })),
    }));
    return { node: nodeKey, sections };
  });
})();

const CLI_COMPLETION_PATTERNS: { tokens: string[]; modes: CliMode[] }[] = COMMAND_DEFINITIONS.flatMap((def) =>
  def.patterns.map((tokens) => ({
    tokens,
    modes: def.modes,
  }))
);

const portCatalog: Record<Node3D["kind"], string[]> = {
  PC: ["eth0", "eth1"],
  ROUTER: ["Gig0/0", "Gig0/1", "Gig0/2", "Gig0/3"],
  SWITCH: Array.from({ length: 8 }, (_, idx) => `Fa0/${idx + 1}`),
  SERVER: ["eth0", "eth1"],
};

function getPortsForNode(node?: Node3D | null): string[] {
  if (!node) return [];
  return portCatalog[node.kind] ?? [];
}

function cidrToMask(cidr: number): string {
  if (cidr < 0 || cidr > 32) return "";
  const mask = (0xffffffff << (32 - cidr)) >>> 0;
  const a = (mask >>> 24) & 0xff;
  const b = (mask >>> 16) & 0xff;
  const c = (mask >>> 8) & 0xff;
  const d = mask & 0xff;
  return `${a}.${b}.${c}.${d}`;
}

function maskToCidr(mask: string): number | undefined {
  const parts = mask.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return undefined;
  const binary = parts.map((p) => p.toString(2).padStart(8, "0")).join("");
  const zeroIndex = binary.indexOf("0");
  if (zeroIndex === -1) return 32;
  const tail = binary.slice(zeroIndex);
  if (tail.includes("1")) return undefined;
  return zeroIndex;
}

function longestCommonPrefix(values: string[]): string {
  if (values.length === 0) return "";
  let prefix = values[0];
  for (let i = 1; i < values.length; i += 1) {
    const value = values[i];
    while (!value.startsWith(prefix) && prefix.length > 0) {
      prefix = prefix.slice(0, -1);
    }
    if (!prefix) break;
  }
  return prefix;
}

function isValidIp(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d+$/.test(part)) return false;
    const n = Number(part);
    return n >= 0 && n <= 255;
  });
}

function findMissionConnectivityKey(mission: Mission, target: string) {
  const goal = mission.goals.find((g) => g.type === "connectivity" && g.to === target);
  if (!goal) return null;
  const from = goal.from ?? mission.setup.nodes[0]?.id ?? "";
  if (!from) return null;
  return {
    storageKey: `${from}->${goal.to}`,
    flagKey: `connectivity:${from}->${goal.to}`,
  } satisfies { storageKey: string; flagKey: string };
}

const VLAN_DEBUG_OPTIONS = [
  "badpmcookies",
  "cfg-vlan",
  "events",
  "ifs",
  "mapping",
  "notification",
  "packets",
  "redundancy",
  "registries",
  "vtp",
] as const;

const VLAN_DEBUG_OPTION_SET = new Set<string>(VLAN_DEBUG_OPTIONS);

const parseVlanId = (value?: string): number | null => {
  if (!value) return null;
  if (!/^\d+$/.test(value)) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1 || num > 4094) return null;
  return num;
};

const parseVlanListExpression = (expr?: string): number[] => {
  if (!expr) return [];
  const cleaned = expr.replace(/\s+/g, "");
  if (!cleaned) return [];
  const collected: number[] = [];
  const segments = cleaned.split(",");
  for (const segment of segments) {
    if (!segment) continue;
    if (segment.includes("-")) {
      const [startRaw, endRaw] = segment.split("-");
      const start = parseVlanId(startRaw);
      const end = parseVlanId(endRaw);
      if (start === null || end === null || end < start) {
        return [];
      }
      for (let n = start; n <= end; n += 1) {
        collected.push(n);
      }
    } else {
      const id = parseVlanId(segment);
      if (id === null) {
        return [];
      }
      collected.push(id);
    }
  }
  return Array.from(new Set(collected)).sort((a, b) => a - b);
};

const formatVlanInterfaceName = (id: number) => `Vlan${id}`;

const vlanIdFromInterface = (name: string): number | null => {
  const match = name.match(/^vlan(\d+)$/i);
  if (!match) return null;
  return parseVlanId(match[1]);
};

const ensureSwitchportConfig = (cfg: SwitchVlanConfig, iface: string) => {
  if (!cfg.switchports[iface]) {
    cfg.switchports[iface] = {};
  }
  return cfg.switchports[iface];
};

const formatVlanTable = (
  cfg: SwitchVlanConfig,
  mode: "brief" | "summary" | "private-vlan" | "id" = "brief",
  targetId?: number
) => {
  const entries = Object.values(cfg.vlanDatabase).sort((a, b) => a.id - b.id);
  if (mode === "summary") {
    const total = entries.length;
    const primary = entries.filter((e) => e.type === "primary").length;
    const secondary = entries.filter((e) => e.type === "community" || e.type === "isolated").length;
    return [
      `VLAN summary: total=${total} primary=${primary} secondary=${secondary}`,
      `Dot1Q native tagging: ${cfg.dot1qTagNative ? "enabled" : "disabled"}`,
    ];
  }
  if (mode === "private-vlan") {
    const lines = ["Primary  Type        Secondary VLANs"];
    cfg.privateVlanAssociations.forEach((assoc) => {
      const prim = assoc.primary.toString().padEnd(8);
      const vlan = cfg.vlanDatabase[assoc.primary];
      const type = (vlan?.type ?? "primary").padEnd(10);
      const secs = assoc.secondaries.join(",") || "-";
      lines.push(`${prim} ${type} ${secs}`);
    });
    if (lines.length === 1) {
      lines.push("（プライベートVLANのマッピングは未設定）");
    }
    return lines;
  }
  const rows = ["VLAN  Name               Type"];
  entries.forEach((entry) => {
    if (mode === "id" && typeof targetId === "number" && entry.id !== targetId) {
      return;
    }
    const idText = entry.id.toString().padEnd(5);
    const nameText = (entry.name ?? `VLAN${entry.id}`).padEnd(18);
    const typeText = entry.type.padEnd(10);
    rows.push(`${idText} ${nameText} ${typeText}`);
  });
  if (rows.length === 1) {
    rows.push("定義済みVLANはありません");
  }
  return rows;
};

const formatPrivateVlanMappings = (cfg: SwitchVlanConfig) => {
  const lines = ["Interface        Primary  Mapping"];
  let hasEntry = false;
  Object.entries(cfg.switchports).forEach(([iface, portCfg]) => {
    if (!portCfg.privateMapping) return;
    hasEntry = true;
    const primary = portCfg.privateMapping.primary ?? "-";
    const secs = portCfg.privateMapping.secondaries?.join(",") || "-";
    lines.push(`${iface.padEnd(16)} ${String(primary).padEnd(8)} ${secs}`);
  });
  if (!hasEntry) {
    lines.push("（インターフェースに対するプライベートVLANマッピングは未設定）");
  }
  return lines;
};

const formatVtpStatusLines = (cfg: SwitchVlanConfig) => {
  const lines = [
    `VTP Version                     : ${cfg.vtp.version}`,
    `Configuration Revision          : ${cfg.vtp.primary ? 1 : 0}`,
    `Maximum VLANs supported locally : 4094`,
    `Number of existing VLANs        : ${Object.keys(cfg.vlanDatabase).length}`,
    `VTP Operating Mode              : ${cfg.vtp.mode}`,
    `VTP Domain Name                 : ${cfg.vtp.domain ?? "(not set)"}`,
    `VTP Pruning Mode                : ${cfg.vtp.pruning ? "enabled" : "disabled"}`,
    `VTP Password                    : ${cfg.vtp.password ? "(set)" : "(not set)"}`,
    `Primary Server                  : ${cfg.vtp.primary ? "yes" : "no"}`,
  ];
  if (cfg.vtp.lastCleared) {
    lines.push(`Counters Last Cleared           : ${cfg.vtp.lastCleared}`);
  }
  return lines;
};

type WSMessage =
  | { event: "log"; message: string; origin?: string }
  | { event: "flow"; from: string; to: string; proto?: "ICMP" | "TCP" | "UDP" }
  | { event: "mission_update"; goal?: string; flag?: string };

type PendingReply = { flagKey: string; message: string; nodeId?: string };

type NodeConsoleProps = {
  nodeId: string;
  nodeName: string;
  logs: string[];
  appendLog(nodeId: string, entry: string): void;
};

function NodeConsole({ nodeId, nodeName, logs, appendLog }: NodeConsoleProps) {
  const node = useNet((s) => s.nodes[nodeId]);
  const links = useNet((s) => s.links);
  const portsState = useNet((s) => s.ports);
  const setPortMode = useNet((s) => s.setPortMode);
  const setPortIp = useNet((s) => s.setPortIp);
  const setPortMask = useNet((s) => s.setPortMask);
  const setLinkStatus = useNet((s) => s.setLinkStatus);
  const switchConfigs = useNet((s) => s.switchConfigs);
  const updateSwitchConfig = useNet((s) => s.updateSwitchConfig);
  const getSwitchConfig = useNet((s) => s.getSwitchConfig);
  const addVlanName = useNet((s) => s.addVlan);
  const logRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<string[]>([]);
  const historyIndex = useRef(-1);
  const [cliMode, setCliMode] = useState<CliMode>("user");
  const [activeInterface, setActiveInterface] = useState<string | null>(null);
  const tabPressRef = useRef(false);

  const switchConfig = node ? switchConfigs[node.id] : undefined;
  const nodeLinks = useMemo(() => Object.values(links).filter((l) => l.a === nodeId || l.b === nodeId), [links, nodeId]);
  const basePorts = useMemo(() => (node ? getPortsForNode(node) : []), [node]);
  const vlanInterfaces = useMemo(() => {
    if (!node || node.kind !== "SWITCH") return [];
    const cfg = switchConfigs[node.id];
    if (!cfg) return [];
    return Object.keys(cfg.vlanInterfaces)
      .map((id) => parseInt(id, 10))
      .filter((id) => Number.isFinite(id))
      .map((id) => formatVlanInterfaceName(id));
  }, [node, switchConfigs]);
  const availablePorts = useMemo(() => {
    if (!node || node.kind === "PC") return [];
    const seen = new Set<string>();
    const merged = [...basePorts, ...vlanInterfaces];
    return merged.filter((port) => {
      if (seen.has(port)) return false;
      seen.add(port);
      return true;
    });
  }, [node, basePorts, vlanInterfaces]);
  const linkByPort = useMemo(() => {
    const map: Record<string, (typeof nodeLinks)[number] | undefined> = {};
    basePorts.forEach((port, idx) => {
      map[port] = nodeLinks[idx];
    });
    return map;
  }, [basePorts, nodeLinks]);
  const portConfig = portsState[nodeId] ?? {};

  const promptLabel = useMemo(() => {
    const base = nodeName;
    switch (cliMode) {
      case "user":
        return `${base}>`;
      case "privileged":
        return `${base}#`;
      case "config":
        return `${base}(config)#`;
      case "interface":
        return activeInterface ? `${base}(config-if-${activeInterface})#` : `${base}(config)#`;
      default:
        return `${base}>`;
    }
  }, [activeInterface, cliMode, nodeName]);

  const printLocal = useCallback(
    (message: string | string[]) => {
      const body = Array.isArray(message) ? message.join("\n") : message;
      appendLog(nodeId, `[local] ${body}`);
    },
    [appendLog, nodeId]
  );

  useEffect(() => {
    setCliMode("user");
    setActiveInterface(null);
  }, [nodeId]);

  useEffect(() => {
    const el = logRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs]);

  const handleTabComplete = useCallback(
    (forceList = false) => {
      if (!inputRef.current) return;
      const inputEl = inputRef.current;
      const value = inputEl.value;
    const caret = inputEl.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const after = value.slice(caret);
    const fragmentMatch = before.match(/([^\s]*)$/);
    const fragment = fragmentMatch ? fragmentMatch[0] : "";
    const fragmentStart = caret - fragment.length;
    const prefixText = before.slice(0, fragmentStart);
    const prefixTokens = prefixText.trim().length ? prefixText.trim().split(/\s+/) : [];
    const tokenIndex = prefixTokens.length;
    const fragmentLower = fragment.toLowerCase();
    const interfaceContext =
      tokenIndex === 1 &&
      prefixTokens[0] &&
      "interface".startsWith(prefixTokens[0].toLowerCase());
      type Candidate = { text: string; hasMore: boolean };
      let candidates: Candidate[] = [];
    if (interfaceContext) {
      candidates = availablePorts
        .filter((port) => port.toLowerCase().startsWith(fragmentLower))
        .map((port) => ({ text: port, hasMore: false }));
    } else {
      const lowerPrefixes = prefixTokens.map((token) => token.toLowerCase());
      CLI_COMPLETION_PATTERNS.forEach((pattern) => {
        if (!pattern.modes.includes(cliMode)) return;
        if (tokenIndex >= pattern.tokens.length) return;
        for (let i = 0; i < tokenIndex; i += 1) {
          const typed = lowerPrefixes[i];
          if (!typed || !pattern.tokens[i].startsWith(typed)) {
            return;
          }
        }
        const suggestion = pattern.tokens[tokenIndex];
        if (!suggestion) return;
        if (fragmentLower && !suggestion.startsWith(fragmentLower)) return;
        candidates.push({
          text: suggestion,
          hasMore: pattern.tokens.length > tokenIndex + 1,
        });
      });
    }
      if (!candidates.length) return;
      const candidateMap = new Map<string, boolean>();
    candidates.forEach(({ text, hasMore }) => {
      candidateMap.set(text, Boolean(candidateMap.get(text)) || hasMore);
    });
      const uniqueCandidates = Array.from(candidateMap.keys());
      const fragmentLowerLen = fragmentLower.length;
      let replacement = fragment;
      if (uniqueCandidates.length === 1) {
        replacement = uniqueCandidates[0];
      } else {
        const common = longestCommonPrefix(uniqueCandidates);
        if (forceList) {
          printLocal(["候補:", ...uniqueCandidates]);
          return;
        }
        if (common.length > fragmentLowerLen) {
          replacement = common;
        } else {
          return;
        }
      }
      const newBefore = value.slice(0, fragmentStart) + replacement;
      let newValue = newBefore + after;
      let nextCaret = fragmentStart + replacement.length;
      if (uniqueCandidates.length === 1) {
        const candidateText = uniqueCandidates[0];
        const hasMore = candidateMap.get(candidateText) ?? false;
        if (hasMore) {
          const charAfter = newValue[nextCaret];
          if (charAfter !== " ") {
            newValue = newValue.slice(0, nextCaret) + " " + newValue.slice(nextCaret);
          }
          nextCaret += 1;
        }
      }
      inputEl.value = newValue;
      inputEl.setSelectionRange(nextCaret, nextCaret);
    },
    [availablePorts, cliMode, printLocal]
  );

  const handleInternalCommand = useCallback(
    (input: string) => {
      if (!node) return false;
      const trimmed = input.trim();
      if (!trimmed) return true;
      const rawTokens = trimmed.split(/\s+/);
      const lowerTokens = rawTokens.map((token) => token.toLowerCase());
      const matchCommand = (patterns: string[][]): number | null => {
        for (const pattern of patterns) {
          if (lowerTokens.length < pattern.length) continue;
          let ok = true;
          for (let i = 0; i < pattern.length; i += 1) {
            const target = pattern[i];
            const fragment = lowerTokens[i];
            if (!target.startsWith(fragment)) {
              ok = false;
              break;
            }
          }
          if (ok) {
            return pattern.length;
          }
        }
        return null;
      };

      const matchPort = (target?: string) => {
        if (!target) return undefined;
        return availablePorts.find((p) => p.toLowerCase() === target.toLowerCase());
      };

      const enableMatch = matchCommand(COMMAND_PATTERN_MAP.enable);
      if (enableMatch !== null) {
        setCliMode("privileged");
        setActiveInterface(null);
        printLocal("特権EXECモードに入りました");
        return true;
      }

      const disableMatch = matchCommand(COMMAND_PATTERN_MAP.disable);
      if (disableMatch !== null) {
        setCliMode("user");
        setActiveInterface(null);
        printLocal("ユーザEXECモードに戻りました");
        return true;
      }

      const configMatch = matchCommand(COMMAND_PATTERN_MAP.configureTerminal);
      if (configMatch !== null) {
        if (node?.kind === "PC") {
          printLocal("PCでは configure terminal は利用できません");
          return true;
        }
        if (cliMode === "user") {
          printLocal("まず enable を実行してください");
          return true;
        }
        setCliMode("config");
        setActiveInterface(null);
        printLocal("コンフィグレーションモード");
        return true;
      }

      const interfaceMatch = matchCommand(COMMAND_PATTERN_MAP.interface);
      if (interfaceMatch !== null) {
        if (node?.kind === "PC") {
          printLocal("PCでは interface コマンドは利用できません");
          return true;
        }
        if (cliMode !== "config" && cliMode !== "interface") {
          printLocal("interface コマンドは configure terminal 後に実行してください");
          return true;
        }
        const maybeVlanKeyword = rawTokens[interfaceMatch];
        if (maybeVlanKeyword && maybeVlanKeyword.toLowerCase() === "vlan") {
          if (!node || node.kind !== "SWITCH") {
            printLocal("VLANインターフェースはスイッチでのみ設定できます");
            return true;
          }
          const vlanIdToken = rawTokens[interfaceMatch + 1];
          const vlanId = parseVlanId(vlanIdToken);
          if (vlanId === null) {
            printLocal("使い方: interface vlan <ID>");
            return true;
          }
          const ifaceName = formatVlanInterfaceName(vlanId);
          updateSwitchConfig(node.id, (cfg) => {
            if (!cfg.vlanDatabase[vlanId]) {
              cfg.vlanDatabase[vlanId] = { id: vlanId, type: "normal" };
            }
            cfg.vlanInterfaces[vlanId] = { id: vlanId, name: `VLAN${vlanId}` };
            ensureSwitchportConfig(cfg, ifaceName);
          });
          setCliMode("interface");
          setActiveInterface(ifaceName);
          printLocal(`Interface ${ifaceName} を編集中`);
          return true;
        }
        const port = rawTokens[interfaceMatch];
        const resolved = matchPort(port);
        if (!resolved) {
          printLocal(`ポート ${port ?? ""} は利用できません`);
          return true;
        }
        setCliMode("interface");
        setActiveInterface(resolved);
        printLocal(`Interface ${resolved} を編集中`);
        return true;
      }

      const exitMatch = matchCommand(COMMAND_PATTERN_MAP.exit);
      if (exitMatch !== null) {
        if (cliMode === "interface") {
          setCliMode("config");
          setActiveInterface(null);
        } else if (cliMode === "config") {
          setCliMode("privileged");
        } else if (cliMode === "privileged") {
          setCliMode("user");
        }
        printLocal("上位モードに戻りました");
        return true;
      }

      const endMatch = matchCommand(COMMAND_PATTERN_MAP.end);
      if (endMatch !== null) {
        setCliMode("privileged");
        setActiveInterface(null);
        printLocal("特権EXECモードに戻りました");
        return true;
      }

      const showGeneralMatch = matchCommand(COMMAND_PATTERN_MAP.show);
      if (showGeneralMatch !== null && lowerTokens.length === showGeneralMatch) {
        printLocal([
          "利用可能な show コマンド:",
          " show ip interface brief  (sh ip int br)",
        ]);
        return true;
      }

      const showIpMatch = matchCommand(COMMAND_PATTERN_MAP.showIp);
      if (showIpMatch !== null && lowerTokens.length === showIpMatch) {
        printLocal(["show ip サブコマンド:", " interface brief"]);
        return true;
      }

      const showIntMatch = matchCommand(COMMAND_PATTERN_MAP.showIpInterfaceBrief);
      if (showIntMatch !== null) {
        const header = "Interface          IP-Address      Mask             Status";
        const rows = availablePorts.map((port) => {
          const cfg = portConfig[port];
          const ip = cfg?.ip ?? "unassigned";
          const mask = typeof cfg?.maskCidr === "number" ? cidrToMask(cfg.maskCidr) : "-";
          const linkState = linkByPort[port];
          const status = linkState ? (linkState.up ? "up" : "administratively down") : "down";
          return `${port.padEnd(18)} ${ip.padEnd(15)} ${mask.padEnd(15)} ${status}`;
        });
        printLocal([header, ...rows]);
        return true;
      }

      const ipAddressMatch = matchCommand(COMMAND_PATTERN_MAP.ipAddress);
      if (ipAddressMatch !== null) {
        if (cliMode !== "interface" || !activeInterface) {
          printLocal("interfaceモードで ip address を設定してください");
          return true;
        }
        const ipStr = rawTokens[ipAddressMatch];
        const maskStr = rawTokens[ipAddressMatch + 1];
        if (!ipStr || !maskStr) {
          printLocal("使い方: ip address <IP> <マスク>");
          return true;
        }
        if (!isValidIp(ipStr)) {
          printLocal(`無効なIPです: ${ipStr}`);
          return true;
        }
        let cidr = maskStr.includes(".") ? maskToCidr(maskStr) : Number(maskStr);
        if (typeof cidr === "undefined" || Number.isNaN(cidr) || cidr < 0 || cidr > 32) {
          printLocal(`無効なマスクです: ${maskStr}`);
          return true;
        }
        setPortMode(node.id, activeInterface, "static");
        setPortIp(node.id, activeInterface, ipStr);
        setPortMask(node.id, activeInterface, cidr);
        const maskText = cidrToMask(cidr);
        printLocal(`${activeInterface} に ${ipStr} ${maskText} を設定しました`);
        return true;
      }

      const noIpMatch = matchCommand(COMMAND_PATTERN_MAP.noIpAddress);
      if (noIpMatch !== null) {
        if (cliMode !== "interface" || !activeInterface) {
          printLocal("interfaceモードで実行してください");
          return true;
        }
        setPortMode(node.id, activeInterface, "static");
        setPortIp(node.id, activeInterface, undefined);
        setPortMask(node.id, activeInterface, undefined);
        printLocal(`${activeInterface} のIP設定を削除しました`);
        return true;
      }

      const shutdownMatch = matchCommand(COMMAND_PATTERN_MAP.shutdown);
      if (shutdownMatch !== null) {
        if (cliMode !== "interface" || !activeInterface) {
          printLocal("interfaceモードで実行してください");
          return true;
        }
        const link = linkByPort[activeInterface];
        if (!link) {
          printLocal(`${activeInterface} はリンクに接続されていません`);
          return true;
        }
        setLinkStatus(link.id, false);
        printLocal(`${activeInterface} を shutdown しました`);
        return true;
      }

      const noShutdownMatch = matchCommand(COMMAND_PATTERN_MAP.noShutdown);
      if (noShutdownMatch !== null) {
        if (cliMode !== "interface" || !activeInterface) {
          printLocal("interfaceモードで実行してください");
          return true;
        }
        const link = linkByPort[activeInterface];
        if (!link) {
          printLocal(`${activeInterface} はリンクに接続されていません`);
          return true;
        }
        setLinkStatus(link.id, true);
        printLocal(`${activeInterface} を no shutdown しました`);
        return true;
      }

      const switchCommandHandled = (() => {
        if (!node || node.kind !== "SWITCH") {
          return false;
        }
        const cfgSnapshot = switchConfig ?? getSwitchConfig(node.id);
        const ensureInterfaceContext = () => {
          if (cliMode !== "interface" || !activeInterface) {
            printLocal("interfaceモードで実行してください");
            return null;
          }
          return activeInterface;
        };
        const ensureVlanExists = (targetId: number, type?: SwitchVlanConfig["vlanDatabase"][number]["type"]) => {
          updateSwitchConfig(node.id, (cfg) => {
            if (!cfg.vlanDatabase[targetId]) {
              cfg.vlanDatabase[targetId] = { id: targetId, type: type ?? "normal" };
            }
            if (type) {
              cfg.vlanDatabase[targetId].type = type;
            }
          });
        };
        const clearVtpCountersMatch = matchCommand(COMMAND_PATTERN_MAP.clearVtpCounters);
        if (clearVtpCountersMatch !== null) {
          updateSwitchConfig(node.id, (cfg) => {
            cfg.vtp.counters = { summary: 0, subset: 0, req: 0, join: 0 };
            cfg.vtp.lastCleared = new Date().toLocaleString();
          });
          printLocal("VTP counters cleared");
          return true;
        }
        const debugSwVlanMatch = matchCommand(COMMAND_PATTERN_MAP.debugSwVlan);
        if (debugSwVlanMatch !== null) {
          const modules = rawTokens.slice(debugSwVlanMatch).map((t) => t.toLowerCase());
          if (!modules.length) {
            const enabled = cfgSnapshot.debugModules.length ? cfgSnapshot.debugModules.join(", ") : "none";
            printLocal(`sw-vlan debug modules: ${enabled}`);
            return true;
          }
          const valid = modules.filter((mod) => VLAN_DEBUG_OPTION_SET.has(mod));
          if (!valid.length) {
            printLocal([
              "利用可能な debug sw-vlan オプション:",
              ...VLAN_DEBUG_OPTIONS.map((opt) => ` ${opt}`),
            ]);
            return true;
          }
          updateSwitchConfig(node.id, (cfg) => {
            const next = new Set(cfg.debugModules);
            valid.forEach((mod) => next.add(mod));
            cfg.debugModules = Array.from(next);
          });
          printLocal(`sw-vlan debug を有効化: ${valid.join(", ")}`);
          return true;
        }
        const showInterfacesPvlanMatch = matchCommand(COMMAND_PATTERN_MAP.showInterfacesPvlanMapping);
        if (showInterfacesPvlanMatch !== null) {
          printLocal(formatPrivateVlanMappings(cfgSnapshot));
          return true;
        }
        const showVlanMatch = matchCommand(COMMAND_PATTERN_MAP.showVlan);
        if (showVlanMatch !== null) {
          const option = lowerTokens[showVlanMatch];
          if (!option || option === "brief") {
            printLocal(formatVlanTable(cfgSnapshot));
          } else if (option === "summary") {
            printLocal(formatVlanTable(cfgSnapshot, "summary"));
          } else if (option === "private-vlan") {
            printLocal(formatVlanTable(cfgSnapshot, "private-vlan"));
          } else if (option === "id") {
            const target = parseVlanId(rawTokens[showVlanMatch + 1]);
            if (target === null) {
              printLocal("使い方: show vlan id <ID>");
            } else {
              printLocal(formatVlanTable(cfgSnapshot, "id", target));
            }
          } else if (option === "name") {
            const nameToken = rawTokens.slice(showVlanMatch + 1).join(" ").trim();
            if (!nameToken) {
              printLocal("使い方: show vlan name <NAME>");
            } else {
              const matched = Object.values(cfgSnapshot.vlanDatabase).filter((entry) =>
                (entry.name ?? `VLAN${entry.id}`).toLowerCase().includes(nameToken.toLowerCase())
              );
              if (!matched.length) {
                printLocal(`名前に '${nameToken}' を含むVLANは見つかりません`);
              } else {
                const lines = ["VLAN  Name               Type"];
                matched
                  .sort((a, b) => a.id - b.id)
                  .forEach((entry) =>
                    lines.push(
                      `${entry.id.toString().padEnd(5)} ${(entry.name ?? `VLAN${entry.id}`).padEnd(18)} ${entry.type.padEnd(10)}`
                    )
                  );
                printLocal(lines);
              }
            }
          } else {
            printLocal("show vlan では brief / summary / private-vlan / id / name を利用できます");
          }
          return true;
        }
        const showVtpMatch = matchCommand(COMMAND_PATTERN_MAP.showVtp);
        if (showVtpMatch !== null) {
          const option = lowerTokens[showVtpMatch] ?? "status";
          if (option === "counters") {
            const { counters, lastCleared } = cfgSnapshot.vtp;
            const lines = [
              `Summary advertisements : ${counters.summary}`,
              `Subset advertisements  : ${counters.subset}`,
              `Request advertisements : ${counters.req}`,
              `Join messages          : ${counters.join}`,
            ];
            if (lastCleared) {
              lines.push(`Last cleared           : ${lastCleared}`);
            }
            printLocal(lines);
          } else if (option === "password") {
            const pwd = cfgSnapshot.vtp.password;
            printLocal(`VTP password: ${pwd ? "*".repeat(Math.min(8, pwd.length)) : "(not set)"}`);
          } else if (option === "devices") {
            if (!cfgSnapshot.vtp.devices.length) {
              printLocal("VTP devices: （未学習）");
            } else {
              printLocal(["VTP devices:", ...cfgSnapshot.vtp.devices.map((dev) => ` ${dev}`)]);
            }
          } else if (option === "interface" || option === "interfaces") {
            if (!cfgSnapshot.vtp.interfaces.length) {
              printLocal("VTP aware interfaces: none");
            } else {
              printLocal(["VTP aware interfaces:", ...cfgSnapshot.vtp.interfaces.map((intf) => ` ${intf}`)]);
            }
          } else {
            printLocal(formatVtpStatusLines(cfgSnapshot));
          }
          return true;
        }
        const vtpPrimaryMatch = matchCommand(COMMAND_PATTERN_MAP.vtpPrimary);
        if (vtpPrimaryMatch !== null) {
          updateSwitchConfig(node.id, (cfg) => {
            cfg.vtp.primary = true;
            cfg.vtp.mode = "server";
          });
          printLocal("このスイッチをVTPプライマリサーバに設定しました");
          return true;
        }
        const noVtpPruningMatch = matchCommand(COMMAND_PATTERN_MAP.noVtpPruning);
        if (noVtpPruningMatch !== null) {
          updateSwitchConfig(node.id, (cfg) => {
            cfg.vtp.pruning = false;
          });
          printLocal("VTPプルーニングを無効化しました");
          return true;
        }
        const vtpGeneralMatch = matchCommand(COMMAND_PATTERN_MAP.vtpBase);
        if (vtpGeneralMatch !== null) {
          const action = lowerTokens[vtpGeneralMatch];
          const interfaceScoped = cliMode === "interface" && activeInterface ? activeInterface : null;
          const describeScope = interfaceScoped ? `interface ${interfaceScoped}` : "global";
          if (!action) {
            printLocal([
              "利用可能な vtp サブコマンド:",
              " vtp mode <server|client|transparent|off>",
              " vtp domain <NAME>",
              " vtp password <SECRET>",
              " vtp pruning",
              " no vtp pruning",
              " vtp version <1-3>",
            ]);
            return true;
          }
          if (action === "mode") {
            const targetMode = lowerTokens[vtpGeneralMatch + 1];
            if (!targetMode || !["server", "client", "transparent", "off"].includes(targetMode)) {
              printLocal("使い方: vtp mode <server|client|transparent|off>");
              return true;
            }
            updateSwitchConfig(node.id, (cfg) => {
              if (interfaceScoped) {
                const portCfg = ensureSwitchportConfig(cfg, interfaceScoped);
                portCfg.vtp = { ...(portCfg.vtp ?? {}), mode: targetMode as SwitchVlanConfig["vtp"]["mode"] };
              } else {
                cfg.vtp.mode = targetMode as SwitchVlanConfig["vtp"]["mode"];
              }
            });
            printLocal(`VTPモードを ${targetMode} (${describeScope}) に設定しました`);
            return true;
          }
          if (action === "domain") {
            const domainName = rawTokens.slice(vtpGeneralMatch + 1).join(" ").trim();
            if (!domainName) {
              printLocal("使い方: vtp domain <NAME>");
              return true;
            }
            updateSwitchConfig(node.id, (cfg) => {
              if (interfaceScoped) {
                const portCfg = ensureSwitchportConfig(cfg, interfaceScoped);
                portCfg.vtp = { ...(portCfg.vtp ?? {}), domain: domainName };
              } else {
                cfg.vtp.domain = domainName;
              }
            });
            printLocal(`VTPドメインを ${domainName} (${describeScope}) に設定しました`);
            return true;
          }
          if (action === "password") {
            const password = rawTokens.slice(vtpGeneralMatch + 1).join(" ").trim();
            if (!password) {
              printLocal("使い方: vtp password <SECRET>");
              return true;
            }
            updateSwitchConfig(node.id, (cfg) => {
              if (interfaceScoped) {
                const portCfg = ensureSwitchportConfig(cfg, interfaceScoped);
                portCfg.vtp = { ...(portCfg.vtp ?? {}), password };
              } else {
                cfg.vtp.password = password;
              }
            });
            printLocal(`VTPパスワードを設定しました (${describeScope})`);
            return true;
          }
          if (action === "pruning") {
            updateSwitchConfig(node.id, (cfg) => {
              if (interfaceScoped) {
                const portCfg = ensureSwitchportConfig(cfg, interfaceScoped);
                portCfg.vtp = { ...(portCfg.vtp ?? {}), pruning: true };
              } else {
                cfg.vtp.pruning = true;
              }
            });
            printLocal(`VTPプルーニングを有効化しました (${describeScope})`);
            return true;
          }
          if (action === "version") {
            const versionToken = rawTokens[vtpGeneralMatch + 1];
            const version = Number(versionToken);
            if (!versionToken || !Number.isInteger(version) || version < 1 || version > 3) {
              printLocal("使い方: vtp version <1-3>");
              return true;
            }
            updateSwitchConfig(node.id, (cfg) => {
              if (interfaceScoped) {
                const portCfg = ensureSwitchportConfig(cfg, interfaceScoped);
                portCfg.vtp = { ...(portCfg.vtp ?? {}), version };
              } else {
                cfg.vtp.version = version;
              }
            });
            printLocal(`VTPバージョンを ${version} に設定しました (${describeScope})`);
            return true;
          }
          printLocal("サポートされていない vtp サブコマンドです");
          return true;
        }
        const noVlanTagNativeMatch = matchCommand(COMMAND_PATTERN_MAP.noVlanDot1qTagNative);
        if (noVlanTagNativeMatch !== null) {
          updateSwitchConfig(node.id, (cfg) => {
            cfg.dot1qTagNative = false;
          });
          printLocal("ネイティブVLANへの dot1q タギングを無効化しました");
          return true;
        }
        const vlanTagNativeMatch = matchCommand(COMMAND_PATTERN_MAP.vlanDot1qTagNative);
        if (vlanTagNativeMatch !== null) {
          updateSwitchConfig(node.id, (cfg) => {
            cfg.dot1qTagNative = true;
          });
          printLocal("ネイティブVLANへの dot1q タギングを有効化しました");
          return true;
        }
        const vlanMatch = matchCommand(COMMAND_PATTERN_MAP.vlanDefine);
        if (vlanMatch !== null) {
          const remainder = rawTokens.slice(vlanMatch);
          if (!remainder.length || remainder[0].toLowerCase() === "dot1q") {
            return false;
          }
          const nameIndex = remainder.findIndex((token) => token.toLowerCase() === "name");
          const vlanExprTokens = nameIndex === -1 ? remainder : remainder.slice(0, nameIndex);
          const vlanExpr = vlanExprTokens.join("");
          const ids = parseVlanListExpression(vlanExpr);
          if (!ids.length) {
            printLocal("使い方: vlan <ID[,ID2]|ID-Range> [name <NAME>]");
            return true;
          }
          const vlanName = nameIndex === -1 ? undefined : remainder.slice(nameIndex + 1).join(" ").trim();
          updateSwitchConfig(node.id, (cfg) => {
            ids.forEach((id) => {
              if (!cfg.vlanDatabase[id]) {
                cfg.vlanDatabase[id] = { id, type: "normal" };
              }
              if (vlanName) {
                cfg.vlanDatabase[id].name = vlanName;
              }
            });
          });
          ids.forEach((id) => addVlanName(`VLAN ${id}`));
          printLocal(`VLAN ${ids.join(",")} を ${vlanName ? `名称 ${vlanName} で` : ""}定義しました`);
          return true;
        }
        const pvlanPrimaryMatch = matchCommand(COMMAND_PATTERN_MAP.privateVlanPrimary);
        if (pvlanPrimaryMatch !== null) {
          const target = parseVlanId(rawTokens[pvlanPrimaryMatch]);
          if (target === null) {
            printLocal("使い方: private-vlan primary <ID>");
            return true;
          }
          ensureVlanExists(target, "primary");
          printLocal(`VLAN ${target} をプライマリVLANに設定しました`);
          return true;
        }
        const pvlanCommunityMatch = matchCommand(COMMAND_PATTERN_MAP.privateVlanCommunity);
        if (pvlanCommunityMatch !== null) {
          const target = parseVlanId(rawTokens[pvlanCommunityMatch]);
          if (target === null) {
            printLocal("使い方: private-vlan community <ID>");
            return true;
          }
          ensureVlanExists(target, "community");
          printLocal(`VLAN ${target} をコミュニティVLANに設定しました`);
          return true;
        }
        const pvlanIsolatedMatch = matchCommand(COMMAND_PATTERN_MAP.privateVlanIsolated);
        if (pvlanIsolatedMatch !== null) {
          const target = parseVlanId(rawTokens[pvlanIsolatedMatch]);
          if (target === null) {
            printLocal("使い方: private-vlan isolated <ID>");
            return true;
          }
          ensureVlanExists(target, "isolated");
          printLocal(`VLAN ${target} をアイソレーテッドVLANに設定しました`);
          return true;
        }
        const pvlanAssocMatch = matchCommand(COMMAND_PATTERN_MAP.privateVlanAssociation);
        if (pvlanAssocMatch !== null) {
          const primary = parseVlanId(rawTokens[pvlanAssocMatch]);
          const secondaryExpr = rawTokens.slice(pvlanAssocMatch + 1).join("");
          if (primary === null || !secondaryExpr) {
            printLocal("使い方: private-vlan association <PRIMARY> <SEC_LIST>");
            return true;
          }
          const secondaries = parseVlanListExpression(secondaryExpr);
          if (!secondaries.length) {
            printLocal("セカンダリVLANを正しく指定してください");
            return true;
          }
          updateSwitchConfig(node.id, (cfg) => {
            const existing = cfg.privateVlanAssociations.find((assoc) => assoc.primary === primary);
            if (existing) {
              existing.secondaries = Array.from(new Set(secondaries));
            } else {
              cfg.privateVlanAssociations.push({
                primary,
                secondaries: Array.from(new Set(secondaries)),
              });
            }
          });
          printLocal(`プライベートVLAN マッピング: ${primary} -> ${secondaries.join(",")}`);
          return true;
        }
        const pvlanMappingMatch = matchCommand(COMMAND_PATTERN_MAP.privateVlanMapping);
        if (pvlanMappingMatch !== null) {
          const rest = rawTokens.slice(pvlanMappingMatch);
          let primary: number | null = null;
          let index = 0;
          const candidate = parseVlanId(rest[0]);
          if (candidate !== null) {
            primary = candidate;
            index = 1;
          } else if (cliMode === "interface" && activeInterface) {
            primary = vlanIdFromInterface(activeInterface);
          }
          const expr = rest.slice(index).join("");
          if (primary === null || !expr) {
            printLocal("使い方: private-vlan mapping [<PRIMARY>] <SEC_LIST>");
            return true;
          }
          const secondaries = parseVlanListExpression(expr);
          if (!secondaries.length) {
            printLocal("セカンダリVLANを正しく指定してください");
            return true;
          }
          const interfaceScoped = cliMode === "interface" && activeInterface ? activeInterface : null;
          updateSwitchConfig(node.id, (cfg) => {
            if (interfaceScoped) {
              const portCfg = ensureSwitchportConfig(cfg, interfaceScoped);
              portCfg.privateMapping = { primary, secondaries };
            }
            const existing = cfg.privateVlanAssociations.find((assoc) => assoc.primary === primary);
            const merged = Array.from(new Set(secondaries));
            if (existing) {
              existing.secondaries = merged;
            } else {
              cfg.privateVlanAssociations.push({ primary, secondaries: merged });
            }
          });
          printLocal(
            `プライベートVLANマッピング (${interfaceScoped ?? "global"}): ${primary} -> ${secondaries.join(",")}`
          );
          return true;
        }
        const switchportModePvlanMatch = matchCommand(COMMAND_PATTERN_MAP.switchportModePrivateVlan);
        if (switchportModePvlanMatch !== null) {
          const iface = ensureInterfaceContext();
          if (!iface) return true;
          const roleToken = lowerTokens[switchportModePvlanMatch];
          if (!roleToken || !["host", "promiscuous"].includes(roleToken)) {
            printLocal("使い方: switchport mode private-vlan <host|promiscuous>");
            return true;
          }
          updateSwitchConfig(node.id, (cfg) => {
            const portCfg = ensureSwitchportConfig(cfg, iface);
            portCfg.mode = roleToken === "host" ? "private-host" : "private-promiscuous";
            portCfg.privateRole = roleToken as "host" | "promiscuous";
          });
          printLocal(`switchport ${iface} を private-vlan ${roleToken} モードに設定しました`);
          return true;
        }
        const noPriorityExtendMatch = matchCommand(COMMAND_PATTERN_MAP.noSwitchportPriorityExtend);
        if (noPriorityExtendMatch !== null) {
          const iface = ensureInterfaceContext();
          if (!iface) return true;
          updateSwitchConfig(node.id, (cfg) => {
            const portCfg = ensureSwitchportConfig(cfg, iface);
            portCfg.priorityExtend = undefined;
          });
          printLocal(`switchport ${iface} の priority extend 設定を削除しました`);
          return true;
        }
        const switchportPriorityMatch = matchCommand(COMMAND_PATTERN_MAP.switchportPriorityExtend);
        if (switchportPriorityMatch !== null) {
          const iface = ensureInterfaceContext();
          if (!iface) return true;
          const action = lowerTokens[switchportPriorityMatch];
          if (!action) {
            printLocal("使い方: switchport priority extend [cos <0-7>|trust]");
            return true;
          }
          if (action === "cos") {
            const cosToken = rawTokens[switchportPriorityMatch + 1];
            const cosValue = Number(cosToken);
            if (!cosToken || !Number.isInteger(cosValue) || cosValue < 0 || cosValue > 7) {
              printLocal("使い方: switchport priority extend cos <0-7>");
              return true;
            }
            updateSwitchConfig(node.id, (cfg) => {
              const portCfg = ensureSwitchportConfig(cfg, iface);
              portCfg.priorityExtend = { ...(portCfg.priorityExtend ?? {}), cos: cosValue };
            });
            printLocal(`switchport ${iface} の priority cos を ${cosValue} に設定しました`);
            return true;
          }
          if (action === "trust") {
            updateSwitchConfig(node.id, (cfg) => {
              const portCfg = ensureSwitchportConfig(cfg, iface);
              portCfg.priorityExtend = { ...(portCfg.priorityExtend ?? {}), trust: true };
            });
            printLocal(`switchport ${iface} を priority extend trust に設定しました`);
            return true;
          }
          printLocal("使い方: switchport priority extend [cos <0-7>|trust]");
          return true;
        }
        const trunkAllowedMatch = matchCommand(COMMAND_PATTERN_MAP.switchportTrunkAllowed);
        if (trunkAllowedMatch !== null) {
          const iface = ensureInterfaceContext();
          if (!iface) return true;
          const expr = rawTokens.slice(trunkAllowedMatch).join("");
          if (!expr || expr.toLowerCase() === "all") {
            updateSwitchConfig(node.id, (cfg) => {
              const portCfg = ensureSwitchportConfig(cfg, iface);
              portCfg.trunkAllowedVlans = undefined;
            });
            printLocal(`switchport ${iface} トランクの許可VLANを ALL に設定しました`);
            return true;
          }
          const vlans = parseVlanListExpression(expr);
          if (!vlans.length) {
            printLocal("使い方: switchport trunk allowed vlan <LIST>");
            return true;
          }
          updateSwitchConfig(node.id, (cfg) => {
            const portCfg = ensureSwitchportConfig(cfg, iface);
            portCfg.trunkAllowedVlans = vlans;
          });
          printLocal(`switchport ${iface} トランク許可VLAN: ${vlans.join(",")}`);
          return true;
        }
        const trunkNativeMatch = matchCommand(COMMAND_PATTERN_MAP.switchportTrunkNative);
        if (trunkNativeMatch !== null) {
          const iface = ensureInterfaceContext();
          if (!iface) return true;
          const vlanToken = rawTokens[trunkNativeMatch];
          const vlanId = parseVlanId(vlanToken);
          if (vlanId === null) {
            printLocal("使い方: switchport trunk native vlan <ID>");
            return true;
          }
          updateSwitchConfig(node.id, (cfg) => {
            const portCfg = ensureSwitchportConfig(cfg, iface);
            portCfg.trunkNativeVlan = vlanId;
          });
          printLocal(`switchport ${iface} のネイティブVLANを ${vlanId} に設定しました`);
          return true;
        }
        const trunkPruningMatch = matchCommand(COMMAND_PATTERN_MAP.switchportTrunkPruning);
        if (trunkPruningMatch !== null) {
          const iface = ensureInterfaceContext();
          if (!iface) return true;
          const expr = rawTokens.slice(trunkPruningMatch).join("");
          if (!expr || expr.toLowerCase() === "all") {
            updateSwitchConfig(node.id, (cfg) => {
              const portCfg = ensureSwitchportConfig(cfg, iface);
              portCfg.trunkPruningVlans = undefined;
            });
            printLocal(`switchport ${iface} の pruning VLAN を ALL に設定しました`);
            return true;
          }
          const vlans = parseVlanListExpression(expr);
          if (!vlans.length) {
            printLocal("使い方: switchport trunk pruning vlan <LIST>");
            return true;
          }
          updateSwitchConfig(node.id, (cfg) => {
            const portCfg = ensureSwitchportConfig(cfg, iface);
            portCfg.trunkPruningVlans = vlans;
          });
          printLocal(`switchport ${iface} の pruning VLAN を ${vlans.join(",")} に設定しました`);
          return true;
        }
        const dot1qNativeMatch = matchCommand(COMMAND_PATTERN_MAP.dot1qVlanNative);
        if (dot1qNativeMatch !== null) {
          const iface = ensureInterfaceContext();
          if (!iface) return true;
          const vlanToken = rawTokens[dot1qNativeMatch];
          const vlanId = parseVlanId(vlanToken);
          if (vlanId === null) {
            printLocal("使い方: dot1q vlan native <ID>");
            return true;
          }
          updateSwitchConfig(node.id, (cfg) => {
            const portCfg = ensureSwitchportConfig(cfg, iface);
            portCfg.dot1qNativeVlan = vlanId;
          });
          printLocal(`interface ${iface} の dot1q ネイティブVLANを ${vlanId} に設定しました`);
          return true;
        }
        return false;
      })();
      if (switchCommandHandled) {
        return true;
      }

      const helpMatch = matchCommand(COMMAND_PATTERN_MAP.help);
      if (helpMatch !== null || trimmed === "?") {
        printLocal([
          "サポートされる主なコマンド:",
          " enable",
          " configure terminal / conf t",
          " interface <port>",
          " ip address <IP> <mask>",
          " no ip address",
          " shutdown / no shutdown",
          " show ip interface brief",
          " exit / end",
        ]);
        return true;
      }

      return false;
    },
    [
      activeInterface,
      availablePorts,
      cliMode,
      linkByPort,
      node,
      nodeId,
      portConfig,
      printLocal,
      setPortIp,
      setPortMask,
      addVlanName,
      getSwitchConfig,
      setPortMode,
      setLinkStatus,
      switchConfig,
      updateSwitchConfig,
    ]
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = inputRef.current?.value.trim();
    if (!value) return;
    appendLog(nodeId, `${promptLabel} ${value}`);
    const handledLocally = handleInternalCommand(value);
    if (!handledLocally) {
      sendCommand(value, nodeId);
    }
    setHistory((prev) => [...prev, value]);
    historyIndex.current = -1;
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const forceList = tabPressRef.current;
      handleTabComplete(forceList);
      tabPressRef.current = true;
      return;
    }
    tabPressRef.current = false;
    if (!history.length) return;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex.current === -1) {
        historyIndex.current = history.length - 1;
      } else if (historyIndex.current > 0) {
        historyIndex.current -= 1;
      }
      const cmd = history[historyIndex.current];
      if (inputRef.current) {
        inputRef.current.value = cmd;
        queueMicrotask(() => inputRef.current?.setSelectionRange(cmd.length, cmd.length));
      }
    } else if (e.key === "ArrowDown") {
      if (historyIndex.current === -1) return;
      e.preventDefault();
      if (historyIndex.current < history.length - 1) {
        historyIndex.current += 1;
        const cmd = history[historyIndex.current];
        if (inputRef.current) {
          inputRef.current.value = cmd;
          queueMicrotask(() => inputRef.current?.setSelectionRange(cmd.length, cmd.length));
        }
      } else {
        historyIndex.current = -1;
        if (inputRef.current) inputRef.current.value = "";
      }
    }
  };

  return (
    <div
      style={{
        flex: "1 0 240px",
        minWidth: 220,
        background: "rgba(0, 0, 0, 0.65)",
        border: "1px solid rgba(0, 255, 204, 0.25)",
        borderRadius: 6,
        padding: "0.4rem",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        color: "#00ffcc",
        fontFamily: "monospace",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: "0.2rem", fontSize: "0.85rem" }}>{nodeName}</div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "rgba(5, 5, 5, 0.65)",
          borderRadius: 4,
          border: "1px solid rgba(0, 255, 204, 0.35)",
        }}
      >
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0.3rem",
            whiteSpace: "pre-line",
          }}
          ref={logRef}
        >
          {logs.length ? logs.join("\n") : "(no activity)"}
        </div>
        <form onSubmit={handleSubmit} style={{ borderTop: "1px solid rgba(0, 255, 204, 0.2)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "0.25rem 0.4rem",
              boxSizing: "border-box",
              fontFamily: "monospace",
              fontSize: "0.9rem",
            }}
          >
            <span
              style={{
                color: "#66ffcc",
                marginRight: "0.4rem",
                whiteSpace: "nowrap",
              }}
            >
              {promptLabel}
            </span>
            <input
              ref={inputRef}
              type="text"
              placeholder={node?.kind === "PC" ? "例: ping 10.0.0.1" : "例: configure terminal"}
              onKeyDown={handleKeyDown}
              style={{
                flex: 1,
                background: "transparent",
                color: "#00ffcc",
                border: "none",
                outline: "none",
                fontFamily: "inherit",
                fontSize: "inherit",
              }}
            />
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CLIConsole() {
  const nodes = useNet((s) => s.nodes);
  const cliNodeId = useNet((s) => s.cliNodeId);
  const setCliNode = useNet((s) => s.setCliNode);
  const setSelection = useNet((s) => s.setSelected);
  const [showCommandList, setShowCommandList] = useState(false);
  const [commandListNode, setCommandListNode] = useState(COMMAND_GROUPED_LIST[0]?.node ?? "");
  const [commandListSection, setCommandListSection] = useState<string | undefined>(undefined);
  const allNodes = useMemo(() => Object.values(nodes), [nodes]);
  const nodeIds = useMemo(() => allNodes.map((n) => n.id), [allNodes]);
  const activeNode = useMemo(() => {
    if (cliNodeId) {
      const node = nodes[cliNodeId];
      if (node) return node;
    }
    return allNodes[0] ?? null;
  }, [cliNodeId, nodes, allNodes]);
  const activeNodeId = activeNode?.id;

  const [logsByNode, setLogsByNode] = useState<Record<string, string[]>>({});
  const nodeIdsRef = useRef<string[]>(nodeIds);
  const addFlow = useNet((s) => s.addFlow);
  const missionProgress = useMission((s) => s.progress);
  const currentMission = useMission((s) => s.current);
  const missionFlags = useMission((s) => s.flags);
  const pendingReplies = useRef<Record<string, PendingReply>>({});

  useEffect(() => {
    nodeIdsRef.current = nodeIds;
  }, [nodeIds]);

  useEffect(() => {
    setLogsByNode((prev) => {
      const next = { ...prev };
      nodeIds.forEach((id) => {
        if (!next[id]) next[id] = [];
      });
      // なくなったノードのログは保持したままでも良いが、今回は保持
      return next;
    });
  }, [nodeIds]);

  const appendLog = useCallback((nodeId: string, entry: string) => {
    setLogsByNode((prev) => ({
      ...prev,
      [nodeId]: [...(prev[nodeId] ?? []), entry],
    }));
  }, []);

  const activeCommandGroup = useMemo(() => {
    if (!COMMAND_GROUPED_LIST.length) return null;
    return COMMAND_GROUPED_LIST.find((group) => group.node === commandListNode) ?? COMMAND_GROUPED_LIST[0];
  }, [commandListNode]);

  const activeSection = useMemo(() => {
    if (!activeCommandGroup || activeCommandGroup.node !== "スイッチ") return undefined;
    if (commandListSection) {
      return activeCommandGroup.sections.find((section) => section.section === commandListSection) ?? undefined;
    }
    return activeCommandGroup.sections[0];
  }, [activeCommandGroup, commandListSection]);

  useEffect(() => {
    if (!activeCommandGroup) return;
    if (activeCommandGroup.node === "スイッチ") {
      const defaultSection = activeCommandGroup.sections[0]?.section;
      if (
        typeof defaultSection !== "undefined" &&
        (typeof commandListSection === "undefined" ||
          !activeCommandGroup.sections.some((section) => section.section === commandListSection))
      ) {
        setCommandListSection(defaultSection);
      }
    } else if (commandListSection) {
      setCommandListSection(undefined);
    }
  }, [activeCommandGroup, commandListSection]);

  const focusCliNode = useCallback(
    (nodeId: string) => {
      setCliNode(nodeId);
      setSelection({ mode: "idle", nodeId, linkId: undefined });
    },
    [setCliNode, setSelection]
  );

  useEffect(() => {
    if (!activeNode && allNodes[0]) {
      focusCliNode(allNodes[0].id);
    }
  }, [activeNode, allNodes, focusCliNode]);

  const broadcastLog = useCallback((entry: string) => {
    setLogsByNode((prev) => {
      const next = { ...prev };
      nodeIdsRef.current.forEach((id) => {
        next[id] = [...(next[id] ?? []), entry];
      });
      return next;
    });
  }, []);

  useEffect(() => {
    connectWS();
    const unsubscribe = onMessage((msg: WSMessage) => {
      if (msg.event === "log") {
        const replyMatch = msg.message.match(/Reply received from\s+(\S+)/);
        if (replyMatch && currentMission) {
          const target = replyMatch[1];
          const info = findMissionConnectivityKey(currentMission, target);
          if (info) {
            pendingReplies.current[info.storageKey] = {
              flagKey: info.flagKey,
              message: msg.message,
              nodeId: msg.origin,
            };
            return;
          }
        }
        if (msg.origin) {
          appendLog(msg.origin, msg.message);
        } else {
          broadcastLog(msg.message);
        }
      } else if (msg.event === "flow") {
        addFlow({
          id: `flow_${Date.now()}`,
          path: [[msg.from, msg.to]],
          progress: 0,
          proto: msg.proto ?? "ICMP",
        });
        useMission.getState().recordConnectivity(msg.from, msg.to);
        playPing();
      } else if (msg.event === "mission_update") {
        if (msg.goal && !(msg.flag && msg.flag.includes("complete"))) {
          broadcastLog(`MISSION: ${msg.goal}`);
        }
        if (msg.flag) {
          useMission.getState().setFlag(msg.flag, true);
          if (msg.flag.includes("complete")) {
            playMissionComplete();
          }
        }
      }
    });
    return unsubscribe;
  }, [addFlow, appendLog, broadcastLog, currentMission]);

  const completionLogged = useRef(false);
  useEffect(() => {
    if (!currentMission) {
      completionLogged.current = false;
      return;
    }
    const done = currentMission.goals.every((goal) => missionProgress[goal.id]);
    if (done && !completionLogged.current) {
      broadcastLog(`MISSION: ${currentMission.title} complete`);
      completionLogged.current = true;
    } else if (!done) {
      completionLogged.current = false;
    }
  }, [currentMission, missionProgress, broadcastLog]);

  useEffect(() => {
    if (!currentMission) {
      pendingReplies.current = {};
      return;
    }
    Object.entries(pendingReplies.current).forEach(([key, entry]) => {
      if (missionFlags[entry.flagKey]) {
        if (entry.nodeId) {
          appendLog(entry.nodeId, entry.message);
        } else {
          broadcastLog(entry.message);
        }
        delete pendingReplies.current[key];
      }
    });
  }, [missionFlags, currentMission, appendLog, broadcastLog]);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 300,
        right: 280,
        height: "30%",
        background: "rgba(10, 10, 10, 0.85)",
        color: "#00ffcc",
        fontFamily: "monospace",
        padding: "0.5rem",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: "0.4rem",
      }}
      onMouseDownCapture={(e) => {
        if (e.button !== 0) return;
        if (e.currentTarget === e.target) {
          setSelection({ mode: "idle", nodeId: undefined, linkId: undefined });
        }
      }}
    >
      {allNodes.length === 0 ? (
        <div style={{ color: "#66ffee", opacity: 0.7 }}>ノードを追加するとCLIが表示されます。</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setShowCommandList(true)}
              style={{
                padding: "0.25rem 0.75rem",
                borderRadius: 999,
                border: "1px solid rgba(0, 255, 204, 0.5)",
                background: showCommandList ? "rgba(0, 255, 204, 0.2)" : "transparent",
                color: "#00ffcc",
                fontFamily: "inherit",
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              コマンド一覧
            </button>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
              <div style={{ fontWeight: 600 }}>{activeNode?.name ?? activeNode?.id ?? "-"} CLI</div>
              <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>ノードをクリックして切り替え</div>
            </div>
          </div>
          {showCommandList && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(1, 5, 10, 0.95)",
                display: "flex",
                justifyContent: "center",
                alignItems: "stretch",
                zIndex: 1200,
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  background: "rgba(3, 10, 16, 0.98)",
                  borderTop: "2px solid rgba(0,255,204,0.45)",
                  borderBottom: "2px solid rgba(0,255,204,0.45)",
                  padding: "1.2rem 1.4rem",
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "0.5rem",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: "1.1rem" }}>実行できるコマンド</div>
                  <button
                    type="button"
                    onClick={() => setShowCommandList(false)}
                    style={{
                      background: "rgba(0, 0, 0, 0.4)",
                      border: "1px solid rgba(0, 255, 204, 0.5)",
                      color: "#00ffcc",
                      borderRadius: 6,
                      fontSize: "0.85rem",
                      padding: "0.2rem 0.75rem",
                      cursor: "pointer",
                    }}
                  >
                    閉じる
                  </button>
                </div>
                {COMMAND_GROUPED_LIST.length > 1 && (
                  <div
                    style={{
                      display: "flex",
                      gap: "0.4rem",
                      marginBottom: "0.6rem",
                      flexWrap: "wrap",
                    }}
                  >
                    {COMMAND_GROUPED_LIST.map((group) => {
                      const active = activeCommandGroup?.node === group.node;
                      return (
                        <button
                          key={group.node}
                          type="button"
                          onClick={() => {
                            setCommandListNode(group.node);
                            if (group.node !== "スイッチ") {
                              setCommandListSection(undefined);
                            }
                          }}
                          style={{
                            padding: "0.25rem 0.75rem",
                            borderRadius: 999,
                            border: active ? "1px solid rgba(0,255,204,0.8)" : "1px solid rgba(0,255,204,0.3)",
                            background: active ? "rgba(0,255,204,0.2)" : "transparent",
                            color: "#00ffcc",
                            fontFamily: "monospace",
                            fontSize: "0.8rem",
                            cursor: "pointer",
                          }}
                        >
                          {group.node}
                        </button>
                      );
                    })}
                  </div>
                )}
                {activeCommandGroup && activeCommandGroup.node === "スイッチ" && activeCommandGroup.sections.length > 1 && (
                  <div
                    style={{
                      display: "flex",
                      gap: "0.4rem",
                      marginBottom: "0.6rem",
                      flexWrap: "wrap",
                    }}
                  >
                    {activeCommandGroup.sections.map((section) => {
                      const active = activeSection?.section === section.section;
                      return (
                        <button
                          key={section.section}
                          type="button"
                          onClick={() => setCommandListSection(section.section)}
                          style={{
                            padding: "0.2rem 0.65rem",
                            borderRadius: 6,
                            border: active ? "1px solid rgba(102,255,204,0.9)" : "1px solid rgba(102,255,204,0.35)",
                            background: active ? "rgba(102,255,204,0.2)" : "transparent",
                            color: "#66ffcc",
                            fontFamily: "monospace",
                            fontSize: "0.76rem",
                            cursor: "pointer",
                          }}
                        >
                          {section.section}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div
                  style={{
                    fontSize: "0.85rem",
                    lineHeight: 1.5,
                    flex: 1,
                    overflowY: "auto",
                    border: "1px solid rgba(0,255,204,0.25)",
                    borderRadius: 8,
                    padding: "0.8rem",
                    background: "rgba(0,0,0,0.35)",
                  }}
                >
                  {activeCommandGroup ? (
                    (activeCommandGroup.node === "スイッチ" && activeSection
                      ? [activeSection]
                      : activeCommandGroup.sections
                    ).map((section) => (
                      <div key={`${activeCommandGroup.node}-${section.section}`} style={{ marginBottom: "0.6rem" }}>
                        <div style={{ fontWeight: 500, marginBottom: "0.15rem", color: "#7be0ff" }}>
                          ・{section.section}
                        </div>
                        {section.commands.map((item) => (
                          <div
                            key={item.id}
                            style={{
                              display: "flex",
                              gap: "0.5rem",
                              padding: "0.25rem 0",
                              borderBottom: "1px solid rgba(0, 255, 204, 0.08)",
                            }}
                          >
                            <span style={{ color: "#66ffcc", whiteSpace: "nowrap" }}>{item.command}</span>
                            <span style={{ flex: 1, opacity: 0.85 }}>{item.description}</span>
                          </div>
                        ))}
                      </div>
                    ))
                  ) : (
                    <div>表示できるコマンドがありません。</div>
                  )}
                </div>
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
            {allNodes.map((node) => (
              <div
                key={node.id}
                style={{
                  padding: "0.2rem 0.55rem",
                  borderRadius: 999,
                  border: "1px solid rgba(0, 255, 204, 0.4)",
                  background: node.id === activeNodeId ? "rgba(0, 255, 204, 0.25)" : "transparent",
                  color: "#00ffcc",
                  fontSize: "0.75rem",
                  transition: "background 0.2s",
                  cursor: "pointer",
                }}
                onClick={() => focusCliNode(node.id)}
              >
                {node.name ?? node.id}
              </div>
            ))}
          </div>
          <div style={{ flex: 1, position: "relative" }}>
            {allNodes.map((node) => (
              <div
                key={node.id}
                style={{
                  position: "absolute",
                  inset: 0,
                  display: node.id === activeNodeId ? "flex" : "none",
                  width: "100%",
                  height: "100%",
                }}
              >
                <NodeConsole
                  nodeId={node.id}
                  nodeName={node.name ?? node.id}
                  logs={logsByNode[node.id] ?? []}
                  appendLog={appendLog}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
