// The full-screen focus session: an intro ceremony, a single-task work/break timer
// with Pomodoro cadence, and a completion summary. Emits the pomodoro/break telemetry
// that the learning loop will use to tune each user's rhythm.
import { useState, useEffect, useRef } from "react";
import { glass, glassStrong } from "./tokens";
import { GlassButton } from "./GlassButton";
import { logEvent } from "../lib/client";
import { taskTier, TIER, fmtDuration } from "../lib/tasks";

function notify(title, body) {
  try { if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(title, { body }); } catch { /* ignore */ }
}
let _audioCtx = null;
function chime(freq = 660) {
  try {
    _audioCtx = _audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = _audioCtx.createOscillator(), g = _audioCtx.createGain();
    o.type = "sine"; o.frequency.value = freq; o.connect(g); g.connect(_audioCtx.destination);
    const t = _audioCtx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.start(t); o.stop(t + 0.7);
  } catch { /* ignore */ }
}
const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;
const TIER_RANK = { reflex: 0, standard: 1, heavy: 2 };

export function FocusMode({ session, tasks, onMarkDone, onExit }) {
  const [completed, setCompleted] = useState([]);
  const remaining = session.taskIds.filter(id => !completed.includes(id));
  const current = tasks.find(t => t.id === remaining[0]) || null;
  const heaviestTier = session.taskIds
    .map(id => tasks.find(t => t.id === id)).filter(Boolean)
    .reduce((m, t) => Math.max(m, TIER_RANK[taskTier(t)]), 0);

  const [phase, setPhase] = useState("intro"); // intro | work | break | done
  const [secondsLeft, setSecondsLeft] = useState(session.work * 60);
  const [running, setRunning] = useState(true);
  const [pomos, setPomos] = useState(0);
  const focusSec = useRef(0);
  const flipping = useRef(false);

  // Calm entrance; longer breath for heavier work.
  useEffect(() => {
    if (phase !== "intro") return;
    const t = setTimeout(() => setPhase("work"), heaviestTier === 2 ? 4200 : 2400);
    return () => clearTimeout(t);
  }, [phase, heaviestTier]);

  // Tick
  useEffect(() => {
    if ((phase !== "work" && phase !== "break") || !running) return;
    const iv = setInterval(() => {
      if (phase === "work") focusSec.current += 1;
      setSecondsLeft(s => s - 1);
    }, 1000);
    return () => clearInterval(iv);
  }, [phase, running]);

  // Phase transition when the clock runs out
  useEffect(() => {
    if (phase !== "work" && phase !== "break") return;
    if (secondsLeft > 0) { flipping.current = false; return; }
    if (flipping.current) return;
    flipping.current = true;
    if (phase === "work") {
      chime(660); notify("Break time", "Step away and breathe.");
      setPomos(p => p + 1); logEvent("pomodoro_completed", null, { minutes: session.work });
      logEvent("break_started", null, { trigger: "pomodoro", break_minutes: session.brk });
      setPhase("break"); setSecondsLeft(session.brk * 60);
    } else {
      chime(880); notify("Back to focus", "Next round — let's go.");
      logEvent("break_ended", null, { trigger: "timer" });
      setPhase("work"); setSecondsLeft(session.work * 60);
    }
  }, [secondsLeft, phase, session.work, session.brk]);

  const finish = () => onExit(completed, focusSec.current);
  const doneCurrent = () => {
    if (!current) return;
    onMarkDone(current.id);
    const next = [...completed, current.id];
    setCompleted(next);
    if (session.taskIds.every(id => next.includes(id))) setPhase("done");
  };
  // Manual break: the user chooses to step away. Logged so we can later learn each
  // user's natural focus rhythm (Telemetry Capture Spec §3 — break_started/break_ended).
  const takeBreak = () => {
    chime(660); notify("Break", "Step away and breathe.");
    logEvent("break_started", null, { trigger: "manual", break_minutes: session.brk });
    flipping.current = true;
    setPhase("break"); setSecondsLeft(session.brk * 60); setRunning(true);
  };
  const endBreak = () => {
    chime(880);
    logEvent("break_ended", null, { trigger: "manual" });
    flipping.current = true;
    setPhase("work"); setSecondsLeft(session.work * 60);
  };

  const shell = { position: "fixed", inset: 0, zIndex: 300, background: "radial-gradient(900px 600px at 50% 35%, rgba(232,255,90,0.05), transparent 60%), #0a0a0d", color: "#e8e8e8", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "2rem", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" };

  // INTRO ceremony
  if (phase === "intro") {
    const heavy = heaviestTier === 2;
    return (
      <div style={shell}>
        <div className="task-enter" style={{ maxWidth: "560px" }}>
          <p style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: "#555", letterSpacing: "0.3em", textTransform: "uppercase", fontSize: "0.7rem" }}>Focus</p>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 800, fontSize: "clamp(1.6rem, 5vw, 2.4rem)", color: "#fff", margin: "1rem 0", lineHeight: 1.2 }}>{current ? current.title : "Let's begin"}</h1>
          {heavy && <p style={{ color: "#888", fontSize: "0.9rem" }}>Take a breath. What does “done” look like?</p>}
          <p style={{ color: "#444", fontSize: "0.78rem", marginTop: "1.5rem" }}>{session.work}-minute focus · {remaining.length} task{remaining.length === 1 ? "" : "s"}</p>
        </div>
      </div>
    );
  }

  // DONE summary
  if (phase === "done") {
    return (
      <div style={shell}>
        <div className="task-enter">
          <div style={{ fontSize: "2.4rem", marginBottom: "0.6rem" }}>✓</div>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 800, fontSize: "1.8rem", color: "#bef24a", margin: 0 }}>Session complete</h1>
          <p style={{ color: "#aaa", fontSize: "0.95rem", marginTop: "1rem", lineHeight: 1.9 }}>
            <b style={{ color: "#6bffb3" }}>{completed.length}</b> task{completed.length === 1 ? "" : "s"} done ·{" "}
            <b style={{ color: "#bef24a" }}>{mmss(focusSec.current)}</b> focused · <b style={{ color: "#6b9fff" }}>{pomos}</b> pomodoro{pomos === 1 ? "" : "s"}
          </p>
          <GlassButton onClick={finish} accent="#bef24a" style={{ marginTop: "1.8rem", padding: "0.8rem 2rem" }}>Done</GlassButton>
        </div>
      </div>
    );
  }

  // WORK / BREAK — calm, single-task screen: a timer bar up top, one focus card below.
  const isBreak = phase === "break";
  const accent = isBreak ? "#6b9fff" : "#bef24a";
  const taskTotal = session.taskIds.length;
  const taskPos = Math.min(completed.length + 1, taskTotal);
  const tier = current ? TIER[taskTier(current)] : null;
  const progPct = taskTotal ? (completed.length / taskTotal) * 100 : 0;

  const stage = { ...shell, justifyContent: "flex-start", padding: 0, overflow: "hidden" };
  const topbar = { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.1rem 1.6rem", boxSizing: "border-box" };
  const pill = { display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "0.05rem", padding: "0.4rem 1.3rem", borderRadius: "14px", ...glass, border: `1px solid ${accent}44`, opacity: running ? 1 : 0.55, transition: "opacity .3s" };
  const card = { ...glassStrong, position: "relative", width: "100%", maxWidth: "620px", borderRadius: "24px", padding: "2.6rem 2rem 2rem", border: `1px solid ${accent}22`, boxShadow: `0 0 80px ${accent}10`, textAlign: "center" };
  const badge = { width: "54px", height: "54px", margin: "0 auto 1.4rem", borderRadius: "50%", display: "grid", placeItems: "center", fontSize: "1.4rem", background: `${accent}14`, border: `1px solid ${accent}55`, boxShadow: `0 0 24px ${accent}33` };
  const eyebrow = { fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: accent, letterSpacing: "0.28em", textTransform: "uppercase", fontSize: "0.66rem", opacity: 0.85, margin: 0 };
  const btn = { padding: "0.8rem 1.2rem", flex: "1 1 auto" };

  return (
    <div style={stage}>
      {/* top bar: wordmark · timer · exit */}
      <div style={topbar}>
        <span style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 800, fontSize: "1.05rem", color: "#fff" }}>Brain<span style={{ color: "#bef24a" }}>Queue</span></span>
        <div style={pill}>
          <span style={{ fontSize: "1.15rem", fontWeight: 700, color: "#fff", letterSpacing: "0.02em" }}>{mmss(secondsLeft)}</span>
          <span style={{ fontSize: "0.56rem", letterSpacing: "0.18em", textTransform: "uppercase", color: accent }}>{running ? (isBreak ? "Break time" : "Focus time") : "Paused"}</span>
        </div>
        <button onClick={finish} title="End session"
          style={{ background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", color: "#888", fontSize: "0.74rem", padding: "0.45rem 0.8rem", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>✕ Exit Focus</button>
      </div>

      {/* centered focus card */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", width: "100%", padding: "1rem 1.4rem 3rem", boxSizing: "border-box" }}>
        <div className="task-enter" style={card}>
          <div style={badge}>{isBreak ? "☕" : "✓"}</div>
          <p style={eyebrow}>{isBreak ? "On a break" : "Your current focus"}</p>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 800, fontSize: "clamp(1.4rem, 4vw, 2.1rem)", color: "#fff", margin: "0.7rem 0 0", lineHeight: 1.2 }}>
            {isBreak ? "Breathe — look away from the screen" : (current ? current.title : "All tasks done — wrap up")}
          </h1>
          <p style={{ color: "#7a7a86", fontSize: "0.8rem", margin: "0.9rem 0 0", lineHeight: 1.6, maxWidth: "440px", marginInline: "auto" }}>
            {isBreak
              ? "Rest your eyes. Your timer resumes focus when the break ends."
              : (current ? <>✦ Chosen for this slot — {tier.label.toLowerCase()} effort, ~{fmtDuration(current.est_minutes || 25)}, matching your current energy &amp; urgency.</> : "Nothing left in this session.")}
          </p>

          {!isBreak && (
            <div style={{ maxWidth: "300px", margin: "1.6rem auto 1.8rem" }}>
              <div style={{ fontSize: "0.7rem", color: "#888", marginBottom: "0.55rem", letterSpacing: "0.05em" }}>{taskPos} of {taskTotal}</div>
              <div style={{ height: "6px", borderRadius: "20px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progPct}%`, background: accent, borderRadius: "20px", transition: "width .4s", boxShadow: `0 0 12px ${accent}88` }} />
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "0.7rem", marginTop: isBreak ? "1.8rem" : 0, flexWrap: "wrap", justifyContent: "center" }}>
            {isBreak ? (
              <GlassButton onClick={endBreak} accent="#6bffb3" style={btn}>▶ Resume focus</GlassButton>
            ) : (
              <>
                {current && <GlassButton onClick={doneCurrent} accent="#bef24a" style={btn}>✓ Complete task</GlassButton>}
                <GlassButton onClick={takeBreak} style={btn}>☕ Take a short break</GlassButton>
                <GlassButton onClick={() => setRunning(r => !r)} style={btn}>{running ? "⏸ Pause focus" : "▶ Resume"}</GlassButton>
              </>
            )}
          </div>

          <p style={{ color: "#4a4a52", fontSize: "0.7rem", marginTop: "1.5rem", marginBottom: 0 }}>
            ⓘ {isBreak ? "Telemetry noted your break — it helps tune your ideal rhythm." : "The next task appears only after this one is completed."}
          </p>
        </div>
      </div>
    </div>
  );
}
