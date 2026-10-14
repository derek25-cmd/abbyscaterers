import { z } from 'zod';
import { supabase } from '@/lib/supabase-client';
import { validate } from '@/lib/service-validation';
import type { Candidate, OfferStatus } from '@/types';

// Job candidates (Phase 4). HR keeps them by hand; the offer status moves only
// through the offer letter and respondToOffer (the database refuses anything
// else), and a candidate is linked to an employee once, after accepting.

interface DbError { message: string; code?: string }
const toError = (e: DbError, fallback: string) =>
  new Error(e.code === '42501' && !/^(Only|You )/.test(e.message) ? 'You do not have permission to do that.' : e.message || fallback);

export const CandidateSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter the candidate\'s full name'),
  phone: z.string().trim().optional().or(z.literal('')),
  email: z.string().trim().email('Not a valid email').optional().or(z.literal('')),
  address: z.string().trim().optional().or(z.literal('')),
  position: z.string().trim().optional().or(z.literal('')),
  department: z.string().trim().optional().or(z.literal('')),
  proposed_salary: z.preprocess((v) => (v === '' || v == null ? null : Number(v)), z.number().min(0).nullable()),
  proposed_start_date: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});
export type CandidateInput = z.input<typeof CandidateSchema>;
type CandidateValues = z.infer<typeof CandidateSchema>;

const clean = (v: CandidateValues) => ({
  full_name: v.full_name,
  phone: v.phone || null,
  email: v.email || null,
  address: v.address || null,
  position: v.position || null,
  department: v.department || null,
  proposed_salary: v.proposed_salary,
  proposed_start_date: v.proposed_start_date || null,
  notes: v.notes || null,
});

export const listCandidates = async (status?: OfferStatus): Promise<Candidate[]> => {
  let query = supabase.from('candidates').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('offer_status', status);
  const { data, error } = await query;
  if (error) throw toError(error, 'Could not load the candidates.');
  return (data ?? []) as Candidate[];
};

export const getCandidate = async (id: string): Promise<Candidate> => {
  const { data, error } = await supabase.from('candidates').select('*').eq('id', id).maybeSingle();
  if (error || !data) throw new Error('Candidate not found.');
  return data as Candidate;
};

export const createCandidate = async (input: CandidateInput): Promise<Candidate> => {
  const { data, error } = await supabase.from('candidates').insert([clean(validate(CandidateSchema, input) as CandidateValues)]).select().single();
  if (error) throw toError(error, 'Could not save the candidate.');
  return data as Candidate;
};

export const updateCandidate = async (id: string, input: CandidateInput): Promise<Candidate> => {
  const { data, error } = await supabase.from('candidates').update(clean(validate(CandidateSchema, input) as CandidateValues)).eq('id', id).select().single();
  if (error) throw toError(error, 'Could not save the candidate.');
  return data as Candidate;
};

export const deleteCandidate = async (id: string): Promise<void> => {
  const { data, error } = await supabase.from('candidates').delete().eq('id', id).select('id');
  if (error) throw toError(error, 'Could not delete the candidate.');
  if (!data?.length) throw new Error('The candidate was not deleted.');
};

/** accepted / declined / withdrawn, on the date the answer came. */
export const respondToOffer = async (id: string, response: 'accepted' | 'declined' | 'withdrawn', date?: string): Promise<Candidate> => {
  const { data, error } = await supabase.rpc('respond_to_offer', { p_candidate: id, p_response: response, p_date: date || null });
  if (error) throw toError(error, 'Could not record the response.');
  return data as Candidate;
};

/** Links an accepted candidate to the employee record created for them. */
export const linkCandidateToEmployee = async (id: string, employeeId: string): Promise<void> => {
  const { data, error } = await supabase.from('candidates').update({ employee_id: employeeId }).eq('id', id).select('id');
  if (error) throw toError(error, 'Could not link the candidate to the new employee.');
  if (!data?.length) throw new Error('The candidate was not linked.');
};

/** The accepted offer's terms, for pre-filling the new employee. */
export const getAcceptedOfferTerms = async (candidate: Candidate): Promise<Record<string, unknown> | null> => {
  if (!candidate.offer_document_id) return null;
  const { data } = await supabase.from('hr_documents').select('data').eq('id', candidate.offer_document_id).maybeSingle();
  return (data?.data as Record<string, unknown>) ?? null;
};
