import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/Layout';
import { Button, Field, inputCls } from '@/components/ui';

export default function Login() {
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'up') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name }, emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (!data.session) setMsg('Check your email to confirm your account, then sign in.');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/account` });
        if (error) throw error;
        setMsg('Password reset email sent.');
      }
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-ink p-4 text-white"
      style={{ background: 'radial-gradient(1200px 500px at 50% -10%, rgba(225,29,46,0.25), transparent), #0b0b0c' }}>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo className="h-16 w-16" />
          <h1 className="mt-3 font-display text-4xl font-bold tracking-wider">ATL OC 27</h1>
          <p className="mt-1 text-sm text-mute">Your digital offensive coordinator</p>
        </div>
        <form onSubmit={submit} className="space-y-3 rounded-3xl border border-line bg-coal p-5">
          {mode === 'up' && <Field label="Name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>}
          <Field label="Email"><input type="email" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
          {mode !== 'reset' && (
            <Field label="Password"><input type="password" required minLength={6} className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></Field>
          )}
          {msg && <p className="text-sm text-amber-300">{msg}</p>}
          <Button tone="red" size="lg" className="w-full" disabled={busy}>
            {busy ? '…' : mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : 'Send reset link'}
          </Button>
          <div className="flex justify-between text-sm">
            <button type="button" className="text-mute hover:text-white" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
              {mode === 'in' ? 'Create an account' : 'I have an account'}
            </button>
            {mode === 'in' && <button type="button" className="text-mute hover:text-white" onClick={() => setMode('reset')}>Forgot password?</button>}
          </div>
        </form>
        <p className="mt-4 text-center text-[11px] text-mute">Independent fan tool. Not affiliated with or endorsed by EA, the NFL, or any team.</p>
      </div>
    </div>
  );
}
