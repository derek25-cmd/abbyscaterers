-- ============================================================================
-- 03_phase2_checks.sql: Phase 2 baseline checks 3a-3c (read-only)
-- ============================================================================
--
-- READ-ONLY: three SELECTs. Run against STAGING with psql:
--   psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/audit/03_phase2_checks.sql
-- or one at a time in a SQL Editor. Run before the Phase 2 migrations and
-- again after them; columns the migrations add (ingredients.product_id,
-- products.base_unit) are read through to_jsonb(), so the same file works on
-- both sides. Output is product / ingredient names and SKUs only.
--
-- Unit families: kg, gms, g, grams -> kg | ml, l, liters -> liters |
--                item, pcs -> pcs | bunch -> bunch | anything else -> unknown
-- ============================================================================


-- 3a  Duplicate product names (lower/trim), with their SKUs and ids.
--     Duplicates are never auto-linked to ingredients.
SELECT
  lower(trim(p.name))          AS name_key,
  count(*)                     AS products,
  array_agg(p.sku ORDER BY p.sku) AS skus,
  array_agg(p.id ORDER BY p.id)   AS product_ids
FROM public.products p
WHERE p.name IS NOT NULL AND trim(p.name) <> ''
GROUP BY lower(trim(p.name))
HAVING count(*) > 1
ORDER BY products DESC, name_key;


-- 3b  Ingredients with no exact (lower/trim) product name match, and
--     whether they are linked by product_id (after the migration).
SELECT
  count(*)                                                        AS ingredients,
  count(*) FILTER (WHERE m.matches = 0)                           AS no_name_match,
  count(*) FILTER (WHERE m.matches = 1)                           AS unique_name_match,
  count(*) FILTER (WHERE m.matches > 1)                           AS ambiguous_name_match,
  count(*) FILTER (WHERE to_jsonb(i) ->> 'product_id' IS NOT NULL) AS linked_by_product_id,
  count(*) FILTER (WHERE to_jsonb(i) ->> 'product_id' IS NULL)     AS not_linked
FROM public.ingredients i
CROSS JOIN LATERAL (
  SELECT count(*) AS matches
  FROM public.products p
  WHERE lower(trim(p.name)) = lower(trim(i."itemDescription"))
) m;


-- 3c  Recipe lines whose unit family differs from their product's unit
--     family. The product is found by product_id if linked, otherwise by a
--     unique exact name match (the migration's rule).
WITH fam(unit, family) AS (
  VALUES ('kg','kg'), ('gms','kg'), ('g','kg'), ('grams','kg'),
         ('ml','liters'), ('l','liters'), ('liters','liters'),
         ('item','pcs'), ('pcs','pcs'), ('bunch','bunch')
),
lines AS (
  SELECT
    r."recipeNumber"                               AS recipe_number,
    nullif(trim(x ->> 'ingredientId'), '')         AS ingredient_id,
    lower(trim(x ->> 'unit'))                      AS recipe_unit
  FROM public.recipes r
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(r.ingredients) = 'array' THEN r.ingredients ELSE '[]'::jsonb END
  ) AS x
  WHERE jsonb_typeof(x) = 'object'
),
unique_names AS (
  SELECT lower(trim(name)) AS name_key, min(id) AS product_id
  FROM public.products
  WHERE name IS NOT NULL
  GROUP BY lower(trim(name))
  HAVING count(*) = 1
),
resolved AS (
  SELECT
    l.*,
    i."itemDescription"                                             AS ingredient_name,
    to_jsonb(i) ->> 'grams_per_item'                                AS grams_per_item,
    coalesce(to_jsonb(i) ->> 'product_id', u.product_id)            AS product_id
  FROM lines l
  LEFT JOIN public.ingredients i ON i."itemNumber" = l.ingredient_id
  LEFT JOIN unique_names u ON u.name_key = lower(trim(i."itemDescription"))
)
SELECT
  count(*)                                                          AS recipe_lines,
  count(*) FILTER (WHERE res.product_id IS NULL)                    AS no_product,
  count(*) FILTER (WHERE rf.family IS NULL)                         AS recipe_unit_unknown,
  count(*) FILTER (WHERE pf.family IS NULL AND res.product_id IS NOT NULL) AS product_unit_unknown,
  count(*) FILTER (WHERE rf.family <> pf.family)                    AS family_mismatch,
  count(*) FILTER (WHERE rf.family <> pf.family AND res.grams_per_item IS NULL) AS mismatch_without_grams_per_item
FROM resolved res
LEFT JOIN public.products p ON p.id = res.product_id
LEFT JOIN fam rf ON rf.unit = res.recipe_unit
LEFT JOIN fam pf ON pf.unit = lower(trim(coalesce(to_jsonb(p) ->> 'base_unit', p.unit)));
