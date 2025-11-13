import { useState } from "react";
import type { NodeKind } from "@/types/net";
import { useNet } from "@/store/netStore";

const kinds: { kind: NodeKind; label: string }[] = [
  { kind: "PC", label: "PC" },
  { kind: "SWITCH", label: "Switch" },
  { kind: "ROUTER", label: "Router" },
];

export default function NodePalette() {
  const [open, setOpen] = useState(false);
  const clearSelection = useNet((s) => s.setSelected);

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
      onMouseDownCapture={(e) => {
        if (e.button !== 0) return;
        clearSelection({ mode: "idle", nodeId: undefined, linkId: undefined });
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
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
      {open && (
        <div
          style={{
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
  );
}
