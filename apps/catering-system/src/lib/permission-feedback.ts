import { toast } from '@/hooks/use-toast';

/**
 * Edits and deletes that RLS refuses don't error: Postgres filters the rows
 * out of an UPDATE/DELETE, so PostgREST answers "0 rows affected" and the
 * services (which only check `error`) report success. INSERT violations do
 * error (42501). This wraps fetch so both cases surface as a toast instead of
 * a silent no-op.
 */

const HR_TABLES = ['employees', 'attendance', 'positions', 'training_participants', 'training_evaluations', 'payroll'];

const MESSAGE =
  'You do not have permission to do that. Only the HR Manager, General Manager or an Admin can edit or delete these records.';

let lastShown = 0;
function notifyDenied() {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - lastShown < 3000) return; // one toast per burst, not one per request
  lastShown = now;
  toast({ variant: 'destructive', title: 'Not allowed', description: MESSAGE });
}

export function isPermissionDenied(status: number, body: { code?: string; message?: string } | null): boolean {
  return status >= 400 && (body?.code === '42501' || /row-level security|permission denied/i.test(body?.message ?? ''));
}

function targetsHrTable(url: string): boolean {
  const m = url.match(/\/rest\/v1\/([a-z_]+)/);
  return !!m && HR_TABLES.includes(m[1]);
}

export function createPermissionAwareFetch(baseFetch: typeof fetch = (...args) => fetch(...args)): typeof fetch {
  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
    const isMutation = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) && url.includes('/rest/v1/');
    const countRows = (method === 'PATCH' || method === 'DELETE') && targetsHrTable(url);

    let nextInit = init;
    if (countRows) {
      // Ask PostgREST for the affected-row count so a 0 can be detected.
      const headers = new Headers(init?.headers);
      const prefer = headers.get('Prefer');
      headers.set('Prefer', prefer ? `${prefer},count=exact` : 'count=exact');
      nextInit = { ...init, headers };
    }

    const response = await baseFetch(input, nextInit);
    if (!isMutation) return response;

    try {
      if (!response.ok) {
        const body = await response.clone().json().catch(() => null);
        if (isPermissionDenied(response.status, body)) notifyDenied();
      } else if (countRows && /\/0$/.test(response.headers.get('Content-Range') ?? '')) {
        notifyDenied();
      }
    } catch {
      // Feedback must never break the request itself.
    }
    return response;
  };
}
