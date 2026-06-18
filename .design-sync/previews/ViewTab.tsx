import { ViewTab } from "brainqueue";

export const Views = () => (
  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", padding: "1rem" }}>
    <ViewTab label="🔥 Do Now" active onClick={() => {}} />
    <ViewTab label="⚡ Quick Wins" active={false} onClick={() => {}} />
    <ViewTab label="🧠 Low Energy" active={false} onClick={() => {}} />
  </div>
);
