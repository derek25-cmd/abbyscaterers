-- Phase 2: let the HR Manager see leave events in the Audit Trail.
--
-- Phase 1 limited the hr_manager's audit_log access to a fixed list of HR table
-- names. The leave tables are HR data too (who asked for, approved, rejected or
-- cancelled leave, and every balance change), so they join that list. Admin and
-- general_manager already see every table, and plain staff see none.
--
-- Replaces the policy by name; nothing else on audit_log changes.

DROP POLICY IF EXISTS audit_log_select_hr ON public.audit_log;

CREATE POLICY audit_log_select_hr ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    public.has_staff_role(ARRAY['hr_manager'])
    AND table_name IN (
      'employees', 'attendance', 'positions', 'training_participants',
      'training_evaluations', 'payroll',
      'leave_requests', 'leave_balances', 'leave_types', 'leave_settings', 'public_holidays'
    )
  );
