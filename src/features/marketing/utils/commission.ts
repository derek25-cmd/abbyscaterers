import { supabase } from '@/lib/supabase-client';
import { calculateGrandTotal } from '@/lib/utils';
import type { Invoice } from '@/types';

const FIRST_MONTH_RATE = 0.01;
const SUBSEQUENT_RATE = 0.005;
const FIRST_MONTH_DAYS = 30;

interface LandedCompany {
  id: string;
  assigned_marketer_id: string | null;
  landed_at: string | null;
}

/** The marketer who landed the company, plus everyone added as a collaborator
 * (e.g. it took two marketers to close the deal) — commission is split equally
 * across all of them. */
async function getCommissionMarketers(companyId: string, assignedMarketerId: string): Promise<string[]> {
  const { data: collaborators } = await supabase
    .from('company_collaborators')
    .select('marketer_id')
    .eq('company_id', companyId);

  const ids = new Set([assignedMarketerId, ...(collaborators ?? []).map((c) => c.marketer_id)]);
  return Array.from(ids);
}

/**
 * Logs a PENDING_REVIEW commission row per landing marketer for the
 * invoice's client, if any. Called once, right after an invoice is created
 * — invoiced clientId is matched against companies.client_id (set when a
 * manager approves a WON company into the clients database) to find the
 * marketer(s) and the landed_at date the 1%/0.5% rate steps from. If the
 * company has collaborators, the commission amount is split equally across
 * the assigned marketer + all collaborators. A manager reviews and
 * approves/rejects every row before it's payable.
 */
export async function recordCommissionForInvoice(invoice: Invoice): Promise<void> {
  if (!invoice.clientId) return;

  const { data: company } = await supabase
    .from('companies')
    .select('id, assigned_marketer_id, landed_at')
    .eq('client_id', invoice.clientId)
    .maybeSingle();

  if (!company || !company.assigned_marketer_id || !company.landed_at) return;

  const invoiceTotal = calculateGrandTotal(invoice);
  if (invoiceTotal <= 0) return;

  const daysSinceLanded = (new Date(invoice.invoiceDate).getTime() - new Date(company.landed_at).getTime()) / 86_400_000;
  const rate = daysSinceLanded <= FIRST_MONTH_DAYS ? FIRST_MONTH_RATE : SUBSEQUENT_RATE;
  const marketerIds = await getCommissionMarketers(company.id, company.assigned_marketer_id);

  const rows = marketerIds.map((marketerId) => ({
    company_id: company.id,
    marketer_id: marketerId,
    client_id: invoice.clientId,
    invoice_id: invoice.id,
    invoice_total: invoiceTotal,
    commission_rate: rate,
    commission_amount: (invoiceTotal * rate) / marketerIds.length,
    split_count: marketerIds.length,
  }));

  const { error } = await supabase.from('marketer_commissions').insert(rows);
  if (error) console.error('Error recording marketer commission:', error.message);
}

/**
 * Re-syncs an invoice's commission rows after the invoice itself was edited
 * (total, client, or the company's collaborators changed). A PENDING_REVIEW
 * row is just recomputed in place. An already-APPROVED row is sent back to
 * PENDING_REVIEW with a note instead of being silently rewritten — the
 * manager approved a specific amount and should see that it changed before
 * it's treated as final again. A REJECTED row is left alone. Marketers no
 * longer part of the deal (collaborator removed) have their row voided the
 * same way a deleted invoice would void it.
 */
export async function resyncCommissionForInvoice(invoice: Invoice): Promise<void> {
  const { data: existingRows } = await supabase
    .from('marketer_commissions')
    .select('id, marketer_id, status, commission_amount')
    .eq('invoice_id', invoice.id);

  const existing = existingRows ?? [];

  if (existing.length === 0) {
    await recordCommissionForInvoice(invoice);
    return;
  }

  if (!invoice.clientId) {
    // Client removed from the invoice — none of these commissions apply anymore.
    await voidCommissionForInvoice(invoice.id);
    return;
  }

  const { data: company } = await supabase
    .from('companies')
    .select('id, assigned_marketer_id, landed_at')
    .eq('client_id', invoice.clientId)
    .maybeSingle();

  if (!company || !company.assigned_marketer_id || !company.landed_at) {
    await voidCommissionForInvoice(invoice.id);
    return;
  }

  const invoiceTotal = calculateGrandTotal(invoice);
  const daysSinceLanded = (new Date(invoice.invoiceDate).getTime() - new Date(company.landed_at).getTime()) / 86_400_000;
  const rate = daysSinceLanded <= FIRST_MONTH_DAYS ? FIRST_MONTH_RATE : SUBSEQUENT_RATE;
  const marketerIds = await getCommissionMarketers(company.id, company.assigned_marketer_id);
  const newAmount = (invoiceTotal * rate) / marketerIds.length;

  const existingByMarketer = new Map(existing.map((row) => [row.marketer_id, row]));

  // Marketers who dropped off the deal (collaborator removed) — void their row.
  for (const row of existing) {
    if (row.status !== 'REJECTED' && !marketerIds.includes(row.marketer_id)) {
      await voidSingleCommission(row.id, row.status, row.marketer_id, invoice.id);
    }
  }

  // Marketers still (or newly) part of the deal — upsert their row.
  for (const marketerId of marketerIds) {
    const row = existingByMarketer.get(marketerId);
    if (!row) {
      const { error } = await supabase.from('marketer_commissions').insert([{
        company_id: company.id,
        marketer_id: marketerId,
        client_id: invoice.clientId,
        invoice_id: invoice.id,
        invoice_total: invoiceTotal,
        commission_rate: rate,
        commission_amount: newAmount,
        split_count: marketerIds.length,
      }]);
      if (error) console.error('Error adding commission for new collaborator:', error.message);
      continue;
    }
    if (row.status === 'REJECTED') continue;

    const wasApproved = row.status === 'APPROVED';
    const { error } = await supabase.from('marketer_commissions').update({
      company_id: company.id,
      invoice_total: invoiceTotal,
      commission_rate: rate,
      commission_amount: newAmount,
      split_count: marketerIds.length,
      status: wasApproved ? 'PENDING_REVIEW' : row.status,
      reviewed_by: wasApproved ? null : undefined,
      reviewed_at: wasApproved ? null : undefined,
      notes: wasApproved
        ? `Invoice edited after approval — amount changed from ${row.commission_amount} to ${newAmount}. Needs re-approval.`
        : undefined,
    }).eq('id', row.id);

    if (error) console.error('Error resyncing marketer commission:', error.message);
  }
}

/** Keeps commission rows' invoice_id in sync if the invoice's own id is edited. */
export async function renameInvoiceIdForCommission(oldId: string, newId: string): Promise<void> {
  if (oldId === newId) return;
  const { error } = await supabase.from('marketer_commissions').update({ invoice_id: newId }).eq('invoice_id', oldId);
  if (error) console.error('Error renaming commission invoice_id:', error.message);
}

async function voidSingleCommission(id: string, status: string, marketerId: string, invoiceId: string): Promise<void> {
  if (status === 'PENDING_REVIEW') {
    await supabase.from('marketer_commissions').delete().eq('id', id);
    return;
  }
  const { error } = await supabase.from('marketer_commissions').update({
    notes: `No longer part of this deal (invoice ${invoiceId}) — verify before paying out.`,
  }).eq('id', id);
  if (error) console.error(`Error flagging voided commission for marketer ${marketerId}:`, error.message);
}

/** Voids every commission row tied to an invoice when it's deleted. A
 * pending row is simply removed; an approved one (possibly already paid
 * out) is flagged rather than deleted so the manager can see what happened. */
export async function voidCommissionForInvoice(invoiceId: string): Promise<void> {
  const { data: existing } = await supabase
    .from('marketer_commissions')
    .select('id, status, marketer_id')
    .eq('invoice_id', invoiceId);

  for (const row of existing ?? []) {
    if (row.status === 'PENDING_REVIEW') {
      await supabase.from('marketer_commissions').delete().eq('id', row.id);
    } else {
      const { error } = await supabase.from('marketer_commissions').update({
        notes: 'Source invoice was deleted — verify before paying out.',
      }).eq('id', row.id);
      if (error) console.error('Error flagging voided commission:', error.message);
    }
  }
}
