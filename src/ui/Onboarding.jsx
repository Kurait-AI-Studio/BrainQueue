// First-run onboarding. Five beats: welcome → a fake, beautifully-classified brain dump
// → a simulated focus session with an XP win → the Memory ask (two honest contrast cards)
// → "you're ready". Shown once per user; skippable. The Memory step is the informed,
// freely-given consent moment; the recurring nudge catches anyone who picks "Not now".
import { useState, useEffect, useRef } from "react";
import { glass, glassStrong } from "./tokens";
import { GlassButton } from "./GlassButton";
import { CAT_ACCENT } from "../lib/tasks";

const RAW_DUMP = `call the dentist about the filling
reply to Sarah about Friday dinner
pay the electricity bill (urgent!)
buy a birthday gift for mom
finish the Q3 report draft`;

// The "perfectly classified" result we show off.
const DEMO_TASKS = [
  { title: "Pay the electricity bill", category: "Finance", score: 92, est: "5 min" },
  { title: "Call the dentist about the filling", category: "Health", score: 84, est: "10 min" },
  { title: "Reply to Sarah about Friday dinner", category: "Social", score: 71, est: "3 min" },
];

const Tag = ({ children, color = "#bef24a" }) => (
  <span style={{ fontSize: "0.58rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color, border: `1px solid ${color}55`, borderRadius: "6px", padding: "2px 6px" }}>{children}</span>
);

const Dots = ({ n, i }) => (
  <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
    {Array.from({ length: n }).map((_, k) => (
      <span key={k} style={{ width: k === i ? 18 : 6, height: 6, borderRadius: 99, background: k === i ? "#bef24a" : "rgba(255,255,255,0.15)", transition: "all 0.25s" }} />
    ))}
  </div>
);

function TaskRow({ t, done }) {
  const acc = CAT_ACCENT(t.category);
  return (
    <div style={{ ...glass, borderRadius: 12, padding: "0.7rem 0.85rem", borderLeft: `2px solid ${acc}66`, display: "flex", alignItems: "center", gap: 12, transition: "opacity 0.3s" }}>
      <span style={{ width: 20, height: 20, borderRadius: 6, border: `1px solid ${done ? acc : "rgba(255,255,255,0.25)"}`, background: done ? acc : "transparent", display: "grid", placeItems: "center", flexShrink: 0, transition: "all 0.3s" }}>
        {done && <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M2.5 7.5l3 3 6-7" stroke="#0a0a0d" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </span>
      <span style={{ flex: 1, fontSize: "0.85rem", fontWeight: 600, color: done ? "#5a5a64" : "#ddd", textDecoration: done ? "line-through" : "none", transition: "color 0.3s" }}>{t.title}</span>
      <span style={{ fontSize: "0.62rem", color: acc, fontWeight: 700, background: acc + "14", border: `1px solid ${acc}33`, borderRadius: 20, padding: "2px 8px" }}>{t.category}</span>
    </div>
  );
}

export function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [memory, setMemory] = useState(null); // "full" | "product-only" | null
  const next = () => setStep((s) => s + 1);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#0a0a0d", display: "flex", flexDirection: "column", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.1rem 1.4rem" }}>
        <Dots n={5} i={step} />
        {step < 3 && (
          <button onClick={() => onComplete(null)} style={{ background: "none", border: "none", color: "#444", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}>Skip</button>
        )}
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem 1.4rem 3rem" }}>
        <div style={{ width: "100%", maxWidth: 540 }}>
          {step === 0 && <Welcome onNext={next} />}
          {step === 1 && <DumpDemo onNext={next} />}
          {step === 2 && <SessionDemo onNext={next} />}
          {step === 3 && <MemoryAsk onChoose={(m) => { setMemory(m); next(); }} />}
          {step === 4 && <Ready memory={memory} onDone={() => onComplete(memory)} />}
        </div>
      </div>
    </div>
  );
}

function Welcome({ onNext }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "2.4rem", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "0.5rem" }}>
        <span style={{ color: "#e8e8e8" }}>Brain</span><span style={{ color: "#bef24a", textShadow: "0 0 24px rgba(190,242,74,0.45)" }}>Queue</span>
      </div>
      <p style={{ color: "#9a9aa6", fontSize: "1rem", lineHeight: 1.7, maxWidth: 420, margin: "0 auto 2rem" }}>
        Your head is full. BrainQueue catches the mess, turns it into clear, doable tasks, and points you at the one next step.
      </p>
      <GlassButton onClick={onNext} accent="#bef24a" style={{ padding: "0.85rem 1.8rem" }}>Show me how →</GlassButton>
      <p style={{ color: "#333", fontSize: "0.7rem", marginTop: "1rem" }}>Takes about 30 seconds.</p>
    </div>
  );
}

function DumpDemo({ onNext }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.6rem" }}>
        <h2 style={{ color: "#fff", fontSize: "1.2rem", margin: 0 }}>1. Dump everything</h2>
        <Tag color="#6b9fff">Example</Tag>
      </div>
      <p style={{ color: "#666", fontSize: "0.8rem", marginBottom: "1rem", lineHeight: 1.6 }}>Paste anything — messy, half-finished, any order. BrainQueue extracts and scores each task.</p>

      <div style={{ ...glass, borderRadius: 12, padding: "0.9rem 1rem", color: "#8a8a92", fontSize: "0.82rem", lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: "0.9rem" }}>{RAW_DUMP}</div>
      <div style={{ textAlign: "center", color: "#bef24a", fontSize: "1.1rem", marginBottom: "0.9rem" }}>↓</div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.6rem" }}>
        {DEMO_TASKS.concat([
          { title: "Buy a birthday gift for mom", category: "Personal", score: 64, est: "30 min" },
          { title: "Finish the Q3 report draft", category: "Work", score: 58, est: "2 h" },
        ]).map((t) => {
          const acc = CAT_ACCENT(t.category);
          return (
            <div key={t.title} style={{ ...glass, borderRadius: 12, padding: "0.7rem 0.85rem", borderLeft: `2px solid ${acc}66`, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ flex: 1, fontSize: "0.85rem", fontWeight: 600, color: "#ddd" }}>{t.title}</span>
              <span style={{ fontSize: "0.62rem", color: "#777" }}>{t.est}</span>
              <span style={{ fontSize: "0.62rem", color: acc, fontWeight: 700, background: acc + "14", border: `1px solid ${acc}33`, borderRadius: 20, padding: "2px 8px" }}>{t.category}</span>
              <span style={{ fontSize: "0.62rem", color: "#bef24a", fontWeight: 800 }}>{t.score}</span>
            </div>
          );
        })}
      </div>
      <div style={{ textAlign: "center" }}><GlassButton onClick={onNext} accent="#bef24a" style={{ padding: "0.8rem 1.6rem" }}>Now let's focus →</GlassButton></div>
    </div>
  );
}

function SessionDemo({ onNext }) {
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(0);
  const [xp, setXp] = useState(40);
  const [level, setLevel] = useState(1);
  const [leveled, setLeveled] = useState(false);
  const timers = useRef([]);

  const run = () => {
    setStarted(true);
    DEMO_TASKS.forEach((_, i) => {
      timers.current.push(setTimeout(() => {
        setDone(i + 1);
        setXp((x) => Math.min(100, x + 20));
        if (i === DEMO_TASKS.length - 1) {
          timers.current.push(setTimeout(() => { setLevel(2); setLeveled(true); setXp(18); }, 500));
        }
      }, 500 + i * 750));
    });
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.6rem" }}>
        <h2 style={{ color: "#fff", fontSize: "1.2rem", margin: 0 }}>2. Focus and finish</h2>
        <Tag color="#6b9fff">Example</Tag>
      </div>
      <p style={{ color: "#666", fontSize: "0.8rem", marginBottom: "1.2rem", lineHeight: 1.6 }}>Pick a realistic set, work through it, and watch progress add up.</p>

      <div style={{ ...glassStrong, borderRadius: 16, padding: "1.1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.8rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "0.7rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.1em" }}>Level</span>
            <span style={{ fontSize: "1.6rem", fontWeight: 800, color: "#bef24a", lineHeight: 1, transition: "all 0.3s", transform: leveled ? "scale(1.15)" : "none" }}>{level}</span>
            {leveled && <span style={{ fontSize: "0.7rem", color: "#bef24a", fontWeight: 800, animation: "task-enter 0.5s ease" }}>Level up! ✨</span>}
          </div>
          <span style={{ fontSize: "0.78rem", color: "#bef24a", fontWeight: 700 }}>{done > 0 ? `+${done * 20} XP` : ""}</span>
        </div>
        <div style={{ height: 8, borderRadius: 99, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: "1.1rem" }}>
          <div style={{ height: "100%", width: `${xp}%`, borderRadius: 99, background: "linear-gradient(90deg, rgba(190,242,74,0.7), #bef24a)", transition: "width 0.6s cubic-bezier(0.22,1,0.36,1)" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {DEMO_TASKS.map((t, i) => <TaskRow key={t.title} t={t} done={i < done} />)}
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: "1.4rem" }}>
        {!started ? (
          <GlassButton onClick={run} accent="#bef24a" style={{ padding: "0.8rem 1.6rem" }}>Start focus session →</GlassButton>
        ) : (
          <GlassButton onClick={onNext} accent="#bef24a" disabled={!leveled} style={{ padding: "0.8rem 1.6rem", opacity: leveled ? 1 : 0.5 }}>
            {leveled ? "That felt good — continue →" : "Finishing…"}
          </GlassButton>
        )}
      </div>
    </div>
  );
}

function MemoryAsk({ onChoose }) {
  const Card = ({ id, title, points, recommended, accent, fine }) => (
    <button onClick={() => onChoose(id)} style={{
      ...glassStrong, borderRadius: 18, padding: "1.3rem 1.2rem", textAlign: "left", cursor: "pointer", flex: 1, minWidth: 200,
      border: `1px solid ${recommended ? "#bef24a66" : "rgba(255,255,255,0.08)"}`, position: "relative", transition: "transform 0.15s, border-color 0.15s",
    }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-3px)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}>
      {recommended && <span style={{ position: "absolute", top: -10, left: 16, background: "#bef24a", color: "#0a0a0d", fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: 6, padding: "2px 7px" }}>Recommended</span>}
      <div style={{ fontSize: "1.05rem", fontWeight: 800, color: accent, marginBottom: "0.7rem" }}>{title}</div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {points.map((p) => (
          <li key={p} style={{ fontSize: "0.78rem", color: "#bcbcc6", lineHeight: 1.5, display: "flex", gap: 7 }}>
            <span style={{ color: accent }}>{recommended ? "✦" : "·"}</span>{p}
          </li>
        ))}
      </ul>
      {fine && <p style={{ fontSize: "0.66rem", color: "#5a5a64", lineHeight: 1.5, marginTop: "0.9rem" }}>{fine}</p>}
    </button>
  );

  return (
    <div>
      <h2 style={{ color: "#fff", fontSize: "1.4rem", margin: "0 0 0.5rem", textAlign: "center" }}>One last thing — turn on Memory?</h2>
      <p style={{ color: "#8a8a92", fontSize: "0.85rem", lineHeight: 1.6, textAlign: "center", maxWidth: 440, margin: "0 auto 1.6rem" }}>
        That was the standard version. With Memory on, BrainQueue learns how you actually work and adapts to you.
      </p>
      <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap" }}>
        <Card id="full" recommended accent="#bef24a" title="Personalized"
          points={["Remembers how you work", "Plans adapt to your energy and habits", "Gets sharper every week"]}
          fine="Uses your activity, de-identified, including to train our models. Never your calendar data." />
        <Card id="product-only" accent="#cfcfd6" title="Standard"
          points={["A great task manager", "No learning from your data", "Same for everyone"]} />
      </div>
      <p style={{ color: "#444", fontSize: "0.72rem", textAlign: "center", marginTop: "1.3rem" }}>You can change this anytime in Settings → Memory.</p>
    </div>
  );
}

function Ready({ memory, onDone }) {
  const on = memory === "full";
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "2.6rem", marginBottom: "0.6rem" }}>{on ? "🧠" : "✅"}</div>
      <h2 style={{ color: "#fff", fontSize: "1.5rem", margin: "0 0 0.6rem" }}>You're all set</h2>
      <p style={{ color: "#9a9aa6", fontSize: "0.9rem", lineHeight: 1.7, maxWidth: 400, margin: "0 auto 1.8rem" }}>
        {on
          ? "Memory is on — BrainQueue will start adapting to you. Now make it yours: dump what's on your mind."
          : "Memory is off, and that's fine — BrainQueue still works great. You can turn it on anytime in Settings. Now dump what's on your mind."}
      </p>
      <GlassButton onClick={onDone} accent="#bef24a" style={{ padding: "0.9rem 2rem" }}>Start with my own tasks →</GlassButton>
    </div>
  );
}
