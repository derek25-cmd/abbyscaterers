/**
 * Re-exported from the shared, non-marketing-specific location — every
 * Route Handler across the app (marketing and business reports alike) needs
 * the same per-request, bearer-token-forwarding client. Kept here too so
 * existing marketing imports don't need to change.
 */
export { getRouteClient } from '@/lib/supabase-route-client';
