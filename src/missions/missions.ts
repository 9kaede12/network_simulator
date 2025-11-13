import type { NodeKind } from "@/types/net";

export interface MissionGoal {
  id: string;
  description: string;
  type: "connectivity" | "topology" | "command";
  from?: string;
  to?: string;
  condition?: string;
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
    id: "basic_ping",
    title: "Ping Across the Sea 🌊",
    description: "Connect PC1 → SW1 → R1 and verify communication using 'ping R1'.",
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
      { id: "g1", description: "Connect all devices", type: "topology" },
      {
        id: "g2",
        description: "Ping from PC1 to R1",
        type: "connectivity",
        from: "PC1",
        to: "R1",
      },
    ],
  },
  {
    id: "vlan_isolation",
    title: "VLAN Island Challenge 🏝️",
    description: "Create VLAN 10 and isolate PC1 from PC2.",
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
        description: "Assign VLAN 10 to PC1",
        type: "command",
        condition: "vlan10_assigned",
      },
      {
        id: "g2",
        description: "PC1 cannot ping PC2",
        type: "connectivity",
        from: "PC1",
        to: "PC2",
      },
    ],
  },
];
