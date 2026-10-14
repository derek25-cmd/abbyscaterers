import * as Sentry from '@sentry/nextjs';
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

// ── Reporting to Sentry (Phase 5: the first weeks after go-live) ────────────
// Each refusal is reported with WHO (the role), WHAT (table or RPC, and the
// HTTP method) and WHERE (the page path). Never the record contents: no
// request body, no query string (it holds ids and filter values), no response.

let reportingRole: string | null = null;
/** Called by useStaffRole once the signed-in user's role is known. */
export function setReportingRole(role: string | null) { reportingRole = role; }

export type DeniedKind = 'refused' | 'no_rows_changed';

/** "employees", "rpc:approve_hr_document"; never ids or filter values. */
export function targetOf(url: string): string {
  const m = url.match(/\/rest\/v1\/(rpc\/)?([a-z0-9_]+)/i);
  if (!m) return 'unknown';
  return m[1] ? `rpc:${m[2]}` : m[2];
}

export interface DeniedReport { role: string; target: string; method: string; kind: DeniedKind; page: string; status: number; code: string }

export function buildDeniedReport(url: string, method: string, kind: DeniedKind, status: number, code?: string): DeniedReport {
  return {
    role: reportingRole ?? 'unknown',
    target: targetOf(url),
    method,
    kind,
    page: typeof window !== 'undefined' && window.location ? window.location.pathname : '',
    status,
    code: code ?? '',
  };
}

const lastReported = new Map<string, number>();
function reportDenied(r: DeniedReport) {
  const key = `${r.role}|${r.target}|${r.method}|${r.kind}`;
  const now = Date.now();
  if (now - (lastReported.get(key) ?? 0) < 60_000) return; // once a minute per kind of refusal
  lastReported.set(key, now);
  try {
    Sentry.captureMessage(`Permission denied: ${r.method} ${r.target}`, {
      level: 'warning',
      tags: { kind: 'permission_denied', role: r.role, target: r.target, method: r.method, denied: r.kind },
      extra: { page: r.page, status: r.status, code: r.code },
      fingerprint: ['permission-denied', r.role, r.target, r.method, r.kind],
    });
  } catch {
    // Monitoring must never break the request.
  }
}

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
        if (isPermissionDenied(response.status, body)) {
          notifyDenied();
          reportDenied(buildDeniedReport(url, method, 'refused', response.status, body?.code));
        }
      } else if (countRows && /\/0$/.test(response.headers.get('Content-Range') ?? '')) {
        notifyDenied();
        reportDenied(buildDeniedReport(url, method, 'no_rows_changed', response.status));
      }
    } catch {
      // Feedback must never break the request itself.
    }
    return response;
  };
}
