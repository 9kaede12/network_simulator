import type { Node3D, Link3D } from "@/types/net";

function buildAdjacency(nodes: Record<string, Node3D>, links: Record<string, Link3D>) {
  const adj: Record<string, string[]> = {};
  Object.keys(nodes).forEach((id) => {
    adj[id] = [];
  });

  Object.values(links).forEach((link) => {
    if (link.up) {
      if (adj[link.a]) adj[link.a].push(link.b);
      if (adj[link.b]) adj[link.b].push(link.a);
    }
  });

  return adj;
}

export function findShortestPath(
  from: string,
  to: string,
  nodes: Record<string, Node3D>,
  links: Record<string, Link3D>
): string[] {
  if (!nodes[from] || !nodes[to]) return [];
  if (from === to) return [from];

  const adj = buildAdjacency(nodes, links);
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
