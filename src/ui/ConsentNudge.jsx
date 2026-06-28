// A soft, honest nudge shown when self-learning consent is OFF. Not a dark pattern: the
// app works fully without it, the copy is truthful, turning it on is one click, and it's
// reversible in Settings. It frames the value ("the personalized version") rather than
// guilt or fake urgency — which also keeps the consent freely given under GDPR.
export function ConsentNudge({ consent, onEnable, onOpenSettings, onDismiss }) {
  if (consent === "full") return null; // already opted in — nothing to nudge

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        flexWrap: "wrap",
        background: "rgba(255,107,107,0.07)",
        border: "1px solid rgba(255,107,107,0.28)",
        borderRadius: "12px",
        padding: "0.7rem 0.9rem",
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      <span style={{ fontSize: "0.95rem", lineHeight: 1 }} aria-hidden>💤</span>
      <span style={{ flex: 1, minWidth: "200px", fontSize: "0.78rem", color: "#f0b4b4", lineHeight: 1.5 }}>
        <strong style={{ color: "#ff9b9b" }}>Memory is off.</strong>{" "}
        BrainQueue isn't learning how you work yet, so you're on the generic version instead of one that adapts to you.
      </span>
      <button
        onClick={onEnable}
        style={{
          background: "#bef24a",
          border: "none",
          borderRadius: "9px",
          padding: "0.45rem 0.9rem",
          color: "#0a0a0d",
          fontFamily: "inherit",
          fontWeight: 700,
          fontSize: "0.76rem",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Turn on memory
      </button>
      <button
        onClick={onOpenSettings}
        style={{ background: "none", border: "none", color: "#9a7a7a", fontFamily: "inherit", fontSize: "0.72rem", cursor: "pointer", whiteSpace: "nowrap" }}
      >
        Details
      </button>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        title="Hide for now"
        style={{ background: "none", border: "none", color: "#6e5757", fontSize: "1rem", lineHeight: 1, cursor: "pointer" }}
      >
        ×
      </button>
    </div>
  );
}
