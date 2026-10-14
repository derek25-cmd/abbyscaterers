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
    // SECURITY DEFINER RPC stamps actor_id from the session itself, so a
    // caller can't log on someone else's behalf (direct INSERT on audit_log
    // was removed in 20261014000300).
    const { error } = await supabase.rpc('log_audit_event', {
      p_action: action,
      p_table: tableName,
      p_record_id: recordId,
      p_metadata: metadata ?? null,
    });
    if (error) console.error('[audit-log] failed to record event:', error.message);
  } catch (err) {
    console.error('[audit-log] unexpected error recording event:', err);
  }
}
