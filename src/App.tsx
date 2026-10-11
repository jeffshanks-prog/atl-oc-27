import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { useApp, loadCachedSnapshot, ensureDefaultScheme } from '@/state/store';
import { hasAccess, loadAccount, loadPlays, loadUserData } from '@/data/api';
import { startQueueSync, flushQueue } from '@/offline/queue';
import { Layout, Logo } from '@/components/Layout';
import GameCaller from '@/pages/GameCaller';
import Login from '@/pages/Login';
import Subscribe from '@/pages/Subscribe';

const Playbook = lazy(() => import('@/pages/Playbook'));
const ScreenCenter = lazy(() => import('@/pages/ScreenCenter'));
const PlayDetail = lazy(() => import('@/pages/PlayDetail'));
const Favorites = lazy(() => import('@/pages/Favorites'));
const Schemes = lazy(() => import('@/pages/Schemes'));
const SchemeEditor = lazy(() => import('@/pages/SchemeEditor'));
const GamePlans = lazy(() => import('@/pages/GamePlans'));
const GamePlanEditor = lazy(() => import('@/pages/GamePlanEditor'));
const Stats = lazy(() => import('@/pages/Stats'));
const GameDetail = lazy(() => import('@/pages/GameDetail'));
const Admin = lazy(() => import('@/pages/Admin'));
const PlayEditor = lazy(() => import('@/pages/PlayEditor'));
const Account = lazy(() => import('@/pages/Account'));

function Splash({ text = 'Loading playbook…' }: { text?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-ink text-white">
      <div className="flex flex-col items-center gap-3">
        <Logo className="h-14 w-14 animate-pulse" />
        <div className="font-display tracking-widest text-mute">{text}</div>
      </div>
    </div>
  );
}

function SetupNeeded() {
  return (
    <div className="grid min-h-screen place-items-center bg-ink p-6 text-white">
      <div className="max-w-md rounded-3xl border border-line bg-coal p-6">
        <h1 className="font-display text-2xl font-bold">ATL OC 27 — setup needed</h1>
        <p className="mt-2 text-sm text-mute">
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in Netlify → Site settings → Environment variables
          (or a local <code>.env</code> file), then redeploy. See README.md.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [booting, setBooting] = useState(true);
  const profile = useApp((s) => s.profile);
  const subscription = useApp((s) => s.subscription);
  const hydrate = useApp((s) => s.hydrate);
  const reset = useApp((s) => s.reset);
  const syncStarted = useRef(false);

  const refresh = useCallback(async (uid: string) => {
    if (!navigator.onLine) return;
    try {
      const acct = await loadAccount(uid);
      hydrate(uid, acct);
      if (hasAccess(acct.subscription, acct.profile)) {
        await flushQueue(); // push offline results before pulling fresh data
        const [plays, data] = await Promise.all([loadPlays(), loadUserData()]);
        hydrate(uid, { ...data, plays });
        ensureDefaultScheme();
      }
    } catch (e) {
      console.warn('Refresh failed — using cached data', e);
    }
  }, [hydrate]);

  useEffect(() => {
    if (!supabaseConfigured) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (!session) { reset(); setBooting(false); return; }
    const uid = session.user.id;
    let cancelled = false;
    void (async () => {
      setBooting(true);
      const cached = await loadCachedSnapshot(uid);
      if (cached && !cancelled) setBooting(false);
      await refresh(uid);
      if (!cancelled) setBooting(false);
      if (!syncStarted.current) { syncStarted.current = true; startQueueSync(); }
      // Returning from Stripe Checkout: the webhook can take a few seconds.
      if (new URLSearchParams(window.location.search).get('checkout') === 'success') {
        for (let i = 0; i < 6 && !hasAccess(useApp.getState().subscription, useApp.getState().profile); i++) {
          await new Promise((r) => setTimeout(r, 2500));
          await refresh(uid);
        }
        window.history.replaceState({}, '', window.location.pathname);
      }
    })();
    return () => { cancelled = true; };
  }, [session, refresh, reset]);

  if (!supabaseConfigured) return <SetupNeeded />;
  if (session === undefined || (session && booting)) return <Splash />;
  if (!session) return <Login />;
  if (!hasAccess(subscription, profile)) {
    return <Subscribe status={subscription?.status ?? 'none'} onRefresh={() => void refresh(session.user.id)} />;
  }

  return (
    <BrowserRouter>
      <Layout>
        <Suspense fallback={<div className="p-8 text-center text-mute">Loading…</div>}>
          <Routes>
            <Route path="/" element={<GameCaller />} />
            <Route path="/playbook" element={<Playbook />} />
            <Route path="/screens" element={<ScreenCenter />} />
            <Route path="/play/:id" element={<PlayDetail />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/schemes" element={<Schemes />} />
            <Route path="/schemes/new" element={<SchemeEditor />} />
            <Route path="/schemes/:id" element={<SchemeEditor />} />
            <Route path="/game-plan" element={<GamePlans />} />
            <Route path="/game-plan/new" element={<GamePlanEditor />} />
            <Route path="/game-plan/:id" element={<GamePlanEditor />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/games/:id" element={<GameDetail />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/play/new" element={<PlayEditor />} />
            <Route path="/admin/play/:id" element={<PlayEditor />} />
            <Route path="/account" element={<Account />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}
