ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS onboarding_requested BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_requested_by UUID REFERENCES public.marketing_users(id);
