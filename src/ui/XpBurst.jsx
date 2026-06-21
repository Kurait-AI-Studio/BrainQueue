import { useEffect } from "react";

// A celebratory "+N XP" pop, center-screen, that fires the dopamine hit when a task or
// bonus is earned. Drive it from state: pass a burst object with a fresh `id` each time
// (so the animation restarts), and clear it via onDone when the pop finishes.
export function XpBurst({ burst, onDone }) {
  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => onDone?.(), 1700);
    return () => clearTimeout(t);
  }, [burst, onDone]);
  if (!burst) return null;
  const color = burst.color || "#bef24a";
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <style>{`@keyframes bqXpPop{0%{opacity:0;transform:translateY(20px) scale(.6)}16%{opacity:1;transform:translateY(0) scale(1.14)}30%{transform:translateY(0) scale(1)}72%{opacity:1;transform:translateY(-6px) scale(1)}100%{opacity:0;transform:translateY(-48px) scale(.96)}}`}</style>
      <div key={burst.id} style={{ animation: "bqXpPop 1.7s cubic-bezier(.2,.8,.2,1) forwards", textAlign: "center", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div style={{ fontSize: "3rem", fontWeight: 900, color, textShadow: `0 0 30px ${color}88`, letterSpacing: "-0.02em" }}>+{burst.amount} XP</div>
        {burst.label && <div style={{ marginTop: 6, fontSize: "1rem", fontWeight: 700, color: "#ededf0" }}>{burst.label}</div>}
      </div>
    </div>
  );
}
