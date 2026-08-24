'use client';

import { usePortalRole } from '@/lib/portal-role';

/**
 * UI gating only, same documented convention as usePortalRole itself —
 * the real enforcement is RLS (payroll/attendance: has_portal_role(['super_admin','finance']),
 * supabase/migrations/20260901190000_hr_reports_access.sql; employees:
 * the get_employee_directory_for_portal() RPC checks the same role itself).
 */
export function ReportAccessGate({ children }: { children: React.ReactNode }) {
  const { role, loading } = usePortalRole();
  const allowed = role === 'super_admin' || role === 'finance';

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!allowed) {
    return (
      <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
        You don&apos;t have access to this report. It&apos;s restricted to Super Admin and Finance roles.
      </div>
    );
  }
  return <>{children}</>;
}
