-- ============================================================
-- Phase 5 — Marketing Performance Aggregation & Monthly Expenses
-- Abby's Legendary Caterers — Marketing & CRM Module
-- ============================================================

CREATE OR REPLACE FUNCTION aggregate_marketing_performance(
  p_month INTEGER DEFAULT EXTRACT(MONTH FROM NOW())::INTEGER,
  p_year  INTEGER DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER
)
RETURNS void AS $$
BEGIN
  DELETE FROM marketing_performance
  WHERE month = p_month AND year = p_year;

  INSERT INTO marketing_performance (
    marketer_id, month, year,
    total_visits, verified_visits, new_leads, hot_leads,
    quotations_requested, deals_won, follow_ups_completed,
    follow_ups_missed, revenue_generated, avg_lead_score,
    avg_interest_level
  )
  SELECT
    mu.id,
    p_month,
    p_year,

    COUNT(DISTINCT v.id) AS total_visits,
    COUNT(DISTINCT v.id) FILTER (WHERE v.gps_verified = true) AS verified_visits,
    COUNT(DISTINCT c_lead.id) AS new_leads,
    COUNT(DISTINCT c_hot.id) AS hot_leads,
    COUNT(DISTINCT c_quot.id) AS quotations_requested,
    COUNT(DISTINCT c_won.id) AS deals_won,
    COUNT(DISTINCT fu_done.id) AS follow_ups_completed,
    COUNT(DISTINCT fu_miss.id) AS follow_ups_missed,
    COALESCE(SUM(DISTINCT c_won.estimated_value), 0) AS revenue_generated,
    COALESCE(AVG(v.lead_score), 0) AS avg_lead_score,
    COALESCE(AVG(
      CASE v.interest_level
        WHEN 'NOT_INTERESTED' THEN 0
        WHEN 'MAYBE' THEN 1
        WHEN 'INTERESTED' THEN 2
        WHEN 'VERY_INTERESTED' THEN 3
      END
    ), 0) AS avg_interest_level

  FROM marketing_users mu

  LEFT JOIN visits v ON v.marketer_id = mu.id
    AND EXTRACT(MONTH FROM v.check_in_time) = p_month
    AND EXTRACT(YEAR FROM v.check_in_time) = p_year

  LEFT JOIN companies c_lead ON c_lead.assigned_marketer_id = mu.id
    AND c_lead.pipeline_stage != 'IDENTIFIED'
    AND EXTRACT(MONTH FROM c_lead.updated_at) = p_month
    AND EXTRACT(YEAR FROM c_lead.updated_at) = p_year

  LEFT JOIN companies c_hot ON c_hot.assigned_marketer_id = mu.id
    AND c_hot.lead_score >= 80

  LEFT JOIN companies c_quot ON c_quot.assigned_marketer_id = mu.id
    AND c_quot.pipeline_stage = 'QUOTATION_REQUESTED'
    AND EXTRACT(MONTH FROM c_quot.updated_at) = p_month
    AND EXTRACT(YEAR FROM c_quot.updated_at) = p_year

  LEFT JOIN companies c_won ON c_won.assigned_marketer_id = mu.id
    AND c_won.pipeline_stage = 'WON'
    AND EXTRACT(MONTH FROM c_won.client_since) = p_month
    AND EXTRACT(YEAR FROM c_won.client_since) = p_year

  LEFT JOIN follow_ups fu_done ON fu_done.assigned_to = mu.id
    AND fu_done.status = 'DONE'
    AND EXTRACT(MONTH FROM fu_done.completed_at) = p_month
    AND EXTRACT(YEAR FROM fu_done.completed_at) = p_year

  LEFT JOIN follow_ups fu_miss ON fu_miss.assigned_to = mu.id
    AND fu_miss.status IN ('PENDING', 'OVERDUE')
    AND fu_miss.due_date < NOW()
    AND EXTRACT(MONTH FROM fu_miss.due_date) = p_month
    AND EXTRACT(YEAR FROM fu_miss.due_date) = p_year

  WHERE mu.is_active = true
  GROUP BY mu.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Monthly marketing expenses (manager-entered, used by the CAC calculator)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.marketing_monthly_expenses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month          INTEGER NOT NULL,
  year           INTEGER NOT NULL,
  total_expenses NUMERIC(15,2) NOT NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(month, year)
);

ALTER TABLE public.marketing_monthly_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_all" ON public.marketing_monthly_expenses;
CREATE POLICY "expenses_all" ON public.marketing_monthly_expenses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
