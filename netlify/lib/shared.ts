import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2024-06-20' });

export const admin = createClient(
  process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } },
);

export const siteUrl = () => (process.env.SITE_URL ?? process.env.URL ?? 'http://localhost:8888').replace(/\/$/, '');

export function json(status: number, body: unknown) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

/** Verifies the caller's Supabase session token and returns the user. */
export async function userFromAuthHeader(header: string | undefined) {
  const token = (header ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function getOrCreateCustomer(userId: string, email: string | undefined): Promise<string> {
  const { data } = await admin.from('subscriptions').select('stripe_customer_id').eq('user_id', userId).maybeSingle();
  if (data?.stripe_customer_id) return data.stripe_customer_id;
  const customer = await stripe.customers.create({ email, metadata: { user_id: userId } });
  await admin.from('subscriptions').upsert({ user_id: userId, stripe_customer_id: customer.id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  return customer.id;
}
