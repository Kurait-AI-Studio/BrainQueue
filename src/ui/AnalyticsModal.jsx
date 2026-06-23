import { useState } from "react";
import { glass, glassStrong } from "./tokens";
import { MiniBars, Donut, StatCard } from "./widgets";
import { doneSeries, totalXP, levelInfo, allCategories, taskCats, CAT_ACCENT, todayScore, weekScore } from "../lib/tasks";

// Full analytics view: headline stats, done/to-do donut, completion-by-category,
// and a completions-over-time chart (week/month).
export function AnalyticsModal({ tasks, customCategories, onClose }) {
  const [period, setPeriod] = useState("week");
  const active = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);
  const total = tasks.length;
  const donePct = total ? Math.round((done.length / total) * 100) : 0;
  const series = doneSeries(tasks, period);
  const periodCount = series.reduce((s, b) => s + b.count, 0);
  const lvl = levelInfo(totalXP(tasks));
  const cats = allCategories(customCategories).filter(c => tasks.some(t => taskCats(t).includes(c)));
  const pVals = tasks.map(t => t.pleasure).filter(Boolean);
  const avgP = pVals.length ? pVals.reduce((a, b) => a + b, 0) / pVals.length : 0;
  const pEmoji = ["—", "😣", "😕", "😐", "🙂", "😍"][Math.round(avgP)] || "—";

  const Section = ({ title, action, children }) => (
    <div style={{ marginTop: "1.4rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
        <h3 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "#888", fontWeight: 700 }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 120, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", backdropFilter: "blur(8px)", overflow: "auto" }}>
      <div onClick={e => e.stopPropagation()} style={{ ...glassStrong, borderRadius: "22px", width: "100%", maxWidth: "660px", padding: "1.8rem", margin: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.3rem" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: "1.3rem", color: "#fff", margin: 0 }}>📊 Analytics</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", fontSize: "1.5rem", cursor: "pointer" }}>×</button>
        </div>

        <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.6rem" }}>
          <StatCard label="Active tasks" value={active.length} accent="#bef24a" />
          <StatCard label="Completed" value={done.length} accent="#6bffb3" />
          <StatCard label={`Level · ${lvl.title}`} value={lvl.level} accent="#bef24a" />
        </div>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <StatCard label="Done today" value={todayScore(tasks)} accent="#6b9fff" />
          <StatCard label="Done this week" value={weekScore(tasks)} accent="#6b9fff" />
          <StatCard label="Avg pleasure" value={pEmoji} accent="#ff8fd0" />
        </div>

        <Section title="Done vs. to-do">
          <div style={{ display: "flex", alignItems: "center", gap: "1.4rem" }}>
            <Donut donePct={donePct} />
            <div style={{ fontSize: "0.82rem", lineHeight: 2 }}>
              <div><span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "3px", background: "#6bffb3", marginRight: "0.5rem" }} />{done.length} completed</div>
              <div><span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "3px", background: "rgba(255,107,107,0.8)", marginRight: "0.5rem" }} />{active.length} still to do</div>
            </div>
          </div>
        </Section>

        <Section title="Completion by category">
          {cats.length === 0 ? <p style={{ color: "#555", fontSize: "0.8rem" }}>No tasks yet.</p> : cats.map(c => {
            const inCat = tasks.filter(t => taskCats(t).includes(c));
            const d = inCat.filter(t => t.done).length;
            const pct = Math.round((d / inCat.length) * 100);
            const acc = CAT_ACCENT(c);
            return (
              <div key={c} style={{ marginBottom: "0.65rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", marginBottom: "0.25rem" }}>
                  <span style={{ color: acc, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600 }}>{c}</span>
                  <span style={{ color: "#777" }}>{d}/{inCat.length} · {pct}%</span>
                </div>
                <div style={{ height: "7px", borderRadius: "20px", background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: acc, borderRadius: "20px", boxShadow: `0 0 8px ${acc}66`, transition: "width 0.5s ease" }} />
                </div>
              </div>
            );
          })}
        </Section>

        <Section title="Completed over time" action={
          <div style={{ display: "flex", gap: "0.3rem" }}>
            {[["week", "This week"], ["month", "This month"]].map(([p, label]) => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                padding: "0.25rem 0.7rem", borderRadius: "20px", cursor: "pointer", fontSize: "0.68rem",
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700,
                border: `1px solid ${period === p ? "rgba(232,255,90,0.6)" : "rgba(255,255,255,0.1)"}`,
                background: period === p ? "rgba(232,255,90,0.14)" : "transparent",
                color: period === p ? "#bef24a" : "#777",
              }}>{label}</button>
            ))}
          </div>
        }>
          <div style={{ ...glass, borderRadius: "14px", padding: "0.9rem 1rem" }}>
            <MiniBars data={series} height={96} />
            <p style={{ fontSize: "0.72rem", color: "#888", marginTop: "0.6rem", textAlign: "center" }}>
              <b style={{ color: "#bef24a" }}>{periodCount}</b> task{periodCount === 1 ? "" : "s"} completed {period === "week" ? "this week" : "this month"} · score {periodCount}
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}
