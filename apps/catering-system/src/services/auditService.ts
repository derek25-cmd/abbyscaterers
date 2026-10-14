import { supabase } from '@/lib/supabase-client';

export const HR_AUDIT_TABLES = [
  'employees', 'attendance', 'positions', 'training_participants', 'training_evaluations', 'payroll',
  // Leave management (Phase 2)
  'leave_requests', 'leave_balances', 'leave_types', 'leave_settings', 'public_holidays',
] as const;
export const OPS_AUDIT_TABLES = ['products', 'stock_logs', 'assets', 'issuance'] as const;

export type AuditModule = 'all' | 'hr' | 'ops';

export interface AuditEntry {
  id: string;
  actor_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  metadata: { old?: unknown; new?: unknown; changed_fields?: string[] } | null;
  created_at: string;
}

export interface AuditFilters {
  module: AuditModule;
  table: string;      // '' = any
  actorId: string;    // '' = anyone
  from: string;       // yyyy-mm-dd, '' = open
  to: string;         // yyyy-mm-dd, '' = open
}

export const AUDIT_PAGE_SIZE = 100;

/**
 * Reads audit_log. What a caller can see is decided by RLS, not here: hr_manager
 * gets HR tables only, admin and general_manager get everything. The filters
 * only narrow what RLS already allows.
 */
export const getAuditEntries = async (filters: AuditFilters, page = 0): Promise<AuditEntry[]> => {
  let query = supabase
    .from('audit_log')
    .select('id, actor_id, action, table_name, record_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .range(page * AUDIT_PAGE_SIZE, (page + 1) * AUDIT_PAGE_SIZE - 1);

  if (filters.table) query = query.eq('table_name', filters.table);
  else if (filters.module === 'hr') query = query.in('table_name', [...HR_AUDIT_TABLES]);
  else if (filters.module === 'ops') query = query.in('table_name', [...OPS_AUDIT_TABLES]);

  if (filters.actorId) query = query.eq('actor_id', filters.actorId);
  if (filters.from) query = query.gte('created_at', `${filters.from}T00:00:00+03:00`); // Dar es Salaam day
  if (filters.to) query = query.lte('created_at', `${filters.to}T23:59:59.999+03:00`);

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching audit entries:', error);
    throw new Error(error.message);
  }
  return (data ?? []) as AuditEntry[];
};

/** id -> email for the user filter and the "who" column. */
export const getAuditActors = async (): Promise<{ id: string; email: string }[]> => {
  const { data, error } = await supabase.from('staff_users').select('id, email').order('email');
  if (error) {
    console.error('Error fetching audit actors:', error);
    return [];
  }
  return data ?? [];
};
