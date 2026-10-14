import { describe, it, expect, vi, beforeEach } from 'vitest';

const toastMock = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ toast: (...args: unknown[]) => toastMock(...args) }));

const REST = 'https://x.supabase.co/rest/v1';

describe('createPermissionAwareFetch', () => {
  beforeEach(() => {
    toastMock.mockReset();
    vi.resetModules();
    vi.stubGlobal('window', {});
  });

  async function run(url: string, init: RequestInit, response: Response) {
    const { createPermissionAwareFetch } = await import('../permission-feedback');
    const base = vi.fn().mockResolvedValue(response);
    const f = createPermissionAwareFetch(base as unknown as typeof fetch);
    const res = await f(url, init);
    return { res, base };
  }

  it('toasts when an INSERT is refused by RLS (42501)', async () => {
    const body = JSON.stringify({ code: '42501', message: 'new row violates row-level security policy' });
    await run(`${REST}/payroll`, { method: 'POST' }, new Response(body, { status: 403 }));
    expect(toastMock).toHaveBeenCalledTimes(1);
  });

  it('toasts when an UPDATE on an HR table affects 0 rows, and asks for the row count', async () => {
    const { base } = await run(
      `${REST}/employees?id=eq.1`,
      { method: 'PATCH' },
      new Response(null, { status: 204, headers: { 'Content-Range': '*/0' } }),
    );
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(new Headers(base.mock.calls[0][1].headers).get('Prefer')).toContain('count=exact');
  });

  it('does not toast when an UPDATE changed a row', async () => {
    await run(`${REST}/employees?id=eq.1`, { method: 'PATCH' }, new Response(null, { status: 204, headers: { 'Content-Range': '*/1' } }));
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('ignores 0-row updates on non-HR tables and reads', async () => {
    await run(`${REST}/products?id=eq.1`, { method: 'PATCH' }, new Response(null, { status: 204, headers: { 'Content-Range': '*/0' } }));
    await run(`${REST}/employees`, { method: 'GET' }, new Response('[]', { status: 200 }));
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('does not toast for non-permission errors', async () => {
    const body = JSON.stringify({ code: '23505', message: 'duplicate key' });
    await run(`${REST}/payroll`, { method: 'POST' }, new Response(body, { status: 409 }));
    expect(toastMock).not.toHaveBeenCalled();
  });
});
