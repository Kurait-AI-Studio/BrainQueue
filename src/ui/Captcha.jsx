// Provider-agnostic CAPTCHA widget for the magic-link flow. Supabase enforces a
// captcha token on the OTP/sign-in endpoints once Attack Protection is on, so the
// email login must present a challenge and pass its token to signInWithOtp.
//
// Supports Cloudflare Turnstile (default, free) and hCaptcha, chosen by env:
//   VITE_CAPTCHA_PROVIDER = "turnstile" | "hcaptcha"   (default "turnstile")
//   VITE_CAPTCHA_SITE_KEY = <public site key from the provider>
// With no site key it renders nothing and emits no token (local/dev without captcha);
// in production, set both to match whatever you enabled in the Supabase dashboard.
import { useEffect, useRef } from "react";

const PROVIDERS = {
  turnstile: { src: "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit", api: () => window.turnstile },
  hcaptcha: { src: "https://js.hcaptcha.com/1/api.js?render=explicit", api: () => window.hcaptcha },
};

const _loading = {}; // provider -> Promise (load each provider script once)
function loadScript(provider) {
  const cfg = PROVIDERS[provider];
  if (cfg.api()) return Promise.resolve();
  if (_loading[provider]) return _loading[provider];
  _loading[provider] = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = cfg.src; s.async = true; s.defer = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Captcha failed to load"));
    document.head.appendChild(s);
  });
  return _loading[provider];
}

export function Captcha({ provider = "turnstile", siteKey, onToken, onError }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!siteKey || !PROVIDERS[provider]) return;
    let cancelled = false;
    loadScript(provider)
      .then(() => {
        const tryRender = () => {
          if (cancelled) return;
          const api = PROVIDERS[provider].api();
          if (!api || !ref.current) return setTimeout(tryRender, 50);
          api.render(ref.current, {
            sitekey: siteKey,
            theme: "dark",
            callback: (t) => onToken?.(t),
            "expired-callback": () => onToken?.(null),
            "error-callback": () => { onToken?.(null); onError?.("Captcha error, please retry."); },
          });
        };
        tryRender();
      })
      .catch((e) => onError?.(e.message));
    return () => { cancelled = true; };
    // Remount (via a changing `key`) to reset after a consumed/expired token.
  }, [provider, siteKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!siteKey) return null;
  return <div ref={ref} style={{ display: "flex", justifyContent: "center", marginBottom: "0.6rem", minHeight: "65px" }} />;
}
