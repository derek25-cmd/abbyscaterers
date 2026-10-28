-- Delete the whole Product Catalog, keeping the Stock Logs.
--
-- The Admin can remove every product in one go (Product Catalog → Delete all
-- products). What stays:
--   * stock_logs: untouched. They were never linked to products by a foreign
--     key, and each log keeps its own "productId" and "productName".
--   * ingredient_prices (dated price history, mostly copied from Stock In) and
--     purchases.product_id: their foreign keys to products are removed, so the
--     rows stay with the old product code, the same way stock logs do. Without
--     this the delete would be refused (ingredient_prices) or would have to
--     wipe the history.
--   * audit_log: every deleted product is recorded with its values by the
--     existing audit trigger, plus one products.delete_all summary event.
--
-- What stops working until products are added again (by design, the user's
-- decision of 2026-10-28): recipe lines that point at a catalog product, recipe
-- costing and Abby's AI dish costs that read catalog prices, and new Stock In
-- price capture for the old codes (capture_stock_price skips unknown products).
-- Products added later get new codes (PROD + random), so old history is not
-- linked to them automatically.
--
-- Rollback (the function only; deleted products come back from the CSV the app
-- downloads first, or from the audit log / a database backup):
--   DROP FUNCTION IF EXISTS public.delete_all_products(text);
--   The foreign keys can be re-added only once every product_id in
--   ingredient_prices and purchases exists in products again.

-- ── 1. Keep history rows when their product goes ──────────────────────────
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname, con.conrelid::regclass AS tbl
      FROM pg_constraint con
     WHERE con.contype = 'f'
       AND con.confrelid = 'public.products'::regclass
       AND con.conrelid IN (to_regclass('public.ingredient_prices'), to_regclass('public.purchases'))
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
    RAISE NOTICE 'Dropped % on % (rows keep their product code)', c.conname, c.tbl;
  END LOOP;
END $$;

-- ── 2. Delete every product ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_all_products(p_confirm text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  blocking text;
  n_logs_before bigint;
  n_logs_after bigint;
  n_deleted bigint;
BEGIN
  IF NOT public.can_manage_settings() THEN
    RAISE EXCEPTION 'Only an Admin can delete the whole Product Catalog.' USING ERRCODE = '42501';
  END IF;
  IF p_confirm IS DISTINCT FROM 'DELETE ALL PRODUCTS' THEN
    RAISE EXCEPTION 'Type DELETE ALL PRODUCTS to confirm.';
  END IF;

  -- Anything else that still requires a product would stop the delete half
  -- way; name it instead.
  SELECT string_agg(format('%s (%s)', con.conrelid::regclass, con.conname), ', ')
    INTO blocking
    FROM pg_constraint con
   WHERE con.contype = 'f' AND con.confrelid = 'public.products'::regclass;
  IF blocking IS NOT NULL THEN
    RAISE EXCEPTION 'These tables still link to products, so the catalog cannot be deleted: %.', blocking;
  END IF;

  SELECT count(*) INTO n_logs_before FROM public.stock_logs;

  DELETE FROM public.products;   -- each row is recorded by audit_row_change
  GET DIAGNOSTICS n_deleted = ROW_COUNT;

  -- The promise of this function: the Stock Logs are untouched.
  SELECT count(*) INTO n_logs_after FROM public.stock_logs;
  IF n_logs_after <> n_logs_before THEN
    RAISE EXCEPTION 'Stopped: the Stock Logs changed (% before, % after). Nothing was deleted.', n_logs_before, n_logs_after;
  END IF;

  INSERT INTO public.audit_log (actor_id, action, table_name, record_id, metadata)
  VALUES (public.safe_auth_uid(), 'products.delete_all', 'products', NULL,
          jsonb_build_object('products_deleted', n_deleted, 'stock_logs_kept', n_logs_after));

  RETURN jsonb_build_object('products_deleted', n_deleted, 'stock_logs_kept', n_logs_after);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_all_products(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_all_products(text) TO authenticated;
