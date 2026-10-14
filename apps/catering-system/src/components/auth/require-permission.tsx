'use client';

import type { ReactNode } from 'react';
import { useStaffRole } from '@/hooks/use-staff-role';
import type { Permission } from '@/lib/permissions';

interface RequirePermissionProps {
  permission: Permission;
  children: ReactNode;
  /** Shown instead of children when the permission is missing. Default: nothing. */
  fallback?: ReactNode;
}

/**
 * Hides UI the current role may not use (Edit, Delete, Approve, ...). Renders
 * nothing while the role is still loading, so a button never flashes up and
 * disappears. UI gating only — RLS is the real enforcement.
 */
export function RequirePermission({ permission, children, fallback = null }: RequirePermissionProps) {
  const { can, isLoading } = useStaffRole();
  if (isLoading) return null;
  return <>{can(permission) ? children : fallback}</>;
}
