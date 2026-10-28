-- Tests for delete_all_products() (20261028000000): only an Admin, only with
-- the phrase, every product removed, and the Stock Logs, price history and
-- audit trail kept.
--
-- Run on STAGING first. Same harness as the other files: ONE statement that
-- ALWAYS ends in an exception starting with PASS: or FAIL:, which rolls back
-- everything it did, including the delete itself, so the catalog is never
-- actually emptied by this test.

DO $test$
DECLARE
  people constant text[] := ARRAY['adm', 'hr', 'stf'];
  roles_ constant jsonb := '{"adm": "admin", "hr": "hr_manager", "stf": "staff"}';
  u jsonb := '{}'::jsonb;
  nm text; uid uuid; res text;
  logs_before bigint; prices_before bigint; products_before bigint;
  failures integer; checks integer;
BEGIN
  CREATE TEMP TABLE rls_results (who text, tbl text, op text, expected boolean, actual boolean) ON COMMIT DROP;

  -- ── Helpers (inside this block; rolled back with it) ─────────────────────
  EXECUTE $mk$
    CREATE FUNCTION public._dap_as(uid uuid, stmt text) RETURNS text LANGUAGE plpgsql AS $f$
    DECLARE m text; res text;
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
      PERFORM set_config('request.jwt.claim.sub', uid::text, true);
      SET LOCAL ROLE authenticated;
      BEGIN
        EXECUTE stmt;
        res := 'ok';
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS m = MESSAGE_TEXT;
        res := 'err:' || SQLSTATE || ':' || coalesce(m, '');
      END;
      RESET ROLE;
      PERFORM set_config('request.jwt.claims', '', true);
      PERFORM set_config('request.jwt.claim.sub', '', true);
      RETURN res;
    END $f$;
  $mk$;

  -- ── Fixtures ─────────────────────────────────────────────────────────────
  FOREACH nm IN ARRAY people LOOP
    uid := md5('daptest-user-' || nm)::uuid;
    u := u || jsonb_build_object(nm, uid);
    INSERT INTO auth.users (id, email, aud, role)
    VALUES (uid, nm || '@daptest.local', 'authenticated', 'authenticated') ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.staff_users (id, email, role, is_active)
    VALUES (uid, nm || '@daptest.local', roles_ ->> nm, true)
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = true;
  END LOOP;

  -- A product with a stock log (Stock Out, so no price capture runs) and a
  -- price-history row pointing at it.
  INSERT INTO public.products (id, name, unit, quantity_dar, "unitPrice_dar")
  VALUES ('PRODDAPTEST', 'DAP test rice', 'kg', 10, 3000);
  INSERT INTO public.stock_logs (id, "productId", "productName", type, quantity, date, branch)
  VALUES ('LOGDAPTEST', 'PRODDAPTEST', 'DAP test rice', 'Stock Out', 2, current_date, 'Dar es Salaam');
  IF to_regclass('public.ingredient_prices') IS NOT NULL THEN
    EXECUTE $q$INSERT INTO public.ingredient_prices (product_id, branch, unit, unit_price, valid_from, source, source_ref)
               VALUES ('PRODDAPTEST', 'Dar es Salaam', 'kg', 3000, current_date, 'manual', 'DAPTEST')$q$;
  END IF;

  SELECT count(*) INTO products_before FROM public.products;
  SELECT count(*) INTO logs_before FROM public.stock_logs;
  IF to_regclass('public.ingredient_prices') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.ingredient_prices' INTO prices_before;
  END IF;

  -- ── A. Nothing else links to products any more ───────────────────────────
  INSERT INTO rls_results VALUES ('system', 'pg_constraint', 'no table has a foreign key to products', true,
    NOT EXISTS (SELECT 1 FROM pg_constraint WHERE contype = 'f' AND confrelid = 'public.products'::regclass));

  -- ── B. Who may run it ────────────────────────────────────────────────────
  FOREACH nm IN ARRAY ARRAY['hr', 'stf'] LOOP
    res := public._dap_as((u ->> nm)::uuid, 'SELECT public.delete_all_products(''DELETE ALL PRODUCTS'')');
    INSERT INTO rls_results VALUES (nm, 'delete_all_products', 'deletes the catalog', false, res = 'ok');
  END LOOP;
  res := public._dap_as((u ->> 'adm')::uuid, 'SELECT public.delete_all_products(''delete all'')');
  INSERT INTO rls_results VALUES ('adm', 'delete_all_products', 'deletes without the exact phrase', false, res = 'ok');
  INSERT INTO rls_results VALUES ('system', 'products', 'nothing was deleted by the refused attempts', true,
    (SELECT count(*) FROM public.products) = products_before);

  -- ── C. The Admin deletes the catalog ─────────────────────────────────────
  res := public._dap_as((u ->> 'adm')::uuid, 'SELECT public.delete_all_products(''DELETE ALL PRODUCTS'')');
  INSERT INTO rls_results VALUES ('adm', 'delete_all_products', 'the Admin deletes the catalog (' || res || ')', true, res = 'ok');
  INSERT INTO rls_results VALUES ('adm', 'products', 'every product is gone', true, NOT EXISTS (SELECT 1 FROM public.products));
  INSERT INTO rls_results VALUES ('adm', 'stock_logs', 'every stock log is kept', true,
    (SELECT count(*) FROM public.stock_logs) = logs_before);
  INSERT INTO rls_results VALUES ('adm', 'stock_logs', 'a log keeps its product code and name', true,
    EXISTS (SELECT 1 FROM public.stock_logs WHERE id = 'LOGDAPTEST' AND "productId" = 'PRODDAPTEST' AND "productName" = 'DAP test rice'));
  IF prices_before IS NOT NULL THEN
    EXECUTE $q$SELECT count(*) = $1 AND EXISTS (SELECT 1 FROM public.ingredient_prices WHERE source_ref = 'DAPTEST' AND product_id = 'PRODDAPTEST')
               FROM public.ingredient_prices$q$ INTO STRICT res USING prices_before;
    INSERT INTO rls_results VALUES ('adm', 'ingredient_prices', 'the price history is kept, with its product code', true, res::boolean);
  END IF;
  INSERT INTO rls_results VALUES ('adm', 'audit_log', 'a summary event and each deleted product are in the audit log', true,
    EXISTS (SELECT 1 FROM public.audit_log WHERE action = 'products.delete_all' AND actor_id = (u ->> 'adm')::uuid
            AND (metadata ->> 'products_deleted')::bigint = products_before AND (metadata ->> 'stock_logs_kept')::bigint = logs_before)
    AND EXISTS (SELECT 1 FROM public.audit_log WHERE table_name = 'products' AND record_id = 'PRODDAPTEST' AND action = 'products.delete'));

  -- ── Verdict (always an exception, so everything above is rolled back) ────
  SELECT count(*) INTO checks FROM rls_results;
  SELECT count(*) INTO failures FROM rls_results WHERE expected IS DISTINCT FROM actual;
  IF failures > 0 THEN
    RAISE EXCEPTION 'FAIL: % of % checks failed. Failures: %', failures, checks,
      (SELECT string_agg(who || '/' || tbl || '/' || op || ': expected ' || expected || ' got ' || actual, E'
' ORDER BY tbl, who, op) FROM rls_results WHERE expected IS DISTINCT FROM actual);
  END IF;
  RAISE EXCEPTION 'PASS: all % delete-all-products checks passed. This error is intentional: it rolls everything back, so no product was really deleted.', checks;
END
$test$;
