'use client';

import { usePortalRole } from '@/lib/portal-role';

/**
 * UI gating only — the real enforcement is RLS (portal_audit_log:
 * is_portal_admin(); portal_users: portal_users_admin_all, both requiring
 * role = 'super_admin').
 */
export function SuperAdminGate({ children }: { children: React.ReactNode }) {
  const { role, loading } = usePortalRole();

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (role !== 'super_admin') {
    return (
      <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
        This page is restricted to Super Admin.
      </div>
    );
  }
  return <>{children}</>;
}
