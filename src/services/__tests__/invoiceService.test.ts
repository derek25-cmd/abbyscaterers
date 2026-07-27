import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockQueryResult } from './test-utils';

// addInvoice/deleteInvoice go through create_invoice_from_proforma() /
// delete_invoice_and_revert_proforma() so the invoice write and the
// proforma's isInvoiced flag update happen in one DB transaction — see
// supabase/migrations/20260719000100_atomic_invoice_writes.sql. These tests
// confirm the service layer calls the RPCs (not raw sequential
// insert/update calls, which is the bug that migration fixed).

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock('@/lib/supabase-client', () => ({
  supabase: {
    rpc: (...args: any[]) => rpcMock(...args),
    from: (...args: any[]) => fromMock(...args),
  },
}));
vi.mock('@/features/marketing/utils/commission', () => ({
  recordCommissionForInvoice: vi.fn().mockResolvedValue(undefined),
  voidCommissionForInvoice: vi.fn().mockResolvedValue(undefined),
  resyncCommissionForInvoice: vi.fn().mockResolvedValue(undefined),
  renameInvoiceIdForCommission: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/audit-log', () => ({
  logAuditEvent: vi.fn(),
}));
vi.mock('@/lib/service-validation', () => ({
  validate: (_schema: unknown, data: unknown) => data,
}));

describe('invoiceService', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
  });

  it('addInvoice calls the create_invoice_from_proforma RPC, not a raw insert', async () => {
    const { addInvoice } = await import('../invoiceService');

    const builder = mockQueryResult({ data: { id: 'INV-001' }, error: null });
    rpcMock.mockReturnValue(builder);

    await addInvoice({ id: 'INV-001', proformaId: 'PI-001' } as any);

    expect(rpcMock).toHaveBeenCalledWith(
      'create_invoice_from_proforma',
      expect.objectContaining({ p_invoice: expect.objectContaining({ id: 'INV-001', proformaId: 'PI-001' }) })
    );
    // The old bug was a raw .from('invoices').insert(...) plus a separate
    // .from('proforma_invoices').update(...) — neither should happen now.
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('deleteInvoice calls the delete_invoice_and_revert_proforma RPC', async () => {
    const { deleteInvoice } = await import('../invoiceService');

    rpcMock.mockReturnValue(mockQueryResult({ data: null, error: null }));

    const result = await deleteInvoice('INV-001');

    expect(result).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith('delete_invoice_and_revert_proforma', { p_invoice_id: 'INV-001' });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('addInvoice throws when the RPC reports an error (e.g. duplicate invoice)', async () => {
    const { addInvoice } = await import('../invoiceService');

    rpcMock.mockReturnValue(
      mockQueryResult({ data: null, error: { message: 'A final invoice already exists for this proforma.' } })
    );

    await expect(addInvoice({ id: 'INV-002', proformaId: 'PI-001' } as any)).rejects.toThrow(/already exists/i);
  });
});
