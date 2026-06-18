import { SideSection } from "brainqueue";

export const Section = () => (
  <div style={{ width: "260px", padding: "1rem" }}>
    <SideSection title="Analytics" action={<span style={{ color: "#e8ff5a", fontSize: "0.7rem", fontFamily: "'Syne',sans-serif" }}>edit</span>}>
      <div style={{ color: "#999", fontSize: "0.82rem" }}>Today: 3 tasks done · 240 XP earned.</div>
    </SideSection>
  </div>
);
