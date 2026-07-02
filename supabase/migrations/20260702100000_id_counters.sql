-- Monotonically-increasing counters for every application-level ID.
--
-- The fundamental invariant: the counter value is always ≥ the highest number
-- ever issued, regardless of whether those rows were later deleted.  This
-- prevents ID reuse after deletion and eliminates the race-condition in the
-- old "scan existing rows for MAX, add 1" approach.
--
-- Security model:
--   • Direct DML on id_counters is blocked for all client roles (RLS, no
--     permissive policy).
--   • claim_ids() is SECURITY DEFINER so only this function can touch the
--     table; it runs as the function owner (postgres) and bypasses RLS.
--   • EXECUTE is granted to authenticated + anon so the Supabase JS/Flutter
--     clients can call it.

CREATE TABLE IF NOT EXISTS public.id_counters (
  name  TEXT   PRIMARY KEY,
  value BIGINT NOT NULL DEFAULT 0
);

ALTER TABLE public.id_counters ENABLE ROW LEVEL SECURITY;
-- No permissive policies → all direct DML is blocked for client roles.

-- ─── Core function ────────────────────────────────────────────────────────────
-- Atomically reserves `count` consecutive IDs and returns the FIRST one.
-- Example: current value is 1513, claim_ids('event_id', 3) → returns 1514
--          and counter becomes 1516.  Caller uses 1514, 1515, 1516.
--
-- Uses PL/pgSQL instead of LANGUAGE SQL because EXCLUDED is only in scope
-- inside the SET clause of ON CONFLICT DO UPDATE — it cannot be referenced
-- in the RETURNING clause of a plain SQL function.  Capturing the new value
-- into a variable and computing the range start separately avoids this.
CREATE OR REPLACE FUNCTION public.claim_ids(counter_name TEXT, count INTEGER DEFAULT 1)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_value BIGINT;
BEGIN
  INSERT INTO id_counters (name, value)
    VALUES (counter_name, count)
  ON CONFLICT (name) DO UPDATE
    SET value = id_counters.value + EXCLUDED.value
  RETURNING value INTO new_value;

  -- new_value is the counter AFTER the increment.
  -- The first ID in the claimed range is (new_value - count + 1).
  RETURN new_value - count + 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_ids(TEXT, INTEGER) TO authenticated, anon;

-- ─── Seed from current maximums ───────────────────────────────────────────────
-- Ensures the very first call to claim_ids() produces a number strictly
-- greater than every ID that already exists in the database.

-- Order IDs: ORD-NNNNN  (exactly 5-digit suffix)
INSERT INTO id_counters (name, value)
SELECT 'order_id', COALESCE(
  MAX((regexp_match(id, 'ORD-(\d{5})$'))[1]::BIGINT), 0
)
FROM orders
WHERE id ~ '^ORD-\d{5}$'
ON CONFLICT (name) DO UPDATE
  SET value = GREATEST(id_counters.value, EXCLUDED.value);

-- Event IDs: EVT-NNNNN  (stored in JSONB "clientEvents" array inside orders)
INSERT INTO id_counters (name, value)
WITH evt_nums AS (
  SELECT ((regexp_match(ev->>'id', 'EVT-(\d+)$'))[1])::BIGINT AS n
  FROM   orders
  JOIN   LATERAL jsonb_array_elements(
           CASE WHEN "clientEvents" IS NULL THEN '[]'::jsonb
                WHEN jsonb_typeof("clientEvents") = 'array' THEN "clientEvents"
                ELSE '[]'::jsonb
           END
         ) ev ON TRUE
  WHERE  (ev->>'id') ~ '^EVT-\d+$'
)
SELECT 'event_id', COALESCE(MAX(n), 0) FROM evt_nums
ON CONFLICT (name) DO UPDATE
  SET value = GREATEST(id_counters.value, EXCLUDED.value);

-- Invoice IDs: plain 7-digit numbers
INSERT INTO id_counters (name, value)
SELECT 'invoice_id', COALESCE(MAX(id::BIGINT), 0)
FROM   invoices
WHERE  id ~ '^\d+$'
ON CONFLICT (name) DO UPDATE
  SET value = GREATEST(id_counters.value, EXCLUDED.value);

-- Proforma invoice IDs: plain 7-digit numbers
INSERT INTO id_counters (name, value)
SELECT 'proforma_id', COALESCE(MAX(id::BIGINT), 0)
FROM   proforma_invoices
WHERE  id ~ '^\d+$'
ON CONFLICT (name) DO UPDATE
  SET value = GREATEST(id_counters.value, EXCLUDED.value);

-- Delivery note IDs: plain integers
INSERT INTO id_counters (name, value)
SELECT 'delivery_note_id', COALESCE(MAX(id::BIGINT), 0)
FROM   delivery_notes
WHERE  id ~ '^\d+$'
ON CONFLICT (name) DO UPDATE
  SET value = GREATEST(id_counters.value, EXCLUDED.value);
