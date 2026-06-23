// A narrative, kindly-toned recap that reads the week's behaviour back to the user.
// Stats are computed exactly (src/lib/weeklyReview.js); the phrasing varies week to
// week so it reads like a thoughtful note rather than a fixed template. The opening
// fires a weekly_review_viewed event via the onView callback.
import { useMemo, useEffect } from "react";
import { glass, glassStrong } from "./tokens";
import { buildReview } from "../lib/weeklyReview";
import { CAT_ACCENT } from "../lib/tasks";

function WeeklyStat({ label, value, sub, accent }) {
  return (
    <div style={{ ...glass, borderRadius: "14px", padding: "0.85rem 0.9rem", flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: "1.45rem", fontWeight: 800, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: accent, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: "0.66rem", color: "#8a8a96", marginTop: "0.3rem", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      {sub && <div style={{ fontSize: "0.62rem", color: "#5a5a66", marginTop: "0.15rem" }}>{sub}</div>}
    </div>
  );
}

export function WeeklyReviewModal({ tasks, weights, tone, onClose, onView }) {
  const review = useMemo(() => buildReview(tasks, weights, tone), [tasks, weights, tone]);
  // Fire the telemetry event once, when the review is opened.
  useEffect(() => { onView?.(review); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { stats, perCategory, range, insights, closing, hasData } = review;
  const maxCat = perCategory.reduce((m, c) => Math.max(m, c.count), 0) || 1;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(8px)" }}>
      <div style={{ ...glassStrong, borderRadius: "20px", width: "100%", maxWidth: "560px", maxHeight: "90vh", overflow: "auto", padding: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.4rem" }}>
          <div>
            <div style={{ fontSize: "0.66rem", color: "#bef24a", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "0.25rem" }}>Weekly review</div>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: "1.3rem", color: "#fff", margin: 0 }}>Your week in review</h2>
            <div style={{ fontSize: "0.72rem", color: "#6b6b76", marginTop: "0.2rem" }}>{range.label}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", fontSize: "1.4rem", cursor: "pointer" }}>×</button>
        </div>

        {hasData && (
          <div style={{ display: "flex", gap: "0.6rem", marginBottom: "1.4rem" }}>
            <WeeklyStat label="Completed" value={stats.completed} accent="#6bffb3"
              sub={stats.delta === 0 ? "same as last week" : `${stats.delta > 0 ? "+" : ""}${stats.delta} vs last week`} />
            {stats.captureRate != null && <WeeklyStat label="Of this week's adds" value={`${stats.captureRate}%`} accent="#bef24a" sub="already done" />}
            {stats.focusMinutes >= 1 && <WeeklyStat label="Focused effort" value={stats.focusLabel} accent="#6b9fff" sub={`${stats.openNow} still open`} />}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem", marginBottom: hasData ? "1.4rem" : 0 }}>
          {insights.map((line, i) => (
            <p key={i} style={{ color: i === 0 && hasData ? "#e6e6ea" : "#a7a7b2", fontSize: i === 0 && hasData ? "0.95rem" : "0.85rem", lineHeight: 1.7, margin: 0, fontWeight: i === 0 && hasData ? 600 : 400 }}>{line}</p>
          ))}
        </div>

        {hasData && perCategory.length > 0 && (
          <div style={{ marginBottom: "1.3rem" }}>
            <div style={{ fontSize: "0.66rem", color: "#6b6b76", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.6rem" }}>By category</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
              {perCategory.map(({ cat, count }) => {
                const acc = CAT_ACCENT(cat);
                return (
                  <div key={cat} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span style={{ fontSize: "0.72rem", color: "#bcbcc6", width: "84px", flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat}</span>
                    <div style={{ flex: 1, height: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ width: `${(count / maxCat) * 100}%`, height: "100%", background: acc, boxShadow: `0 0 8px ${acc}88`, borderRadius: "4px", transition: "width 0.4s" }} />
                    </div>
                    <span style={{ fontSize: "0.7rem", color: acc, fontWeight: 700, width: "20px", textAlign: "right" }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {hasData && stats.biggestWin && (
          <div style={{ ...glass, borderRadius: "12px", padding: "0.75rem 0.9rem", marginBottom: "1.3rem", borderLeft: "2px solid #bef24a66" }}>
            <div style={{ fontSize: "0.62rem", color: "#6b6b76", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", textTransform: "uppercase", letterSpacing: "0.08em" }}>🏆 Biggest win</div>
            <div style={{ fontSize: "0.86rem", color: "#ddd", marginTop: "0.25rem" }}>{stats.biggestWin.title}</div>
          </div>
        )}

        {closing && <p style={{ color: "#7a7a86", fontSize: "0.8rem", lineHeight: 1.7, fontStyle: "italic", margin: 0 }}>{closing}</p>}
      </div>
    </div>
  );
}
