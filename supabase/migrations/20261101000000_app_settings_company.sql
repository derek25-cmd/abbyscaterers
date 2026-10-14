-- Phase 3: company details as settings instead of text hard-coded into each PDF.
--
-- HR letters print the company name, address, contact and tax numbers (on the
-- plain-text letterhead used when no header image is set, and as the
-- {{company.*}} placeholders). They live on the existing singleton app_settings
-- row next to the header/footer/signature images, so there is one place to
-- change them.
--
-- Pre-filled with the values already printed on invoices
-- (components/invoices/invoice-template.tsx) and the address supplied for the
-- HR letters. Phone and email are left empty: no existing source for them.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS company_address text,
  ADD COLUMN IF NOT EXISTS company_phone text,
  ADD COLUMN IF NOT EXISTS company_email text,
  ADD COLUMN IF NOT EXISTS company_tin text,
  ADD COLUMN IF NOT EXISTS company_vrn text;

-- Fill only what is still empty, so re-running never overwrites an edit.
UPDATE public.app_settings
SET
  company_name    = COALESCE(company_name, 'Abby''s Legendary Caterers Limited'),
  company_address = COALESCE(company_address,
                      E'Plot # 362 Makenya Street, Regent Estate - Mikocheni\nP.O. Box 25187, Dar es Salaam'),
  company_tin     = COALESCE(company_tin, '151-209-696'),
  company_vrn     = COALESCE(company_vrn, '40-050290-L')
WHERE id = true;

-- app_settings_write (20260901160000) lets any active staff member update the
-- row, which is right for the header/footer images but not for the legal name
-- and tax numbers that appear on official letters. Guard just those columns.
CREATE OR REPLACE FUNCTION public.guard_company_settings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.company_name, NEW.company_address, NEW.company_phone, NEW.company_email, NEW.company_tin, NEW.company_vrn)
     IS DISTINCT FROM
     (OLD.company_name, OLD.company_address, OLD.company_phone, OLD.company_email, OLD.company_tin, OLD.company_vrn)
     -- No signed-in user means maintenance/migrations, not an end user.
     AND public.safe_auth_uid() IS NOT NULL
     AND NOT public.can_manage_settings()
  THEN
    RAISE EXCEPTION 'Only an Admin can change the company details.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_company_settings ON public.app_settings;
CREATE TRIGGER guard_company_settings
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.guard_company_settings();
