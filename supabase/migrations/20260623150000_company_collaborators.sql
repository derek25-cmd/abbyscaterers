-- ============================================================
-- Marketing & CRM — Multi-marketer companies (collaborators)
-- Abby's Legendary Caterers
-- ============================================================

-- A company can be landed by more than one marketer. `companies.assigned_marketer_id`
-- stays the marketer who registered/loaded the company; any additional marketer who
-- helped land it is added here as a collaborator. Commission is then split equally
-- across the assigned marketer + all collaborators.
CREATE TABLE IF NOT EXISTS public.company_collaborators (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  marketer_id  UUID NOT NULL REFERENCES public.marketing_users(id),
  added_by     UUID NOT NULL REFERENCES public.marketing_users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id, marketer_id)
);

CREATE INDEX IF NOT EXISTS idx_company_collaborators_company ON public.company_collaborators(company_id);

ALTER TABLE public.company_collaborators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_collaborators_select" ON public.company_collaborators;
DROP POLICY IF EXISTS "company_collaborators_insert" ON public.company_collaborators;
DROP POLICY IF EXISTS "company_collaborators_delete" ON public.company_collaborators;

CREATE POLICY "company_collaborators_select" ON public.company_collaborators
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "company_collaborators_insert" ON public.company_collaborators
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "company_collaborators_delete" ON public.company_collaborators
  FOR DELETE TO authenticated USING (true);

-- Commission rows now key off (invoice_id, marketer_id) since a single invoice
-- can produce one row per collaborating marketer. `split_count` records how many
-- ways the commission was divided so the amount is self-explanatory:
-- commission_amount = invoice_total * commission_rate / split_count.
ALTER TABLE public.marketer_commissions
  ADD COLUMN IF NOT EXISTS split_count INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.marketer_commissions DROP CONSTRAINT IF EXISTS marketer_commissions_invoice_id_key;
ALTER TABLE public.marketer_commissions ADD CONSTRAINT marketer_commissions_invoice_id_marketer_id_key UNIQUE (invoice_id, marketer_id);
