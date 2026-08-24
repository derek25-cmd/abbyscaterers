-- Seeds the shared app_settings row (20260901160000_app_settings.sql) with
-- the header/footer/signature/stamp images already uploaded to the public
-- "abbys catersmart" Storage bucket under the old localStorage-only
-- settings flow — provided directly by the user so no one has to
-- re-upload these through catering-system's Settings page after this
-- migration lands. The files themselves aren't touched, only the URL
-- columns pointing at them.

UPDATE public.app_settings
SET
  header_url = 'https://enpcjcesyvjqugnxdslp.supabase.co/storage/v1/object/public/abbys%20catersmart/headerUrl-1786813481114-HEADER-removebg-preview.png',
  footer_url = 'https://enpcjcesyvjqugnxdslp.supabase.co/storage/v1/object/public/abbys%20catersmart/footerUrl-1786813490399-WhatsApp_Image_2026-08-15_at_19.39.38-removebg-preview.png',
  signature_url = 'https://enpcjcesyvjqugnxdslp.supabase.co/storage/v1/object/public/abbys%20catersmart/signatureUrl-1786813499001-SIGNATURE.jpeg-removebg-preview.png',
  proforma_stamp_url = 'https://enpcjcesyvjqugnxdslp.supabase.co/storage/v1/object/public/abbys%20catersmart/proformaStampUrl-1786813505345-PROFORMA_STAMP.jpeg-removebg-preview.png',
  invoice_stamp_url = 'https://enpcjcesyvjqugnxdslp.supabase.co/storage/v1/object/public/abbys%20catersmart/invoiceStampUrl-1786813513310-STAMP.jpeg-removebg-preview.png',
  updated_at = now()
WHERE id = true;
