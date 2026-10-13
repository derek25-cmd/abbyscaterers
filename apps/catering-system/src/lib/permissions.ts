/**
 * Single source of truth for what each staff role may do in the UI.
 *
 * This only decides what to *show*. The enforcement is RLS: the SQL helpers
 * has_staff_role() / can_manage_hr() / can_manage_ops() / can_manage_settings()
 * in supabase/migrations/20261014000000_hr_ops_roles.sql. Keep the two in
 * step — a role listed here but not allowed by the database just produces a
 * button that fails with a permission toast.
 */

export type StaffRole = 'admin' | 'general_manager' | 'hr_manager' | 'finance' | 'staff';

export const STAFF_ROLES: readonly StaffRole[] = ['admin', 'general_manager', 'hr_manager', 'finance', 'staff'];

export const ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'Admin',
  general_manager: 'General Manager',
  hr_manager: 'HR Manager',
  finance: 'Finance',
  staff: 'Other Authorized User',
};

export type Permission =
  | 'hr.manage'          // edit/delete HR records, approve HR requests (can_manage_hr)
  | 'ops.manage'         // edit/delete Ops records (can_manage_ops — not locked in Phase 1)
  | 'settings.manage'    // users, roles, settings (can_manage_settings)
  | 'payroll.manage'     // edit/delete payroll: HR roles plus finance, as before
  | 'employees.viewFull' // read employees incl. salary/ID/bank fields
  | 'audit.view'         // audit trail page
  | 'audit.viewAll';     // audit trail incl. non-HR tables

export const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  admin: ['hr.manage', 'ops.manage', 'settings.manage', 'payroll.manage', 'employees.viewFull', 'audit.view', 'audit.viewAll'],
  general_manager: ['hr.manage', 'ops.manage', 'payroll.manage', 'employees.viewFull', 'audit.view', 'audit.viewAll'],
  hr_manager: ['hr.manage', 'ops.manage', 'payroll.manage', 'employees.viewFull', 'audit.view'],
  finance: ['ops.manage', 'payroll.manage', 'employees.viewFull'],
  staff: ['ops.manage'],
};

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && (STAFF_ROLES as readonly string[]).includes(value);
}

export function hasPermission(role: StaffRole | null | undefined, permission: Permission): boolean {
  return !!role && ROLE_PERMISSIONS[role].includes(permission);
}
