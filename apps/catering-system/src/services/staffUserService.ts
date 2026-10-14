import { supabase } from '@/lib/supabase-client';
import { isStaffRole, type StaffRole } from '@/lib/permissions';

export interface StaffUser {
  id: string;
  email: string;
  role: StaffRole;
  is_active: boolean;
  created_at: string | null;
}

// Enforcement is the staff_users_admin_all RLS policy (can_manage_settings()).
// Role and is_active changes are recorded in audit_log by the
// audit_staff_user_change trigger, so nothing is logged from here.

export const getStaffUsers = async (): Promise<StaffUser[]> => {
  const { data, error } = await supabase
    .from('staff_users')
    .select('id, email, role, is_active, created_at')
    .order('email');
  if (error) {
    console.error('Error fetching staff users:', error);
    throw new Error(error.message);
  }
  return (data ?? []).filter((u) => isStaffRole(u.role)) as StaffUser[];
};

async function updateStaffUser(id: string, patch: Partial<Pick<StaffUser, 'role' | 'is_active'>>): Promise<void> {
  // select() so a row RLS filtered out comes back empty instead of looking like success.
  const { data, error } = await supabase.from('staff_users').update(patch).eq('id', id).select('id');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error('Update was not applied. You may not have permission to manage users.');
}

export const updateStaffUserRole = (id: string, role: StaffRole) => updateStaffUser(id, { role });

export const setStaffUserActive = (id: string, isActive: boolean) => updateStaffUser(id, { is_active: isActive });
