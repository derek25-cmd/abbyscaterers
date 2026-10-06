'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import type { PortalRole } from '@abbyscaterers/types';
import { useSupabaseClient } from './supabase-client';

export interface PortalRoleState {
  role: PortalRole | null;
  isActive: boolean;
  loading: boolean;
  error?: string | null;
}

/**
 * UI gating only, not a security boundary by itself — mirrors
 * apps/catering-system/src/hooks/use-staff-role.ts's own documented
 * convention. The real enforcement is the portal_users RLS policies
 * (is_active_portal_user()/is_portal_admin()/has_portal_role() in
 * supabase/migrations/20260901000000_add_portal_users_and_rfqs.sql) —
 * this hook only decides what to *show*, never what to *allow*.
 */
export function usePortalRole(): PortalRoleState {
  const { user, isLoaded } = useUser();
  const userId = user?.id;
  const supabase = useSupabaseClient();
  const [state, setState] = useState<PortalRoleState>({ role: null, isActive: false, loading: true });

  useEffect(() => {
    if (!isLoaded) return;
    if (!userId) {
      setState({ role: null, isActive: false, loading: false });
      return;
    }

    let cancelled = false;
    supabase
      .from('portal_users')
      .select('role, is_active')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          // Distinct from "not provisioned": the lookup itself failed (bad JWT
          // template, expired token, network).
          console.error('[portal-role] portal_users lookup failed:', error.message);
          setState({ role: null, isActive: false, loading: false, error: error.message });
          return;
        }
        setState({
          role: (data?.role as PortalRole) ?? null,
          isActive: data?.is_active ?? false,
          loading: false,
          error: null,
        });
      }, (err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('[portal-role] portal_users lookup threw:', err);
        setState({ role: null, isActive: false, loading: false, error: message });
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, userId, supabase]);

  return state;
}
