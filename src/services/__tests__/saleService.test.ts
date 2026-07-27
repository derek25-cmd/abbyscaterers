import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockQueryResult } from './test-utils';

// The live `sales` table's real columns are unquoted/lowercase
// (customerid, invoicenumber, etc.) — not the camelCase schema.sql
// describes. addSale silently failed on every call until this was fixed
// (see src/services/saleService.ts). These tests pin that fix down so a
// future edit can't reintroduce the mismatch.

const fromMock = vi.fn();
const getUserMock = vi.fn();

vi.mock('@/lib/supabase-client', () => ({
  supabase: {
    from: (...args: any[]) => fromMock(...args),
    auth: { getUser: () => getUserMock() },
  },
}));

describe('saleService', () => {
  beforeEach(() => {
    fromMock.mockReset();
    getUserMock.mockReset();
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-123' } } });
  });

  it('addSale sends the real lowercase column names and includes user_id', async () => {
    const { addSale } = await import('../saleService');

    let insertedPayload: any = null;
    fromMock.mockImplementation((table: string) => {
      expect(table).toBe('sales');
      const builder = mockQueryResult({
        data: { id: 'sale-1', createdat: '2026-01-01T00:00:00Z', updatedat: '2026-01-01T00:00:00Z' },
        error: null,
      });
      builder.insert = vi.fn((rows: any[]) => {
        insertedPayload = rows[0];
        return builder;
      });
      return builder;
    });

    await addSale({
      date: '2026-01-01',
      customerId: '0001',
      invoiceNumber: 'INV-1',
      description: 'Test sale',
      quantity: 1,
      unitPrice: 100,
      totalAmount: 100,
      taxAmount: 0,
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      event_id: '',
      efd_receipt: '',
    } as any);

    expect(insertedPayload).toMatchObject({
      customerid: '0001',
      invoicenumber: 'INV-1',
      unitprice: 100,
      totalamount: 100,
      taxamount: 0,
      paymentmethod: 'cash',
      paymentstatus: 'paid',
      user_id: 'user-123',
    });
    // The old (broken) camelCase keys must never be sent — the live table
    // doesn't have these columns at all.
    expect(insertedPayload).not.toHaveProperty('customerId');
    expect(insertedPayload).not.toHaveProperty('invoiceNumber');
  });

  it('getSales maps the lowercase customerid column back to customerId', async () => {
    const { getSales } = await import('../saleService');

    fromMock.mockImplementation(() =>
      mockQueryResult({
        data: [{
          id: 'sale-1',
          date: '2026-01-01',
          customerid: '0001', // real live column — not customerId or customer_id
          invoicenumber: 'INV-1',
          description: 'Test sale',
          quantity: 1,
          unitprice: 100,
          totalamount: 100,
          taxamount: 0,
          paymentmethod: 'cash',
          paymentstatus: 'paid',
          createdat: '2026-01-01T00:00:00Z',
          updatedat: '2026-01-01T00:00:00Z',
        }],
        error: null,
      })
    );

    const sales = await getSales();
    expect(sales[0].customerId).toBe('0001');
  });
});
