import type { Handler } from '@netlify/functions';
import { getOrCreateCustomer, json, siteUrl, stripe, userFromAuthHeader } from '../lib/shared';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const user = await userFromAuthHeader(event.headers.authorization);
    if (!user) return json(401, { error: 'Please sign in again.' });
    const { plan } = JSON.parse(event.body || '{}') as { plan?: 'monthly' | 'yearly' };
    const price = plan === 'yearly' ? process.env.STRIPE_PRICE_YEARLY : process.env.STRIPE_PRICE_MONTHLY;
    if (!price) return json(500, { error: 'Pricing is not configured yet.' });

    const customer = await getOrCreateCustomer(user.id, user.email);
    const trialDays = Number(process.env.STRIPE_TRIAL_DAYS ?? 0);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: user.id,
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { user_id: user.id },
        ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
      },
      success_url: `${siteUrl()}/?checkout=success`,
      cancel_url: `${siteUrl()}/?checkout=cancelled`,
    });
    return json(200, { url: session.url });
  } catch (e) {
    console.error(e);
    return json(500, { error: (e as Error).message });
  }
};
