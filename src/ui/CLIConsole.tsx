import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onMessage, sendCommand, connectWS } from "@/lib/ws";
import { useNet } from "@/store/netStore";
import { useMission } from "@/store/missionStore";
import { playPing, playMissionComplete } from "@/lib/sound";
import type { Mission } from "@/missions/missions";

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
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyIndex = useRef<number>(-1);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = inputRef.current?.value.trim();
    if (!value) return;
    sendCommand(value, nodeId);
    appendLog(nodeId, `> ${value}`);
    setHistory((prev) => [...prev, value]);
    historyIndex.current = -1;
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (history.length === 0) return;
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
          overflowY: "auto",
          background: "rgba(5, 5, 5, 0.65)",
          borderRadius: 4,
          padding: "0.3rem",
          marginBottom: "0.35rem",
          whiteSpace: "pre-line",
        }}
      >
        {logs.length ? logs.join("\n") : "(no activity)"}
      </div>
      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          placeholder={`Enter command on ${nodeName}`}
          onKeyDown={handleKeyDown}
          style={{
            width: "100%",
            background: "black",
            color: "#00ffcc",
            border: "1px solid rgba(0, 255, 204, 0.3)",
            borderRadius: 4,
            outline: "none",
            fontFamily: "monospace",
            padding: "0.3rem",
            boxSizing: "border-box",
          }}
        />
      </form>
    </div>
  );
}

export default function CLIConsole() {
  const nodes = useNet((s) => s.nodes);
  const cliNodeId = useNet((s) => s.cliNodeId);
  const setCliNode = useNet((s) => s.setCliNode);
  const clearSelection = useNet((s) => s.setSelected);
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

  useEffect(() => {
    if (!activeNode && allNodes[0]) {
      setCliNode(allNodes[0].id);
    }
  }, [activeNode, allNodes, setCliNode]);

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
        clearSelection({ mode: "idle", nodeId: undefined, linkId: undefined });
      }}
    >
      {allNodes.length === 0 ? (
        <div style={{ color: "#66ffee", opacity: 0.7 }}>ノードを追加するとCLIが表示されます。</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ fontWeight: 600 }}>{activeNode?.name ?? activeNode?.id ?? "-"} CLI</div>
            <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>ノードをクリックして切り替え</div>
          </div>
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
                onClick={() => setCliNode(node.id)}
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
