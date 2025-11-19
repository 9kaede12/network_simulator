import { useState } from "react";
import { useNet } from "@/store/netStore";

type SubnetCard = { cidr: number; label: string; hint: string };

const cards: SubnetCard[] = [
  { cidr: 30, label: "/30", hint: "P2P (2 hosts)" },
  { cidr: 24, label: "/24", hint: "LAN (254 hosts)" },
];

export default function SubnetPalette() {
  const [localOpen, setLocalOpen] = useState(false);
  const activePalette = useNet((s) => s.activePalette);
  const setActivePalette = useNet((s) => s.setActivePalette);
  const [draggingCidr, setDraggingCidr] = useState<number | null>(null);

  const onDragStart = (e: React.DragEvent<HTMLDivElement>, card: SubnetCard) => {
    e.dataTransfer.setData("application/x-subnet", JSON.stringify({ cidr: card.cidr }));
    e.dataTransfer.effectAllowed = "copy";
    setDraggingCidr(card.cidr);
  };

  const onDragEnd = () => setDraggingCidr(null);

  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        right: 460,
        zIndex: 30,
        userSelect: "none",
      }}
    >
      <div style={{ position: "relative" }}>
        <button
          onClick={() => {
            if (activePalette === "subnet") {
              setActivePalette(null);
              setLocalOpen(false);
            } else {
              setActivePalette("subnet");
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
          Subnets
        </button>
        {activePalette === "subnet" && localOpen && (
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
            {cards.map((c) => {
              const isDraggingThis = draggingCidr === c.cidr;
              return (
                <div
                  key={c.cidr}
                  draggable
                  onDragStart={(e) => onDragStart(e, c)}
                  onDragEnd={onDragEnd}
                  style={{
                    padding: "0.6rem 0.8rem",
                    border: isDraggingThis ? "1.8px solid #00ffcc" : "1.2px solid rgba(0,255,204,0.6)",
                    borderRadius: 8,
                    color: "#00ffcc",
                    background: isDraggingThis ? "rgba(0,255,204,0.25)" : "rgba(0,0,0,0.55)",
                    fontFamily: "monospace",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    cursor: "grab",
                    minWidth: 84,
                    textAlign: "center",
                    boxShadow: isDraggingThis
                      ? "0 0 18px rgba(0,255,204,0.75), 0 3px 12px rgba(0,0,0,0.4)"
                      : "0 2px 10px rgba(0,255,204,0.18)",
                  }}
                  title="ドラッグしてケーブルにドロップ"
                >
                  <div>{c.label}</div>
                  <div style={{ opacity: 0.7, fontSize: "0.75rem" }}>{c.hint}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
