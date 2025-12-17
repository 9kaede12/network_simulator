import type { NodeKind } from "@/types/net";

export interface MissionGoal {
  id: string;
  description: string;
  type: "connectivity" | "topology" | "command" | "nodes" | "links" | "ip";
  from?: string;
  to?: string;
  condition?: string;
  // nodes: ノード配置系のゴール
  requiredKinds?: NodeKind[];
  minNodes?: number;
  // links: リンク本数のゴール
  minLinks?: number;
  // ip: IPアドレス＋サブネットマスク設定ゴール
  minConfiguredPorts?: number;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  setup: {
    nodes: Array<{
      id: string;
      name?: string;
      kind: NodeKind;
      position: [number, number, number];
      ip?: string;
      vlans?: number[];
    }>;
    links: Array<{
      a: string;
      b: string;
      bandwidthMbps?: number;
      up?: boolean;
    }>;
  };
  goals: MissionGoal[];
}

export const missions: Mission[] = [
  {
    id: "tutorial_nodes",
    title: "ノードを配置しよう 🧱",
    description: "PCノードとルーターノードを少なくとも1つずつ海の上に配置しましょう。",
    setup: {
      nodes: [],
      links: [],
    },
    goals: [
      {
        id: "g1",
        description: "PCとルーターをそれぞれ1台以上配置する",
        type: "nodes",
        requiredKinds: ["PC", "ROUTER"],
      },
    ],
  },
  {
    id: "tutorial_links",
    title: "ケーブルを接続しよう 🔌",
    description: "PCとルーターをケーブルで接続して、一直線のネットワークを作りましょう。",
    setup: {
      nodes: [
        { id: "PC1", name: "PC1", kind: "PC", position: [-4, 0, 0] },
        { id: "R1", name: "R1", kind: "ROUTER", position: [0, 0, 0] },
        { id: "PC2", name: "PC2", kind: "PC", position: [4, 0, 0] },
      ],
      links: [],
    },
    goals: [
      {
        id: "g1",
        description: "PC1–R1–PC2 がケーブルでつながるように接続する",
        type: "links",
        minLinks: 2,
      },
    ],
  },
  {
    id: "tutorial_ip",
    title: "IPアドレスを設定しよう 🧬",
    description: "少なくとも2つのポートにIPアドレスとサブネットマスクを設定しましょう。",
    setup: {
      nodes: [
        { id: "PC1", name: "PC1", kind: "PC", position: [-4, 0, 0] },
        { id: "R1", name: "R1", kind: "ROUTER", position: [0, 0, 0] },
        { id: "PC2", name: "PC2", kind: "PC", position: [4, 0, 0] },
      ],
      links: [
        { a: "PC1", b: "R1" },
        { a: "R1", b: "PC2" },
      ],
    },
    goals: [
      {
        id: "g1",
        description: "2つ以上のポートにIPアドレスとサブネットマスクを設定する",
        type: "ip",
        minConfiguredPorts: 2,
      },
    ],
  },
  {
    id: "tutorial_vlan_vtp",
    title: "VTPを準備しよう ⚙️",
    description: "複数スイッチでVLANを共有するため、VTPモードとドメインを設定しましょう。",
    setup: {
      nodes: [
        { id: "SW1", name: "SW1", kind: "SWITCH", position: [-2, 0, 0] },
        { id: "SW2", name: "SW2", kind: "SWITCH", position: [2, 0, 0] },
      ],
      links: [{ a: "SW1", b: "SW2" }],
    },
    goals: [
      {
        id: "g1",
        description: "VTPモードやドメイン名を設定する",
        type: "command",
        condition: "tutorial_vtp_configured",
      },
    ],
  },
  {
    id: "tutorial_vlan_create",
    title: "VLANを作成しよう 🧩",
    description: "VLAN 10 を作成して名前を設定しましょう。",
    setup: {
      nodes: [{ id: "SW1", name: "SW1", kind: "SWITCH", position: [0, 0, 0] }],
      links: [],
    },
    goals: [
      {
        id: "g1",
        description: "VLAN 10 を作成し、必要なら名前を付ける",
        type: "command",
        condition: "tutorial_vlan_created",
      },
    ],
  },
  {
    id: "tutorial_vlan_ports",
    title: "ポートをVLANに割り当てよう 🔌",
    description: "アクセスポートを VLAN 10 に所属させましょう。",
    setup: {
      nodes: [
        { id: "PC1", name: "PC1", kind: "PC", position: [-4, 0, 0] },
        { id: "PC2", name: "PC2", kind: "PC", position: [-4, 0, 2] },
        { id: "SW1", name: "SW1", kind: "SWITCH", position: [0, 0, 0] },
      ],
      links: [
        { a: "PC1", b: "SW1" },
        { a: "PC2", b: "SW1" },
      ],
    },
    goals: [
      {
        id: "g1",
        description: "アクセスポートを VLAN 10 に設定する",
        type: "command",
        condition: "tutorial_ports_assigned",
      },
    ],
  },
  {
    id: "tutorial_vlan_svi",
    title: "SVIを設定しよう 🛰️",
    description: "VLAN 10 のインターフェースに IP を設定しましょう。",
    setup: {
      nodes: [{ id: "SW1", name: "SW1", kind: "SWITCH", position: [0, 0, 0] }],
      links: [],
    },
    goals: [
      {
        id: "g1",
        description: "VLAN 10 のSVIに 192.168.10.1/24 を設定する",
        type: "command",
        condition: "tutorial_svi_configured",
      },
    ],
  },
  {
    id: "tutorial_vlan_verify",
    title: "設定を確認して保存しよう ✅",
    description: "`show vlan brief` などで状態を確認し、設定を保存しましょう。",
    setup: {
      nodes: [{ id: "SW1", name: "SW1", kind: "SWITCH", position: [0, 0, 0] }],
      links: [],
    },
    goals: [
      {
        id: "g1",
        description: "VLAN情報を表示して確認する",
        type: "command",
        condition: "tutorial_vlan_verified",
      },
    ],
  },
  {
    id: "basic_ping",
    title: "海を越えてPingしよう 🌊",
    description: "PC1 → SW1 → R1 を接続し、PC1から 'ping R1' で疎通を確認しましょう。",
    setup: {
      nodes: [
        { id: "PC1", name: "PC1", kind: "PC", position: [-4, 0, 0] },
        { id: "SW1", name: "SW1", kind: "SWITCH", position: [0, 0, 0] },
        { id: "R1", name: "R1", kind: "ROUTER", position: [4, 0, 0] },
      ],
      links: [
        { a: "PC1", b: "SW1" },
        { a: "SW1", b: "R1" },
      ],
    },
    goals: [
      { id: "g1", description: "すべてのデバイスをケーブルで接続する", type: "topology" },
      {
        id: "g2",
        description: "PC1 から R1 へ ping を成功させる",
        type: "connectivity",
        from: "PC1",
        to: "R1",
      },
    ],
  },
  {
    id: "vlan_isolation",
    title: "VLAN アイランドチャレンジ 🏝️",
    description: "VLAN 10 を作成して、PC1 と PC2 を分離しましょう。",
    setup: {
      nodes: [
        { id: "PC1", name: "PC1", kind: "PC", position: [-4, 0, 0] },
        { id: "PC2", name: "PC2", kind: "PC", position: [-2, 0, 2] },
        { id: "SW1", name: "SW1", kind: "SWITCH", position: [0, 0, 0] },
      ],
      links: [
        { a: "PC1", b: "SW1" },
        { a: "PC2", b: "SW1" },
      ],
    },
    goals: [
      {
        id: "g1",
        description: "PC1 を VLAN 10 に所属させる",
        type: "command",
        condition: "vlan10_assigned",
      },
      {
        id: "g2",
        description: "PC1 から PC2 へ ping できない状態にする",
        type: "connectivity",
        from: "PC1",
        to: "PC2",
      },
    ],
  },
];
