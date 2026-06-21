import { XpBurst } from "brainqueue";

// XpBurst is an ephemeral pop that animates to opacity 0; freeze it at its visible
// base frame for a static preview by disabling the inline animation.
export const Burst = () => (
  <div style={{ position: "relative", minHeight: "100vh", background: "#09090c" }}>
    <style>{`[style*="bqXpPop"]{animation:none!important}`}</style>
    <XpBurst burst={{ id: 1, amount: 48, label: "Task complete" }} onDone={() => {}} />
  </div>
);
