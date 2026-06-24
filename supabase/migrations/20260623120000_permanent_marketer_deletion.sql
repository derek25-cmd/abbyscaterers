-- ============================================================
-- Permanent Marketer Deletion ("Purge") — REMOVED
-- Abby's Legendary Caterers — Marketing & CRM Module
--
-- This used to add a hard-delete that wiped a marketer's visits,
-- performance, commissions, and audit trail entirely. That contradicts
-- how account deletion is meant to work here: a manager deletes the
-- ACCOUNT (blocks login, anonymises PII, forces the person to sign up
-- again), but the business data they generated stays — the management
-- system still needs it for reporting. See delete_marketer() in
-- 20260621100000_marketer_account_authority.sql for the account-only
-- deletion, which now also detaches the Supabase Auth login.
--
-- Dropping rather than leaving dormant: it was SECURITY DEFINER and
-- callable directly via the Supabase client by any authenticated user
-- (the manager-only check lived in the Next.js route, not the function
-- itself), so leaving it in place was a real risk of a non-manager
-- wiping another marketer's entire history.
-- ============================================================

DROP FUNCTION IF EXISTS permanently_delete_marketer(UUID, UUID, TEXT);
DROP TABLE IF EXISTS public.marketer_deletion_log;
