import { useHover } from "./useHover";

// A pill tab for switching views. Lime when active, subtle lift on hover.
export function ViewTab({ label, active, onClick }) {
  const [hov, hovProps] = useHover();
  return (
    <button onClick={onClick} {...hovProps} style={{
      padding: "0.5rem 1rem", borderRadius: "24px",
      border: active ? "1px solid rgba(232,255,90,0.5)" : "1px solid rgba(255,255,255,0.08)",
      background: active ? "rgba(232,255,90,0.15)" : hov ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
      color: active ? "#bef24a" : hov ? "#ddd" : "#666",
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: active ? 700 : 400, fontSize: "0.78rem",
      cursor: "pointer", whiteSpace: "nowrap",
      boxShadow: active ? "0 0 16px rgba(232,255,90,0.2), inset 0 1px 0 rgba(255,255,255,0.1)" : "none",
      transform: hov && !active ? "translateY(-1px)" : "translateY(0)",
      transition: "background 0.18s ease, color 0.18s ease, border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease",
      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
    }}>{label}</button>
  );
}
