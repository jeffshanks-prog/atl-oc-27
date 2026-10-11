// Database access: loading. Writes go through the store -> offline queue.
import { supabase } from '@/lib/supabase';
import { BILLING_ENABLED } from '@/lib/config';
import type { Game, GamePlan, Play, PlayCall, Profile, Scheme, Subscription } from '@/lib/types';
import { rowToCall, rowToGame, rowToGamePlan, rowToPlay, rowToScheme } from './mappers';

export const PLAY_SELECT =
  '*, formation:formations(id,family,name), playbook:playbooks(id,name), play_tags(tag:tags(name))';

async function pageAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await fetchPage(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return out;
}

export interface Snapshot {
  profile: Profile | null;
  subscription: Subscription | null;
  plays: Play[];
  favorites: Record<string, string[]>;
  schemes: Scheme[];
  gamePlans: GamePlan[];
  games: Game[];
  calls: PlayCall[];
}

export async function loadAccount(userId: string): Promise<Pick<Snapshot, 'profile' | 'subscription'>> {
  const [p, s] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('subscriptions').select('*').eq('user_id', userId).maybeSingle(),
  ]);
  return {
    profile: p.data ? { id: p.data.id, displayName: p.data.display_name, isAdmin: Boolean(p.data.is_admin) } : null,
    subscription: s.data
      ? { status: s.data.status, currentPeriodEnd: s.data.current_period_end, cancelAtPeriodEnd: Boolean(s.data.cancel_at_period_end), priceId: s.data.price_id }
      : { status: 'none', currentPeriodEnd: null, cancelAtPeriodEnd: false, priceId: null },
  };
}

export async function loadPlays(): Promise<Play[]> {
  const rows = await pageAll((from, to) => supabase.from('plays').select(PLAY_SELECT).order('play_name').range(from, to));
  return rows.map(rowToPlay);
}

export async function loadUserData(): Promise<Omit<Snapshot, 'profile' | 'subscription' | 'plays'>> {
  const [fav, roles, schemes, plans, games, calls] = await Promise.all([
    supabase.from('favorites').select('play_id'),
    supabase.from('favorite_roles').select('play_id, role'),
    supabase.from('schemes').select('*, scheme_plays(play_id)').order('created_at'),
    supabase.from('game_plans').select('*, game_plan_plays(*)').order('created_at', { ascending: false }),
    supabase.from('games').select('*').order('started_at', { ascending: false }),
    pageAll((from, to) => supabase.from('play_calls').select('*, play_results(*)').order('created_at').range(from, to)),
  ]);
  for (const r of [fav, roles, schemes, plans, games]) if (r.error) throw new Error(r.error.message);
  const favorites: Record<string, string[]> = {};
  for (const f of fav.data ?? []) favorites[f.play_id] = [];
  for (const r of roles.data ?? []) (favorites[r.play_id] ??= []).push(r.role);
  return {
    favorites,
    schemes: (schemes.data ?? []).map(rowToScheme),
    gamePlans: (plans.data ?? []).map(rowToGamePlan),
    games: (games.data ?? []).map(rowToGame),
    calls: calls.map(rowToCall),
  };
}

export function hasAccess(sub: Subscription | null, profile: Profile | null): boolean {
  if (!BILLING_ENABLED) return true; // subscriptions turned off — everyone signed in gets the full app
  if (profile?.isAdmin) return true;
  return Boolean(sub && ['active', 'trialing', 'past_due'].includes(sub.status));
}

// ---- Billing (Netlify Functions) ----
async function callFn(name: string, body: Record<string, unknown>): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`/.netlify/functions/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !json.url) throw new Error(json.error ?? `Billing request failed (${res.status})`);
  return json.url;
}
export const startCheckout = (plan: 'monthly' | 'yearly') => callFn('create-checkout', { plan });
export const openBillingPortal = () => callFn('customer-portal', {});
