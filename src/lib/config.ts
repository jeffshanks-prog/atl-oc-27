// Build-time switches (set in Netlify → Environment variables, then redeploy).
// Subscriptions are OFF until VITE_BILLING_ENABLED = "true". Keep this in sync with
// public.app_settings.billing_enabled in Supabase (the database enforces it either way).
export const BILLING_ENABLED = import.meta.env.VITE_BILLING_ENABLED === 'true';
