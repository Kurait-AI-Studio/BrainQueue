import { useState } from "react";
import { glass } from "./tokens";
import { useHover } from "./useHover";

// The primary button: a frosted-glass pill that lifts and glows on hover.
// `accent` recolors the text + glow; pass `style` to override padding/size.
export function GlassButton({ onClick, children, accent, style = {}, disabled, className, title }) {
  const [hov, hovProps] = useHover();
  const [pressed, setPressed] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled} className={className} title={title}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)}
      {...hovProps}
      style={{
        ...glass, borderRadius: "12px", padding: "0.7rem 1.2rem",
        color: accent || "#fff",
        border: `1px solid ${hov ? (accent || "rgba(255,255,255,0.3)") : "rgba(255,255,255,0.1)"}`,
        background: hov ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.04)",
        boxShadow: hov ? `0 0 20px ${accent ? accent + "44" : "rgba(255,255,255,0.1)"}, inset 0 1px 0 rgba(255,255,255,0.12)` : glass.boxShadow,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "0.82rem",
        transform: pressed ? "scale(0.97)" : hov ? "scale(1.02)" : "scale(1)",
        transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1)",
        opacity: disabled ? 0.4 : 1, ...style,
      }}>{children}</button>
  );
}
