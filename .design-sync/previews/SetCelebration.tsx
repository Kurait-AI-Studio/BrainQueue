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

export const Celebration = () => <SetCelebration celebration={celebration} onDone={() => {}} />;
