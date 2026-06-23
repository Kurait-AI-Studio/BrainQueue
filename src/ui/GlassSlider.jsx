// A 1–5 range slider with a label and end captions, driven by a `sublabels`
// map ({1:"…",…,5:"…"}) that names each step.
export function GlassSlider({ label, value, onChange, sublabels }) {
  return (
    <div style={{ marginBottom: "1.3rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <label style={{ fontSize: "0.75rem", color: "#666", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</label>
        <span style={{ fontSize: "0.78rem", color: "#bef24a", fontWeight: 700 }}>{sublabels[value]}</span>
      </div>
      <input type="range" min={1} max={5} value={value} onChange={e => onChange(+e.target.value)} style={{ width: "100%" }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.2rem" }}>
        <span style={{ fontSize: "0.62rem", color: "#333" }}>{sublabels[1]}</span>
        <span style={{ fontSize: "0.62rem", color: "#333" }}>{sublabels[5]}</span>
      </div>
    </div>
  );
}
