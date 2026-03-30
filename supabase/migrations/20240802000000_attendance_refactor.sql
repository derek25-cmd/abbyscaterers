-- Up Migration for Attendance Refactoring

-- Add robust structured types
ALTER TABLE IF EXISTS public.attendance
ADD COLUMN IF NOT EXISTS employee_id TEXT REFERENCES public.employees(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS clock_in_time TIME WITHOUT TIME ZONE,
ADD COLUMN IF NOT EXISTS clock_out_time TIME WITHOUT TIME ZONE,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Present' CHECK (status IN ('Present', 'Absent', 'Leave', 'Half Day', 'Late')),
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Data migration: mapping employee names to employee_id
UPDATE public.attendance a
SET employee_id = e.id
FROM public.employees e
WHERE a.employee_id IS NULL 
  AND a.employee = (e."firstName" || ' ' || COALESCE(e."middleName" || ' ', '') || e."lastName");

-- Convert existing string times to TIME type where possible
UPDATE public.attendance
SET clock_in_time = "clockIn"::time
WHERE "clockIn" IS NOT NULL AND "clockIn" != '—' AND clock_in_time IS NULL
  AND "clockIn" ~ '^[0-1]?[0-9]:[0-5][0-9] [AP]M$';

UPDATE public.attendance
SET clock_out_time = "clockOut"::time
WHERE "clockOut" IS NOT NULL AND "clockOut" != '—' AND clock_out_time IS NULL
  AND "clockOut" ~ '^[0-1]?[0-9]:[0-5][0-9] [AP]M$';
