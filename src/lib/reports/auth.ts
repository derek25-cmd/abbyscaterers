import { getRouteClient } from '@/lib/supabase-route-client';

export type ReportRole = 'admin' | 'finance';

export interface ReportSession {
  userId: string;
  email: string;
  role: ReportRole;
}

/**
 * Business-wide periodic reports span every department (finance, HR,
 * marketing) and are gated to admin/finance staff only — modeled on
 * src/features/marketing/utils/auth.ts's getMarketingSession, but checking
 * staff_users (the core-app role table) instead of marketing_users.
 */
export async function getReportSession(request: Request): Promise<ReportSession | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  const client = getRouteClient(authHeader);
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return null;

  const { data: staffUser, error } = await client
    .from('staff_users')
    .select('role, is_active, email')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (error || !staffUser || !staffUser.is_active) return null;
  if (staffUser.role !== 'admin' && staffUser.role !== 'finance') return null;

  return { userId: authData.user.id, email: staffUser.email, role: staffUser.role };
}
