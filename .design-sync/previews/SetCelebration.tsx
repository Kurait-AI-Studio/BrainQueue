import { SetCelebration } from "brainqueue";

const celebration = {
  id: 1,
  title: "🔗 Combo ×3!",
  earned: [
    { id: "set", icon: "🎯", name: "Full set clear", xp: 50, color: "#bef24a" },
    { id: "combo", icon: "🔗", name: "Combo ×3", xp: 150, color: "#f5b13a" },
    { id: "early", icon: "🌅", name: "Early bird", xp: 25, color: "#6b9fff" },
  ],
  totalXp: 225,
};

// The overlay renders position:fixed; un-fix its root so it flows into the capture card.
export const Celebration = () => (
  <div style={{ minHeight: "100vh", background: "#09090c", display: "flex" }}>
    <style>{`[style*="z-index: 320"]{position:relative!important;inset:auto!important;min-height:100vh;width:100%}`}</style>
    <SetCelebration celebration={celebration} onDone={() => {}} />
  </div>
);
