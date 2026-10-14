import { supabase } from '@/lib/supabase-client';
import { isStaffRole, type StaffRole } from '@/lib/permissions';

export interface StaffUser {
  id: string;
  email: string;
  role: StaffRole;
  is_active: boolean;
  /** employees.id this login belongs to; null until the admin links it. */
  employee_id: string | null;
  created_at: string | null;
}

// Enforcement is the staff_users_admin_all RLS policy (can_manage_settings()).
// Role and is_active changes are recorded in audit_log by the
// audit_staff_user_change trigger, so nothing is logged from here.

export const getStaffUsers = async (): Promise<StaffUser[]> => {
  let { data, error } = await supabase
    .from('staff_users')
    .select('id, email, role, is_active, employee_id, created_at')
    .order('email');
  // Before the employee-link migration is applied the column does not exist.
  if (error?.code === '42703') {
    const basic = await supabase.from('staff_users').select('id, email, role, is_active, created_at').order('email');
    data = (basic.data ?? []).map((u) => ({ ...u, employee_id: null })) as typeof data;
    error = basic.error;
  }
  if (error) {
    console.error('Error fetching staff users:', error);
    throw new Error(error.message);
  }
  return (data ?? []).filter((u) => isStaffRole(u.role)) as StaffUser[];
};

async function updateStaffUser(id: string, patch: Partial<Pick<StaffUser, 'role' | 'is_active' | 'employee_id'>>): Promise<void> {
  // select() so a row RLS filtered out comes back empty instead of looking like success.
  const { data, error } = await supabase.from('staff_users').update(patch).eq('id', id).select('id');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error('Update was not applied. You may not have permission to manage users.');
}

export const updateStaffUserRole = (id: string, role: StaffRole) => updateStaffUser(id, { role });

export const setStaffUserEmployee = (id: string, employeeId: string | null) => updateStaffUser(id, { employee_id: employeeId });

export const setStaffUserActive = (id: string, isActive: boolean) => updateStaffUser(id, { is_active: isActive });
