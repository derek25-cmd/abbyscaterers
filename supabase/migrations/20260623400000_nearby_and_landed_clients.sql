-- ============================================================
-- 1. Proximity detection — stop two marketers registering /
--    visiting the same company. Haversine distance in metres.
-- 2. Landed-clients view — each marketer's onboarded clients
--    with the commission they have earned from invoices.
-- ============================================================

-- ── find_nearby_companies(lat, lng, radius_m) ──────────────
-- Returns existing companies within radius, nearest first, so the
-- app can warn a marketer before they register a duplicate.
CREATE OR REPLACE FUNCTION find_nearby_companies(
  p_lat      DOUBLE PRECISION,
  p_lng      DOUBLE PRECISION,
  p_radius_m DOUBLE PRECISION DEFAULT 150
)
RETURNS TABLE (
  id                   UUID,
  name                 TEXT,
  distance_m           DOUBLE PRECISION,
  pipeline_stage       TEXT,
  assigned_marketer_id UUID,
  landed_by_name       TEXT,
  contact_name         TEXT,
  last_visited_at      TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
  SELECT
    c.id,
    c.name,
    (6371000 * acos(LEAST(1,
      cos(radians(p_lat)) * cos(radians(c.latitude)) *
      cos(radians(c.longitude) - radians(p_lng)) +
      sin(radians(p_lat)) * sin(radians(c.latitude))
    ))) AS distance_m,
    c.pipeline_stage::text,
    c.assigned_marketer_id,
    c.landed_by_name,
    c.contact_name,
    c.last_visited_at
  FROM companies c
  WHERE c.latitude IS NOT NULL
    AND c.longitude IS NOT NULL
    AND c.is_active IS NOT FALSE
    AND (6371000 * acos(LEAST(1,
      cos(radians(p_lat)) * cos(radians(c.latitude)) *
      cos(radians(c.longitude) - radians(p_lng)) +
      sin(radians(p_lat)) * sin(radians(c.latitude))
    ))) <= p_radius_m
  ORDER BY distance_m ASC
  LIMIT 10;
$$;

-- ── marketer_landed_clients view ───────────────────────────
-- Per marketer: every company they're attributed to (primary
-- lander OR collaborator) that has been onboarded as a client,
-- with the commission THIS marketer has earned from its invoices.
CREATE OR REPLACE VIEW marketer_landed_clients AS
WITH attributed AS (
  SELECT id AS company_id, landed_by_marketer_id AS marketer_id, true AS is_primary
  FROM companies
  WHERE landed_by_marketer_id IS NOT NULL
  UNION
  SELECT company_id, marketer_id, false
  FROM company_collaborators
)
SELECT
  a.marketer_id,
  c.id                       AS company_id,
  c.name,
  c.pipeline_stage::text     AS pipeline_stage,
  c.client_since,
  c.landed_at,
  bool_or(a.is_primary)      AS is_primary_lander,
  COALESCE((SELECT SUM(cm.invoice_amount)
            FROM commissions cm
            WHERE cm.company_id = c.id
              AND cm.marketer_id = a.marketer_id), 0) AS total_invoiced,
  COALESCE((SELECT SUM(cm.commission_amount)
            FROM commissions cm
            WHERE cm.company_id = c.id
              AND cm.marketer_id = a.marketer_id), 0) AS my_commission,
  COALESCE((SELECT COUNT(*)
            FROM commissions cm
            WHERE cm.company_id = c.id
              AND cm.marketer_id = a.marketer_id), 0) AS invoice_count
FROM attributed a
JOIN companies c ON c.id = a.company_id
WHERE c.client_since IS NOT NULL
GROUP BY a.marketer_id, c.id, c.name, c.pipeline_stage,
         c.client_since, c.landed_at;
