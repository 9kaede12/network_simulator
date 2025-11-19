export type NodeKind = "ROUTER" | "SWITCH" | "PC" | "SERVER";
export type VLANId = number;

export interface Node3D {
  id: string;
  kind: NodeKind;
  name: string;
  position: [number, number, number];
  vlans?: VLANId[];
  ip?: string;
}

export interface Link3D {
  id: string;
  a: string;
  b: string;
  up: boolean;
  bandwidthMbps: number;
  vlanTag?: VLANId;
  subnet?: { network: string; cidr: number };
}

export interface PacketFlow3D {
  id: string;
  path: [string, string][];
  progress: number;
  proto: "ICMP" | "TCP" | "UDP";
}
