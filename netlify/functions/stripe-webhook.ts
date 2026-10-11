// Stripe → Supabase subscription sync. Point a Stripe webhook at /.netlify/functions/stripe-webhook
// with events: checkout.session.completed, customer.subscription.created/updated/deleted
import type { Handler } from '@netlify/functions';
import type Stripe from 'stripe';
import { admin, json, stripe } from '../lib/shared';

async function userIdFor(sub: Stripe.Subscription): Promise<string | null> {
  if (sub.metadata?.user_id) return sub.metadata.user_id;
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const { data } = await admin.from('subscriptions').select('user_id').eq('stripe_customer_id', customerId).maybeSingle();
  if (data?.user_id) return data.user_id;
  const customer = await stripe.customers.retrieve(customerId);
  return 'metadata' in customer ? (customer.metadata?.user_id ?? null) : null;
}

function periodEnd(sub: Stripe.Subscription): string | null {
  // Newer Stripe API versions moved current_period_end onto subscription items.
  const raw = (sub as unknown as { current_period_end?: number }).current_period_end
    ?? (sub.items?.data[0] as unknown as { current_period_end?: number } | undefined)?.current_period_end;
  return typeof raw === 'number' ? new Date(raw * 1000).toISOString() : null;
}

async function sync(sub: Stripe.Subscription) {
  const userId = await userIdFor(sub);
  if (!userId) { console.warn('No user for subscription', sub.id); return; }
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const { error } = await admin.from('subscriptions').upsert({
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    status: sub.status,
    price_id: sub.items.data[0]?.price.id ?? null,
    current_period_end: periodEnd(sub),
    cancel_at_period_end: sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
}

export const handler: Handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  if (!sig) return json(400, { error: 'Missing signature' });
  const raw = event.isBase64Encoded ? Buffer.from(event.body ?? '', 'base64').toString('utf8') : (event.body ?? '');
  let evt: Stripe.Event;
  try {
    evt = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET ?? '');
  } catch (e) {
    return json(400, { error: `Signature check failed: ${(e as Error).message}` });
  }
  try {
    switch (evt.type) {
      case 'checkout.session.completed': {
        const s = evt.data.object as Stripe.Checkout.Session;
        if (s.subscription) {
          const sub = await stripe.subscriptions.retrieve(typeof s.subscription === 'string' ? s.subscription : s.subscription.id);
          if (!sub.metadata?.user_id && s.client_reference_id) sub.metadata = { ...sub.metadata, user_id: s.client_reference_id };
          await sync(sub);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        // Re-fetch with this function's pinned API version so the shape is always the same,
        // no matter which API version the webhook destination was created with.
        const obj = evt.data.object as Stripe.Subscription;
        await sync(await stripe.subscriptions.retrieve(obj.id));
        break;
      }
      default:
        break;
    }
    return json(200, { received: true });
  } catch (e) {
    console.error(e);
    return json(500, { error: (e as Error).message });
  }
};
