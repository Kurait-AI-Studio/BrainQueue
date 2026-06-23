import { useState, useEffect, lazy, Suspense } from "react";
import { getSupabase } from "./lib/client";
import { LoginScreen, Splash } from "./ui/LoginScreen";

// The authed app is the bulk of the bundle (task UI, focus mode, brain dump, charts,
// Supabase sync). Lazy-load it so a signed-out visitor downloads only React + the login
// screen — the whole product arrives once they're actually signed in.
const MainApp = lazy(() => import("./MainApp").then(m => ({ default: m.MainApp })));

export default function App() {
  // undefined = still loading the session; null = no Supabase / signed out.
  const [session, setSession] = useState(() => (getSupabase() ? undefined : null));

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let active = true;
    sb.auth.getSession().then(({ data }) => { if (active) setSession(data.session); });
    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  if (session === undefined) return <Splash />;
  if (!session) return <LoginScreen />;
  // key on user id so switching accounts fully remounts with fresh per-user state
  return (
    <Suspense fallback={<Splash />}>
      <MainApp key={session.user.id} session={session} />
    </Suspense>
  );
}
