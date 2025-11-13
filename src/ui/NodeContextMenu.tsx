import { useEffect, useMemo, useRef, useState } from "react";
import { useNet } from "@/store/netStore";

export default function NodeContextMenu() {
  const ctx = useNet((s) => s.contextMenu);
  const hide = useNet((s) => s.hideContextMenu);
  const beginLink = useNet((s) => s.beginLink);
  const removeNode = useNet((s) => s.removeNode);
  const removeLinksForNode = useNet((s) => s.removeLinksForNode);
  const removeLink = useNet((s) => s.removeLink);
  const links = useNet((s) => s.links);
  const nodes = useNet((s) => s.nodes);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<"root" | "deleteLink">("root");

  const hasLinks = useMemo(() => {
    if (!ctx?.nodeId) return false;
    return Object.values(links).some((link) => link.a === ctx.nodeId || link.b === ctx.nodeId);
  }, [links, ctx?.nodeId]);

  const linkOptions = useMemo(() => {
    if (!ctx?.nodeId) return [];
    return Object.entries(links)
      .filter(([, link]) => link.a === ctx.nodeId || link.b === ctx.nodeId)
      .map(([id, link]) => {
        const targetId = link.a === ctx.nodeId ? link.b : link.a;
        return {
          linkId: id,
          targetId,
          targetName: nodes[targetId]?.name ?? targetId,
        };
      });
  }, [links, ctx?.nodeId, nodes]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        hide();
      }
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [hide]);

  useEffect(() => {
    setMode("root");
  }, [ctx?.visible, ctx?.nodeId]);

  if (!ctx?.visible || !ctx?.nodeId) return null;

  const startLink = () => {
    beginLink(ctx.nodeId!);
    hide();
  };

  const deleteAllLinks = () => {
    if (!hasLinks) {
      hide();
      return;
    }
    removeLinksForNode(ctx.nodeId!);
    hide();
  };

  const handleDeleteNode = () => {
    removeNode(ctx.nodeId!);
    hide();
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: "absolute",
        top: ctx.y,
        left: ctx.x,
        zIndex: 1000,
        background: "rgba(5,12,18,0.95)",
        border: "1px solid rgba(0,255,204,0.5)",
        borderRadius: 8,
        color: "#00ffcc",
        fontFamily: "monospace",
        fontSize: "0.85rem",
        boxShadow: "0 8px 22px rgba(0,0,0,0.45)",
        overflow: "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {mode === "root" ? (
        <>
          <MenuItem onClick={startLink}>Add Link</MenuItem>
          <MenuItem onClick={() => (hasLinks ? setMode("deleteLink") : undefined)} disabled={!hasLinks}>
            {hasLinks ? "Delete Link" : "Delete Link (none)"}
          </MenuItem>
          <MenuItem onClick={deleteAllLinks} disabled={!hasLinks}>
            {hasLinks ? "Delete All Links" : "Delete All Links (none)"}
          </MenuItem>
          <MenuItem onClick={handleDeleteNode} tone="danger">
            Delete Node
          </MenuItem>
        </>
      ) : (
        <>
          <MenuItem onClick={() => setMode("root")}>← Back</MenuItem>
          {linkOptions.map((opt) => (
            <MenuItem
              key={opt.linkId}
              onClick={() => {
                removeLink(opt.linkId);
                hide();
              }}
            >
              Delete link to {opt.targetName}
            </MenuItem>
          ))}
          {linkOptions.length === 0 && <div style={{ padding: "0.4rem 0.7rem", opacity: 0.6 }}>(no links)</div>}
        </>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  children,
  disabled,
  tone,
}: {
  onClick(): void;
  children: React.ReactNode;
  disabled?: boolean;
  tone?: "danger" | "default";
}) {
  return (
    <div
      onClick={() => {
        if (disabled) return;
        onClick();
      }}
      style={{
        padding: "0.45rem 0.7rem",
        cursor: disabled ? "not-allowed" : "pointer",
        borderBottom: "1px solid rgba(0,255,204,0.15)",
        color: tone === "danger" ? "#ff6b6b" : "#00ffcc",
        opacity: disabled ? 0.4 : 1,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </div>
  );
}
