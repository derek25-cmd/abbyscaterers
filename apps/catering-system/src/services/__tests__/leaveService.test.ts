import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockQueryResult } from './test-utils';

// The leave rules live in the database (see supabase/tests/hr_ops_rls.sql for
// the end-to-end checks). These tests pin what the service itself must do:
// send only what the database should accept from a client, and turn the
// database's refusals into errors a person can act on.

const fromMock = vi.fn();
const rpcMock = vi.fn();
const directoryMock = vi.fn();

vi.mock('@/lib/supabase-client', () => ({
  supabase: { from: (...a: any[]) => fromMock(...a), rpc: (...a: any[]) => rpcMock(...a) },
}));
vi.mock('@/services/employeeService', () => ({ getEmployeeDirectory: () => directoryMock() }));

const TYPES = [
  { id: 't-annual', name: 'Annual', days_per_year: 28, is_paid: true, tracks_balance: true, requires_attachment: false, max_carry_forward: 0, is_active: true, sort_order: 1 },
  { id: 't-unpaid', name: 'Unpaid', days_per_year: 0, is_paid: false, tracks_balance: false, requires_attachment: false, max_carry_forward: 0, is_active: true, sort_order: 6 },
];

function tables(map: Record<string, { data: any; error?: any }>) {
  const builders: Record<string, any> = {};
  fromMock.mockImplementation((table: string) => {
    const result = map[table] ?? { data: [], error: null };
    builders[table] = mockQueryResult({ data: result.data, error: result.error ?? null });
    return builders[table];
  });
  return builders;
}

beforeEach(() => {
  fromMock.mockReset();
  rpcMock.mockReset();
  directoryMock.mockReset();
  directoryMock.mockResolvedValue([{ id: 'emp-1', firstName: 'Amina', lastName: 'Juma', department: 'Kitchen' }]);
});

describe('applyForLeave', () => {
  it('sends only the fields a client may set (never days, status or approver)', async () => {
    const { applyForLeave } = await import('../leaveService');
    const b = tables({ leave_requests: { data: { id: 'r-1', status: 'pending' } } });

    await applyForLeave({
      employee_id: 'emp-1', leave_type_id: 't-annual', start_date: '2026-03-02', end_date: '2026-03-06', reason: ' family event ',
    });

    const sent = b.leave_requests.insert.mock.calls[0][0][0];
    expect(sent).toEqual({
      employee_id: 'emp-1', leave_type_id: 't-annual', start_date: '2026-03-02', end_date: '2026-03-06',
      reason: 'family event', attachment_path: null,
    });
    expect(sent).not.toHaveProperty('days');
    expect(sent).not.toHaveProperty('status');
  });

  it('refuses an end date before the start date before calling the database', async () => {
    const { applyForLeave } = await import('../leaveService');
    await expect(applyForLeave({
      employee_id: 'emp-1', leave_type_id: 't-annual', start_date: '2026-03-06', end_date: '2026-03-02',
    })).rejects.toThrow();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('shows the database message (e.g. not enough balance) as it is', async () => {
    const { applyForLeave } = await import('../leaveService');
    tables({ leave_requests: { data: null, error: { message: 'Not enough Annual leave: 2 day(s) left in 2026, but 5 requested.' } } });
    await expect(applyForLeave({
      employee_id: 'emp-1', leave_type_id: 't-annual', start_date: '2026-03-02', end_date: '2026-03-06',
    })).rejects.toThrow('Not enough Annual leave: 2 day(s) left in 2026, but 5 requested.');
  });

  it('turns a bare permission refusal into a readable message', async () => {
    const { applyForLeave } = await import('../leaveService');
    tables({ leave_requests: { data: null, error: { code: '42501', message: 'new row violates row-level security policy' } } });
    await expect(applyForLeave({
      employee_id: 'emp-1', leave_type_id: 't-annual', start_date: '2026-03-02', end_date: '2026-03-06',
    })).rejects.toThrow('You do not have permission to do that.');
  });

  it('keeps the specific message when the database refuses on purpose', async () => {
    const { applyForLeave } = await import('../leaveService');
    tables({ leave_requests: { data: null, error: { code: '42501', message: 'You can only apply for leave for yourself.' } } });
    await expect(applyForLeave({
      employee_id: 'emp-2', leave_type_id: 't-annual', start_date: '2026-03-02', end_date: '2026-03-06',
    })).rejects.toThrow('You can only apply for leave for yourself.');
  });
});

describe('reviewRequest', () => {
  it('calls the review function with the decision, note and replace flag', async () => {
    const { reviewRequest } = await import('../leaveService');
    rpcMock.mockResolvedValue({ data: { id: 'r-1', status: 'approved' }, error: null });

    await reviewRequest('r-1', 'approved', ' enjoy ', true);

    expect(rpcMock).toHaveBeenCalledWith('review_leave_request', {
      p_id: 'r-1', p_decision: 'approved', p_note: 'enjoy', p_replace_absent: true,
    });
  });

  it('reports attendance conflicts, and whether they can be replaced', async () => {
    const { reviewRequest, LeaveConflictError } = await import('../leaveService');
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message: 'Attendance is already recorded on 2 of these days, so the leave cannot be approved yet.',
        details: JSON.stringify([{ date: '2026-03-02', status: 'Absent' }, { date: '2026-03-03', status: 'Absent' }]),
        hint: 'ONLY_ABSENT',
      },
    });

    const err: any = await reviewRequest('r-1', 'approved').catch((e) => e);
    expect(err).toBeInstanceOf(LeaveConflictError);
    expect(err.onlyAbsent).toBe(true);
    expect(err.conflicts).toEqual([{ date: '2026-03-02', status: 'Absent' }, { date: '2026-03-03', status: 'Absent' }]);
  });

  it('marks conflicts that must be corrected by HR first', async () => {
    const { reviewRequest } = await import('../leaveService');
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Attendance is already recorded', details: JSON.stringify([{ date: '2026-03-02', status: 'Present' }]), hint: 'MUST_CORRECT' },
    });
    const err: any = await reviewRequest('r-1', 'approved').catch((e) => e);
    expect(err.onlyAbsent).toBe(false);
  });

  it('passes through the self-approval refusal', async () => {
    const { reviewRequest } = await import('../leaveService');
    rpcMock.mockResolvedValue({ data: null, error: { message: 'You cannot approve or reject your own leave. Another Admin, HR Manager or General Manager must do it.' } });
    await expect(reviewRequest('r-1', 'approved')).rejects.toThrow(/cannot approve or reject your own leave/);
  });
});

describe('cancelRequest', () => {
  it('calls the cancel function', async () => {
    const { cancelRequest } = await import('../leaveService');
    rpcMock.mockResolvedValue({ data: { id: 'r-1', status: 'cancelled' }, error: null });
    await cancelRequest('r-1', 'plans changed');
    expect(rpcMock).toHaveBeenCalledWith('cancel_leave_request', { p_id: 'r-1', p_note: 'plans changed' });
  });
});

describe('getEmployeeBalances', () => {
  it('shows the full entitlement for a type with no balance row yet, and skips unpaid leave', async () => {
    const { getEmployeeBalances } = await import('../leaveService');
    tables({ leave_types: { data: TYPES }, leave_balances: { data: [] } });

    const result = await getEmployeeBalances('emp-1', 2026);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ entitled: 28, taken: 0, remaining: 28 });
  });

  it('uses the stored row when there is one', async () => {
    const { getEmployeeBalances } = await import('../leaveService');
    tables({
      leave_types: { data: TYPES },
      leave_balances: { data: [{ id: 'b-1', employee_id: 'emp-1', leave_type_id: 't-annual', year: 2026, entitled: 28, carried_forward: 2, taken: 10 }] },
    });
    const result = await getEmployeeBalances('emp-1', 2026);
    expect(result[0].remaining).toBe(20);
  });
});

describe('getUnpaidLeaveReport', () => {
  it('counts only the working days of unpaid leave that fall inside the period', async () => {
    const { getUnpaidLeaveReport } = await import('../leaveService');
    tables({
      leave_types: { data: TYPES },
      leave_settings: { data: { working_days: [1, 2, 3, 4, 5, 6] } },
      public_holidays: { data: [] },
      // Mon 23 Feb - Sat 7 Mar; the period is March, so only Mon 2 - Sat 7 Mar counts = 6 days.
      leave_requests: { data: [{ id: 'r-1', employee_id: 'emp-1', leave_type_id: 't-unpaid', start_date: '2026-02-23', end_date: '2026-03-07', status: 'approved' }] },
    });

    const report = await getUnpaidLeaveReport('2026-03-01', '2026-03-31');

    expect(report).toHaveLength(1);
    expect(report[0]).toMatchObject({ employee_name: 'Amina Juma', days: 6 });
    expect(report[0].requests[0].days_in_period).toBe(6);
  });

  it('is empty when no leave type is unpaid', async () => {
    const { getUnpaidLeaveReport } = await import('../leaveService');
    tables({ leave_types: { data: [TYPES[0]] }, leave_settings: { data: null }, public_holidays: { data: [] } });
    expect(await getUnpaidLeaveReport('2026-03-01', '2026-03-31')).toEqual([]);
  });
});
