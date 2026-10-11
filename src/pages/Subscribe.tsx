import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { startCheckout } from '@/data/api';
import { Logo } from '@/components/Layout';
import { Button } from '@/components/ui';

const FEATURES = [
  '🧠 Situational play caller with transparent match scores',
  '🔥 Screen Center + live Screen Alerts vs pressure',
  '❤️ Favorites with roles that boost your go-to calls',
  '🧩 Unlimited custom schemes from the master Atlanta playbook',
  '📋 Game plans, opening scripts and situational packages',
  '📊 Opponent tendencies and stats from your own results',
  '📱 Works on phone, tablet and desktop — even offline',
];

export default function Subscribe({ onRefresh, status }: { onRefresh: () => void; status: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const go = async (plan: 'monthly' | 'yearly') => {
    setBusy(plan); setErr(null);
    try { window.location.href = await startCheckout(plan); }
    catch (e) { setErr((e as Error).message); setBusy(null); }
  };
  return (
    <div className="grid min-h-screen place-items-center bg-ink p-4 text-white">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center gap-3">
          <Logo className="h-12 w-12" />
          <div>
            <h1 className="font-display text-3xl font-bold tracking-wider">ATL OC 27</h1>
            <p className="text-sm text-mute">Subscribe to unlock your offensive coordinator</p>
          </div>
        </div>
        <ul className="mb-5 space-y-2 rounded-3xl border border-line bg-coal p-5 text-sm">
          {FEATURES.map((f) => <li key={f}>{f}</li>)}
        </ul>
        {status !== 'none' && <p className="mb-3 rounded-xl bg-amber-950 p-3 text-sm text-amber-200">Subscription status: <b>{status}</b>. Renew below or manage billing from your account.</p>}
        <div className="grid gap-2">
          <Button tone="red" size="lg" onClick={() => go('monthly')} disabled={Boolean(busy)}>{busy === 'monthly' ? 'Opening checkout…' : 'Subscribe monthly'}</Button>
          <Button size="lg" onClick={() => go('yearly')} disabled={Boolean(busy)}>{busy === 'yearly' ? 'Opening checkout…' : 'Subscribe yearly'}</Button>
        </div>
        {err && <p className="mt-3 text-sm text-red">{err}</p>}
        <div className="mt-4 flex justify-between text-sm">
          <button className="text-mute hover:text-white" onClick={onRefresh}>Already paid? Refresh</button>
          <button className="text-mute hover:text-white" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </div>
    </div>
  );
}
