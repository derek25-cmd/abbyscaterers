import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockQueryResult } from './test-utils';

// deleteClient must refuse to delete a client that still has linked
// orders/proforma_invoices/invoices/sales — the DB enforces this via
// ON DELETE RESTRICT for three of those four tables, but NOT for orders
// (that FK pre-dates this app and is ON DELETE SET NULL), so this
// app-level guard is the only thing that catches a client-with-only-orders
// case. See supabase/migrations/20260719000000_add_client_foreign_keys.sql.

const fromMock = vi.fn();
const logAuditEventMock = vi.fn();

vi.mock('@/lib/supabase-client', () => ({
  supabase: { from: (...args: any[]) => fromMock(...args) },
}));
vi.mock('@/lib/audit-log', () => ({
  logAuditEvent: (...args: any[]) => logAuditEventMock(...args),
}));

describe('clientService.deleteClient', () => {
  beforeEach(() => {
    fromMock.mockReset();
    logAuditEventMock.mockReset();
  });

  it('throws and does not delete when the client has linked orders', async () => {
    const { deleteClient } = await import('../clientService');

    const deleteSpy = vi.fn();
    fromMock.mockImplementation((table: string) => {
      if (table === 'orders') return mockQueryResult({ data: null, error: null, count: 3 });
      if (table === 'clients') {
        const builder = mockQueryResult({ data: null, error: null });
        builder.delete = deleteSpy.mockReturnValue(builder);
        return builder;
      }
      return mockQueryResult({ data: null, error: null, count: 0 });
    });

    await expect(deleteClient('0164')).rejects.toThrow(/linked record/i);
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(logAuditEventMock).not.toHaveBeenCalled();
  });

  it('deletes and logs an audit event when the client has no linked records', async () => {
    const { deleteClient } = await import('../clientService');

    fromMock.mockImplementation(() => mockQueryResult({ data: null, error: null, count: 0 }));

    const result = await deleteClient('0999');

    expect(result).toBe(true);
    expect(logAuditEventMock).toHaveBeenCalledWith('client.delete', 'clients', '0999');
  });
});
