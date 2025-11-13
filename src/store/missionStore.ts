import { create } from "zustand";
import { missions, type Mission } from "@/missions/missions";
import { useNet } from "@/store/netStore";
import type { PacketFlow3D } from "@/types/net";

type GoalProgress = Record<string, boolean>;
type FlagMap = Record<string, boolean>;

const connectivityKey = (from: string, to: string) => `connectivity:${from}->${to}`;
const connectivityPendingKey = (from: string, to: string) => `pending:${from}->${to}`;
const commandKey = (condition: string) => `cmd:${condition}`;

interface MissionState {
  current?: Mission;
  progress: GoalProgress;
  flags: FlagMap;
  completed: Record<string, boolean>;
  setMission(id: string): void;
  resetMission(): void;
  updateProgress(goalId: string, done: boolean): void;
  setFlag(flag: string, value: boolean): void;
  recordConnectivity(from: string, to: string): void;
  markConnectivityComplete(from: string, to: string): void;
  refreshProgress(): void;
  checkCompletion(): boolean;
}

export const useMission = create<MissionState>((set, get) => ({
  current: undefined,
  progress: {},
  flags: {},
  completed: {},
  setMission: (id) => {
    const mission = missions.find((m) => m.id === id);
    if (!mission) return;
    if (get().completed[mission.id]) return;
    const { clear, addNode, addLink, recomputeRouting } = useNet.getState();
    clear();
    mission.setup.nodes.forEach((node) => {
      addNode({
        id: node.id,
        name: node.name ?? node.id,
        kind: node.kind,
        position: node.position,
        vlans: node.vlans,
        ip: node.ip,
      });
    });
    mission.setup.links.forEach((link, idx) => {
      addLink({
        id: `${mission.id}-link-${idx}`,
        a: link.a,
        b: link.b,
        up: link.up ?? true,
        bandwidthMbps: link.bandwidthMbps ?? 1000,
      });
    });
    recomputeRouting();
    set({ current: mission, progress: {}, flags: {} });
    get().refreshProgress();
  },
  resetMission: () => {
    const { clear, recomputeRouting } = useNet.getState();
    clear();
    recomputeRouting();
    set({ current: undefined, progress: {}, flags: {} });
  },
  updateProgress: (goalId, done) => {
    set((state) => ({
      progress: { ...state.progress, [goalId]: done },
    }));
    get().refreshProgress();
  },
  setFlag: (flag, value) => {
    const state = get();
    if (state.flags[flag] === value) return;
    set({ flags: { ...state.flags, [flag]: value } });
    get().refreshProgress();
  },
  recordConnectivity: (from, to) => {
    const key = connectivityPendingKey(from, to);
    const state = get();
    if (state.flags[key]) return;
    set({ flags: { ...state.flags, [key]: true } });
  },
  markConnectivityComplete: (from, to) => {
    const state = get();
    const completeKey = connectivityKey(from, to);
    if (state.flags[completeKey]) return;
    const flags = { ...state.flags, [completeKey]: true };
    const pendingKey = connectivityPendingKey(from, to);
    if (pendingKey in flags) {
      delete flags[pendingKey];
    }
    set({ flags });
    get().refreshProgress();
  },
  refreshProgress: () => {
    const state = get();
    const { current, flags, progress, completed } = state;
    if (!current) return;

    const net = useNet.getState();
    const nextFlags: FlagMap = { ...flags };
    const nextProgress: GoalProgress = {};

    current.goals.forEach((goal) => {
      let done = false;
      switch (goal.type) {
        case "topology": {
          done = current.setup.links.every((required) =>
            Object.values(net.links).some(
              (link) =>
                ((link.a === required.a && link.b === required.b) ||
                  (link.a === required.b && link.b === required.a)) &&
                link.up
            )
          );
          break;
        }
        case "connectivity": {
          if (goal.from && goal.to) {
            const key = connectivityKey(goal.from, goal.to);
            done = Boolean(nextFlags[key]);
          }
          break;
        }
        case "command": {
          if (goal.condition) {
            done = Boolean(nextFlags[commandKey(goal.condition)]);
          }
          break;
        }
        default:
          done = false;
      }
      nextProgress[goal.id] = done;
    });

    const progressKeys = new Set([...Object.keys(progress), ...Object.keys(nextProgress)]);
    let progressChanged = false;
    progressKeys.forEach((key) => {
      if (Boolean(progress[key]) !== Boolean(nextProgress[key])) {
        progressChanged = true;
      }
    });

    const flagKeys = new Set([...Object.keys(flags), ...Object.keys(nextFlags)]);
    let flagsChanged = false;
    flagKeys.forEach((key) => {
      if (Boolean(flags[key]) !== Boolean(nextFlags[key])) {
        flagsChanged = true;
      }
    });

    const completedNow = current.goals.every((goal) => Boolean(nextProgress[goal.id]));
    const completedChanged = completedNow && !completed[current.id];

    if (!progressChanged && !flagsChanged && !completedChanged) return;

    const updates: Partial<MissionState> = {};
    if (progressChanged) updates.progress = nextProgress;
    if (flagsChanged) updates.flags = nextFlags;
    if (completedChanged) updates.completed = { ...completed, [current.id]: true };
    set(updates);
  },
  checkCompletion: () => {
    const { current, progress } = get();
    if (!current) return false;
    return current.goals.every((goal) => progress[goal.id]);
  },
}));

let previousFlows: Record<string, PacketFlow3D> = { ...useNet.getState().flows };

useNet.subscribe((state) => {
  const mission = useMission.getState();
  const removedIds = Object.keys(previousFlows).filter((id) => !(id in state.flows));
  removedIds.forEach((id) => {
    const flow = previousFlows[id];
    if (!flow) return;
    const start = flow.path[0]?.[0];
    const end = flow.path.length ? flow.path[flow.path.length - 1][1] : undefined;
    if (start && end) {
      mission.markConnectivityComplete(start, end);
    }
  });
  previousFlows = state.flows;
  mission.refreshProgress();
});
