import { Dim } from "brainqueue";

export const Steppers = () => (
  <div style={{ display: "flex", gap: "1.2rem", padding: "1rem" }}>
    <Dim label="U" value={4} onChange={() => {}} />
    <Dim label="I" value={3} onChange={() => {}} />
    <Dim label="E" value={2} onChange={() => {}} />
  </div>
);
