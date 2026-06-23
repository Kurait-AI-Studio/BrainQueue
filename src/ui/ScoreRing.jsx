// A circular priority gauge: the conic fill and label color shift with the
// score (lime ≥80, amber ≥60, grey below).
export function ScoreRing({ score }) {
  const color = score >= 80 ? "#bef24a" : score >= 60 ? "#ffb347" : "#555";
  return (
    <div style={{
      width: "42px", height: "42px", borderRadius: "50%",
      background: `conic-gradient(${color} ${score * 3.6}deg, rgba(255,255,255,0.06) 0deg)`,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      boxShadow: `0 0 12px ${color}44`,
    }}>
      <div style={{
        width: "30px", height: "30px", borderRadius: "50%",
        background: "rgba(10,10,20,0.9)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "0.65rem", fontWeight: 800, color, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}>{score}</div>
    </div>
  );
}
