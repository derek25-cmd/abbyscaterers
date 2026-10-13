'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_WORKING_WEEK } from '@/lib/leave';
import { getLeaveSettings, getLeaveTypes, getPublicHolidays } from '@/services/leaveService';
import type { LeaveType, PublicHoliday } from '@/types';

/**
 * The slow-changing data every leave screen needs: leave types, public
 * holidays and the working week. Loaded once per screen, with reload() for
 * after HR edits them.
 */
export function useLeaveReference() {
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [workingWeek, setWorkingWeek] = useState<number[]>([...DEFAULT_WORKING_WEEK]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [t, h, s] = await Promise.all([getLeaveTypes(true), getPublicHolidays(), getLeaveSettings()]);
      setTypes(t);
      setHolidays(h);
      setWorkingWeek(s.working_days);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the leave settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const activeTypes = useMemo(() => types.filter((t) => t.is_active), [types]);
  const holidayDates = useMemo(() => holidays.map((h) => h.holiday_date), [holidays]);

  return { types, activeTypes, holidays, holidayDates, workingWeek, loading, error, reload };
}
