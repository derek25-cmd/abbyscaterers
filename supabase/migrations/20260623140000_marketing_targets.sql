-- ============================================================
-- Marketing & CRM — Performance Targets
-- Abby's Legendary Caterers
-- ============================================================

-- A target is either for one marketer (scope = MARKETER, marketer_id set)
-- or for the whole team (scope = OVERALL, marketer_id NULL, actuals are
-- summed across every marketer for the period). `metrics` holds the goal
-- for each tracked figure, e.g. {"visits": 60, "deals_won": 2}; only the
-- keys a manager actually sets are included, so a target can focus on
-- just one or two metrics instead of forcing every figure to be set.
CREATE TABLE IF NOT EXISTS public.marketing_targets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope        TEXT NOT NULL CHECK (scope IN ('MARKETER', 'OVERALL')),
  marketer_id  UUID REFERENCES public.marketing_users(id),
  period_type  TEXT NOT NULL CHECK (period_type IN ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL')),
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  metrics      JSONB NOT NULL,
  notes        TEXT,
  created_by   UUID NOT NULL REFERENCES public.marketing_users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  CHECK (scope = 'OVERALL' OR marketer_id IS NOT NULL),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_targets_marketer ON public.marketing_targets(marketer_id);
CREATE INDEX IF NOT EXISTS idx_targets_period ON public.marketing_targets(start_date, end_date);

-- Each row is one AI-scored run against a target — kept as a history so a
-- manager can see how a marketer trended over the period, not just the
-- latest read. `actuals`/per-metric % achieved are computed deterministically
-- from visits/companies/commissions; the AI only writes the narrative and
-- recommendation on top of those numbers (same pattern as the monthly report
-- narrative — Claude explains, it doesn't do the arithmetic).
CREATE TABLE IF NOT EXISTS public.marketing_target_analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id       UUID NOT NULL REFERENCES public.marketing_targets(id) ON DELETE CASCADE,
  actuals         JSONB NOT NULL,
  score           NUMERIC(5, 2) NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'ACHIEVED', 'PARTIALLY_ACHIEVED', 'MISSED')),
  narrative       TEXT,
  recommendation  TEXT,
  analysed_by     UUID REFERENCES public.marketing_users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_target_analyses_target ON public.marketing_target_analyses(target_id, created_at DESC);

ALTER TABLE public.marketing_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_target_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "targets_select" ON public.marketing_targets;
DROP POLICY IF EXISTS "targets_insert" ON public.marketing_targets;
DROP POLICY IF EXISTS "targets_update" ON public.marketing_targets;
DROP POLICY IF EXISTS "targets_delete" ON public.marketing_targets;

CREATE POLICY "targets_select" ON public.marketing_targets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "targets_insert" ON public.marketing_targets
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "targets_update" ON public.marketing_targets
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "targets_delete" ON public.marketing_targets
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "target_analyses_select" ON public.marketing_target_analyses;
DROP POLICY IF EXISTS "target_analyses_insert" ON public.marketing_target_analyses;

CREATE POLICY "target_analyses_select" ON public.marketing_target_analyses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "target_analyses_insert" ON public.marketing_target_analyses
  FOR INSERT TO authenticated WITH CHECK (true);
