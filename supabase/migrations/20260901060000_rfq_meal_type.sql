-- Adds "Type of Meal" to the RFQ form, mirroring the pax-per-day pattern
-- (20260901050000) exactly: a per-day value with an independent "same for
-- all dates" toggle, since pax and meal type don't necessarily vary
-- together (same pax every day but a different menu, or vice versa).

ALTER TABLE public.rfqs
  ADD COLUMN IF NOT EXISTS same_meal_type_all_dates BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS meal_type_per_day JSONB; -- [{ date: 'YYYY-MM-DD', mealType: string }, ...]
