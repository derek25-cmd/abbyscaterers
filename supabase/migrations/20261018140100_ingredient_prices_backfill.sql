-- Data readiness Phase 3, Step 6: load price history into ingredient_prices.
--
-- 1. Every past Stock In with a price (source 'backfill', source_ref = the
--    stock log id), dated by the stock log.
-- 2. Today's catalog price per branch from products."unitPrice_dar" /
--    "unitPrice_arusha" / "unitPrice_dodoma" where > 0 (source 'manual',
--    source_ref = 'seed:<product id>:<branch>'), dated today (Dar es Salaam).
-- Unit = coalesce(base_unit, unit). Stock logs whose product is no longer in
-- the catalog are skipped.
--
-- Idempotent: the unique (source, source_ref) index makes a re-run insert
-- nothing. Stock In prices are copied as entered; pack-size prices (e.g. a
-- 20 L tin logged against a per-litre product) are not corrected here.
--
-- Rollback: DELETE FROM public.ingredient_prices WHERE source IN ('backfill', 'manual');

INSERT INTO public.ingredient_prices (product_id, branch, unit, unit_price, valid_from, source, source_ref)
SELECT p.id, s.branch, coalesce(nullif(trim(p.base_unit), ''), nullif(trim(p.unit), '')),
       s.actual_unit_price,
       coalesce(s.date, (s."createdAt" AT TIME ZONE 'Africa/Dar_es_Salaam')::date),
       'backfill', s.id
FROM public.stock_logs s
JOIN public.products p ON p.id = s."productId"
WHERE s.type = 'Stock In'
  AND s.actual_unit_price > 0
  AND s.branch IN ('Dar es Salaam', 'Arusha', 'Dodoma')
  AND coalesce(s.date, s."createdAt") IS NOT NULL
  AND coalesce(nullif(trim(p.base_unit), ''), nullif(trim(p.unit), '')) IS NOT NULL
ON CONFLICT (source, source_ref) WHERE source_ref IS NOT NULL DO NOTHING;

INSERT INTO public.ingredient_prices (product_id, branch, unit, unit_price, valid_from, source, source_ref)
SELECT p.id, b.branch, coalesce(nullif(trim(p.base_unit), ''), nullif(trim(p.unit), '')),
       b.price, (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date,
       'manual', 'seed:' || p.id || ':' || b.branch
FROM public.products p
CROSS JOIN LATERAL (VALUES
  ('Dar es Salaam', p."unitPrice_dar"),
  ('Arusha',        p."unitPrice_arusha"),
  ('Dodoma',        p."unitPrice_dodoma")
) AS b(branch, price)
WHERE b.price > 0
  AND coalesce(nullif(trim(p.base_unit), ''), nullif(trim(p.unit), '')) IS NOT NULL
ON CONFLICT (source, source_ref) WHERE source_ref IS NOT NULL DO NOTHING;
