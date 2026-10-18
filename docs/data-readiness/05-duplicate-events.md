# Data readiness 05: duplicate event IDs

An event ID (`EVT-NNNNN`) must be unique: it links the event to its daily
menus, invoices and purchases. Duplicates are **never fixed automatically**.

## Result (staging = production copy, 2026-10-18)

**No duplicate event IDs.** All 2,713 events across 2,051 orders have a
distinct, standard `EVT-NNNNN` id, and no event is missing one. This
agrees with baseline check B (`02-baseline.md`) and with
`event_quality_issues()` (0 events flagged "duplicate event id").

There is therefore nothing to list. Event IDs come from the `claim_ids`
counter since `20260702100000_id_counters.sql`, which cannot hand out the
same id twice.

## If one appears

The Data Quality page flags it as "duplicate event id". For each duplicate:

1. Find both orders (the page lists one row per event, so both appear).
2. Check which order has an invoice that references the event
   (`invoices.items[].id` = the event ID), or a proforma if neither is
   invoiced.
3. **Keep the invoiced one.** In the other order, delete the event and add it
   again: the new event gets a fresh ID from `claim_ids`.
4. Move any daily menu or purchase that belongs to the re-added event to its
   new ID.
