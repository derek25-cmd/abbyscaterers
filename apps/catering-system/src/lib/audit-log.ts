import { supabase } from '@/lib/supabase-client';

/**
 * Records a sensitive action to audit_log. Never throws — a logging
 * failure must not block the real operation it's describing, same "log but
 * don't block" convention already used for commission sync / proforma
 * status side effects elsewhere in the service layer.
 */
export async function logAuditEvent(
  action: string,
  tableName: string,
  recordId: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // no session to attribute this to — nothing to log

    const { error } = await supabase.from('audit_log').insert([{
      actor_id: user.id,
      action,
      table_name: tableName,
      record_id: recordId,
      metadata: metadata ?? null,
    }]);
    if (error) console.error('[audit-log] failed to record event:', error.message);
  } catch (err) {
    console.error('[audit-log] unexpected error recording event:', err);
  }
}
