import type { Handler } from '@netlify/functions';
import { getOrCreateCustomer, json, siteUrl, stripe, userFromAuthHeader } from '../lib/shared';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const user = await userFromAuthHeader(event.headers.authorization);
    if (!user) return json(401, { error: 'Please sign in again.' });
    const customer = await getOrCreateCustomer(user.id, user.email);
    const portal = await stripe.billingPortal.sessions.create({ customer, return_url: `${siteUrl()}/account` });
    return json(200, { url: portal.url });
  } catch (e) {
    console.error(e);
    return json(500, { error: (e as Error).message });
  }
};
