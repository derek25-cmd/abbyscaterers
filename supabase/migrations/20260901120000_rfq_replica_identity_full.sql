-- apps/catering-system's new-rfq-popup needs to tell "an unrelated edit to
-- an already-submitted RFQ" apart from "this RFQ just became submitted" via
-- payload.old.status on a Realtime UPDATE event. Postgres's default
-- REPLICA IDENTITY only ships the primary key in the "old" row, so without
-- this, payload.old.status is always undefined and every update to a
-- submitted RFQ would re-pop the dialog. Same fix already applied to
-- companies/follow_ups for the same reason (20260620150000_add_realtime_helpers.sql).
ALTER TABLE public.rfqs REPLICA IDENTITY FULL;
