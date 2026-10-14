import { describe, it, expect, vi, beforeEach } from 'vitest';

const toastMock = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ toast: (...args: unknown[]) => toastMock(...args) }));
const sentryMock = vi.fn();
vi.mock('@sentry/nextjs', () => ({ captureMessage: (...args: unknown[]) => sentryMock(...args) }));

const REST = 'https://x.supabase.co/rest/v1';

describe('createPermissionAwareFetch', () => {
  beforeEach(() => {
    toastMock.mockReset();
    sentryMock.mockReset();
    vi.resetModules();
    vi.stubGlobal('window', { location: { pathname: '/hr/employees' } });
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

  it('reports a refusal to Sentry with role, target, method and page, and nothing from the record', async () => {
    const { setReportingRole } = await import('../permission-feedback');
    setReportingRole('staff');
    const body = JSON.stringify({ code: '42501', message: 'new row violates row-level security policy for table "payroll"' });
    await run(`${REST}/payroll?id=eq.PAY-123&employeeId=eq.EMP-9`, { method: 'POST', body: '{"netSalary": 999999}' }, new Response(body, { status: 403 }));
    expect(sentryMock).toHaveBeenCalledTimes(1);
    const [message, ctx] = sentryMock.mock.calls[0];
    expect(message).toBe('Permission denied: POST payroll');
    expect(ctx.tags).toEqual({ kind: 'permission_denied', role: 'staff', target: 'payroll', method: 'POST', denied: 'refused' });
    expect(ctx.extra).toEqual({ page: '/hr/employees', status: 403, code: '42501' });
    const sent = JSON.stringify(sentryMock.mock.calls);
    for (const secret of ['PAY-123', 'EMP-9', '999999', 'netSalary']) expect(sent).not.toContain(secret);
  });

  it('reports RPCs by name and 0-row edits as "no_rows_changed"', async () => {
    const body = JSON.stringify({ code: '42501', message: 'Only an Admin, HR Manager or General Manager can approve HR documents.' });
    await run(`${REST}/rpc/approve_hr_document`, { method: 'POST' }, new Response(body, { status: 403 }));
    expect(sentryMock.mock.calls[0][1].tags.target).toBe('rpc:approve_hr_document');
    await run(`${REST}/employees?id=eq.1`, { method: 'PATCH' }, new Response(null, { status: 204, headers: { 'Content-Range': '*/0' } }));
    expect(sentryMock.mock.calls[1][1].tags).toMatchObject({ target: 'employees', method: 'PATCH', denied: 'no_rows_changed' });
  });

  it('reports the same refusal once a minute, not once per request', async () => {
    const { createPermissionAwareFetch } = await import('../permission-feedback');
    const body = () => new Response(JSON.stringify({ code: '42501', message: 'permission denied' }), { status: 403 });
    const base = vi.fn().mockImplementation(async () => body());
    const f = createPermissionAwareFetch(base as unknown as typeof fetch);
    await f(`${REST}/payroll`, { method: 'POST' });
    await f(`${REST}/payroll`, { method: 'POST' });
    expect(sentryMock).toHaveBeenCalledTimes(1);
  });

  it('does not report non-permission errors', async () => {
    await run(`${REST}/payroll`, { method: 'POST' }, new Response(JSON.stringify({ code: '23505', message: 'duplicate key' }), { status: 409 }));
    expect(sentryMock).not.toHaveBeenCalled();
  });
});
