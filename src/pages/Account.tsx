import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/state/store';
import { supabase } from '@/lib/supabase';
import { openBillingPortal } from '@/data/api';
import { BILLING_ENABLED } from '@/lib/config';
import { flushQueue, onQueueChange, queueSize } from '@/offline/queue';
import { Badge, Button, Card, Field, PageHeader, SectionTitle, inputCls } from '@/components/ui';

export default function Account() {
  const nav = useNavigate();
  const profile = useApp((s) => s.profile);
  const sub = useApp((s) => s.subscription);
  const toast = useApp((s) => s.toast);
  const [pending, setPending] = useState(0);
  const [name, setName] = useState(profile?.displayName ?? '');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { void queueSize().then(setPending); return onQueueChange(setPending); }, []);

  const billing = async () => {
    setBusy(true);
    try { window.location.href = await openBillingPortal(); } catch (e) { toast((e as Error).message, 'warn'); setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Account" />
      <Card className="space-y-3 p-4">
        <SectionTitle>Profile</SectionTitle>
        <Field label="Display name">
          <div className="flex gap-2">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
            <Button onClick={async () => {
              const { error } = await supabase.from('profiles').update({ display_name: name }).eq('id', profile?.id ?? '');
              toast(error ? error.message : 'Saved', error ? 'warn' : 'ok');
            }}>Save</Button>
          </div>
        </Field>
        <Field label="New password">
          <div className="flex gap-2">
            <input type="password" className={inputCls} value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} autoComplete="new-password" />
            <Button disabled={pw.length < 6} onClick={async () => {
              const { error } = await supabase.auth.updateUser({ password: pw });
              toast(error ? error.message : 'Password updated', error ? 'warn' : 'ok'); setPw('');
            }}>Update</Button>
          </div>
        </Field>
      </Card>

      {BILLING_ENABLED && <Card className="space-y-2 p-4">
        <SectionTitle>Subscription</SectionTitle>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {profile?.isAdmin && <Badge tone="red">Admin — full access</Badge>}
          <Badge tone={sub && ['active', 'trialing'].includes(sub.status) ? 'green' : 'amber'}>{sub?.status ?? 'none'}</Badge>
          {sub?.currentPeriodEnd && <span className="text-mute">{sub.cancelAtPeriodEnd ? 'Ends' : 'Renews'} {new Date(sub.currentPeriodEnd).toLocaleDateString()}</span>}
        </div>
        <Button onClick={billing} disabled={busy}>Manage billing</Button>
      </Card>}

      <Card className="space-y-2 p-4">
        <SectionTitle>Offline sync</SectionTitle>
        <p className="text-sm text-mute">{pending ? `${pending} change(s) waiting to sync.` : 'Everything is synced.'}</p>
        <Button size="sm" onClick={async () => { const left = await flushQueue(); toast(left ? `${left} still queued` : 'Synced'); }}>Sync now</Button>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => nav('/admin')}>{profile?.isAdmin ? 'Admin & import' : 'My custom plays'}</Button>
        <Button onClick={() => nav('/screens')}>🔥 Screen Center</Button>
        <Button tone="ghost" onClick={() => supabase.auth.signOut()}>Sign out</Button>
      </div>
      <p className="text-[11px] text-mute">ATL OC 27 is an independent fan tool and is not affiliated with or endorsed by EA, the NFL, or any team. Play names are stored only as references for your own playbook management.</p>
    </div>
  );
}
