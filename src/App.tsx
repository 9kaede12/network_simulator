import CanvasRoot from "@/canvas/CanvasRoot";
import { useNet, ensureVlanColorMap } from "@/store/netStore";
import { useEffect, useState } from "react";
import CLIConsole from "@/ui/CLIConsole";
import SidePanel from "@/ui/SidePanel";
import MissionPanel from "@/ui/MissionPanel";
import { playWaveLoop } from "@/lib/sound";
import NodePalette from "@/ui/NodePalette";
import NodeContextMenu from "@/ui/NodeContextMenu";
import IpConfigDialog from "@/ui/IpConfigDialog";
import StartScreen from "@/ui/StartScreen";
import { useMission } from "@/store/missionStore";

export default function App() {
  const addNode = useNet((s) => s.addNode);
  const addLink = useNet((s) => s.addLink);
  const recomputeRouting = useNet((s) => s.recomputeRouting);
  const routerVlanWarning = useNet((s) => s.routerVlanWarning);
  const setRouterVlanWarning = useNet((s) => s.setRouterVlanWarning);
  const setMission = useMission((s) => s.setMission);
  const currentMission = useMission((s) => s.current);
  const isTutorial = Boolean(currentMission?.id?.startsWith("tutorial_"));
  const [started, setStarted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newGameDialogOpen, setNewGameDialogOpen] = useState(false);
  const [newGameName, setNewGameName] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [availableSaves, setAvailableSaves] = useState<string[]>([]);
  const [currentSessionName, setCurrentSessionName] = useState<string | null>(null);

  useEffect(() => {
    addNode({ id: "PC1", kind: "PC", name: "PC1", position: [-4, 0, 0] });
    addNode({ id: "R1", kind: "ROUTER", name: "R1", position: [0, 0, 0] });
    addNode({ id: "PC2", kind: "PC", name: "PC2", position: [4, 0, 0] });
    addLink({ id: "L1", a: "PC1", b: "R1", up: true, bandwidthMbps: 100 });
    addLink({ id: "L2", a: "R1", b: "PC2", up: true, bandwidthMbps: 100 });
    recomputeRouting();
  }, [addNode, addLink, recomputeRouting]);

  useEffect(() => {
    const stop = playWaveLoop();
    return stop;
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#061b2b",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        style={{
          position: "absolute",
          top: 8,
          left: isTutorial ? 308 : 8,
          width: 44,
          height: 44,
          borderRadius: 999,
          border: "1.5px solid rgba(0,255,204,0.75)",
          background: "rgba(0,0,0,0.7)",
          color: "#00ffcc",
          fontSize: "1.35rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 40,
        }}
        aria-label="Settings"
        onClick={() => setSettingsOpen((prev) => !prev)}
      >
        ⚙
      </button>
      {settingsOpen && (
        <div
          style={{
            position: "absolute",
            top: 60,
            left: isTutorial ? 308 : 8,
            padding: "0.45rem 0.7rem",
            borderRadius: 8,
            border: "1px solid rgba(0,255,204,0.65)",
            background: "rgba(0, 0, 0, 0.88)",
            color: "#00ffcc",
            fontFamily: "monospace",
            fontSize: "0.85rem",
            zIndex: 39,
            minWidth: 160,
            boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
          }}
        >
          <div
            style={{
              padding: "0.35rem 0.4rem",
              borderRadius: 4,
              cursor: "pointer",
              border: "1px solid rgba(0,255,204,0.35)",
              background: "rgba(0,0,0,0.6)",
            }}
            onClick={() => {
              setSaveName(currentSessionName ?? "");
              setSaveDialogOpen(true);
            }}
          >
            データをセーブする
          </div>
          <div
            style={{
              marginTop: "0.35rem",
              padding: "0.35rem 0.4rem",
              borderRadius: 4,
              cursor: "pointer",
              border: "1px solid rgba(255,100,100,0.7)",
              background: "rgba(80,0,0,0.8)",
              color: "#ff6b6b",
              textAlign: "center",
            }}
            onClick={() => {
              setSettingsOpen(false);
              setStarted(false);
            }}
          >
            終了する
          </div>
        </div>
      )}
      {saveDialogOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.45)",
            zIndex: 2500,
          }}
          onMouseDown={() => setSaveDialogOpen(false)}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              minWidth: 300,
              maxWidth: 420,
              background: "rgba(4,12,18,0.98)",
              borderRadius: 10,
              border: "1px solid rgba(0,255,204,0.55)",
              padding: "0.9rem 1rem",
              color: "#00ffcc",
              fontFamily: "monospace",
              boxSizing: "border-box",
              boxShadow: "0 10px 28px rgba(0,0,0,0.55)",
            }}
          >
            <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem" }}>
              セーブデータ名を入力
            </div>
            <div style={{ fontSize: "0.78rem", marginBottom: "0.35rem", opacity: 0.8 }}>
              例: lesson1 / my-lab
            </div>
            <input
              autoFocus
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.currentTarget.value)}
              style={{
                width: "100%",
                background: "black",
                color: "#00ffcc",
                borderRadius: 4,
                border: "1px solid rgba(0,255,204,0.45)",
                padding: "0.25rem 0.4rem",
                fontFamily: "monospace",
                fontSize: "0.8rem",
                marginBottom: "0.6rem",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => setSaveDialogOpen(false)}
                style={{
                  padding: "0.25rem 0.6rem",
                  borderRadius: 4,
                  border: "1px solid rgba(0,255,204,0.35)",
                  background: "transparent",
                  color: "#00ffcc",
                  fontFamily: "monospace",
                  fontSize: "0.78rem",
                  cursor: "pointer",
                }}
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  const name = saveName.trim();
                  if (!name) {
                    setSaveDialogOpen(false);
                    return;
                  }
                  const { nodes, links, ports, vlans, nodeVlans, activeVlanName, vlanColors, switchConfigs } =
                    useNet.getState();
                  const payload = {
                    name,
                    savedAt: new Date().toISOString(),
                    nodes,
                    links,
                    ports,
                    vlans,
                    nodeVlans,
                    activeVlanName,
                    vlanColors,
                    switchConfigs,
                  };
                  try {
                    window.localStorage.setItem(
                      `network-sea:save:${name}`,
                      JSON.stringify(payload)
                    );
                  } catch {
                    // localStorage が使えない場合は黙って失敗
                  }
                  setSaveDialogOpen(false);
                }}
                style={{
                  padding: "0.25rem 0.8rem",
                  borderRadius: 4,
                  border: "1px solid rgba(0,255,204,0.75)",
                  background: "rgba(0,255,204,0.2)",
                  color: "#00ffcc",
                  fontFamily: "monospace",
                  fontSize: "0.78rem",
                  cursor: "pointer",
                }}
              >
                セーブ
              </button>
            </div>
          </div>
        </div>
      )}
      {routerVlanWarning && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.45)",
            zIndex: 2500,
          }}
          onMouseDown={() => setRouterVlanWarning(false)}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              minWidth: 320,
              maxWidth: 480,
              background: "rgba(4,12,18,0.98)",
              borderRadius: 10,
              border: "1px solid rgba(0,255,204,0.55)",
              padding: "0.9rem 1rem",
              color: "#00ffcc",
              fontFamily: "monospace",
              boxSizing: "border-box",
              boxShadow: "0 10px 28px rgba(0,0,0,0.55)",
            }}
          >
            <div style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              ルーターはVLANに所属できません
            </div>
            <div style={{ fontSize: "0.8rem", opacity: 0.85, marginBottom: "0.8rem" }}>
              VLANを設定する場合は、スイッチやPC、サーバーなどのノードを選択してください。
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setRouterVlanWarning(false)}
                style={{
                  padding: "0.3rem 0.9rem",
                  borderRadius: 4,
                  border: "1px solid rgba(0,255,204,0.65)",
                  background: "rgba(0,255,204,0.12)",
                  color: "#00ffcc",
                  fontFamily: "monospace",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      {newGameDialogOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.45)",
            zIndex: 2500,
          }}
          onMouseDown={() => setNewGameDialogOpen(false)}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              minWidth: 360,
              maxWidth: 560,
              background: "rgba(4,12,18,0.98)",
              borderRadius: 10,
              border: "1px solid rgba(0,255,204,0.55)",
              padding: "0.9rem 1rem",
              color: "#00ffcc",
              fontFamily: "monospace",
              boxSizing: "border-box",
              boxShadow: "0 10px 28px rgba(0,0,0,0.55)",
            }}
          >
            <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem" }}>ニューゲーム</div>
            <div style={{ fontSize: "0.78rem", marginBottom: "0.35rem", opacity: 0.8 }}>
              セーブデータ名を入力してください
            </div>
            <input
              autoFocus
              type="text"
              value={newGameName}
              onChange={(e) => setNewGameName(e.currentTarget.value)}
              style={{
                width: "70%",
                background: "black",
                color: "#00ffcc",
                borderRadius: 4,
                border: "1px solid rgba(0,255,204,0.45)",
                padding: "0.25rem 0.4rem",
                fontFamily: "monospace",
                fontSize: "0.8rem",
                marginBottom: "0.6rem",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => setNewGameDialogOpen(false)}
                style={{
                  padding: "0.25rem 0.6rem",
                  borderRadius: 4,
                  border: "1px solid rgba(0,255,204,0.35)",
                  background: "transparent",
                  color: "#00ffcc",
                  fontFamily: "monospace",
                  fontSize: "0.78rem",
                  cursor: "pointer",
                }}
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  const name = newGameName.trim();
                  if (name) {
                    setCurrentSessionName(name);
                  } else {
                    setCurrentSessionName(null);
                  }
                  setNewGameDialogOpen(false);
                  setStarted(true);
                }}
                style={{
                  padding: "0.25rem 0.8rem",
                  borderRadius: 4,
                  border: "1px solid rgba(0,255,204,0.75)",
                  background: "rgba(0,255,204,0.2)",
                  color: "#00ffcc",
                  fontFamily: "monospace",
                  fontSize: "0.78rem",
                  cursor: "pointer",
                }}
              >
                開始
              </button>
            </div>
          </div>
        </div>
      )}
      {loadDialogOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.45)",
            zIndex: 2500,
          }}
          onMouseDown={() => setLoadDialogOpen(false)}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              minWidth: 300,
              maxWidth: 420,
              maxHeight: "70vh",
              background: "rgba(4,12,18,0.98)",
              borderRadius: 10,
              border: "1px solid rgba(0,255,204,0.55)",
              padding: "0.9rem 1rem",
              color: "#00ffcc",
              fontFamily: "monospace",
              boxSizing: "border-box",
              boxShadow: "0 10px 28px rgba(0,0,0,0.55)",
              overflowY: "auto",
            }}
          >
            <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem" }}>セーブデータをロード</div>
            {availableSaves.length === 0 && (
              <div style={{ fontSize: "0.8rem", opacity: 0.8 }}>セーブデータがありません。</div>
            )}
            {availableSaves.map((name) => (
              <div
                key={name}
                role="button"
                onClick={() => {
                  try {
                    const raw = window.localStorage.getItem(`network-sea:save:${name}`);
                if (!raw) return;
                const data = JSON.parse(raw) as {
                  name?: string;
                  nodes?: ReturnType<typeof useNet.getState>["nodes"];
                  links?: ReturnType<typeof useNet.getState>["links"];
                  ports?: ReturnType<typeof useNet.getState>["ports"];
                  vlans?: string[];
                  nodeVlans?: ReturnType<typeof useNet.getState>["nodeVlans"];
                  activeVlanName?: string;
                  vlanColors?: Record<string, string>;
                  switchConfigs?: ReturnType<typeof useNet.getState>["switchConfigs"];
                };
                const { nodes, links, ports, vlans, nodeVlans, activeVlanName, vlanColors, switchConfigs } = data;
                const resolvedVlanColors = ensureVlanColorMap(vlans ?? [], vlanColors);
                useNet.setState((state) => ({
                  ...state,
                  nodes: nodes ?? {},
                  links: links ?? {},
                  ports: ports ?? {},
                  vlans: vlans ?? [],
                  nodeVlans: nodeVlans ?? {},
                  vlanColors: resolvedVlanColors,
                  activeVlanName,
                  switchConfigs: switchConfigs ?? {},
                  flows: {},
                  selected: { mode: "idle" },
                      cliNodeId: nodes ? Object.keys(nodes)[0] : undefined,
                    }));
                    useNet.getState().recomputeRouting();
                    setCurrentSessionName(name);
                    setLoadDialogOpen(false);
                    setStarted(true);
                  } catch {
                    // 失敗時は何もしない
                  }
                }}
                style={{
                  padding: "0.4rem 0.5rem",
                  borderRadius: 4,
                  border: "1px solid rgba(0,255,204,0.35)",
                  background: "rgba(0,0,0,0.6)",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  marginBottom: "0.3rem",
                }}
              >
                {name}
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.4rem" }}>
              <button
                type="button"
                onClick={() => setLoadDialogOpen(false)}
                style={{
                  padding: "0.25rem 0.6rem",
                  borderRadius: 4,
                  border: "1px solid rgba(0,255,204,0.35)",
                  background: "transparent",
                  color: "#00ffcc",
                  fontFamily: "monospace",
                  fontSize: "0.78rem",
                  cursor: "pointer",
                }}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
      {started && (
        <>
          <CanvasRoot />
          <NodePalette />
          <NodeContextMenu />
          <IpConfigDialog />
          <CLIConsole />
          <SidePanel />
          {currentMission && (
            <MissionPanel
              onCompleteTutorial={() => {
                setStarted(false);
              }}
            />
          )}
        </>
      )}
      {!started && (
        <StartScreen
          onStartTutorial={() => {
            setStarted(true);
            setMission("tutorial_nodes");
          }}
          onNewGame={() => {
            setNewGameName("");
            setNewGameDialogOpen(true);
          }}
          onLoad={() => {
            try {
              const names: string[] = [];
              for (let i = 0; i < window.localStorage.length; i += 1) {
                const key = window.localStorage.key(i);
                if (key && key.startsWith("network-sea:save:")) {
                  names.push(key.slice("network-sea:save:".length));
                }
              }
              names.sort();
              setAvailableSaves(names);
            } catch {
              setAvailableSaves([]);
            }
            setLoadDialogOpen(true);
          }}
        />
      )}
    </div>
  );
}
