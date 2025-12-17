type StartScreenProps = {
  onStartTutorial: () => void;
  onNewGame: () => void;
  onLoad: () => void;
};

export default function StartScreen({ onStartTutorial, onNewGame, onLoad }: StartScreenProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at top, #0b3b5b 0%, #020916 55%, #000000 100%)",
        zIndex: 2000,
      }}
    >
      <div
        style={{
          width: 420,
          maxWidth: "90%",
          padding: "1.6rem 1.8rem",
          borderRadius: 16,
          border: "1px solid rgba(0,255,204,0.5)",
          background: "rgba(2, 12, 20, 0.94)",
          boxShadow: "0 16px 40px rgba(0,0,0,0.65)",
          color: "#00ffcc",
          fontFamily: "monospace",
        }}
      >
        <h1 style={{ margin: 0, marginBottom: "1.2rem", fontSize: "1.4rem" }}>Network Sea</h1>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            onClick={onStartTutorial}
            style={{
              padding: "0.55rem 0.7rem",
              borderRadius: 6,
              border: "1px solid rgba(0,255,204,0.7)",
              background: "rgba(0,255,204,0.16)",
              color: "#00ffcc",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "0.9rem",
            }}
          >
            ▶ チュートリアルミッションから始める
          </button>
          <button
            type="button"
            onClick={onNewGame}
            style={{
              padding: "0.5rem 0.7rem",
              borderRadius: 6,
              border: "1px solid rgba(0,255,204,0.4)",
              background: "transparent",
              color: "#00ffcc",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "0.85rem",
            }}
          >
            🆕 ニューゲーム
          </button>
          <button
            type="button"
            onClick={onLoad}
            style={{
              padding: "0.5rem 0.7rem",
              borderRadius: 6,
              border: "1px solid rgba(0,255,204,0.4)",
              background: "transparent",
              color: "#00ffcc",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "0.85rem",
            }}
          >
            📂 ロード
          </button>
        </div>
      </div>
    </div>
  );
}
