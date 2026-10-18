-- Data readiness Phase 3, Step 7: mark test / demo orders so analytics and
-- the data-quality checks can leave them out.
--
-- Nothing is flagged here. The candidate list is in
-- docs/data-readiness/04-test-orders.md, for the owner to confirm; orders are
-- then flagged one by one in the order screen ("Exclude from analytics").
--
-- Rollback: ALTER TABLE public.orders DROP COLUMN IF EXISTS is_test;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
