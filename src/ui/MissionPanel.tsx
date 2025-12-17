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
  const isTutorial = Boolean(current?.id?.startsWith("tutorial_"));
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
        background: isTutorial ? "rgba(8, 16, 24, 0.62)" : "rgba(8, 16, 24, 0.92)",
        color: "#00ffcc",
        fontFamily: "monospace",
        padding: "0.9rem",
        boxSizing: "border-box",
        overflowY: "auto",
        borderRight: "1px solid rgba(0, 255, 204, 0.35)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        zIndex: 45,
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
          {current.id === "tutorial_vlan_vtp" && (
            <div style={{ marginBottom: "0.8rem", fontSize: "0.78rem", lineHeight: 1.5 }}>
              <div style={{ marginBottom: 4, opacity: 0.9 }}>チュートリアルの手順</div>
              <ol style={{ paddingLeft: "1.1rem", margin: 0 }}>
                <li>
                  SW1 の CLI を開き、<span style={{ opacity: 0.85 }}>[ユーザEXEC → 特権EXEC]</span> へ:
                  <div style={{ marginLeft: "0.6rem" }}>
                    <code>enable</code>
                  </div>
                </li>
                <li>
                  <span style={{ opacity: 0.85 }}>[特権EXEC → グローバルコンフィグ]</span> へ:
                  <div style={{ marginLeft: "0.6rem" }}>
                    <code>configure terminal</code>（<code>conf t</code>）
                  </div>
                </li>
                <li>
                  <span style={{ opacity: 0.85 }}>[グローバルコンフィグ]</span> で SW1 を VTP サーバーモード・ドメイン設定:
                  <div style={{ marginLeft: "0.6rem" }}>
                    <code>vtp mode server</code>
                    <br />
                    <code>vtp domain TUTORIAL</code>
                  </div>
                </li>
                <li>
                  SW2 でも <span style={{ opacity: 0.85 }}>[ユーザEXEC → 特権EXEC → グローバルコンフィグ]</span> へ入り、クライアントとして同じドメインを設定:
                  <div style={{ marginLeft: "0.6rem" }}>
                    <code>enable</code>
                    <br />
                    <code>conf t</code>
                    <br />
                    <code>vtp mode client</code>
                    <br />
                    <code>vtp domain TUTORIAL</code>
                  </div>
                </li>
                <li>
                  いずれかのスイッチで <span style={{ opacity: 0.85 }}>[特権EXEC]</span> に戻し状態を確認:
                  <div style={{ marginLeft: "0.6rem" }}>
                    <code>show vtp status</code>
                  </div>
                </li>
              </ol>
            </div>
          )}
          {current.id === "tutorial_vlan_create" && (
            <div style={{ marginBottom: "0.8rem", fontSize: "0.78rem", lineHeight: 1.5 }}>
              <div style={{ marginBottom: 4, opacity: 0.9 }}>チュートリアルの手順</div>
              <ol style={{ paddingLeft: "1.1rem", margin: 0 }}>
                <li>
                  <span style={{ opacity: 0.85 }}>[ユーザEXEC → 特権EXEC]</span> へ:
                  <div style={{ marginLeft: "0.6rem" }}>
                    <code>enable</code>
                  </div>
                </li>
                <li>
                  <span style={{ opacity: 0.85 }}>[特権EXEC → グローバルコンフィグ]</span> へ:
                  <div style={{ marginLeft: "0.6rem" }}>
                    <code>conf t</code>
                  </div>
                </li>
                <li>
                  <span style={{ opacity: 0.85 }}>[グローバルコンフィグ]</span> で VLAN 10 を作成し、必要なら名前を付ける:
                  <div style={{ marginLeft: "0.6rem" }}>
                    <code>vlan 10</code>
                    <br />
                    <code>name VLAN10</code>（任意）
                  </div>
                </li>
                <li>
                  <span style={{ opacity: 0.85 }}>[特権EXEC]</span> へ戻り確認:
                  <div style={{ marginLeft: "0.6rem" }}>
                    <code>end</code> または <code>Ctrl+Z</code>
                    <br />
                    <code>show vlan brief</code>
                  </div>
                </li>
              </ol>
            </div>
          )}
          {current.id === "tutorial_vlan_ports" && (
            <div style={{ marginBottom: "0.8rem", fontSize: "0.78rem", lineHeight: 1.5 }}>
              <div style={{ marginBottom: 4, opacity: 0.9 }}>チュートリアルの手順</div>
              <ol style={{ paddingLeft: "1.1rem", margin: 0 }}>
                <li>
                  <span style={{ opacity: 0.85 }}>[ユーザEXEC → 特権EXEC → グローバルコンフィグ]</span> へ:
                  <div style={{ marginLeft: "0.6rem" }}>
                    <code>enable</code>
                    <br />
                    <code>conf t</code>
                  </div>
                </li>
                <li>
                  アクセスポートを VLAN 10 に設定する（例: <code>Fa0/1</code>）:
                  <div style={{ marginLeft: "0.6rem" }}>
                    <code>interface Fa0/1</code>
                    <br />
                    <code>switchport mode access</code>
                    <br />
                    <code>switchport access vlan 10</code>
                  </div>
                </li>
                <li>
                  他の接続ポートも同様に設定:
                  <div style={{ marginLeft: "0.6rem" }}>
                    <code>interface Fa0/2</code>
                    <br />
                    <code>switchport mode access</code>
                    <br />
                    <code>switchport access vlan 10</code>
                  </div>
                </li>
                <li>
                  必要に応じて <span style={{ opacity: 0.85 }}>[特権EXEC]</span> に戻り確認:
                  <div style={{ marginLeft: "0.6rem" }}>
                    <code>end</code>
                    <br />
                    <code>show vlan brief</code>
                  </div>
                </li>
              </ol>
            </div>
          )}
          {current.id === "tutorial_vlan_svi" && (
            <div style={{ marginBottom: "0.8rem", fontSize: "0.78rem", lineHeight: 1.5 }}>
              <div style={{ marginBottom: 4, opacity: 0.9 }}>チュートリアルの手順</div>
              <ol style={{ paddingLeft: "1.1rem", margin: 0 }}>
                <li>
                  <span style={{ opacity: 0.85 }}>[ユーザEXEC → 特権EXEC → グローバルコンフィグ]</span> へ:
                  <div style={{ marginLeft: "0.6rem" }}>
                    <code>enable</code>
                    <br />
                    <code>conf t</code>
                  </div>
                </li>
                <li>
                  <span style={{ opacity: 0.85 }}>[インターフェースコンフィグ]</span> で VLAN 10 の SVI を設定:
                  <div style={{ marginLeft: "0.6rem" }}>
                    <code>interface vlan 10</code>
                    <br />
                    <code>ip address 192.168.10.1 255.255.255.0</code>
                    <br />
                    <code>no shutdown</code>
                  </div>
                </li>
                <li>
                  必要なら <span style={{ opacity: 0.85 }}>[特権EXEC]</span> で確認:
                  <div style={{ marginLeft: "0.6rem" }}>
                    <code>end</code>
                    <br />
                    <code>show ip interface brief</code>
                  </div>
                </li>
              </ol>
            </div>
          )}
          {current.id === "tutorial_vlan_verify" && (
            <div style={{ marginBottom: "0.8rem", fontSize: "0.78rem", lineHeight: 1.5 }}>
              <div style={{ marginBottom: 4, opacity: 0.9 }}>チュートリアルの手順</div>
              <ol style={{ paddingLeft: "1.1rem", margin: 0 }}>
                <li>
                  <span style={{ opacity: 0.85 }}>[ユーザEXEC → 特権EXEC]</span> へ:
                  <div style={{ marginLeft: "0.6rem" }}>
                    <code>enable</code>
                  </div>
                </li>
                <li>
                  VLAN 状態を確認:
                  <div style={{ marginLeft: "0.6rem" }}>
                    <code>show vlan brief</code>
                    <br />
                    <code>show ip interface brief</code>（SVI確認用）
                  </div>
                </li>
                <li>
                  必要なら設定を保存（任意）:
                  <div style={{ marginLeft: "0.6rem" }}>
                    <code>copy running-config startup-config</code>
                  </div>
                </li>
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
