-- Fix: "Delete all products" failed in the app with "DELETE requires a WHERE
-- clause".
--
-- Requests from the app (PostgREST) run with Supabase's pg-safeupdate guard,
-- which refuses an UPDATE or DELETE without a WHERE clause, also inside a
-- function. delete_all_products() (20261028000000) deleted with a bare
-- DELETE FROM public.products, so it worked from the SQL editor (no guard) but
-- not from the app. Same function, with a WHERE that every product matches.

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

  -- The WHERE is required: calls from the app run with Supabase's safeupdate
  -- guard, which refuses a DELETE without one. Every product matches it
  -- (id is the primary key, never NULL).
  DELETE FROM public.products WHERE id IS NOT NULL;   -- each row is recorded by audit_row_change
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
