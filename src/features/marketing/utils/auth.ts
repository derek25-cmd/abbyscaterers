import { getRouteClient } from '../api/route-client';
import type { MarketingUserRole } from '../types';

export interface MarketingSession {
  marketerId: string;
  role: MarketingUserRole;
  email: string;
}

/** Resolves the calling user's marketing role from their bearer token. Call at the start of any Route Handler that needs role-based filtering. Returns null if unauthenticated or not registered as a marketing user. */
export async function getMarketingSession(request: Request): Promise<MarketingSession | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  const client = getRouteClient(authHeader);
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user?.email) return null;

  const { data: marketingUser, error } = await client
    .from('marketing_users')
    .select('id, role, email, is_active')
    .eq('email', authData.user.email)
    .maybeSingle();

  if (error || !marketingUser || !marketingUser.is_active) return null;

  return { marketerId: marketingUser.id, role: marketingUser.role, email: marketingUser.email };
}

export function isManager(role: MarketingUserRole): boolean {
  return role === 'MARKETING_MANAGER' || role === 'ADMIN';
}
