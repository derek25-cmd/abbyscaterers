-- ============================================================================
-- 10_ml_events.sql: one row per event (sales forecasting dataset)
-- ============================================================================
--
-- READ-ONLY: a single SELECT. Run it in the Supabase SQL Editor, export the
-- result as CSV and save it as  ml-data/ml_events.csv  (gitignored).
-- Contains ids and business figures only: no client names or contacts.
--
-- Source: orders."clientEvents" (one element per event). Decisions behind it
-- (docs/data-readiness/02-findings-and-ml-datasets.md):
--   * revenue = order events (pax x price per head), not invoices;
--   * region -> branch: Dar es Salaam, Morogoro, Pwani -> Dar es Salaam;
--     Arusha -> Arusha; Dodoma, Mwanza, Mbeya -> Dodoma.
-- Nothing is dropped: problem rows are kept and flagged (flag_* columns), so
-- the analysis decides what to exclude.
--
-- If the editor cuts the export off, narrow the date range in "params" and
-- export in parts (filters on the event date).
-- ============================================================================
WITH params AS (
  SELECT DATE '2000-01-01' AS from_date,   -- edit to export in parts
         DATE '2100-12-31' AS to_date,
         0.18::numeric     AS vat_rate,    -- Tanzania standard VAT
         (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date AS today_dar
),
raw AS (
  SELECT
    o.id                                                          AS order_id,
    nullif(o.client_id, '')                                       AS client_id,
    to_jsonb(o) ->> 'status'                                      AS order_status,
    nullif(to_jsonb(o) ->> 'region', '')                          AS order_region,
    nullif(o.booking_id, '')                                      AS booking_id,
    coalesce(nullif(to_jsonb(o) ->> 'proforma_id', ''),
             nullif(to_jsonb(o) ->> 'proformaId', ''))            AS proforma_id,
    jsonb_array_length(o.events)                                  AS events_in_order,
    e.ord                                                         AS event_index,
    e.ev
  FROM (
    -- Guard inside the call: a WHERE filter is not guaranteed to run before
    -- jsonb_array_elements(), which fails on a non-array value.
    SELECT o0.*, CASE WHEN jsonb_typeof(o0."clientEvents") = 'array'
                      THEN o0."clientEvents" ELSE '[]'::jsonb END AS events
    FROM public.orders o0
  ) o
  CROSS JOIN LATERAL jsonb_array_elements(o.events) WITH ORDINALITY AS e(ev, ord)
  WHERE jsonb_typeof(e.ev) = 'object'
),
parsed AS (
  SELECT
    r.*,
    nullif(trim(r.ev ->> 'id'), '')                               AS event_id,
    r.ev ->> 'date'                                               AS date_raw,
    -- Safe date parse: first-of-month + (day - 1), kept only if the month
    -- did not roll over (so 2026-02-30 becomes NULL, not an error).
    CASE WHEN nullif(r.ev ->> 'date', '') ~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])' THEN
      CASE WHEN extract(month FROM (substr(r.ev ->> 'date', 1, 8) || '01')::date
                                   + (substr(r.ev ->> 'date', 9, 2)::int - 1))
                = substr(r.ev ->> 'date', 6, 2)::int
           THEN (substr(r.ev ->> 'date', 1, 8) || '01')::date + (substr(r.ev ->> 'date', 9, 2)::int - 1)
      END
    END                                                           AS event_date,
    CASE jsonb_typeof(r.ev -> 'numberOfPeople')
      WHEN 'number' THEN (r.ev ->> 'numberOfPeople')::numeric
      WHEN 'string' THEN CASE WHEN trim(r.ev ->> 'numberOfPeople') ~ '^-?\d+(\.\d+)?$'
                              THEN trim(r.ev ->> 'numberOfPeople')::numeric END
    END                                                           AS pax,
    CASE jsonb_typeof(r.ev -> 'unitPrice')
      WHEN 'number' THEN (r.ev ->> 'unitPrice')::numeric
      WHEN 'string' THEN CASE WHEN trim(r.ev ->> 'unitPrice') ~ '^-?\d+(\.\d+)?$'
                              THEN trim(r.ev ->> 'unitPrice')::numeric END
    END                                                           AS unit_price,
    nullif(trim(r.ev ->> 'vatType'), '')                          AS vat_type,
    nullif(trim(r.ev ->> 'mealType'), '')                         AS meal_type,
    nullif(trim(r.ev ->> 'particularType'), '')                   AS particular_type,
    nullif(trim(coalesce(nullif(r.ev ->> 'customEventType', ''), r.ev ->> 'eventType')), '') AS event_type,
    coalesce(nullif(trim(r.ev ->> 'region'), ''), r.order_region) AS region
  FROM raw r
)
SELECT
  p.event_id,
  p.order_id,
  p.event_index,
  p.events_in_order,
  p.client_id,
  c."typeOfOrganization"                                          AS client_type,
  p.event_date,
  extract(isodow FROM p.event_date)::int                          AS weekday_iso,      -- 1 = Monday
  to_char(p.event_date, 'IYYY-"W"IW')                             AS iso_week,
  to_char(p.event_date, 'YYYY-MM')                                AS month,
  p.region,
  CASE
    WHEN p.region IN ('Dar es Salaam', 'Morogoro', 'Pwani') THEN 'Dar es Salaam'
    WHEN p.region = 'Arusha'                                THEN 'Arusha'
    WHEN p.region IN ('Dodoma', 'Mwanza', 'Mbeya')          THEN 'Dodoma'
  END                                                             AS branch,
  p.meal_type,
  p.particular_type,
  p.event_type,
  p.pax,
  p.unit_price,
  p.vat_type,
  round(p.pax * p.unit_price, 2)                                  AS revenue_as_entered,
  round(CASE p.vat_type
          WHEN 'inclusive' THEN p.pax * p.unit_price / (1 + prm.vat_rate)
          WHEN 'exclusive' THEN p.pax * p.unit_price
        END, 2)                                                   AS revenue_ex_vat,
  p.order_status,
  p.booking_id,
  p.proforma_id,
  coalesce(p.order_status = 'cancelled', false)                   AS flag_cancelled,
  (p.event_date IS NULL)                                          AS flag_date_unreadable,
  coalesce(p.event_date > prm.today_dar, false)                   AS flag_future,
  (p.pax IS NULL OR p.pax <= 0)                                   AS flag_bad_pax,
  (p.unit_price IS NULL OR p.unit_price <= 0)                     AS flag_zero_price,
  (p.vat_type IS NULL OR p.vat_type NOT IN ('inclusive', 'exclusive')) AS flag_vat_unknown,
  (p.region IS NULL)                                              AS flag_region_missing,
  (p.event_id IS NULL OR p.event_id !~ '^EVT-\d{5}$')             AS flag_event_id_nonstandard
FROM parsed p
CROSS JOIN params prm
LEFT JOIN public.clients c ON c.id = p.client_id
WHERE p.event_date IS NULL
   OR p.event_date BETWEEN prm.from_date AND prm.to_date
ORDER BY p.event_date NULLS FIRST, p.order_id, p.event_index;
