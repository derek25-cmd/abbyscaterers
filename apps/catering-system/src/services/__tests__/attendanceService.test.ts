import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockQueryResult } from './test-utils';

const fromMock = vi.fn();

vi.mock('@/lib/supabase-client', () => ({
  supabase: { from: (...args: any[]) => fromMock(...args) },
}));

describe('attendanceService.getAttendanceRecords', () => {
  beforeEach(() => fromMock.mockReset());

  it('scopes the query to the given date range via gte/lte', async () => {
    const { getAttendanceRecords } = await import('../attendanceService');

    const gteSpy = vi.fn();
    const lteSpy = vi.fn();
    fromMock.mockImplementation(() => {
      const builder = mockQueryResult({ data: [], error: null });
      builder.gte = gteSpy.mockImplementation(() => builder);
      builder.lte = lteSpy.mockImplementation(() => builder);
      return builder;
    });

    await getAttendanceRecords({ startDate: '2026-01-01', endDate: '2026-01-31' });

    expect(gteSpy).toHaveBeenCalledWith('date', '2026-01-01');
    expect(lteSpy).toHaveBeenCalledWith('date', '2026-01-31');
  });

  it('pages through results instead of silently truncating at 1000 rows', async () => {
    const { getAttendanceRecords } = await import('../attendanceService');

    const page1 = Array.from({ length: 1000 }, (_, i) => ({ id: `a-${i}`, employee_id: 'e1', date: '2026-01-01', status: 'Present' }));
    const page2 = [{ id: 'a-1000', employee_id: 'e1', date: '2026-01-02', status: 'Present' }];

    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      return mockQueryResult({ data: call === 1 ? page1 : page2, error: null });
    });

    const result = await getAttendanceRecords();

    expect(call).toBe(2); // had to page a second time to get the remainder
    expect(result).toHaveLength(1001);
  });

  it('returns whatever was fetched so far (not empty) if a later page errors', async () => {
    const { getAttendanceRecords } = await import('../attendanceService');

    const page1 = Array.from({ length: 1000 }, (_, i) => ({ id: `a-${i}`, employee_id: 'e1', date: '2026-01-01', status: 'Present' }));

    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) return mockQueryResult({ data: page1, error: null });
      return mockQueryResult({ data: null, error: { message: 'network error' } });
    });

    const result = await getAttendanceRecords();
    expect(result).toHaveLength(1000);
  });
});

describe('attendanceService.upsertAttendanceRecords', () => {
  beforeEach(() => fromMock.mockReset());

  it('rejects an invalid record (missing employee_id) before touching the database', async () => {
    const { upsertAttendanceRecords } = await import('../attendanceService');

    await expect(upsertAttendanceRecords([
      { employee: 'Jane Doe', date: '2026-01-01', status: 'Present' } as any,
    ])).rejects.toThrow();

    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects clock_out_time before clock_in_time', async () => {
    const { upsertAttendanceRecords } = await import('../attendanceService');

    await expect(upsertAttendanceRecords([
      {
        employee_id: 'e1', employee: 'Jane Doe', date: '2026-01-01', status: 'Present',
        clock_in_time: '17:00', clock_out_time: '08:00',
      } as any,
    ])).rejects.toThrow();

    expect(fromMock).not.toHaveBeenCalled();
  });

  it('omits clock_in_time/clock_out_time/notes from the payload when not provided, instead of nulling them out', async () => {
    const { upsertAttendanceRecords } = await import('../attendanceService');

    let insertedPayload: any = null;
    fromMock.mockImplementation(() => {
      const builder = mockQueryResult({ data: [{ id: 'a-1' }], error: null });
      builder.upsert = vi.fn((rows: any[]) => { insertedPayload = rows[0]; return builder; });
      return builder;
    });

    await upsertAttendanceRecords([
      { employee_id: 'e1', employee: 'Jane Doe', date: '2026-01-01', status: 'Present' },
    ]);

    expect('clock_in_time' in insertedPayload).toBe(false);
    expect('clock_out_time' in insertedPayload).toBe(false);
  });

  it('surfaces the real error message on failure instead of swallowing it', async () => {
    const { upsertAttendanceRecords } = await import('../attendanceService');

    fromMock.mockImplementation(() => mockQueryResult({ data: null, error: { message: 'duplicate key value violates unique constraint' } }));

    const result = await upsertAttendanceRecords([
      { employee_id: 'e1', employee: 'Jane Doe', date: '2026-01-01', status: 'Present' },
    ]);

    expect(result.data).toBeNull();
    expect(result.error).toBe('duplicate key value violates unique constraint');
  });
});

describe('attendanceService.checkForConflicts', () => {
  beforeEach(() => fromMock.mockReset());

  it('flags a cell whose current updatedAt differs from what was known when editing began', async () => {
    const { checkForConflicts } = await import('../attendanceService');

    fromMock.mockImplementation(() => mockQueryResult({
      data: [
        { employee_id: 'e1', date: '2026-01-01', updatedAt: '2026-01-02T00:00:00.000Z' }, // changed since
        { employee_id: 'e2', date: '2026-01-01', updatedAt: '2026-01-01T00:00:00.000Z' }, // unchanged
      ],
      error: null,
    }));

    const conflicts = await checkForConflicts([
      { employee_id: 'e1', date: '2026-01-01', knownUpdatedAt: '2026-01-01T00:00:00.000Z' },
      { employee_id: 'e2', date: '2026-01-01', knownUpdatedAt: '2026-01-01T00:00:00.000Z' },
    ]);

    expect(conflicts).toEqual([{ employee_id: 'e1', date: '2026-01-01' }]);
  });

  it('returns no conflicts (fails open) if the check query itself errors', async () => {
    const { checkForConflicts } = await import('../attendanceService');

    fromMock.mockImplementation(() => mockQueryResult({ data: null, error: { message: 'network error' } }));

    const conflicts = await checkForConflicts([
      { employee_id: 'e1', date: '2026-01-01', knownUpdatedAt: '2026-01-01T00:00:00.000Z' },
    ]);

    expect(conflicts).toEqual([]);
  });

  it('returns no conflicts for an empty cell list without querying', async () => {
    const { checkForConflicts } = await import('../attendanceService');
    const conflicts = await checkForConflicts([]);
    expect(conflicts).toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });
});
