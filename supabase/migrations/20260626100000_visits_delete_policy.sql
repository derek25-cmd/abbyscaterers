-- Visits previously had no DELETE policy at all, so even a manager-gated
-- DELETE route would have been rejected at the database layer. Managers
-- need to be able to remove a mis-logged visit (route-level auth in
-- src/app/api/marketing/visits/[id]/route.ts already restricts this to
-- managers/admins) — this just opens the matching RLS policy.
DROP POLICY IF EXISTS "visits_delete" ON visits;
CREATE POLICY "visits_delete" ON visits
  FOR DELETE TO authenticated USING (true);
