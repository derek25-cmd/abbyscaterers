import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * HR letters waiting for approval, approved or returned from the admin
 * portal (super_admin and management). The database functions are in
 * supabase/migrations/20261015000100_hr_portal_letter_approval.sql. Issuing
 * (reference number, PDF) stays in the HR system.
 */

export const HR_LETTER_APPROVER_ROLES = ['super_admin', 'management'] as const;

/** The letter as it will print, saved by the HR system when it was sent for approval. */
export interface LetterPreview {
  v: 1;
  date: string;
  subject: string;
  addressee: string[];
  paragraphs: { text: string; bold: boolean }[][];
  confidential: boolean;
}

export interface PendingLetter {
  id: string;
  doc_type: string;
  type_label: string;
  subject: string;
  person: string;
  author_email: string | null;
  written_at: string;
  confidential: boolean;
  needs_other_approver: boolean;
  written_by_me: boolean | null;
  preview: LetterPreview | null;
}

const message = (e: { message?: string } | null, fallback: string) => new Error(e?.message || fallback);

export async function listPendingLetters(supabase: SupabaseClient): Promise<PendingLetter[]> {
  const { data, error } = await supabase.rpc('portal_pending_hr_documents');
  if (error) throw message(error, 'Could not load the letters waiting for approval.');
  return (data ?? []) as PendingLetter[];
}

export async function approveLetter(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.rpc('portal_approve_hr_document', { p_id: id });
  if (error) throw message(error, 'Could not approve the letter.');
}

export async function returnLetter(supabase: SupabaseClient, id: string, note: string): Promise<void> {
  if (note.trim().length < 3) throw new Error('Say what needs to change, so the author knows.');
  const { error } = await supabase.rpc('portal_return_hr_document', { p_id: id, p_note: note.trim() });
  if (error) throw message(error, 'Could not return the letter.');
}

/** "You wrote this" blocks approval only for the types that need a second person. */
export const cannotApproveOwn = (l: Pick<PendingLetter, 'needs_other_approver' | 'written_by_me'>) =>
  l.needs_other_approver && l.written_by_me === true;
