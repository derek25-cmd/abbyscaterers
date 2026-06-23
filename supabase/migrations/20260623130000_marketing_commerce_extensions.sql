-- ============================================================
-- Marketing & CRM — Client linking, Commissions, Daily Reports
-- Abby's Legendary Caterers
-- ============================================================

-- Links a won company to the real client record once a manager approves
-- it for the clients database (Finance module). `landed_at` is the date
-- the company became a client — commission rate steps down 30 days after.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS client_id  TEXT REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS landed_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_companies_client_id ON public.companies(client_id);

-- ── Commission ledger ────────────────────────────────────────
-- One row per invoice issued against a marketer-landed client. Created
-- automatically (PENDING_REVIEW) when an invoice is saved for a linked
-- client; a manager approves or rejects it before it's payable.
CREATE TABLE IF NOT EXISTS public.marketer_commissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  marketer_id       UUID NOT NULL REFERENCES public.marketing_users(id),
  client_id         TEXT NOT NULL,
  invoice_id        TEXT NOT NULL,
  invoice_total     NUMERIC(15, 2) NOT NULL,
  commission_rate   NUMERIC(5, 4) NOT NULL,
  commission_amount NUMERIC(15, 2) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'PENDING_REVIEW'
    CHECK (status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED')),
  reviewed_by       UUID REFERENCES public.marketing_users(id),
  reviewed_at       TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_commissions_marketer ON public.marketer_commissions(marketer_id, status);

ALTER TABLE public.marketer_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commissions_select" ON public.marketer_commissions;
DROP POLICY IF EXISTS "commissions_insert" ON public.marketer_commissions;
DROP POLICY IF EXISTS "commissions_update" ON public.marketer_commissions;

CREATE POLICY "commissions_select" ON public.marketer_commissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "commissions_insert" ON public.marketer_commissions
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "commissions_update" ON public.marketer_commissions
  FOR UPDATE TO authenticated USING (true);

-- ── Daily reports ─────────────────────────────────────────────
-- One per marketer per day. Visit counts are a point-in-time snapshot
-- taken at submission time (compiled from that day's `visits` rows);
-- the narrative is the marketer's own write-up of the day.
CREATE TABLE IF NOT EXISTS public.marketer_daily_reports (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marketer_id                 UUID NOT NULL REFERENCES public.marketing_users(id),
  report_date                 DATE NOT NULL,
  narrative                   TEXT NOT NULL,
  visits_count                INTEGER NOT NULL DEFAULT 0,
  prospects_count             INTEGER NOT NULL DEFAULT 0,
  quotations_requested_count  INTEGER NOT NULL DEFAULT 0,
  submitted_at                TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (marketer_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON public.marketer_daily_reports(report_date DESC);

ALTER TABLE public.marketer_daily_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_reports_select" ON public.marketer_daily_reports;
DROP POLICY IF EXISTS "daily_reports_insert" ON public.marketer_daily_reports;
DROP POLICY IF EXISTS "daily_reports_update" ON public.marketer_daily_reports;

CREATE POLICY "daily_reports_select" ON public.marketer_daily_reports
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "daily_reports_insert" ON public.marketer_daily_reports
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "daily_reports_update" ON public.marketer_daily_reports
  FOR UPDATE TO authenticated USING (true);
