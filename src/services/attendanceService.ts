import { supabase } from '@/lib/supabase-client';
import { Attendance } from '@/types';
import { AttendanceSchema } from '@/lib/schemas';
import { validate } from '@/lib/service-validation';

export interface DateRange {
    startDate: string;
    endDate: string;
}

/**
 * Date-range-scoped fetch — the grid/report only ever need one visible
 * month, so bound the query instead of pulling the whole table. This is the
 * actual fix for PostgREST's 1000-row default cap: an unbounded full-table
 * fetch would silently truncate once the registry outgrows one page, with
 * no error, just missing rows. The .range() loop below is a defensive
 * backstop in case a single date range itself exceeds 1000 rows (very large
 * roster), matching the pattern already used in employeeService.ts /
 * payrollService.ts.
 */
export const getAttendanceRecords = async (range?: DateRange): Promise<Attendance[]> => {
    const PAGE = 1000;
    const all: Attendance[] = [];
    let page = 0;
    while (true) {
        let query = supabase.from('attendance').select('*').order('date', { ascending: false });
        if (range) {
            query = query.gte('date', range.startDate).lte('date', range.endDate);
        }
        const { data, error } = await query.range(page * PAGE, (page + 1) * PAGE - 1);
        if (error) {
            console.error('Error fetching attendance records:', error);
            return all;
        }
        if (!data || data.length === 0) break;
        all.push(...(data as Attendance[]));
        if (data.length < PAGE) break;
        page++;
    }
    return all;
};

export const getAttendanceByDate = async (date: string): Promise<Attendance[]> => {
    const { data, error } = await supabase.from('attendance').select('*').eq('date', date);
    if (error) {
        console.error('Error fetching attendance by date:', error);
        return [];
    }
    return data as Attendance[];
};

export const findAttendanceRecord = async (employeeId: string, date: string): Promise<Attendance | null> => {
    const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('date', date)
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116: no rows found
        console.error('Error finding attendance record:', error);
    }
    return data as Attendance | null;
};

export interface UpsertResult {
    data: Attendance[] | null;
    error: string | null;
}

export const upsertAttendanceRecord = async (record: Partial<Attendance>): Promise<UpsertResult> => {
    return upsertAttendanceRecords([record]);
};

/**
 * Validates every record before writing (previously unvalidated) and
 * surfaces the real Postgres/PostgREST error message on failure instead of
 * only console.error-ing it — callers need the message to show a toast
 * explaining *why* a save failed, matching the honesty fix already applied
 * to payrollService.updatePayroll this session.
 */
export const upsertAttendanceRecords = async (records: Partial<Attendance>[]): Promise<UpsertResult> => {
    const validated = records.map(r => validate(AttendanceSchema, r));

    // clock_in_time/clock_out_time/notes are only included in the payload
    // when the caller actually provided them. A quick grid status-cycle
    // save omits them entirely (undefined) — including them as `null` in
    // that case would silently wipe out clock-in/out data previously
    // captured via the detail dialog on every unrelated status change.
    const payload = validated.map(r => {
        const row: Record<string, unknown> = {
            employee_id: r.employee_id,
            employee: r.employee,
            date: r.date,
            status: r.status,
            updatedAt: new Date().toISOString(),
        };
        if (r.clock_in_time !== undefined) row.clock_in_time = r.clock_in_time || null;
        if (r.clock_out_time !== undefined) row.clock_out_time = r.clock_out_time || null;
        if (r.notes !== undefined) row.notes = r.notes || null;
        return row;
    });

    const { data, error } = await supabase
        .from('attendance')
        .upsert(payload, {
            onConflict: 'employee_id,date'
        })
        .select();

    if (error) {
        console.error('Error upserting attendance records:', error);
        return { data: null, error: error.message };
    }
    return { data: data as Attendance[], error: null };
};

export const deleteAttendanceRecord = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('attendance').delete().eq('id', id);
    if (error) {
        console.error('Error deleting attendance record:', error);
    }
    return !error;
};

export interface ConflictCell {
    employee_id: string;
    date: string;
}

/**
 * Optimistic-concurrency pre-check: before saving a batch of pending grid
 * edits, re-fetch just the affected employee/date cells and compare their
 * current updatedAt against what was on screen when editing began. Full
 * per-row versioning would be overkill for a grid editor — this pre-save
 * diff is the pragmatic way to stop two admins from silently clobbering
 * each other's edits to the same employee/day.
 */
export const checkForConflicts = async (
    cells: { employee_id: string; date: string; knownUpdatedAt: string }[]
): Promise<ConflictCell[]> => {
    if (cells.length === 0) return [];

    const employeeIds = Array.from(new Set(cells.map(c => c.employee_id)));
    const dates = cells.map(c => c.date);
    const minDate = dates.reduce((a, b) => (a < b ? a : b));
    const maxDate = dates.reduce((a, b) => (a > b ? a : b));

    const { data, error } = await supabase
        .from('attendance')
        .select('employee_id, date, updatedAt')
        .in('employee_id', employeeIds)
        .gte('date', minDate)
        .lte('date', maxDate);

    if (error) {
        // Fail open — a conflict-check failure shouldn't itself block a save
        // the user explicitly asked to make.
        console.error('Error checking attendance conflicts:', error);
        return [];
    }

    const known = new Map(cells.map(c => [`${c.employee_id}:${c.date}`, c.knownUpdatedAt]));
    return (data || [])
        .filter((row: any) => {
            const key = `${row.employee_id}:${row.date}`;
            const knownUpdatedAt = known.get(key);
            return knownUpdatedAt !== undefined && row.updatedAt !== knownUpdatedAt;
        })
        .map((row: any) => ({ employee_id: row.employee_id, date: row.date }));
};
