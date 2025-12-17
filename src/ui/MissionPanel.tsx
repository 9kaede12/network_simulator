import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useMission } from "@/store/missionStore";
import { useNet } from "@/store/netStore";
import { useShallow } from "zustand/react/shallow";
import { playMissionComplete } from "@/lib/sound";
import { missions } from "@/missions/missions";

export default function MissionPanel() {
  const { current, progress } = useMission(
    useShallow((state) => ({ current: state.current, progress: state.progress }))
  );
  const setMission = useMission((state) => state.setMission);
  const resetMission = useMission((state) => state.resetMission);
  const completedMap = useMission((state) => state.completed);
  const clearSelection = useNet((s) => s.setSelected);

  const completed = useMemo(() => {
    if (!current) return false;
    return current.goals.every((goal) => Boolean(progress[goal.id]));
  }, [current, progress]);

  const hasCelebrated = useRef(false);
  useEffect(() => {
    if (completed && !hasCelebrated.current) {
      hasCelebrated.current = true;
      playMissionComplete();
    }
    if (!completed) {
      hasCelebrated.current = false;
    }
  }, [completed]);

  const nextMission = useMemo(() => {
    if (!current) return undefined;
    const idx = missions.findIndex((m) => m.id === current.id);
    if (idx < 0) return undefined;
    for (let i = idx + 1; i < missions.length; i += 1) {
      const m = missions[i];
      if (!completedMap[m.id]) return m;
    }
    return undefined;
  }, [current, completedMap]);

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "300px",
        height: "100%",
        background: "rgba(8, 16, 24, 0.92)",
        color: "#00ffcc",
        fontFamily: "monospace",
        padding: "0.9rem",
        boxSizing: "border-box",
        overflowY: "auto",
        borderRight: "1px solid rgba(0, 255, 204, 0.35)",
        backdropFilter: "blur(6px)",
      }}
      onMouseDownCapture={(e) => {
        if (e.button !== 0) return;
        clearSelection({ mode: "idle", nodeId: undefined, linkId: undefined });
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: "0.8rem" }}>🎯 ミッションコントロール</h2>

      {!current && (
        <div>
          <p style={{ marginBottom: "0.6rem" }}>はじめるミッションを選択してください:</p>
          {missions.filter((mission) => !completedMap[mission.id]).length === 0 ? (
            <div style={{ opacity: 0.8 }}>すべてのミッションを達成しました！ 🚀</div>
          ) : (
            missions
              .filter((mission) => !completedMap[mission.id])
              .map((mission) => (
                <MissionButton key={mission.id} onClick={() => setMission(mission.id)}>
                  {mission.title}
                </MissionButton>
              ))
          )}
        </div>
      )}

      {current && (
        <div>
          <h3 style={{ marginBottom: "0.4rem" }}>{current.title}</h3>
          <p style={{ marginBottom: "0.6rem" }}>{current.description}</p>
          {current.id === "tutorial_nodes" && (
            <div style={{ marginBottom: "0.8rem", fontSize: "0.78rem", lineHeight: 1.5 }}>
              <div style={{ marginBottom: 4, opacity: 0.9 }}>チュートリアルの手順</div>
              <ol style={{ paddingLeft: "1.1rem", margin: 0 }}>
                <li>中央パネル右上にある「+ Add Node」パネルを開きます。</li>
                <li>PCノードをドラッグして海の上に配置します。</li>
                <li>ROUTERノードも同じようにドラッグして配置します。</li>
              </ol>
            </div>
          )}
          {current.id === "tutorial_links" && (
            <div style={{ marginBottom: "0.8rem", fontSize: "0.78rem", lineHeight: 1.5 }}>
              <div style={{ marginBottom: 4, opacity: 0.9 }}>チュートリアルの手順</div>
              <ol style={{ paddingLeft: "1.1rem", margin: 0 }}>
                <li>ノードを右クリックしてコンテキストメニューを開きます。</li>
                <li>「Add Link」を選んでケーブル接続モードに入ります。</li>
                <li>接続先のノードをクリックしてケーブルを張ります（PC1–R1–PC2）。</li>
              </ol>
            </div>
          )}
          {current.id === "tutorial_ip" && (
            <div style={{ marginBottom: "0.8rem", fontSize: "0.78rem", lineHeight: 1.5 }}>
              <div style={{ marginBottom: 4, opacity: 0.9 }}>チュートリアルの手順</div>
              <ol style={{ paddingLeft: "1.1rem", margin: 0 }}>
                <li>IPを設定したいノードを右クリックします。</li>
                <li>「Add IP address」を選び、接続されているポートを選択します。</li>
                <li>DHCP または Static を選び、必要ならIPアドレスとサブネットマスクを設定して保存します。</li>
                <li>PC1 と R1 など、2つ以上のポートに設定するとゴール達成です。</li>
              </ol>
            </div>
          )}
          <div style={{ marginBottom: "0.8rem" }}>
            <MissionButton onClick={resetMission}>← ミッション一覧に戻る</MissionButton>
          </div>
          <h4 style={{ marginBottom: "0.4rem" }}>ゴール:</h4>
          <ul style={{ paddingLeft: "1.1rem", lineHeight: 1.5 }}>
            {current.goals.map((goal) => (
              <li key={goal.id}>
                {progress[goal.id] ? "✅" : "⬜"} {goal.description}
              </li>
            ))}
          </ul>
          {completed && (
            <div
              style={{
                marginTop: "1rem",
                color: "#ffd166",
                fontWeight: 600,
                textShadow: "0 0 6px rgba(255, 209, 102, 0.6)",
              }}
            >
              🎉 ミッション完了！
              {nextMission && (
                <div style={{ marginTop: "0.75rem" }}>
                  <MissionButton onClick={() => setMission(nextMission.id)}>
                    → 次のミッションへ進む（{nextMission.title}）
                  </MissionButton>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MissionButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        marginBottom: "0.5rem",
        background: "rgba(0, 255, 204, 0.12)",
        color: "#00ffcc",
        border: "1px solid rgba(0, 255, 204, 0.35)",
        borderRadius: "4px",
        padding: "0.45rem",
        fontFamily: "inherit",
        fontSize: "0.9rem",
        cursor: "pointer",
        transition: "background 0.2s ease, border-color 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(0, 255, 204, 0.2)";
        e.currentTarget.style.borderColor = "rgba(0, 255, 204, 0.55)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(0, 255, 204, 0.12)";
        e.currentTarget.style.borderColor = "rgba(0, 255, 204, 0.35)";
      }}
    >
      {children}
    </button>
  );
}
