-- Add SEMI_ANNUAL ("6 Months") as a valid marketing_targets.period_type.
ALTER TABLE public.marketing_targets
  DROP CONSTRAINT IF EXISTS marketing_targets_period_type_check;

ALTER TABLE public.marketing_targets
  ADD CONSTRAINT marketing_targets_period_type_check
  CHECK (period_type IN ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'));
