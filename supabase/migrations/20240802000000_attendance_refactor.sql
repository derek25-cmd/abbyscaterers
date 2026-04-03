-- Up Migration for Attendance Refactoring

-- Add robust structured types and make legacy ones nullable
ALTER TABLE IF EXISTS public.attendance
ADD COLUMN IF NOT EXISTS employee_id TEXT REFERENCES public.employees(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS clock_in_time TIME WITHOUT TIME ZONE,
ADD COLUMN IF NOT EXISTS clock_out_time TIME WITHOUT TIME ZONE,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Present' CHECK (status IN ('Present', 'Absent', 'Leave', 'Half Day', 'Late')),
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Make legacy columns nullable to allow new registry logic to work without them
ALTER TABLE public.attendance 
ALTER COLUMN "clockIn" DROP NOT NULL,
ALTER COLUMN "clockOut" DROP NOT NULL,
ALTER COLUMN "totalHours" DROP NOT NULL;

-- Add unique constraint for upsert (onConflict) support
ALTER TABLE public.attendance
ADD CONSTRAINT attendance_employee_id_date_key UNIQUE (employee_id, date);

-- Data migration: mapping employee names to employee_id
UPDATE public.attendance a
SET employee_id = e.id
FROM public.employees e
WHERE a.employee_id IS NULL 
  AND a.employee = (e."firstName" || ' ' || COALESCE(e."middleName" || ' ', '') || e."lastName");

-- Convert existing string times to TIME type where possible
UPDATE public.attendance
SET clock_in_time = (CASE WHEN "clockIn" ~ '^[0-1]?[0-9]:[0-5][0-9] [AP]M$' THEN "clockIn"::time ELSE NULL END),
    clock_out_time = (CASE WHEN "clockOut" ~ '^[0-1]?[0-9]:[0-5][0-9] [AP]M$' THEN "clockOut"::time ELSE NULL END)
WHERE clock_in_time IS NULL OR clock_out_time IS NULL;
