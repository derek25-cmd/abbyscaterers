-- A confirmed order whose service period has already ended isn't
-- meaningfully "Confirmed" anymore — it happened. Adds a 'completed'
-- status, backfills every already-past confirmed order (this is what
-- makes existing orders show "Completed" immediately), and adds an RPC
-- for ongoing maintenance going forward.
--
-- No pg_cron in this project, so there's no true midnight-exact
-- scheduled trigger — complete_past_orders() is called opportunistically
-- from the client (apps/catering-system/src/components/orders/
-- complete-past-orders-sweep.tsx, mounted once in main-layout) whenever
-- someone has the app open, which self-heals within normal usage but
-- isn't instant at the stroke of midnight.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending_confirmation', 'confirmed', 'completed', 'cancelled'));

-- Backfill: every existing confirmed order whose period has already
-- ended is retroactively "Completed" as of this migration.
UPDATE public.orders
SET status = 'completed', "updatedAt" = now()
WHERE status = 'confirmed' AND end_date::date < CURRENT_DATE;

CREATE OR REPLACE FUNCTION public.complete_past_orders()
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.orders
  SET status = 'completed', "updatedAt" = now()
  WHERE status = 'confirmed' AND end_date::date < CURRENT_DATE;
$$;

GRANT EXECUTE ON FUNCTION public.complete_past_orders() TO authenticated;
