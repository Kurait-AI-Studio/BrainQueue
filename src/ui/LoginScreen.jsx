// The signed-out entry point: OAuth + email magic-link sign-in, and the splash
// shown while the session is still resolving. Kept separate from the authed app so
// it can load on its own (a logged-out visitor doesn't need the whole product).
import { useState } from "react";
import { glass, glassStrong } from "./tokens";
import { useHover } from "./useHover";
import { MouseGlow } from "./MouseGlow";
import { Captcha } from "./Captcha";
import { getSupabase } from "../lib/client";
import { humanizeError } from "../lib/errors";

// Supabase enforces a captcha token on the OTP endpoint once Attack Protection is on.
// Set these to the Turnstile (or hCaptcha) values you configured in the dashboard.
const CAPTCHA_PROVIDER = import.meta.env.VITE_CAPTCHA_PROVIDER || "turnstile";
const CAPTCHA_SITE_KEY = import.meta.env.VITE_CAPTCHA_SITE_KEY || "";

const OAUTH_PROVIDERS = [
  { id: "google", label: "Continue with Google" },
  { id: "github", label: "Continue with GitHub" },
];

async function signInWithProvider(provider) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase is not configured.");
  const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
  if (error) throw error;
}
async function signInWithEmail(email, captchaToken) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase is not configured.");
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin, captchaToken: captchaToken || undefined },
  });
  if (error) throw error;
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function ProviderButton({ provider, busy, onClick }) {
  const [hov, hovProps] = useHover();
  const isGoogle = provider.id === "google";
  return (
    <button onClick={onClick} disabled={!!busy} {...hovProps}
      style={{
        width: "100%", padding: "0.85rem 1rem", borderRadius: "12px",
        display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem",
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: "0.85rem",
        cursor: busy ? "not-allowed" : "pointer", opacity: busy && busy !== provider.id ? 0.45 : 1,
        transition: "all 0.18s cubic-bezier(0.34,1.56,0.64,1)",
        transform: hov && !busy ? "translateY(-1px)" : "none",
        ...(isGoogle
          ? { background: hov ? "#fff" : "#f3f3f3", color: "#1a1a1a", border: "1px solid #fff" }
          : { ...glass, color: "#e8e8e8", border: `1px solid ${hov ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.12)"}` }),
      }}>
      {isGoogle ? <GoogleMark /> : <span style={{ fontSize: "1rem" }}>{provider.id === "github" ? "" : "→"}</span>}
      {busy === provider.id ? "Redirecting…" : provider.label}
    </button>
  );
}

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(null);   // provider id | "email" | null
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [captchaKey, setCaptchaKey] = useState(0); // bump to remount/reset the widget
  const configured = !!getSupabase();
  const captchaReady = !CAPTCHA_SITE_KEY || !!captchaToken; // no key configured -> no gate

  const oauth = async (id) => {
    setBusy(id); setError(null);
    try { await signInWithProvider(id); }
    catch (e) { setError(humanizeError(e)); setBusy(null); }
    // on success the browser redirects away — no need to clear busy
  };

  const magic = async () => {
    if (!email.trim()) return;
    if (CAPTCHA_SITE_KEY && !captchaToken) { setError("Please complete the captcha first."); return; }
    setBusy("email"); setError(null);
    try { await signInWithEmail(email.trim(), captchaToken); setSent(true); }
    catch (e) {
      setError(humanizeError(e));
      // The token is single-use; reset the widget so the user can retry.
      setCaptchaToken(null); setCaptchaKey(k => k + 1);
    }
    setBusy(null);
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0a0a0d", padding: "1rem", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    }}>
      <MouseGlow />
      <div style={{
        ...glassStrong, borderRadius: "24px", padding: "2.5rem 2rem",
        width: "100%", maxWidth: "380px", position: "relative", zIndex: 1,
      }}>
        <h1 style={{
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 800, fontSize: "1.9rem",
          letterSpacing: "-0.03em", textAlign: "center", marginBottom: "0.25rem",
        }}>
          <span style={{ color: "#e8e8e8" }}>Brain</span>
          <span style={{ color: "#bef24a", textShadow: "0 0 20px rgba(232,255,90,0.4)" }}>Queue</span>
        </h1>
        <p style={{ color: "#444", fontSize: "0.74rem", textAlign: "center", marginBottom: "2rem" }}>
          your tasks, on every device
        </p>

        {!configured ? (
          <p style={{ color: "#ffb347", fontSize: "0.8rem", textAlign: "center", lineHeight: 1.7 }}>
            Supabase isn't configured.<br />Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env</code>.
          </p>
        ) : sent ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📬</div>
            <p style={{ color: "#ccc", fontSize: "0.86rem", lineHeight: 1.7 }}>
              Magic link sent to<br /><strong style={{ color: "#bef24a" }}>{email}</strong>
            </p>
            <p style={{ color: "#444", fontSize: "0.72rem", marginTop: "0.75rem" }}>Open it on this device to sign in.</p>
            <button onClick={() => { setSent(false); setEmail(""); }}
              style={{ background: "none", border: "none", color: "#6b9fff", fontSize: "0.76rem", cursor: "pointer", marginTop: "1rem" }}>
              ← use a different email
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {OAUTH_PROVIDERS.map(p => (
                <ProviderButton key={p.id} provider={p} busy={busy} onClick={() => oauth(p.id)} />
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "1.3rem 0" }}>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
              <span style={{ color: "#333", fontSize: "0.68rem" }}>or email</span>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
            </div>

            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") magic(); }}
              placeholder="you@example.com"
              autoCapitalize="none" autoCorrect="off" spellCheck="false"
              style={{
                ...glass, borderRadius: "10px", padding: "0.85rem 1rem", marginBottom: "0.6rem",
                color: "#e8e8e8", fontSize: "0.9rem", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                outline: "none", width: "100%", boxSizing: "border-box",
              }}
            />
            {CAPTCHA_SITE_KEY && (
              <Captcha
                key={captchaKey}
                provider={CAPTCHA_PROVIDER}
                siteKey={CAPTCHA_SITE_KEY}
                onToken={setCaptchaToken}
                onError={setError}
              />
            )}
            <button
              onClick={magic} disabled={!!busy || !email.trim() || !captchaReady}
              style={{
                width: "100%", padding: "0.85rem",
                background: "rgba(232,255,90,0.1)", border: "1px solid rgba(232,255,90,0.4)",
                borderRadius: "12px", color: "#bef24a",
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: "0.85rem",
                cursor: busy || !email.trim() || !captchaReady ? "not-allowed" : "pointer",
                opacity: busy || !email.trim() || !captchaReady ? 0.5 : 1,
              }}>
              {busy === "email" ? "Sending…" : "Send magic link →"}
            </button>
          </>
        )}

        {error && <p style={{ color: "#ff6b6b", fontSize: "0.78rem", marginTop: "1rem", textAlign: "center" }}>{error}</p>}

        <p style={{ color: "#222", fontSize: "0.64rem", textAlign: "center", marginTop: "1.6rem", lineHeight: 1.6 }}>
          Secured by Supabase Auth · OAuth 2.0
        </p>
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #0a0a0d; overflow-x: hidden; max-width: 100%; }
        input { -webkit-appearance: none; appearance: none; }
      `}</style>
    </div>
  );
}

export function Splash() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0a0a0d", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 800, fontSize: "1.4rem",
    }}>
      <span style={{ color: "#e8e8e8" }}>Brain</span>
      <span style={{ color: "#bef24a", textShadow: "0 0 20px rgba(232,255,90,0.4)" }}>Queue</span>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@800&display=swap'); body{background:#0a0a0d;}`}</style>
    </div>
  );
}
