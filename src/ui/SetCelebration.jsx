import { useEffect, useMemo } from "react";

// The BIG reward moment — full-screen, only for a full set clear / combo / streak.
// Confetti burst + headline + the bonuses earned + a fat total. Auto-dismisses.
const COLORS = ["#bef24a", "#f5b13a", "#b388ff", "#ff6b6b", "#6b9fff", "#ff8fd0", "#6bffb3"];
// Deterministic pseudo-random (pure) so confetti can be computed in render without
// Math.random's impurity — varied enough to look scattered.
const rnd = (i, s) => { const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); };

export function SetCelebration({ celebration, onDone }) {
  const confetti = useMemo(() => Array.from({ length: 36 }, (_, i) => ({
    left: rnd(i, 1) * 100, color: COLORS[i % COLORS.length], delay: rnd(i, 2) * 0.5,
    dur: 1.8 + rnd(i, 3) * 1.4, size: 6 + rnd(i, 4) * 7, rot: rnd(i, 5) * 360,
  })), []);
  useEffect(() => {
    if (!celebration) return;
    const t = setTimeout(() => onDone?.(), 3400);
    return () => clearTimeout(t);
  }, [celebration, onDone]);
  if (!celebration) return null;

  const { title, earned, totalXp } = celebration;
  return (
    <div onClick={onDone} style={{ position: "fixed", inset: 0, zIndex: 320, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(5,5,9,0.72)", backdropFilter: "blur(6px)", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", overflow: "hidden" }}>
      <style>{`
        @keyframes bqConfetti{0%{transform:translateY(-12vh) rotate(0);opacity:0}8%{opacity:1}100%{transform:translateY(112vh) rotate(720deg);opacity:.9}}
        @keyframes bqCelebPop{0%{opacity:0;transform:scale(.8) translateY(14px)}60%{opacity:1;transform:scale(1.04) translateY(0)}100%{transform:scale(1) translateY(0)}}
      `}</style>

      {confetti.map((c, i) => (
        <span key={i} style={{ position: "absolute", top: 0, left: `${c.left}%`, width: c.size, height: c.size * 0.6, background: c.color, borderRadius: 2, transform: `rotate(${c.rot}deg)`, animation: `bqConfetti ${c.dur}s ${c.delay}s cubic-bezier(.3,.6,.4,1) forwards` }} />
      ))}

      <div style={{ animation: "bqCelebPop .5s cubic-bezier(.2,.8,.2,1) both", textAlign: "center", padding: "2rem 2.4rem", borderRadius: 24, background: "linear-gradient(180deg, rgba(190,242,74,0.08), rgba(22,22,28,0.95))", border: "1px solid rgba(190,242,74,0.3)", boxShadow: "0 0 60px rgba(190,242,74,0.18)", maxWidth: 420 }}>
        <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#ededf0", letterSpacing: "-0.02em" }}>{title}</div>
        <div style={{ fontSize: "3.2rem", fontWeight: 900, color: "#bef24a", textShadow: "0 0 34px rgba(190,242,74,0.5)", margin: "0.4rem 0 1.1rem", letterSpacing: "-0.03em" }}>+{totalXp} XP</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {earned.map(b => (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, background: `${b.color}14`, border: `1px solid ${b.color}33`, borderRadius: 12, padding: "0.55rem 0.8rem" }}>
              <span style={{ fontSize: "1.05rem" }}>{b.icon}</span>
              <span style={{ flex: 1, textAlign: "left", fontSize: "0.85rem", fontWeight: 700, color: "#ededf0" }}>{b.name}</span>
              <span style={{ fontWeight: 800, color: b.color, fontSize: "0.85rem" }}>+{b.xp}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "1.1rem", fontSize: "0.72rem", color: "#83838f" }}>Tap anywhere to continue</div>
      </div>
    </div>
  );
}
