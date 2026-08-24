-- Order confirmation workflow: orders can be created as "Pending
-- Confirmation" or "Confirmed" (from both the Single Orders form and the
-- Proforma Wizard's order-persisting flow), and a client-side reminder
-- (mounted in main-layout.tsx) nags every 10 minutes from 5:00pm EAT
-- onward about any of tomorrow's orders still pending confirmation.
--
-- DEFAULT 'confirmed' is deliberate: every pre-existing row (and any
-- other, unmodified insert path this change didn't touch) reads as
-- already-confirmed, so nothing already in the system starts looking
-- unconfirmed. The two creation flows that actually get a status picker
-- (order-form.tsx, proforma-invoice-form.tsx's persistDraftOrders) always
-- set it explicitly to whatever staff chose, rather than relying on this
-- default.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS status TEXT
  CHECK (status IN ('pending_confirmation', 'confirmed', 'cancelled'))
  DEFAULT 'confirmed';

CREATE INDEX IF NOT EXISTS idx_orders_status_start_date ON public.orders (status, start_date);
