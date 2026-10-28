import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockQueryResult } from './test-utils';

// The rules (Admin only, the phrase, Stock Logs untouched) are enforced by
// delete_all_products() in the database (supabase/tests/delete_all_products.sql).
// These tests pin what the service sends and how it reports refusals, and the
// backup CSV.

const rpcMock = vi.fn();
const fromMock = vi.fn();
vi.mock('@/lib/supabase-client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpcMock(...a),
    from: (...a: unknown[]) => fromMock(...a),
  },
}));

beforeEach(() => { rpcMock.mockReset(); fromMock.mockReset(); });

describe('deleteAllProducts', () => {
  it('sends the typed phrase to the database and returns what was deleted and kept', async () => {
    rpcMock.mockResolvedValue({ data: { products_deleted: 387, stock_logs_kept: 650 }, error: null });
    const { deleteAllProducts } = await import('../productService');

    await expect(deleteAllProducts('DELETE ALL PRODUCTS')).resolves.toEqual({ products_deleted: 387, stock_logs_kept: 650 });
    expect(rpcMock).toHaveBeenCalledWith('delete_all_products', { p_confirm: 'DELETE ALL PRODUCTS' });
  });

  it('does not call the database without the exact phrase', async () => {
    const { deleteAllProducts } = await import('../productService');
    await expect(deleteAllProducts('delete all products')).rejects.toThrow(/Type DELETE ALL PRODUCTS/);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('passes the database refusal on, and words a bare permission error', async () => {
    const { deleteAllProducts } = await import('../productService');
    rpcMock.mockResolvedValue({ data: null, error: { message: 'Stopped: the Stock Logs changed (650 before, 649 after). Nothing was deleted.' } });
    await expect(deleteAllProducts('DELETE ALL PRODUCTS')).rejects.toThrow(/Stock Logs changed/);
    rpcMock.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied for function delete_all_products' } });
    await expect(deleteAllProducts('DELETE ALL PRODUCTS')).rejects.toThrow('Only an Admin can delete the whole Product Catalog.');
  });
});

describe('the backup CSV', () => {
  it('has every column of every row, and quotes commas, quotes and line breaks', async () => {
    const { rowsToCsv } = await import('../productService');
    const csv = rowsToCsv([
      { id: 'PROD1', name: 'Rice, Pishori', unitPrice_dar: 3200 },
      { id: 'PROD2', name: 'Say "cheese"', note: 'line1\nline2', unitPrice_dar: null },
    ]);
    expect(csv.split('\r\n')).toEqual([
      'id,name,unitPrice_dar,note',
      'PROD1,"Rice, Pishori",3200,',
      'PROD2,"Say ""cheese""",,"line1\nline2"',
      '',
    ]);
  });

  it('reads the catalog page by page until the last page', async () => {
    const page = (n: number, start: number) => Array.from({ length: n }, (_, i) => ({ id: `PROD${start + i}` }));
    fromMock
      .mockReturnValueOnce(mockQueryResult({ data: page(1000, 0), error: null }))
      .mockReturnValueOnce(mockQueryResult({ data: page(5, 1000), error: null }));
    const { productsBackupCsv } = await import('../productService');

    const { count, csv } = await productsBackupCsv();

    expect(count).toBe(1005);
    expect(fromMock).toHaveBeenCalledTimes(2);
    expect(csv.split('\r\n')[1005]).toBe('PROD1004');
  });
});
