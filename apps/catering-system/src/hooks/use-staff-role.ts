'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase-client';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission, isStaffRole, type Permission, type StaffRole } from '@/lib/permissions';

export type { StaffRole };

interface StaffRoleState {
  role: StaffRole | null;
  isAdmin: boolean;
  isActiveStaff: boolean;
  isLoading: boolean;
  canManageHr: boolean;
  canManageOps: boolean;
  canManageSettings: boolean;
  can: (permission: Permission) => boolean;
}

function derive(role: StaffRole | null) {
  return {
    canManageHr: hasPermission(role, 'hr.manage'),
    canManageOps: hasPermission(role, 'ops.manage'),
    canManageSettings: hasPermission(role, 'settings.manage'),
    can: (permission: Permission) => hasPermission(role, permission),
  };
}

/**
 * Reads the current user's row from staff_users (see
 * supabase/migrations/20260714000000_add_roles.sql) for client-side role
 * gating. Nothing client-side read this table before — it was RLS-only.
 * This is UI gating only, not a security boundary by itself: the real
 * enforcement is the RLS policies (can_manage_hr() and friends) on each
 * table, which apply regardless of what this hook returns. The role →
 * permission map lives in src/lib/permissions.ts.
 */
export function useStaffRole(): StaffRoleState {
  const { user } = useAuth();
  const [state, setState] = useState<StaffRoleState>({
    role: null,
    isAdmin: false,
    isActiveStaff: false,
    isLoading: true,
    ...derive(null),
  });

  useEffect(() => {
    let active = true;

    if (!user) {
      setState({ role: null, isAdmin: false, isActiveStaff: false, isLoading: false, ...derive(null) });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true }));

    supabase
      .from('staff_users')
      .select('role, is_active')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data || !data.is_active) {
          setState({ role: null, isAdmin: false, isActiveStaff: false, isLoading: false, ...derive(null) });
          return;
        }
        const role = isStaffRole(data.role) ? data.role : null;
        setState({
          role,
          isAdmin: role === 'admin',
          isActiveStaff: role !== null,
          isLoading: false,
          ...derive(role),
        });
      });

    return () => {
      active = false;
    };
  }, [user]);

  return state;
}
