import { supabase } from '@/lib/supabase-client';
import type { ModuleReportData } from './types';
import type { PeriodRange } from './periods';
import { kpi } from './aggregate-helpers';

interface AuditRow { action: string; table_name: string }

/**
 * audit_log is admin-only via RLS (public.is_admin()) — a `finance`-role
 * viewer will simply see zero rows here (RLS filters silently, no error),
 * which is the correct behaviour for an audit trail.
 */
export async function fetchSystemModuleData(range: PeriodRange): Promise<ModuleReportData> {
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();

  const [auditRes, staffRes, marketingUsersRes] = await Promise.all([
    supabase.from('audit_log').select('action, table_name').gte('created_at', fromIso).lte('created_at', toIso),
    supabase.from('staff_users').select('role, is_active'),
    supabase.from('marketing_users').select('is_active'),
  ]);

  const auditEntries = (auditRes.data ?? []) as AuditRow[];
  const staff = staffRes.data ?? [];
  const marketingUsers = marketingUsersRes.data ?? [];

  const byAction = new Map<string, number>();
  const byTable = new Map<string, number>();
  auditEntries.forEach((e) => {
    byAction.set(e.action, (byAction.get(e.action) || 0) + 1);
    byTable.set(e.table_name, (byTable.get(e.table_name) || 0) + 1);
  });

  return {
    moduleId: 'audit-system',
    moduleLabel: 'Audit & System',
    kpis: [
      kpi('Audit Log Entries', auditEntries.length, 'number'),
      kpi('Active Staff Users', staff.filter((s) => s.is_active).length, 'number'),
      kpi('Admin Staff', staff.filter((s) => s.role === 'admin').length, 'number'),
      kpi('Active Marketing Users', marketingUsers.filter((m) => m.is_active).length, 'number'),
    ],
    tables: [
      { title: 'Audit Entries by Action', columns: ['Action', 'Count'], rows: Array.from(byAction.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15) },
      { title: 'Audit Entries by Table', columns: ['Table', 'Count'], rows: Array.from(byTable.entries()).sort((a, b) => b[1] - a[1]) },
    ],
    charts: [{ title: 'Audit Entries by Table', type: 'pie', data: Array.from(byTable.entries()).map(([name, value]) => ({ name, value })) }],
  };
}
