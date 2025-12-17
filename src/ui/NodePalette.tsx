import { useState } from "react";
import type { NodeKind } from "@/types/net";
import { useNet } from "@/store/netStore";

const kinds: { kind: NodeKind; label: string }[] = [
  { kind: "PC", label: "PC" },
  { kind: "SWITCH", label: "Switch" },
  { kind: "ROUTER", label: "Router" },
];

export default function NodePalette() {
  const [localOpen, setLocalOpen] = useState(false);
  const [vlanDialogOpen, setVlanDialogOpen] = useState(false);
  const [vlanName, setVlanName] = useState("");
  const [vlanMenuOpen, setVlanMenuOpen] = useState(false);
  const activePalette = useNet((s) => s.activePalette);
  const setActivePalette = useNet((s) => s.setActivePalette);
  const vlans = useNet((s) => s.vlans);
  const vlanColors = useNet((s) => s.vlanColors);
  const addVlan = useNet((s) => s.addVlan);
  const activeVlanName = useNet((s) => s.activeVlanName);
  const setActiveVlan = useNet((s) => s.setActiveVlan);

  const onDragStart = (e: React.DragEvent<HTMLDivElement>, kind: NodeKind) => {
    e.dataTransfer.setData("application/x-node-kind", kind);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        right: 288, // SidePanel の幅に合わせてキャンバス領域内の右上に配置
        zIndex: 30,
        userSelect: "none",
      }}
    >
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            style={{
              background: "rgba(0,0,0,0.62)",
              color: "#00ffcc",
              border: "1.5px solid rgba(0,255,204,0.65)",
              borderRadius: 10,
              padding: "0.5rem 0.85rem",
              fontFamily: "monospace",
              fontSize: "0.95rem",
              fontWeight: 700,
              letterSpacing: 0.3,
              boxShadow: "0 4px 16px rgba(0,255,204,0.22)",
              cursor: "pointer",
            }}
            onClick={() => {
              if (activePalette === "node") {
                setActivePalette(null);
                setLocalOpen(false);
              }
              setVlanMenuOpen((prev) => !prev);
            }}
          >
            Add VLAN
          </button>
          <button
            type="button"
            onClick={() => {
              setVlanMenuOpen(false);
              if (activePalette === "node") {
                setActivePalette(null);
                setLocalOpen(false);
              } else {
                setActivePalette("node");
                setLocalOpen(true);
              }
            }}
            style={{
              background: "rgba(0,0,0,0.62)",
              color: "#00ffcc",
              border: "1.5px solid rgba(0,255,204,0.65)",
              borderRadius: 10,
              padding: "0.5rem 0.85rem",
              fontFamily: "monospace",
              fontSize: "0.95rem",
              fontWeight: 700,
              letterSpacing: 0.3,
              boxShadow: "0 4px 16px rgba(0,255,204,0.22)",
              cursor: "pointer",
            }}
          >
            ＋ Add Node
          </button>
        </div>
        {vlanMenuOpen && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: 8,
              background: "rgba(5,12,18,0.95)",
              border: "1.5px solid rgba(0,255,204,0.55)",
              borderRadius: 8,
              padding: "0.35rem 0.55rem",
              fontFamily: "monospace",
              fontSize: "0.8rem",
              color: "#00ffcc",
              boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
              minWidth: 160,
            }}
          >
            <div style={{ opacity: 0.8, marginBottom: "0.25rem" }}>VLAN メニュー</div>
            {vlans.length > 0 && (
              <div style={{ marginBottom: "0.25rem" }}>
                {vlans.map((name) => (
                  <div
                    key={name}
                    role="button"
                    onClick={() =>
                      setActiveVlan(activeVlanName === name ? undefined : name)
                    }
                    style={{
                      padding: "0.25rem 0.3rem",
                      borderRadius: 4,
                      border:
                        activeVlanName === name
                          ? "1.5px solid rgba(0,255,204,0.9)"
                          : "1px solid rgba(0,255,204,0.35)",
                      background:
                        activeVlanName === name
                          ? "rgba(0,255,204,0.25)"
                          : "rgba(0,0,0,0.6)",
                      marginBottom: "0.18rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: vlanColors[name] ?? "#00ffcc",
                        boxShadow: "0 0 6px rgba(0,0,0,0.5)",
                      }}
                    />
                    {name}
                  </div>
                ))}
              </div>
            )}
            <div
              role="button"
              onClick={() => {
              setVlanName("");
              setVlanDialogOpen(true);
                setVlanMenuOpen(false);
              }}
              style={{
                padding: "0.35rem 0.4rem",
                borderRadius: 4,
                cursor: "pointer",
                border: "1px solid rgba(0,255,204,0.45)",
                background: "rgba(0,0,0,0.6)",
              }}
            >
              新規VLAN作成
            </div>
          </div>
        )}
        {activePalette === "node" && localOpen && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              right: 0,
              marginTop: 8,
              background: "rgba(5,12,18,0.9)",
              border: "1.5px solid rgba(0,255,204,0.55)",
              borderRadius: 10,
              padding: 10,
              display: "flex",
              gap: 10,
              backdropFilter: "blur(4px)",
              boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
            }}
          >
            {kinds.map((k) => (
              <div
                key={k.kind}
                draggable
                onDragStart={(e) => onDragStart(e, k.kind)}
                style={{
                  padding: "0.55rem 0.8rem",
                  border: "1.2px solid rgba(0,255,204,0.6)",
                  borderRadius: 8,
                  color: "#00ffcc",
                  background: "rgba(0,0,0,0.55)",
                  fontFamily: "monospace",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  cursor: "grab",
                  minWidth: 84,
                  textAlign: "center",
                  boxShadow: "0 2px 10px rgba(0,255,204,0.18)",
                }}
                title="ドラッグしてキャンバスへドロップ"
              >
                {k.label}
              </div>
            ))}
          </div>
        )}
      </div>
      {vlanDialogOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.45)",
            zIndex: 1200,
          }}
          onMouseDown={() => setVlanDialogOpen(false)}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              minWidth: 360,
              maxWidth: 520,
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
            <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem" }}>Add VLAN</div>
            <div style={{ fontSize: "0.78rem", marginBottom: "0.35rem", opacity: 0.8 }}>
              VLAN名または番号を入力してください
            </div>
            <input
              autoFocus
              type="text"
              value={vlanName}
              onChange={(e) => setVlanName(e.currentTarget.value)}
              placeholder="例: VLAN10 / 10"
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
                onClick={() => setVlanDialogOpen(false)}
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
                  const name = vlanName.trim();
                  if (name) {
                    addVlan(name);
                  }
                  setVlanDialogOpen(false);
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
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
