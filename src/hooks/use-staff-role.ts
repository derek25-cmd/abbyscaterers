'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase-client';
import { useAuth } from '@/hooks/useAuth';

export type StaffRole = 'admin' | 'finance' | 'staff';

interface StaffRoleState {
  role: StaffRole | null;
  isAdmin: boolean;
  isActiveStaff: boolean;
  isLoading: boolean;
}

/**
 * Reads the current user's row from staff_users (see
 * supabase/migrations/20260714000000_add_roles.sql) for client-side role
 * gating. Nothing client-side read this table before — it was RLS-only.
 * This is UI gating only, not a security boundary by itself: the real
 * enforcement is the RLS policies (is_admin()/is_active_staff()) on each
 * table, which apply regardless of what this hook returns.
 */
export function useStaffRole(): StaffRoleState {
  const { user } = useAuth();
  const [state, setState] = useState<StaffRoleState>({
    role: null,
    isAdmin: false,
    isActiveStaff: false,
    isLoading: true,
  });

  useEffect(() => {
    let active = true;

    if (!user) {
      setState({ role: null, isAdmin: false, isActiveStaff: false, isLoading: false });
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
          setState({ role: null, isAdmin: false, isActiveStaff: false, isLoading: false });
          return;
        }
        setState({
          role: data.role as StaffRole,
          isAdmin: data.role === 'admin',
          isActiveStaff: true,
          isLoading: false,
        });
      });

    return () => {
      active = false;
    };
  }, [user]);

  return state;
}
