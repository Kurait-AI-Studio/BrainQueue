import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";


// ─── Auth ────────────────────────────────────────────────────────────────────
// Username + salted SHA-256 password. Change CREDENTIALS below to your own.
// To generate a new hash: open browser console and run:
//   crypto.subtle.digest("SHA-256", new TextEncoder().encode("SALT" + "yourpassword"))
//     .then(b => console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")))

const AUTH_SALT = "bq2026$";
const CREDENTIALS = {
  // username → SHA-256(salt + password)
  // Default: username="husse"  password="brainqueue"  → change this!
  "husse": "5b0db9c0f909d248a8d872a8c3e6dff7696f2b21db788894c38b61635870e9e7",
};
const SESSION_KEY = "bq_session";

async function hashPassword(salt, password) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(salt + password)
  );
  return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, "0")).join("");
}

async function checkCredentials(username, password) {
  const expected = CREDENTIALS[username.toLowerCase()];
  if (!expected || expected === "PLACEHOLDER_HASH") return false;
  const actual = await hashPassword(AUTH_SALT, password);
  return actual === expected;
}

function loadSession() {
  try { return localStorage.getItem(SESSION_KEY) === "1"; }
  catch { return false; }
}
function saveSession() { try { localStorage.setItem(SESSION_KEY, "1"); } catch {} }
function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch {} }

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hov, hovProps] = useHover();

  const attempt = async () => {
    if (!username || !password) return;
    setLoading(true); setError(null);
    const ok = await checkCredentials(username, password);
    if (ok) { saveSession(); onLogin(); }
    else { setError("Invalid credentials."); }
    setLoading(false);
  };

  const onKey = (e) => { if (e.key === "Enter") attempt(); };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#060610", padding: "1rem", fontFamily: "'DM Mono', monospace",
    }}>
      <MouseGlow />
      <div style={{
        ...glassStrong, borderRadius: "24px", padding: "2.5rem 2rem",
        width: "100%", maxWidth: "360px", position: "relative", zIndex: 1,
      }}>
        <h1 style={{
          fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "1.8rem",
          letterSpacing: "-0.03em", textAlign: "center", marginBottom: "0.25rem",
        }}>
          <span style={{ color: "#e8e8e8" }}>Brain</span>
          <span style={{ color: "#e8ff5a", textShadow: "0 0 20px rgba(232,255,90,0.4)" }}>Queue</span>
        </h1>
        <p style={{ color: "#333", fontSize: "0.72rem", textAlign: "center", marginBottom: "2rem" }}>
          personal task system
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
          <input
            value={username} onChange={e => setUsername(e.target.value)} onKeyDown={onKey}
            placeholder="username"
            autoCapitalize="none" autoCorrect="off" spellCheck="false"
            style={{
              ...glass, borderRadius: "10px", padding: "0.85rem 1rem",
              color: "#e8e8e8", fontSize: "0.9rem", fontFamily: "'DM Mono', monospace",
              outline: "none", width: "100%", boxSizing: "border-box",
            }}
          />
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={onKey}
            placeholder="password"
            style={{
              ...glass, borderRadius: "10px", padding: "0.85rem 1rem",
              color: "#e8e8e8", fontSize: "0.9rem", fontFamily: "'DM Mono', monospace",
              outline: "none", width: "100%", boxSizing: "border-box",
            }}
          />
        </div>

        {error && <p style={{ color: "#ff6b6b", fontSize: "0.78rem", marginBottom: "0.75rem", textAlign: "center" }}>{error}</p>}

        <button
          onClick={attempt} disabled={loading || !username || !password}
          {...hovProps}
          style={{
            width: "100%", padding: "0.9rem",
            background: hov ? "rgba(232,255,90,0.2)" : "rgba(232,255,90,0.1)",
            border: "1px solid rgba(232,255,90,0.4)",
            borderRadius: "12px", color: "#e8ff5a",
            fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "0.9rem",
            cursor: loading || !username || !password ? "not-allowed" : "pointer",
            opacity: loading || !username || !password ? 0.5 : 1,
            boxShadow: hov ? "0 0 20px rgba(232,255,90,0.15)" : "none",
            transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1)",
            transform: hov ? "scale(1.02)" : "scale(1)",
          }}
        >{loading ? "Checking…" : "Enter →"}</button>

        <p style={{ color: "#222", fontSize: "0.65rem", textAlign: "center", marginTop: "1.5rem", lineHeight: 1.6 }}>
          salted SHA-256 · session stored locally
        </p>
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #060610; }
        input { -webkit-appearance: none; appearance: none; }
      `}</style>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = ["Health", "Work", "Admin", "Social", "Finance", "Learning", "Personal"];
const CATEGORY_COLORS = {
  Health: { accent: "#ff6b6b", glow: "255,107,107" },
  Work: { accent: "#6b9fff", glow: "107,159,255" },
  Admin: { accent: "#ffb347", glow: "255,179,71" },
  Social: { accent: "#6bffb3", glow: "107,255,179" },
  Finance: { accent: "#c47bff", glow: "196,123,255" },
  Learning: { accent: "#5de8ff", glow: "93,232,255" },
  Personal: { accent: "#ffaa5e", glow: "255,170,94" },
};
const CAT_ACCENT = (cat) => CATEGORY_COLORS[cat]?.accent || "#aaa";

const ENERGY_LABELS = { 1: "Zombie mode", 2: "Low", 3: "Normal", 4: "Focused", 5: "Peak" };
const EFFORT_LABELS = { 1: "2 min", 2: "15 min", 3: "1 hour", 4: "Half day", 5: "Multi-day" };
const DEFAULT_WEIGHTS = { urgency: 35, importance: 35, effort: 20, energy: 10 };

function calcScore(task, w = DEFAULT_WEIGHTS) {
  const total = w.urgency + w.importance + w.effort + w.energy || 100;
  return Math.round(
    (task.urgency * (w.urgency / total) +
      task.importance * (w.importance / total) +
      (6 - task.effort) * (w.effort / total) +
      (6 - task.energy) * (w.energy / total)) * 20
  );
}
function getUrgencyLabel(u) {
  if (u >= 5) return "🔴 Today"; if (u >= 4) return "🟠 This week";
  if (u >= 3) return "🟡 This month"; return "⚪ Someday";
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n, l = 2) => String(n).padStart(l, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const STORAGE_KEY = "brainqueue_v4";
function loadState() {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : { tasks: [], apiKey: "", weights: DEFAULT_WEIGHTS }; }
  catch { return { tasks: [], apiKey: "", weights: DEFAULT_WEIGHTS }; }
}
function saveState(s) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {} }

// Supabase client (lazy — only init if env vars present)
let _supabase = null;
function getSupabase() {
  if (_supabase) return _supabase;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _supabase = createClient(url, key);
  return _supabase;
}

// Supabase helpers — snake_case ↔ camelCase conversion
const toRow = (t) => ({
  id: String(t.id),
  title: t.title,
  category: t.category,
  urgency: t.urgency,
  importance: t.importance,
  effort: t.effort,
  energy: t.energy,
  notes: t.notes || "",
  done: t.done || false,
  added_at: t.addedAt || new Date().toISOString(),
  done_at: t.doneAt || null,
  updated_at: new Date().toISOString(),
});
const fromRow = (r) => ({
  id: r.id,
  title: r.title,
  category: r.category,
  urgency: r.urgency,
  importance: r.importance,
  effort: r.effort,
  energy: r.energy,
  notes: r.notes,
  done: r.done,
  addedAt: r.added_at,
  doneAt: r.done_at,
});

async function fetchRemoteTasks() {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("tasks").select("*");
  if (error) { console.error("Supabase fetch:", error); return null; }
  return data.map(fromRow);
}

async function upsertTask(task) {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("tasks").upsert(toRow(task));
  if (error) console.error("Supabase upsert:", error);
}

async function deleteRemoteTask(id) {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("tasks").delete().eq("id", String(id));
  if (error) console.error("Supabase delete:", error);
}

// Merge: for each task, keep whichever version has the latest updated_at/addedAt
function mergeTasks(local, remote) {
  const map = new Map();
  [...local, ...remote].forEach(t => {
    const existing = map.get(String(t.id));
    if (!existing) { map.set(String(t.id), t); return; }
    const existingTs = new Date(existing.doneAt || existing.addedAt || 0).getTime();
    const newTs = new Date(t.doneAt || t.addedAt || 0).getTime();
    if (newTs > existingTs) map.set(String(t.id), t);
  });
  return Array.from(map.values());
}

const VIEWS = ["🔥 Do Now", "⚡ Quick Wins", "🧠 Low Energy", "🗂 By Category", "✅ Done"];
const DEFAULT_FORM = { title: "", category: "Work", urgency: 3, importance: 3, effort: 3, energy: 3, notes: "" };

const glass = {
  background: "rgba(255,255,255,0.04)",
  backdropFilter: "blur(24px) saturate(180%)",
  WebkitBackdropFilter: "blur(24px) saturate(180%)",
  border: "1px solid rgba(255,255,255,0.10)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
};
const glassStrong = {
  background: "rgba(255,255,255,0.07)",
  backdropFilter: "blur(40px) saturate(200%)",
  WebkitBackdropFilter: "blur(40px) saturate(200%)",
  border: "1px solid rgba(255,255,255,0.13)",
  boxShadow: "0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)",
};

// Mouse glow — organic morphing shape, color tied to movement speed
function MouseGlow() {
  const canvasRef = useRef(null);
  const raf = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let w = window.innerWidth, h = window.innerHeight;

    const resize = () => {
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w; canvas.height = h;
    };
    resize();
    window.addEventListener("resize", resize);

    // State
    const pos = { x: -999, y: -999 };      // actual mouse
    const smooth = { x: -999, y: -999 };   // smoothed position for drawing
    let hue = 260;                           // current displayed hue
    let targetHue = 260;                     // hue we're drifting toward (set on move)
    let speed = 0;                           // mouse speed magnitude
    let prevX = -999, prevY = -999;

    // Blob: 8 control points around the glow, each with their own phase offset
    const N = 8;
    const phases = Array.from({ length: N }, (_, i) => (i / N) * Math.PI * 2);
    const phaseOffsets = Array.from({ length: N }, () => Math.random() * Math.PI * 2);
    const ampOffsets = Array.from({ length: N }, () => Math.random() * Math.PI * 2);

    let frame = 0;

    const onMove = (e) => {
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      speed = Math.sqrt(dx * dx + dy * dy); // pixels moved this event
      prevX = e.clientX; prevY = e.clientY;
      pos.x = e.clientX; pos.y = e.clientY;
      // Color advances proportionally to speed
      targetHue = (targetHue + speed * 0.8) % 360;
    };
    window.addEventListener("mousemove", onMove);

    // Draw organic blob using canvas path with sinusoidal radii per segment
    // 5 layers: innermost 40px → outermost 200px, opacity 0.20 → 0.019 (×0.55 each step)
    const LAYERS = [
      { r: 40,  hueShift: 0,   alpha: 0.200, deform: 1.00, speed: 1.00 },
      { r: 75,  hueShift: 25,  alpha: 0.110, deform: 0.80, speed: 0.80 },
      { r: 115, hueShift: 50,  alpha: 0.060, deform: 0.60, speed: 0.60 },
      { r: 158, hueShift: 80,  alpha: 0.034, deform: 0.40, speed: 0.40 },
      { r: 200, hueShift: 115, alpha: 0.019, deform: 0.22, speed: 0.22 },
    ];

    const drawBlob = (cx, cy, layer, hueBase, frameLocal, speedLocal) => {
      const { r: baseR, hueShift, alpha, deform } = layer;
      const hue1 = (hueBase + hueShift) % 360;
      const hue2 = (hue1 + 30) % 360;

      const points = [];
      for (let i = 0; i < N; i++) {
        const angle = phases[i];
        const slowWave = Math.sin(frameLocal * 0.007 + phaseOffsets[i]) * 0.22 * deform;
        const fastWave = Math.sin(frameLocal * 0.019 + ampOffsets[i]) * 0.10 * deform;
        const speedBulge = Math.sin(phases[i] + frameLocal * 0.04) * (speedLocal * 0.4 * deform);
        const r = baseR * (1 + slowWave + fastWave) + speedBulge;
        points.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
      }

      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const curr = points[i];
        const next = points[(i + 1) % N];
        const mid = { x: (curr.x + next.x) / 2, y: (curr.y + next.y) / 2 };
        if (i === 0) ctx.moveTo(mid.x, mid.y);
        else ctx.quadraticCurveTo(curr.x, curr.y, mid.x, mid.y);
      }
      const first = points[0];
      const last = points[N - 1];
      ctx.quadraticCurveTo(last.x, last.y, (last.x + first.x) / 2, (last.y + first.y) / 2);
      ctx.closePath();

      // Very wide falloff + canvas blur for true soft frontier
      ctx.save();
      ctx.filter = `blur(${Math.round(baseR * 0.55)}px)`;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 2.8);
      grad.addColorStop(0,    `hsla(${hue1}, 78%, 64%, ${alpha})`);
      grad.addColorStop(0.15, `hsla(${hue1}, 76%, 62%, ${alpha * 0.88})`);
      grad.addColorStop(0.35, `hsla(${hue1}, 72%, 58%, ${alpha * 0.60})`);
      grad.addColorStop(0.55, `hsla(${hue2}, 68%, 54%, ${alpha * 0.32})`);
      grad.addColorStop(0.75, `hsla(${hue2}, 64%, 50%, ${alpha * 0.12})`);
      grad.addColorStop(0.90, `hsla(${hue2}, 60%, 46%, ${alpha * 0.03})`);
      grad.addColorStop(1,    "transparent");
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    };

    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, w, h);

      smooth.x += (pos.x - smooth.x) * 0.12;
      smooth.y += (pos.y - smooth.y) * 0.12;

      hue += (targetHue - hue) * 0.06;
      speed *= 0.88;

      // Draw outermost first so inner layers sit on top
      for (let i = LAYERS.length - 1; i >= 0; i--) {
        drawBlob(smooth.x, smooth.y, LAYERS[i], hue, frame, speed * LAYERS[i].speed);
      }

      raf.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }} />;
}

function useHover() {
  const [hovered, setHovered] = useState(false);
  return [hovered, { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) }];
}

function GlassButton({ onClick, children, accent, style = {}, disabled }) {
  const [hov, hovProps] = useHover();
  const [pressed, setPressed] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled}
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

function ViewTab({ label, active, onClick }) {
  const [hov, hovProps] = useHover();
  return (
    <button onClick={onClick} {...hovProps} style={{
      padding: "0.5rem 1rem", borderRadius: "24px",
      border: active ? "1px solid rgba(232,255,90,0.5)" : "1px solid rgba(255,255,255,0.08)",
      background: active ? "rgba(232,255,90,0.15)" : hov ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
      color: active ? "#e8ff5a" : hov ? "#ddd" : "#666",
      fontFamily: "'Syne', sans-serif", fontWeight: active ? 700 : 400, fontSize: "0.78rem",
      cursor: "pointer", whiteSpace: "nowrap",
      boxShadow: active ? "0 0 16px rgba(232,255,90,0.2), inset 0 1px 0 rgba(255,255,255,0.1)" : "none",
      transform: hov && !active ? "translateY(-1px)" : "translateY(0)",
      transition: "background 0.18s ease, color 0.18s ease, border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease",
      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
    }}>{label}</button>
  );
}

function ScoreRing({ score }) {
  const color = score >= 80 ? "#e8ff5a" : score >= 60 ? "#ffb347" : "#555";
  return (
    <div style={{
      width: "42px", height: "42px", borderRadius: "50%",
      background: `conic-gradient(${color} ${score * 3.6}deg, rgba(255,255,255,0.06) 0deg)`,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      boxShadow: `0 0 12px ${color}44`,
    }}>
      <div style={{
        width: "30px", height: "30px", borderRadius: "50%",
        background: "rgba(10,10,20,0.9)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "0.65rem", fontWeight: 800, color, fontFamily: "'Syne', sans-serif",
      }}>{score}</div>
    </div>
  );
}

function TaskCard({ task, onEdit, onMarkDone, onDelete, weights }) {
  const [hov, hovProps] = useHover();
  const score = calcScore(task, weights);
  const accent = CAT_ACCENT(task.category);
  const glowRgb = CATEGORY_COLORS[task.category]?.glow || "255,255,255";

  return (
    <div {...hovProps} style={{
      ...glass,
      borderRadius: "16px",
      padding: "1rem 1.2rem",
      borderLeft: `2px solid ${accent}88`,
      boxShadow: hov
        ? `0 12px 40px rgba(0,0,0,0.5), 0 0 24px rgba(${glowRgb},0.12), inset 0 1px 0 rgba(255,255,255,0.1)`
        : glass.boxShadow,
      transform: hov ? "translateY(-2px)" : "translateY(0)",
      transition: "transform 0.25s cubic-bezier(0.34,1.2,0.64,1), box-shadow 0.25s ease",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
            <span style={{ color: "#e8e8e8", fontSize: "0.9rem", fontWeight: 600, lineHeight: 1.4 }}>{task.title}</span>
            <ScoreRing score={score} />
          </div>
          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: "0.67rem", padding: "2px 8px", borderRadius: "20px", background: accent + "18", color: accent, border: `1px solid ${accent}30`, fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>{task.category}</span>
            <span style={{ fontSize: "0.67rem", color: "#555" }}>{getUrgencyLabel(task.urgency)}</span>
            <span style={{ fontSize: "0.67rem", color: "#444" }}>⚡ {EFFORT_LABELS[task.effort]}</span>
            <span style={{ fontSize: "0.67rem", color: "#444" }}>🧠 {ENERGY_LABELS[task.energy]}</span>
          </div>
          {task.notes && <p style={{ fontSize: "0.74rem", color: "#4a4a4a", margin: "0.4rem 0 0", lineHeight: 1.5 }}>{task.notes}</p>}
          <p style={{ fontSize: "0.65rem", color: "#2e2e2e", margin: "0.5rem 0 0", fontFamily: "'DM Mono', monospace" }}>Added {formatDate(task.addedAt)}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flexShrink: 0 }}>
          <button onClick={() => onMarkDone(task.id)} title="Mark done"
            style={{ background: "none", border: "none", color: "#3a3a3a", cursor: "pointer", fontSize: "1rem", transition: "color 0.15s, transform 0.15s" }}
            onMouseEnter={e => { e.target.style.color="#6bffb3"; e.target.style.transform="scale(1.2)"; }}
            onMouseLeave={e => { e.target.style.color="#3a3a3a"; e.target.style.transform="scale(1)"; }}>✓</button>
          <button onClick={() => onEdit(task)} title="Edit"
            style={{ background: "none", border: "none", color: "#3a3a3a", cursor: "pointer", fontSize: "0.8rem", transition: "color 0.15s" }}
            onMouseEnter={e => e.target.style.color="#aaa"} onMouseLeave={e => e.target.style.color="#3a3a3a"}>✏️</button>
          <button onClick={() => onDelete(task.id)} title="Delete"
            style={{ background: "none", border: "none", color: "#2a2a2a", cursor: "pointer", fontSize: "0.8rem", transition: "color 0.15s" }}
            onMouseEnter={e => e.target.style.color="#ef4444"} onMouseLeave={e => e.target.style.color="#2a2a2a"}>🗑</button>
        </div>
      </div>
    </div>
  );
}

function DoneCard({ task, onDelete, onRestore }) {
  const [hov, hovProps] = useHover();
  const accent = CAT_ACCENT(task.category);
  return (
    <div {...hovProps} style={{
      ...glass, borderRadius: "16px", padding: "0.9rem 1.2rem",
      opacity: hov ? 0.9 : 0.55,
      borderLeft: `2px solid ${accent}33`,
      transition: "opacity 0.2s ease, transform 0.2s ease",
      transform: hov ? "translateY(-1px)" : "translateY(0)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
            <span style={{ color: "#555", fontSize: "0.88rem", fontWeight: 600, textDecoration: "line-through", lineHeight: 1.4 }}>{task.title}</span>
            <span style={{ fontSize: "0.67rem", padding: "2px 8px", borderRadius: "20px", background: accent + "10", color: accent + "99", border: `1px solid ${accent}20`, fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>{task.category}</span>
          </div>
          <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
            <p style={{ fontSize: "0.64rem", color: "#2e2e2e", fontFamily: "'DM Mono', monospace" }}>Added {formatDate(task.addedAt)}</p>
            <p style={{ fontSize: "0.64rem", color: "#3a3a3a", fontFamily: "'DM Mono', monospace" }}>✓ Done {formatDate(task.doneAt)}</p>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flexShrink: 0 }}>
          <button onClick={() => onRestore(task.id)} title="Restore"
            style={{ background: "none", border: "none", color: "#2a2a2a", cursor: "pointer", fontSize: "0.8rem", transition: "color 0.15s" }}
            onMouseEnter={e => e.target.style.color="#ffb347"} onMouseLeave={e => e.target.style.color="#2a2a2a"}>↩</button>
          <button onClick={() => onDelete(task.id)} title="Delete forever"
            style={{ background: "none", border: "none", color: "#1e1e1e", cursor: "pointer", fontSize: "0.8rem", transition: "color 0.15s" }}
            onMouseEnter={e => e.target.style.color="#ef4444"} onMouseLeave={e => e.target.style.color="#1e1e1e"}>🗑</button>
        </div>
      </div>
    </div>
  );
}

function GlassSlider({ label, value, onChange, sublabels }) {
  return (
    <div style={{ marginBottom: "1.3rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <label style={{ fontSize: "0.75rem", color: "#666", fontFamily: "'Syne', sans-serif", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</label>
        <span style={{ fontSize: "0.78rem", color: "#e8ff5a", fontWeight: 700 }}>{sublabels[value]}</span>
      </div>
      <input type="range" min={1} max={5} value={value} onChange={e => onChange(+e.target.value)} style={{ width: "100%" }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.2rem" }}>
        <span style={{ fontSize: "0.62rem", color: "#333" }}>{sublabels[1]}</span>
        <span style={{ fontSize: "0.62rem", color: "#333" }}>{sublabels[5]}</span>
      </div>
    </div>
  );
}

function TaskModal({ task, onClose, onSave }) {
  const [form, setForm] = useState(task || DEFAULT_FORM);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(8px)" }}>
      <div style={{ ...glassStrong, borderRadius: "20px", width: "100%", maxWidth: "500px", maxHeight: "90vh", overflow: "auto", padding: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.2rem", color: "#fff", margin: 0 }}>{task ? "Edit task" : "New task"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", fontSize: "1.4rem", cursor: "pointer" }}>×</button>
        </div>
        <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Task title…"
          style={{ width: "100%", ...glass, borderRadius: "10px", padding: "0.85rem 1rem", color: "#e8e8e8", fontSize: "0.9rem", fontFamily: "'DM Mono', monospace", marginBottom: "1.2rem", outline: "none", boxSizing: "border-box" }} />
        <div style={{ marginBottom: "1.3rem" }}>
          <label style={{ fontSize: "0.75rem", color: "#666", fontFamily: "'Syne', sans-serif", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: "0.5rem" }}>Category</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {CATEGORIES.map(c => {
              const acc = CAT_ACCENT(c); const active = form.category === c;
              return (
                <button key={c} onClick={() => set("category", c)} style={{
                  padding: "0.3rem 0.8rem", borderRadius: "20px",
                  border: `1px solid ${active ? acc + "80" : "rgba(255,255,255,0.08)"}`,
                  background: active ? acc + "18" : "rgba(255,255,255,0.03)",
                  color: active ? acc : "#444", fontSize: "0.75rem", cursor: "pointer",
                  fontFamily: "'Syne', sans-serif", fontWeight: 600,
                  boxShadow: active ? `0 0 10px ${acc}33` : "none",
                  transition: "background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s",
                }}>{c}</button>
              );
            })}
          </div>
        </div>
        <GlassSlider label="Urgency" value={form.urgency} onChange={v => set("urgency", v)} sublabels={{ 1: "Someday", 2: "Eventually", 3: "This month", 4: "This week", 5: "TODAY" }} />
        <GlassSlider label="Importance" value={form.importance} onChange={v => set("importance", v)} sublabels={{ 1: "Nice to have", 2: "Low", 3: "Medium", 4: "High", 5: "Critical" }} />
        <GlassSlider label="Effort" value={form.effort} onChange={v => set("effort", v)} sublabels={EFFORT_LABELS} />
        <GlassSlider label="Energy needed" value={form.energy} onChange={v => set("energy", v)} sublabels={ENERGY_LABELS} />
        <textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Notes…"
          style={{ width: "100%", ...glass, borderRadius: "10px", padding: "0.75rem 1rem", color: "#888", fontSize: "0.82rem", fontFamily: "'DM Mono', monospace", resize: "none", height: "64px", outline: "none", marginBottom: "1.2rem", boxSizing: "border-box" }} />
        <GlassButton onClick={() => { if (form.title.trim()) onSave({ ...form, id: task?.id || Date.now(), done: task?.done || false, addedAt: task?.addedAt || new Date().toISOString(), doneAt: task?.doneAt || null }); }} accent="#e8ff5a" style={{ width: "100%", padding: "0.9rem", fontSize: "0.9rem" }}>
          Save task →
        </GlassButton>
      </div>
    </div>
  );
}

function BrainDumpModal({ onClose, onTasksAdded, apiKey, weights }) {
  const [dump, setDump] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState(null);

  const parseDump = async () => {
    if (!dump.trim()) return;
    if (!apiKey.trim()) { setError("No API key — add one in Settings (⚙️) first."); return; }
    setLoading(true); setError(null);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey.trim(), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 4000,
          system: `You are a task classification assistant. The user gives you a brain dump — any language, possibly numbered like "5. Do thing" or bullet points. Extract every task and classify it.

For each task output these fields:
- title: clean English action item (verb + object, max 60 chars). Translate from French or other languages.
- category: one of Health, Work, Admin, Social, Finance, Learning, Personal
- urgency: integer 1-5 (5=today, 4=this week, 3=this month, 2=eventually, 1=someday)
- importance: integer 1-5 (5=critical, 1=nice to have)
- effort: integer 1-5 (1=2min, 2=15min, 3=1hr, 4=half day, 5=multi-day)
- energy: integer 1-5 (1=zombie mode ok, 5=peak focus needed)
- notes: brief context string (can be empty string)

Return ONLY a JSON array. No markdown. No explanation. First character must be [ and last must be ].`,
          messages: [{ role: "user", content: dump }]
        })
      });
      const rawText = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${rawText.slice(0, 200)}`);
      const data = JSON.parse(rawText);
      if (data.error) throw new Error(`API: ${data.error.message}`);
      const textBlock = data.content?.find(b => b.type === "text");
      if (!textBlock) throw new Error("No text in response");
      const jsonMatch = textBlock.text.replace(/```json|```/g, "").trim().match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("No JSON array found");
      const tasks = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(tasks) || !tasks.length) throw new Error("Empty task list");
      setParsed(tasks);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const confirmAdd = () => {
    const now = new Date().toISOString();
    onTasksAdded(parsed.map(t => ({ ...t, id: Date.now() + Math.random(), done: false, addedAt: now, doneAt: null })));
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(8px)" }}>
      <div style={{ ...glassStrong, borderRadius: "20px", width: "100%", maxWidth: "640px", maxHeight: "90vh", overflow: "auto", padding: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.3rem", color: "#fff", margin: 0 }}>Brain Dump</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", fontSize: "1.4rem", cursor: "pointer" }}>×</button>
        </div>
        {!parsed ? (
          <>
            <p style={{ color: "#555", fontSize: "0.82rem", marginBottom: "1rem", lineHeight: 1.7 }}>Paste anything — numbered, French, messy. Claude classifies it.</p>
            <textarea value={dump} onChange={e => setDump(e.target.value)}
              placeholder={"5. Se renseigner sur Runpod\n6. Faire recette Sauce carotte\n7. Entreprise Mansa remplir documents\n8. Create Obsidian vault"}
              style={{ width: "100%", minHeight: "180px", ...glass, borderRadius: "12px", padding: "1rem", color: "#ccc", fontSize: "0.87rem", fontFamily: "'DM Mono', monospace", resize: "vertical", outline: "none", boxSizing: "border-box" }} />
            <GlassButton onClick={parseDump} disabled={loading || !dump.trim()} accent="#e8ff5a" style={{ marginTop: "1rem", width: "100%", padding: "0.9rem" }}>
              {loading ? "Classifying…" : "Parse & classify →"}
            </GlassButton>
            {error && <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.75rem" }}>❌ {error}</p>}
          </>
        ) : (
          <>
            <p style={{ color: "#555", fontSize: "0.82rem", marginBottom: "1.2rem" }}>Found <strong style={{ color: "#e8ff5a" }}>{parsed.length} tasks</strong>. Confirm to add.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1.5rem" }}>
              {parsed.map((t, i) => {
                const acc = CAT_ACCENT(t.category);
                return (
                  <div key={i} style={{ ...glass, borderRadius: "12px", padding: "0.85rem 1rem", borderLeft: `2px solid ${acc}66` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
                      <span style={{ color: "#ddd", fontSize: "0.87rem", fontWeight: 600 }}>{t.title}</span>
                      <span style={{ fontSize: "0.68rem", padding: "2px 8px", borderRadius: "20px", background: acc + "18", color: acc, whiteSpace: "nowrap", fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>{t.category}</span>
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.4rem" }}>
                      {[["U", t.urgency], ["I", t.importance], ["E", t.effort], ["⚡", t.energy]].map(([l, v]) => (
                        <span key={l} style={{ fontSize: "0.68rem", color: "#444" }}>{l} <span style={{ color: "#888" }}>{v}/5</span></span>
                      ))}
                      <span style={{ fontSize: "0.68rem", color: "#e8ff5a", fontWeight: 700 }}>Score {calcScore(t, weights)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <GlassButton onClick={() => setParsed(null)} style={{ flex: 1 }}>← Edit</GlassButton>
              <GlassButton onClick={confirmAdd} accent="#e8ff5a" style={{ flex: 2 }}>Add {parsed.length} tasks →</GlassButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function WeightSlider({ label, value, onChange, description }) {
  return (
    <div style={{ marginBottom: "1.2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
        <div>
          <span style={{ fontSize: "0.78rem", color: "#aaa", fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>{label}</span>
          <span style={{ fontSize: "0.68rem", color: "#444", marginLeft: "0.5rem" }}>{description}</span>
        </div>
        <span style={{ fontSize: "0.8rem", color: "#e8ff5a", fontWeight: 700, fontFamily: "'Syne', sans-serif", minWidth: "32px", textAlign: "right" }}>{value}</span>
      </div>
      <input type="range" min={0} max={100} step={5} value={value} onChange={e => onChange(+e.target.value)}
        style={{ width: "100%" }} />
    </div>
  );
}

function SettingsModal({ apiKey, weights, onSave, onClose }) {
  const [key, setKey] = useState(apiKey);
  const [w, setW] = useState(weights || DEFAULT_WEIGHTS);
  const setWField = (k, v) => setW(prev => ({ ...prev, [k]: v }));
  const total = w.urgency + w.importance + w.effort + w.energy;
  const pct = (v) => total > 0 ? Math.round((v / total) * 100) : 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(8px)" }}>
      <div style={{ ...glassStrong, borderRadius: "20px", width: "100%", maxWidth: "500px", maxHeight: "90vh", overflow: "auto", padding: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.2rem", color: "#fff", margin: 0 }}>Settings</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", fontSize: "1.4rem", cursor: "pointer" }}>×</button>
        </div>

        <label style={{ fontSize: "0.75rem", color: "#555", fontFamily: "'Syne', sans-serif", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: "0.5rem" }}>Anthropic API Key</label>
        <input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="sk-ant-..."
          style={{ width: "100%", ...glass, borderRadius: "10px", padding: "0.85rem 1rem", color: "#e8e8e8", fontSize: "0.87rem", fontFamily: "'DM Mono', monospace", marginBottom: "0.5rem", outline: "none", boxSizing: "border-box" }} />
        <p style={{ color: "#3a3a3a", fontSize: "0.72rem", marginBottom: "1.8rem", lineHeight: 1.6 }}>
          Get your key at <span style={{ color: "#6b9fff" }}>console.anthropic.com</span>. Only used for Brain Dump.
        </p>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "1.5rem", marginBottom: "0.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.4rem" }}>
            <label style={{ fontSize: "0.75rem", color: "#555", fontFamily: "'Syne', sans-serif", textTransform: "uppercase", letterSpacing: "0.07em" }}>Score Weights</label>
            <span style={{ fontSize: "0.68rem", color: total === 100 ? "#6bffb3" : "#ffb347" }}>
              total: {total} {total !== 100 ? "(normalised)" : ""}
            </span>
          </div>
          <p style={{ fontSize: "0.72rem", color: "#333", marginBottom: "1.2rem", lineHeight: 1.6 }}>
            Controls what makes a task rise to the top in 🔥 Do Now. Higher weight = more influence on score.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.4rem", marginBottom: "1.2rem" }}>
            {[["Urgency", w.urgency], ["Importance", w.importance], ["Quick win", w.effort], ["Low energy", w.energy]].map(([l, v]) => (
              <div key={l} style={{ ...glass, borderRadius: "10px", padding: "0.6rem", textAlign: "center" }}>
                <div style={{ fontSize: "0.62rem", color: "#444", fontFamily: "'Syne', sans-serif", marginBottom: "0.2rem" }}>{l}</div>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "#e8ff5a", fontFamily: "'Syne', sans-serif" }}>{pct(v)}%</div>
              </div>
            ))}
          </div>
          <WeightSlider label="Urgency" value={w.urgency} onChange={v => setWField("urgency", v)} description="deadline proximity" />
          <WeightSlider label="Importance" value={w.importance} onChange={v => setWField("importance", v)} description="impact if done" />
          <WeightSlider label="Effort (Quick Win)" value={w.effort} onChange={v => setWField("effort", v)} description="rewards fast tasks" />
          <WeightSlider label="Energy (Low cost)" value={w.energy} onChange={v => setWField("energy", v)} description="rewards easy brain tasks" />
          <button onClick={() => setW(DEFAULT_WEIGHTS)} style={{
            background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px",
            color: "#444", fontSize: "0.72rem", cursor: "pointer", padding: "0.4rem 0.8rem",
            fontFamily: "'Syne', sans-serif", marginBottom: "1.2rem", transition: "color 0.15s",
          }}
            onMouseEnter={e => e.target.style.color="#aaa"} onMouseLeave={e => e.target.style.color="#444"}>
            Reset to defaults
          </button>
        </div>

        <GlassButton onClick={() => { onSave(key, w); onClose(); }} accent="#e8ff5a" style={{ width: "100%", padding: "0.9rem" }}>Save →</GlassButton>
      </div>
    </div>
  );
}

function ExportButton({ tasks, weights }) {
  const exportCSV = () => {
    const headers = ["title", "category", "urgency", "importance", "effort", "energy", "score", "done", "notes", "addedAt", "doneAt"];
    const rows = tasks.map(t => headers.map(h => {
      const v = h === "score" ? calcScore(t, weights) : t[h] ?? "";
      return `"${String(v).replace(/"/g, '""')}"`;
    }).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `brainqueue_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };
  return <GlassButton onClick={exportCSV} style={{ padding: "0.6rem 0.9rem", fontSize: "0.75rem" }}>↓ CSV</GlassButton>;
}

function MainApp() {
  const [state, setState] = useState(() => loadState());
  const { tasks, apiKey, weights = DEFAULT_WEIGHTS } = state;
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | synced | error

  const update = (patch) => setState(s => { const n = { ...s, ...patch }; saveState(n); return n; });

  // On mount: fetch remote tasks, merge with local, then subscribe to realtime changes
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;

    setSyncStatus("syncing");

    // 1. Initial fetch + merge
    fetchRemoteTasks().then(remote => {
      if (!remote) { setSyncStatus("error"); return; }
      setState(s => {
        const merged = mergeTasks(s.tasks, remote);
        const remoteIds = new Set(remote.map(t => String(t.id)));
        s.tasks.forEach(t => { if (!remoteIds.has(String(t.id))) upsertTask(t); });
        const n = { ...s, tasks: merged };
        saveState(n);
        return n;
      });
      setSyncStatus("synced");
    });

    // 2. Realtime subscription — listens to INSERT, UPDATE, DELETE from any device
    const channel = sb
      .channel("tasks-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tasks" }, ({ new: row }) => {
        const task = fromRow(row);
        setState(s => {
          if (s.tasks.find(t => String(t.id) === String(task.id))) return s; // already have it
          const n = { ...s, tasks: [...s.tasks, task] };
          saveState(n);
          return n;
        });
        setSyncStatus("synced");
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tasks" }, ({ new: row }) => {
        const task = fromRow(row);
        setState(s => {
          const n = { ...s, tasks: s.tasks.map(t => String(t.id) === String(task.id) ? task : t) };
          saveState(n);
          return n;
        });
        setSyncStatus("synced");
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "tasks" }, ({ old: row }) => {
        setState(s => {
          const n = { ...s, tasks: s.tasks.filter(t => String(t.id) !== String(row.id)) };
          saveState(n);
          return n;
        });
        setSyncStatus("synced");
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") console.log("✓ Realtime connected");
        if (status === "CHANNEL_ERROR") { console.error("Realtime error"); setSyncStatus("error"); }
      });

    // Cleanup on unmount
    return () => { sb.removeChannel(channel); };
  }, []);

  const [view, setView] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [showDump, setShowDump] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [filterCat, setFilterCat] = useState("All");

  const saveTask = useCallback((t) => {
    update({ tasks: tasks.find(x => x.id === t.id) ? tasks.map(x => x.id === t.id ? t : x) : [...tasks, t] });
    upsertTask(t);
    setShowAdd(false); setEditTask(null);
  }, [tasks]);

  const markDone = useCallback((id) => {
    const updated = tasks.map(t => t.id === id ? { ...t, done: true, doneAt: new Date().toISOString() } : t);
    update({ tasks: updated });
    const task = updated.find(t => t.id === id);
    if (task) upsertTask(task);
  }, [tasks]);

  const restore = useCallback((id) => {
    const updated = tasks.map(t => t.id === id ? { ...t, done: false, doneAt: null } : t);
    update({ tasks: updated });
    const task = updated.find(t => t.id === id);
    if (task) upsertTask(task);
  }, [tasks]);

  const deleteTask = useCallback((id) => {
    update({ tasks: tasks.filter(t => t.id !== id) });
    deleteRemoteTask(id);
  }, [tasks]);

  const addBulk = useCallback((newTasks) => {
    update({ tasks: [...tasks, ...newTasks] });
    newTasks.forEach(t => upsertTask(t));
  }, [tasks]);

  const active = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done).sort((a, b) => new Date(b.doneAt) - new Date(a.doneAt));
  const sorted = [...active].sort((a, b) => calcScore(b, weights) - calcScore(a, weights));

  const viewTasks = view === 4 ? done : [
    sorted.filter(t => calcScore(t, weights) >= 60 || t.urgency >= 4),
    sorted.filter(t => t.effort <= 2 && t.importance >= 3),
    sorted.filter(t => t.energy <= 2),
    filterCat === "All" ? sorted : sorted.filter(t => t.category === filterCat),
  ][view];

  const viewDescriptions = [
    "High score + urgent. Start here.",
    "Under 15 min, meaningful impact.",
    "Doable in zombie mode.",
    `${filterCat === "All" ? "All" : filterCat} active tasks.`,
    `${done.length} completed tasks.`,
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #060610; }
        ::selection { background: #e8ff5a33; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
        input[type=range] { -webkit-appearance: none; width: 100%; height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #e8ff5a; box-shadow: 0 0 8px #e8ff5a88; cursor: pointer; }
        input, textarea { -webkit-appearance: none; appearance: none; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .task-enter { animation: fadeUp 0.28s cubic-bezier(0.34,1.2,0.64,1) both; }
      `}</style>

      <MouseGlow />

      {/* Ambient orbs */}
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-20%", left: "-10%", width: "600px", height: "600px", borderRadius: "50%", background: "radial-gradient(circle, rgba(107,159,255,0.06) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "-10%", right: "-5%", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(196,123,255,0.05) 0%, transparent 70%)" }} />
      </div>

      <div style={{ minHeight: "100vh", color: "#e0e0e0", fontFamily: "'DM Mono', monospace", position: "relative", zIndex: 1 }}>

        {/* Header */}
        <div style={{ padding: "2rem 1.5rem 1.2rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ maxWidth: "720px", margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.5rem" }}>
              <div>
                <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "1.7rem", letterSpacing: "-0.03em", lineHeight: 1 }}>
                  <span style={{ color: "#e8e8e8" }}>Brain</span>
                  <span style={{ color: "#e8ff5a", textShadow: "0 0 20px rgba(232,255,90,0.4)" }}>Queue</span>
                </h1>
                <p style={{ fontSize: "0.72rem", color: "#333", marginTop: "0.3rem" }}>
                  {active.length} active · {done.length} done
                  {syncStatus === "syncing" && <span style={{ color: "#6b9fff", marginLeft: "0.5rem" }}>↻ syncing</span>}
                  {syncStatus === "synced"  && <span style={{ color: "#6bffb3", marginLeft: "0.5rem" }}>✓ synced</span>}
                  {syncStatus === "error"   && <span style={{ color: "#ff6b6b", marginLeft: "0.5rem" }}>⚠ offline</span>}
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                <ExportButton tasks={tasks} weights={weights} />
                <GlassButton onClick={() => { clearSession(); window.location.reload(); }} style={{ padding: "0.6rem 0.8rem", fontSize: "0.75rem" }}>⏻</GlassButton>
                <GlassButton onClick={() => setShowSettings(true)} style={{ padding: "0.6rem 0.8rem" }}>⚙️</GlassButton>
                <GlassButton onClick={() => setShowDump(true)}>Brain Dump</GlassButton>
                <GlassButton onClick={() => setShowAdd(true)} accent="#e8ff5a">+ Add</GlassButton>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.4rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
              {VIEWS.map((v, i) => <ViewTab key={i} label={v} active={view === i} onClick={() => setView(i)} />)}
            </div>
          </div>
        </div>

        {view === 3 && (
          <div style={{ padding: "0.75rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ maxWidth: "720px", margin: "0 auto", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {["All", ...CATEGORIES].map(c => {
                const acc = c === "All" ? "#e8ff5a" : CAT_ACCENT(c); const act = filterCat === c;
                return (
                  <button key={c} onClick={() => setFilterCat(c)} style={{
                    padding: "0.28rem 0.75rem", borderRadius: "20px",
                    border: `1px solid ${act ? acc + "60" : "rgba(255,255,255,0.06)"}`,
                    background: act ? acc + "14" : "transparent",
                    color: act ? acc : "#3a3a3a", fontSize: "0.73rem", cursor: "pointer",
                    fontFamily: "'Syne', sans-serif", fontWeight: 600,
                    transition: "background 0.15s, border-color 0.15s, color 0.15s",
                  }}>{c}</button>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ padding: "0.9rem 1.5rem 0.4rem" }}>
          <div style={{ maxWidth: "720px", margin: "0 auto" }}>
            <p style={{ fontSize: "0.7rem", color: "#2e2e2e", fontFamily: "'Syne', sans-serif", letterSpacing: "0.04em" }}>
              {viewTasks?.length} TASKS — {viewDescriptions[view].toUpperCase()}
            </p>
          </div>
        </div>

        <div style={{ padding: "0.5rem 1.5rem 5rem", maxWidth: "720px", margin: "0 auto" }}>
          {!viewTasks?.length ? (
            <div style={{ textAlign: "center", padding: "5rem 0", color: "#222" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem", opacity: 0.3 }}>
                {view === 4 ? "🏆" : "∅"}
              </div>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "0.82rem" }}>
                {view === 4 ? "No completed tasks yet" : "Nothing here yet"}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {viewTasks.map((t, i) => (
                <div key={t.id} className="task-enter" style={{ animationDelay: `${i * 0.04}s` }}>
                  {t.done
                    ? <DoneCard task={t} onDelete={deleteTask} onRestore={restore} />
                    : <TaskCard task={t} onEdit={setEditTask} onMarkDone={markDone} onDelete={deleteTask} weights={weights} />
                  }
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showSettings && <SettingsModal apiKey={apiKey} weights={weights} onSave={(k, w) => update({ apiKey: k, weights: w })} onClose={() => setShowSettings(false)} />}
      {showDump && <BrainDumpModal onClose={() => setShowDump(false)} onTasksAdded={addBulk} apiKey={apiKey} weights={weights} />}
      {(showAdd || editTask) && <TaskModal task={editTask} onClose={() => { setShowAdd(false); setEditTask(null); }} onSave={saveTask} />}
    </>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(() => loadSession());
  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;
  return <MainApp />;
}
