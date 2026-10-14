-- Phase 3: the first template, so the engine works end to end.
--
-- Deliberately plain: a salutation and the text the author writes for each
-- letter ({{{body}}} is the block placeholder: the author's own paragraphs).
-- The HR Manager is expected to replace the wording under HR Documents →
-- Templates; saving there creates version 2 and leaves this one on record.
-- The PDF itself adds the date, reference, subject line and "Yours sincerely"
-- with the signatory's name and title, so none of those belong here.
--
-- Only inserted when the type has no template yet, so re-running this never
-- overwrites or reactivates anything the HR Manager has changed.

INSERT INTO public.hr_document_templates (doc_type, version, title, body, use_stored_signature, is_active)
SELECT
  'general_letter', 1, 'General letter',
  E'Dear {{employee.fullName}},\n\n{{{body}}}',
  false, true
WHERE NOT EXISTS (SELECT 1 FROM public.hr_document_templates WHERE doc_type = 'general_letter');
