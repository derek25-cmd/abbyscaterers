-- Phase 4: version 1 templates for the seven letter types.
--
-- Deliberately neutral DRAFT wording built from the placeholders, so the whole
-- flow can be tried end to end. Every one starts with the line below; while a
-- letter's template contains it, hr_doc_validate() refuses to send, approve or
-- issue the letter (20261115000100). The HR Manager replaces the wording under
-- HR Documents → Templates (which saves version 2); letters already drafted then
-- use "Update to latest".
--
-- Only inserted when the type has no template yet, so re-running never
-- overwrites or reactivates anything the HR Manager has written.

INSERT INTO public.hr_document_templates (doc_type, version, title, body, use_stored_signature, is_active)
SELECT t.doc_type, 1, t.title, t.body, false, true
FROM (VALUES
  ('offer', 'Offer letter (draft)', E'**DRAFT TEMPLATE — HR Manager to replace this wording before use.**\n\n'
    || E'Dear {{candidate.fullName}},\n\n'
    || E'We are pleased to offer you the position of **{{offer.position}}** with {{company.name}}, starting on {{offer.startDate}}.\n\n'
    || E'Your salary will be {{offer.salary}} per month. The offer includes {{offer.probation}} of probation.\n\n'
    || E'{{{offer.otherTerms}}}\n\n'
    || E'Please confirm your acceptance by {{offer.acceptanceDeadline}}. If we have not heard from you by then, this offer will lapse.'),

  ('contract', 'Employment contract (draft)', E'**DRAFT TEMPLATE — HR Manager to replace this wording before use.**\n\n'
    || E'Dear {{employee.fullName}},\n\n'
    || E'This letter sets out the terms of your {{contract.type}} contract of employment as **{{contract.position}}**, {{contract.term}}.\n\n'
    || E'Your salary is {{contract.salary}} per month. Probation: {{contract.probation}}.\n\n'
    || E'{{{contract.otherTerms}}}\n\n'
    || E'Please sign and return a copy of this letter to confirm that you accept these terms.'),

  ('extension', 'Contract extension (draft)', E'**DRAFT TEMPLATE — HR Manager to replace this wording before use.**\n\n'
    || E'Dear {{employee.fullName}},\n\n'
    || E'Your {{contract.type}} contract as {{contract.position}}, which ends on {{contract.endDate}}, is extended until **{{extension.newEndDate}}**.\n\n'
    || E'During the extension your salary will be {{extension.newSalary}} per month.\n\n'
    || E'Reason for the extension: {{extension.reason}}\n\n'
    || E'All other terms of your contract stay the same.'),

  ('termination', 'Termination letter (draft)', E'**DRAFT TEMPLATE — HR Manager to replace this wording before use.**\n\n'
    || E'Dear {{employee.fullName}},\n\n'
    || E'This letter confirms the end of your employment with {{company.name}} ({{termination.type}}). Notice was given on {{termination.noticeDate}} and your last working day will be **{{termination.lastWorkingDay}}**.\n\n'
    || E'{{{termination.reason}}}\n\n'
    || E'{{{termination.warnings}}}\n\n'
    || E'{{{termination.finalDues}}}\n\n'
    || E'Please return all company property by your last working day.'),

  ('warning', 'Warning letter (draft)', E'**DRAFT TEMPLATE — HR Manager to replace this wording before use.**\n\n'
    || E'Dear {{employee.fullName}},\n\n'
    || E'This is a **{{warning.level}}** about {{warning.offence}} on {{warning.incidentDate}}.\n\n'
    || E'{{{warning.description}}}\n\n'
    || E'{{{warning.actionRequired}}}\n\n'
    || E'This warning stays on your file until {{warning.expiresOn}}. Further incidents may lead to further disciplinary action.'),

  ('recognition', 'Letter of recognition (draft)', E'**DRAFT TEMPLATE — HR Manager to replace this wording before use.**\n\n'
    || E'Dear {{employee.fullName}},\n\n'
    || E'On behalf of {{company.name}}, we would like to recognise you for {{reward.category}}.\n\n'
    || E'{{{reward.reason}}}\n\n'
    || E'Thank you for your contribution.'),

  ('certificate_of_service', 'Certificate of service (draft)', E'**DRAFT TEMPLATE — HR Manager to replace this wording before use.**\n\n'
    || E'TO WHOM IT MAY CONCERN\n\n'
    || E'This is to certify that **{{employee.fullName}}** was employed by {{company.name}} from {{service.startDate}} to {{service.endDate}}.\n\n'
    || E'Positions held: {{service.positions}}.\n\n'
    || E'{{{service.reason}}}\n\n'
    || E'We wish {{employee.firstName}} every success.')
) AS t(doc_type, title, body)
WHERE NOT EXISTS (SELECT 1 FROM public.hr_document_templates x WHERE x.doc_type = t.doc_type);
