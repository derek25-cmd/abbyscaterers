


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."business_size" AS ENUM (
    'SMALL',
    'MEDIUM',
    'LARGE',
    'ENTERPRISE'
);


ALTER TYPE "public"."business_size" OWNER TO "postgres";


CREATE TYPE "public"."follow_up_status" AS ENUM (
    'PENDING',
    'DONE',
    'OVERDUE',
    'CANCELLED',
    'RESCHEDULED'
);


ALTER TYPE "public"."follow_up_status" OWNER TO "postgres";


CREATE TYPE "public"."follow_up_type" AS ENUM (
    'CALL',
    'EMAIL',
    'WHATSAPP',
    'IN_PERSON_VISIT',
    'SEND_QUOTATION',
    'SEND_COMPANY_PROFILE',
    'ARRANGE_TASTING',
    'MEET_CEO',
    'MEET_PROCUREMENT',
    'CONTRACT_SIGNING'
);


ALTER TYPE "public"."follow_up_type" OWNER TO "postgres";


CREATE TYPE "public"."interest_level" AS ENUM (
    'NOT_INTERESTED',
    'MAYBE',
    'INTERESTED',
    'VERY_INTERESTED'
);


ALTER TYPE "public"."interest_level" OWNER TO "postgres";


CREATE TYPE "public"."marketing_notification_type" AS ENUM (
    'HOT_LEAD',
    'DEAL_WON',
    'FOLLOWUP_OVERDUE',
    'FOLLOWUP_DUE_TODAY',
    'QUOTATION_REQUESTED',
    'STAGE_CHANGE',
    'MARKETER_INACTIVE',
    'TARGET_SET',
    'TARGET_DUE',
    'FOLLOW_UP_DUE',
    'APPROVAL',
    'MESSAGE'
);


ALTER TYPE "public"."marketing_notification_type" OWNER TO "postgres";


CREATE TYPE "public"."marketing_user_role" AS ENUM (
    'MARKETER',
    'MARKETING_MANAGER',
    'ADMIN'
);


ALTER TYPE "public"."marketing_user_role" OWNER TO "postgres";


CREATE TYPE "public"."pipeline_stage" AS ENUM (
    'IDENTIFIED',
    'VISITED',
    'INTERESTED',
    'QUOTATION_REQUESTED',
    'NEGOTIATING',
    'WON',
    'LOST'
);


ALTER TYPE "public"."pipeline_stage" OWNER TO "postgres";


CREATE TYPE "public"."region" AS ENUM (
    'Dar es Salaam',
    'Arusha',
    'Dodoma',
    'Morogoro',
    'Mwanza',
    'Mbeya',
    'Pwani'
);


ALTER TYPE "public"."region" OWNER TO "postgres";


CREATE TYPE "public"."visit_outcome" AS ENUM (
    'VISITED',
    'NO_ONE_AVAILABLE',
    'MEETING_POSTPONED',
    'PROPOSAL_REQUESTED',
    'QUOTATION_SENT',
    'CONTRACT_NEGOTIATION',
    'CUSTOMER_ACQUIRED'
);


ALTER TYPE "public"."visit_outcome" OWNER TO "postgres";


CREATE TYPE "public"."visit_purpose" AS ENUM (
    'INTRODUCTION',
    'FOLLOW_UP',
    'PROPOSAL_DELIVERY',
    'QUOTATION_FOLLOW_UP',
    'CONTRACT_RENEWAL',
    'COMPLAINT_RESOLUTION',
    'EVENT_INVITATION',
    'TASTING_SESSION'
);


ALTER TYPE "public"."visit_purpose" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."acknowledge_caution"("p_marketer_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE marketing_users SET
    approval_status = 'APPROVED'
  WHERE id = p_marketer_id
    AND approval_status = 'CAUTIONED';
END;
$$;


ALTER FUNCTION "public"."acknowledge_caution"("p_marketer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_company_collaborator"("p_company_id" "uuid", "p_marketer_id" "uuid", "p_added_by" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_name TEXT;
BEGIN
  SELECT full_name INTO v_name FROM marketing_users WHERE id = p_marketer_id;
  INSERT INTO company_collaborators (company_id, marketer_id, marketer_name, added_by)
  VALUES (p_company_id, p_marketer_id, v_name, p_added_by)
  ON CONFLICT (company_id, marketer_id) DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."add_company_collaborator"("p_company_id" "uuid", "p_marketer_id" "uuid", "p_added_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."aggregate_marketing_performance"("p_month" integer DEFAULT (EXTRACT(month FROM "now"()))::integer, "p_year" integer DEFAULT (EXTRACT(year FROM "now"()))::integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  DELETE FROM marketing_performance
  WHERE month = p_month AND year = p_year;

  INSERT INTO marketing_performance (
    marketer_id, month, year,
    total_visits, verified_visits, new_leads, hot_leads,
    quotations_requested, deals_won, follow_ups_completed,
    follow_ups_missed, revenue_generated, avg_lead_score,
    avg_interest_level
  )
  SELECT
    mu.id,
    p_month,
    p_year,

    COUNT(DISTINCT v.id) AS total_visits,
    COUNT(DISTINCT v.id) FILTER (WHERE v.gps_verified = true) AS verified_visits,
    COUNT(DISTINCT c_lead.id) AS new_leads,
    COUNT(DISTINCT c_hot.id) AS hot_leads,
    COUNT(DISTINCT c_quot.id) AS quotations_requested,
    COUNT(DISTINCT c_won.id) AS deals_won,
    COUNT(DISTINCT fu_done.id) AS follow_ups_completed,
    COUNT(DISTINCT fu_miss.id) AS follow_ups_missed,
    COALESCE(SUM(DISTINCT c_won.estimated_value), 0) AS revenue_generated,
    COALESCE(AVG(v.lead_score), 0) AS avg_lead_score,
    COALESCE(AVG(
      CASE v.interest_level
        WHEN 'NOT_INTERESTED' THEN 0
        WHEN 'MAYBE' THEN 1
        WHEN 'INTERESTED' THEN 2
        WHEN 'VERY_INTERESTED' THEN 3
      END
    ), 0) AS avg_interest_level

  FROM marketing_users mu

  LEFT JOIN visits v ON v.marketer_id = mu.id
    AND EXTRACT(MONTH FROM v.check_in_time) = p_month
    AND EXTRACT(YEAR FROM v.check_in_time) = p_year

  LEFT JOIN companies c_lead ON c_lead.assigned_marketer_id = mu.id
    AND c_lead.pipeline_stage != 'IDENTIFIED'
    AND EXTRACT(MONTH FROM c_lead.updated_at) = p_month
    AND EXTRACT(YEAR FROM c_lead.updated_at) = p_year

  LEFT JOIN companies c_hot ON c_hot.assigned_marketer_id = mu.id
    AND c_hot.lead_score >= 80

  LEFT JOIN companies c_quot ON c_quot.assigned_marketer_id = mu.id
    AND c_quot.pipeline_stage = 'QUOTATION_REQUESTED'
    AND EXTRACT(MONTH FROM c_quot.updated_at) = p_month
    AND EXTRACT(YEAR FROM c_quot.updated_at) = p_year

  LEFT JOIN companies c_won ON c_won.assigned_marketer_id = mu.id
    AND c_won.pipeline_stage = 'WON'
    AND EXTRACT(MONTH FROM c_won.client_since) = p_month
    AND EXTRACT(YEAR FROM c_won.client_since) = p_year

  LEFT JOIN follow_ups fu_done ON fu_done.assigned_to = mu.id
    AND fu_done.status = 'DONE'
    AND EXTRACT(MONTH FROM fu_done.completed_at) = p_month
    AND EXTRACT(YEAR FROM fu_done.completed_at) = p_year

  LEFT JOIN follow_ups fu_miss ON fu_miss.assigned_to = mu.id
    AND fu_miss.status IN ('PENDING', 'OVERDUE')
    AND fu_miss.due_date < NOW()
    AND EXTRACT(MONTH FROM fu_miss.due_date) = p_month
    AND EXTRACT(YEAR FROM fu_miss.due_date) = p_year

  WHERE mu.is_active = true
  GROUP BY mu.id;
END;
$$;


ALTER FUNCTION "public"."aggregate_marketing_performance"("p_month" integer, "p_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."safe_auth_uid"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN auth.uid();
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."safe_auth_uid"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."hr_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ref_no" "text",
    "doc_type" "text" NOT NULL,
    "employee_id" "text",
    "candidate_id" "uuid",
    "template_id" "uuid" NOT NULL,
    "template_version" integer NOT NULL,
    "subject" "text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "return_note" "text",
    "void_reason" "text",
    "voided_by" "uuid",
    "voided_at" timestamp with time zone,
    "signatory_name" "text",
    "signatory_title" "text",
    "pdf_path" "text",
    "pdf_sha256" "text",
    "confidential" boolean DEFAULT false NOT NULL,
    "issued_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "public"."safe_auth_uid"(),
    "updated_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "preview" "jsonb",
    "approved_by_portal" "text",
    "issued_content" "jsonb",
    CONSTRAINT "hr_documents_has_person" CHECK ((("employee_id" IS NOT NULL) OR ("candidate_id" IS NOT NULL))),
    CONSTRAINT "hr_documents_issued_complete" CHECK ((("status" <> 'issued'::"text") OR (("ref_no" IS NOT NULL) AND ("issued_at" IS NOT NULL) AND (("issued_content" IS NOT NULL) OR ("pdf_path" IS NOT NULL))))),
    CONSTRAINT "hr_documents_pdf_sha256_check" CHECK ((("pdf_sha256" IS NULL) OR ("pdf_sha256" ~ '^[0-9a-f]{64}$'::"text"))),
    CONSTRAINT "hr_documents_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending_approval'::"text", 'approved'::"text", 'issued'::"text", 'void'::"text"]))),
    CONSTRAINT "hr_documents_void_reason" CHECK ((("status" <> 'void'::"text") OR ("length"(TRIM(BOTH FROM COALESCE("void_reason", ''::"text"))) > 0)))
);


ALTER TABLE "public"."hr_documents" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_hr_document"("p_id" "uuid") RETURNS "public"."hr_documents"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  d public.hr_documents%ROWTYPE;
  me uuid := public.safe_auth_uid();
  needs_other boolean;
  derived_name text;
  derived_title text;
  my_role text;
  role_label text;
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can approve HR documents.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO d FROM public.hr_documents WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document not found.'; END IF;
  IF d.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Only a document waiting for approval can be approved. This document is %.', replace(d.status, '_', ' ');
  END IF;

  SELECT requires_different_approver INTO needs_other FROM public.hr_document_types WHERE doc_type = d.doc_type;
  IF needs_other AND d.created_by = me THEN
    RAISE EXCEPTION 'This type of document must be approved by someone other than the person who wrote it.';
  END IF;
  PERFORM public.hr_doc_validate(d, 'approve');                      -- Phase 4

  SELECT s.role INTO my_role FROM public.staff_users s WHERE s.id = me;
  role_label := CASE my_role
    WHEN 'hr_manager' THEN 'HR Manager' WHEN 'general_manager' THEN 'General Manager'
    WHEN 'admin' THEN 'Administrator' ELSE initcap(replace(coalesce(my_role, ''), '_', ' ')) END;

  SELECT trim(concat_ws(' ', e."firstName", e."middleName", e."lastName")), nullif(trim(e.role), '')
    INTO derived_name, derived_title
    FROM public.staff_users s JOIN public.employees e ON e.id = s.employee_id
   WHERE s.id = me;
  derived_name := coalesce(nullif(derived_name, ''), (SELECT email FROM public.staff_users WHERE id = me));
  derived_title := coalesce(derived_title, role_label);

  PERFORM set_config('hr_docs.rpc', '1', true);
  UPDATE public.hr_documents
     SET status = 'approved', approved_by = me, approved_at = now(),
         signatory_name = coalesce(nullif(trim(signatory_name), ''), derived_name),
         signatory_title = coalesce(nullif(trim(signatory_title), ''), derived_title)
   WHERE id = p_id RETURNING * INTO d;

  IF d.created_by IS NOT NULL AND d.created_by IS DISTINCT FROM me THEN
    PERFORM public.notify_user(d.created_by, 'hr_document_approved', 'Document approved',
      format('%s is approved and ready to issue.', d.subject), '/hr/documents');
  END IF;
  PERFORM set_config('hr_docs.rpc', '', true);
  RETURN d;
END;
$$;


ALTER FUNCTION "public"."approve_hr_document"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_role" "text" DEFAULT 'MARKETER'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE marketing_users SET
    is_active = true, approval_status = 'APPROVED',
    role = p_role::marketing_user_role,
    approved_by = p_manager_id, approved_at = NOW(),
    marketer_code = COALESCE(marketer_code, 'MKT-' || lpad(nextval('marketer_code_seq')::text, 4, '0'))
  WHERE id = p_marketer_id;
  INSERT INTO marketer_approval_log (marketer_id, action, performed_by)
  VALUES (p_marketer_id, 'APPROVED', p_manager_id);
END;
$$;


ALTER FUNCTION "public"."approve_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_proforma"("p_proforma_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_is_voided BOOLEAN;
  v_review_status TEXT;
  v_actor TEXT := public.portal_uid();
  v_rfq RECORD;
BEGIN
  IF NOT public.is_active_portal_user() THEN
    RAISE EXCEPTION 'Not an active portal user';
  END IF;

  SELECT "isVoided", "reviewStatus" INTO v_is_voided, v_review_status
  FROM public.proforma_invoices WHERE id = p_proforma_id FOR UPDATE;
  IF v_review_status IS NULL THEN
    RAISE EXCEPTION 'Proforma % not found', p_proforma_id;
  END IF;
  IF v_is_voided THEN
    RAISE EXCEPTION 'Proforma % has been marked Uninvoiced and cannot be approved', p_proforma_id;
  END IF;
  IF v_review_status <> 'pending' THEN
    RAISE EXCEPTION 'Proforma % has already been %', p_proforma_id, v_review_status;
  END IF;

  UPDATE public.proforma_invoices
  SET "reviewStatus" = 'approved', "reviewedAt" = now(), "reviewedById" = v_actor, "updatedAt" = now()
  WHERE id = p_proforma_id;

  PERFORM public.log_portal_audit_event(v_actor, 'portal', 'proforma.approved', 'proforma_invoices', p_proforma_id, NULL);

  FOR v_rfq IN
    SELECT r.id, r.requested_by_id FROM public.rfqs r
    JOIN public.rfq_proforma_links l ON l.rfq_id = r.id
    WHERE l.proforma_id = p_proforma_id AND r.status = 'proforma_created'
  LOOP
    UPDATE public.rfqs SET status = 'approved', updated_at = now() WHERE id = v_rfq.id;
    INSERT INTO public.rfq_status_history (rfq_id, from_status, to_status, changed_by_id, note)
    VALUES (v_rfq.id, 'proforma_created', 'approved', v_actor, 'Proforma ' || p_proforma_id || ' approved');

    IF v_rfq.requested_by_id IS NOT NULL THEN
      INSERT INTO public.portal_notifications (portal_user_id, type, title, body, rfq_id, proforma_id)
      VALUES (
        v_rfq.requested_by_id, 'proforma_approved', 'Proforma approved',
        'Proforma ' || p_proforma_id || ' was approved.', v_rfq.id, p_proforma_id
      );
    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."approve_proforma"("p_proforma_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."attendance_leave_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  uid uuid := public.safe_auth_uid();
BEGIN
  -- No signed-in user: service role / maintenance, not an end user.
  IF uid IS NULL OR public.can_manage_hr() THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.leave_request_id IS NOT NULL THEN
      RAISE EXCEPTION 'This day is covered by approved leave and cannot be removed here. Ask HR to cancel the leave request.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.leave_request_id IS NOT NULL THEN
    RAISE EXCEPTION 'This day is covered by approved leave and cannot be changed here. Ask HR to cancel the leave request.';
  END IF;

  IF NEW.leave_request_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only the leave approval process can attach attendance to a leave request.';
  END IF;

  IF NEW.status = 'Leave' AND NOT (TG_OP = 'UPDATE' AND OLD.status = 'Leave') THEN
    RAISE EXCEPTION 'Leave cannot be marked on the attendance sheet directly. Submit a leave request instead; once approved it appears here automatically.';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."attendance_leave_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_row_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  -- table -> columns recorded as "changed", never as a value. '*' applies to
  -- every audited table (the Phase 1 list); add a table's own entry to extend.
  mask_map  constant jsonb := '{
    "*": ["nationalId", "tin", "bankAccountNumber", "monthlySalary"],
    "hr_documents": ["data", "preview", "issued_content"],
    "candidates": ["proposed_salary"],
    "employment_contracts": ["salary"],
    "recognition_records": ["amount"]
  }'::jsonb;
  masked    text[] := ARRAY(SELECT jsonb_array_elements_text(mask_map -> '*'))
                      || COALESCE(ARRAY(SELECT jsonb_array_elements_text(mask_map -> TG_TABLE_NAME)), ARRAY[]::text[]);
  -- Bookkeeping columns that change on every write; logging them would make
  -- every update look like it changed something.
  noise     constant text[] := ARRAY['updated_by', 'updatedAt', 'updated_at'];
  old_j     jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  new_j     jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  changed   text[];
  op        text := lower(TG_OP);
  rec_id    text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT array_agg(k ORDER BY k) INTO changed FROM jsonb_object_keys(new_j) k WHERE k <> ALL (noise);
  ELSIF TG_OP = 'DELETE' THEN
    SELECT array_agg(k ORDER BY k) INTO changed FROM jsonb_object_keys(old_j) k WHERE k <> ALL (noise);
  ELSE
    SELECT array_agg(k ORDER BY k) INTO changed
    FROM jsonb_object_keys(new_j) k
    WHERE k <> ALL (noise) AND new_j -> k IS DISTINCT FROM old_j -> k;

    -- An UPDATE that only touched bookkeeping columns is not worth a row.
    IF changed IS NULL THEN
      RETURN NULL;
    END IF;

    -- Approvals get their own action so they can be filtered on.
    IF old_j ->> 'approved_at' IS NULL AND new_j ->> 'approved_at' IS NOT NULL THEN
      op := 'approve';
    END IF;
  END IF;

  -- The record's id; for tables keyed differently, its key ("type", "type/year"
  -- or, for reminder notices, "contract/threshold").
  rec_id := COALESCE(
    new_j ->> 'id', old_j ->> 'id',
    NULLIF(concat_ws('/', COALESCE(new_j ->> 'doc_type', old_j ->> 'doc_type'), COALESCE(new_j ->> 'year', old_j ->> 'year')), ''),
    NULLIF(concat_ws('/', COALESCE(new_j ->> 'contract_id', old_j ->> 'contract_id'), COALESCE(new_j ->> 'threshold_days', old_j ->> 'threshold_days')), '')
  );

  -- Strip masked values from the snapshots (keys stay in changed_fields).
  old_j := old_j - masked;
  new_j := new_j - masked;

  INSERT INTO public.audit_log (actor_id, action, table_name, record_id, metadata)
  VALUES (
    public.safe_auth_uid(),
    TG_TABLE_NAME || '.' || op,
    TG_TABLE_NAME,
    rec_id,
    jsonb_build_object('old', old_j, 'new', new_j, 'changed_fields', COALESCE(to_jsonb(changed), '[]'::jsonb))
  );
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."audit_row_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_staff_user_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  changed text[] := ARRAY_REMOVE(ARRAY[
    CASE WHEN NEW.role IS DISTINCT FROM OLD.role THEN 'role' END,
    CASE WHEN NEW.is_active IS DISTINCT FROM OLD.is_active THEN 'is_active' END,
    CASE WHEN to_jsonb(NEW) ->> 'employee_id' IS DISTINCT FROM to_jsonb(OLD) ->> 'employee_id' THEN 'employee_id' END
  ], NULL);
BEGIN
  IF array_length(changed, 1) IS NOT NULL THEN
    INSERT INTO public.audit_log (actor_id, action, table_name, record_id, metadata)
    VALUES (
      public.safe_auth_uid(), 'staff_users.update', 'staff_users', NEW.id::text,
      jsonb_build_object(
        'old', jsonb_build_object('role', OLD.role, 'is_active', OLD.is_active, 'email', OLD.email,
                                  'employee_id', to_jsonb(OLD) ->> 'employee_id'),
        'new', jsonb_build_object('role', NEW.role, 'is_active', NEW.is_active, 'email', NEW.email,
                                  'employee_id', to_jsonb(NEW) ->> 'employee_id'),
        'changed_fields', to_jsonb(changed)
      )
    );
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."audit_staff_user_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_reinstate_expired_suspensions"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  reinstated_count INTEGER := 0;
BEGIN
  UPDATE marketing_users SET
    is_active         = true,
    approval_status   = 'APPROVED',
    suspended_until   = NULL,
    suspension_reason = NULL,
    suspended_by      = NULL,
    reinstated_at     = NOW()
  WHERE approval_status = 'SUSPENDED'
    AND suspended_until IS NOT NULL
    AND suspended_until <= NOW();

  GET DIAGNOSTICS reinstated_count = ROW_COUNT;
  RETURN reinstated_count;
END;
$$;


ALTER FUNCTION "public"."auto_reinstate_expired_suspensions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_hr"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.has_staff_role(ARRAY['admin', 'hr_manager', 'general_manager']);
$$;


ALTER FUNCTION "public"."can_manage_hr"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_ops"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.is_active_staff();
$$;


ALTER FUNCTION "public"."can_manage_ops"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_settings"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.has_staff_role(ARRAY['admin']);
$$;


ALTER FUNCTION "public"."can_manage_settings"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leave_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "text" NOT NULL,
    "leave_type_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "days" numeric(5,1) NOT NULL,
    "reason" "text",
    "attachment_path" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "decision_note" "text",
    "decided_by" "uuid",
    "decided_at" timestamp with time zone,
    "cancelled_by" "uuid",
    "cancelled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "public"."safe_auth_uid"(),
    "updated_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    CONSTRAINT "leave_requests_dates_check" CHECK (("end_date" >= "start_date")),
    CONSTRAINT "leave_requests_days_check" CHECK (("days" > (0)::numeric)),
    CONSTRAINT "leave_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."leave_requests" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_leave_request"("p_id" "uuid", "p_note" "text" DEFAULT NULL::"text") RETURNS "public"."leave_requests"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  req public.leave_requests%ROWTYPE;
  lt public.leave_types%ROWTYPE;
  me uuid := public.safe_auth_uid();
  hr boolean := public.can_manage_hr();
BEGIN
  SELECT * INTO req FROM public.leave_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Leave request not found.'; END IF;

  IF req.status = 'pending' THEN
    IF NOT (hr OR req.created_by = me OR req.employee_id = public.current_employee_id()) THEN
      RAISE EXCEPTION 'You can only cancel your own leave requests.' USING ERRCODE = '42501';
    END IF;
  ELSIF req.status = 'approved' THEN
    IF NOT hr THEN
      RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can cancel leave that is already approved.' USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'This request is already % and cannot be cancelled.', req.status;
  END IF;

  SELECT * INTO lt FROM public.leave_types WHERE id = req.leave_type_id;
  PERFORM set_config('leave.rpc', '1', true);

  IF req.status = 'approved' THEN
    -- Undo exactly what approval did: the balance, and only this request's
    -- attendance rows (never rows HR entered by hand).
    IF lt.tracks_balance THEN
      UPDATE public.leave_balances SET taken = greatest(taken - req.days, 0)
       WHERE employee_id = req.employee_id AND leave_type_id = req.leave_type_id
         AND year = public.leave_year_of(req.start_date);
    END IF;
    DELETE FROM public.attendance WHERE leave_request_id = req.id;
  END IF;

  UPDATE public.leave_requests
     SET status = 'cancelled', cancelled_by = me, cancelled_at = now(),
         decision_note = coalesce(nullif(trim(p_note), ''), decision_note)
   WHERE id = p_id RETURNING * INTO req;

  PERFORM public.leave_notify_requester(req, 'Leave request cancelled',
    format('The %s leave from %s to %s was cancelled.', lt.name, req.start_date, req.end_date));
  PERFORM set_config('leave.rpc', '', true);
  RETURN req;
END;
$$;


ALTER FUNCTION "public"."cancel_leave_request"("p_id" "uuid", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."candidates_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF coalesce(current_setting('hr_docs.rpc', true), '') = '1' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.offer_status := 'none'; NEW.offer_document_id := NULL; NEW.responded_at := NULL; NEW.employee_id := NULL;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.offer_status <> 'none' OR OLD.offer_document_id IS NOT NULL OR OLD.employee_id IS NOT NULL THEN
      RAISE EXCEPTION 'This candidate has an offer or an employee record on file and cannot be deleted.';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.offer_status IS DISTINCT FROM OLD.offer_status OR NEW.offer_document_id IS DISTINCT FROM OLD.offer_document_id
     OR NEW.responded_at IS DISTINCT FROM OLD.responded_at THEN
    RAISE EXCEPTION 'The offer status changes only through the offer letter and Record response.';
  END IF;
  -- Linking to an employee happens once, on conversion, after acceptance.
  IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
    IF OLD.employee_id IS NOT NULL THEN
      RAISE EXCEPTION 'This candidate is already linked to an employee record.';
    END IF;
    IF OLD.offer_status <> 'accepted' THEN
      RAISE EXCEPTION 'Only a candidate who has accepted an offer can be converted into an employee.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."candidates_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."caution_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text", "p_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE marketing_users SET
    approval_status      = 'CAUTIONED',
    caution_count        = COALESCE(caution_count, 0) + 1,
    last_caution_at      = NOW(),
    last_caution_reason  = p_reason
  WHERE id = p_marketer_id;

  INSERT INTO marketer_account_actions
    (marketer_id, action, performed_by, reason, internal_notes, visible_to_marketer)
  VALUES
    (p_marketer_id, 'CAUTIONED', p_manager_id, p_reason, p_notes, true);

  INSERT INTO marketer_approval_log (marketer_id, action, performed_by, reason)
  VALUES (p_marketer_id, 'CAUTIONED', p_manager_id, p_reason);
END;
$$;


ALTER FUNCTION "public"."caution_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_ids"("counter_name" "text", "count" integer DEFAULT 1) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_value BIGINT;
BEGIN
  INSERT INTO id_counters (name, value)
    VALUES (counter_name, count)
  ON CONFLICT (name) DO UPDATE
    SET value = id_counters.value + EXCLUDED.value
  RETURNING value INTO new_value;

  -- new_value is the counter AFTER the increment.
  -- The first ID in the claimed range is (new_value - count + 1).
  RETURN new_value - count + 1;
END;
$$;


ALTER FUNCTION "public"."claim_ids"("counter_name" "text", "count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_otps"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  DELETE FROM otp_codes
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_otps"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_uat_data"("p_dry_run" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $_$
DECLARE
  emps text[];
  cands uuid[];
  logins uuid[];
  docs uuid[];
  contracts uuid[];
  leave_ids uuid[];
  files jsonb;
  counts jsonb := '{}'::jsonb;
  others jsonb := '[]'::jsonb;
  counters jsonb := '[]'::jsonb;
  fk RECORD;
  n integer;
  ctr RECORD;   -- not "c": the queries below use c as a table alias
  new_value integer;
BEGIN
  -- The service role (scripts) or the SQL editor (no signed-in user) only.
  IF public.safe_auth_uid() IS NOT NULL AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'The UAT cleanup can only be run with the service role.' USING ERRCODE = '42501';
  END IF;

  -- Who is test data (see the header).
  SELECT coalesce(array_agg(id ORDER BY id), '{}') INTO emps
    FROM public.employees WHERE id LIKE 'UAT-%' OR "firstName" LIKE 'UAT %' OR "firstName" = 'UAT';
  SELECT coalesce(array_agg(id), '{}') INTO cands
    FROM public.candidates WHERE full_name LIKE 'UAT %' OR employee_id = ANY (emps);
  SELECT coalesce(array_agg(id), '{}') INTO logins
    FROM public.staff_users WHERE email ILIKE '%+uat-%' OR employee_id = ANY (emps);
  SELECT coalesce(array_agg(id), '{}') INTO docs
    FROM public.hr_documents WHERE employee_id = ANY (emps) OR candidate_id = ANY (cands);
  SELECT coalesce(array_agg(id), '{}') INTO contracts
    FROM public.employment_contracts WHERE employee_id = ANY (emps);
  SELECT coalesce(array_agg(id), '{}') INTO leave_ids
    FROM public.leave_requests WHERE employee_id = ANY (emps);

  -- Files: everything stored under a UAT employee's or candidate's folder, plus
  -- leave attachments of UAT leave (stored under the uploader's login id).
  SELECT coalesce(jsonb_agg(jsonb_build_object('bucket', o.bucket_id, 'path', o.name) ORDER BY o.bucket_id, o.name), '[]'::jsonb)
    INTO files
    FROM storage.objects o
   WHERE (o.bucket_id = 'hr-documents'
          AND (split_part(o.name, '/', 1) = ANY (emps)
               OR split_part(o.name, '/', 1) = ANY (SELECT 'candidate-' || x::text FROM unnest(cands) x)))
      OR (o.bucket_id = 'leave-attachments'
          AND (o.name IN (SELECT attachment_path FROM public.leave_requests WHERE id = ANY (leave_ids) AND attachment_path IS NOT NULL)
               OR split_part(o.name, '/', 1) = ANY (SELECT x::text FROM unnest(logins) x)));

  counts := jsonb_build_object(
    'employees', cardinality(emps),
    'candidates', cardinality(cands),
    'logins', cardinality(logins),
    'hr_documents', cardinality(docs),
    'employment_contracts', cardinality(contracts),
    'contract_expiry_notices', (SELECT count(*) FROM public.contract_expiry_notices WHERE contract_id = ANY (contracts)),
    'disciplinary_records', (SELECT count(*) FROM public.disciplinary_records WHERE employee_id = ANY (emps)),
    'recognition_records', (SELECT count(*) FROM public.recognition_records WHERE employee_id = ANY (emps)),
    'leave_requests', cardinality(leave_ids),
    'leave_balances', (SELECT count(*) FROM public.leave_balances WHERE employee_id = ANY (emps)),
    'attendance', (SELECT count(*) FROM public.attendance WHERE employee_id = ANY (emps)),
    'hr_notifications', (SELECT count(*) FROM public.hr_notifications
                          WHERE recipient_id = ANY (logins)
                             OR EXISTS (SELECT 1 FROM unnest(emps) e WHERE hr_notifications.link = '/hr/employees?open=' || e)),
    'files', jsonb_array_length(files));

  -- Any other table that points at a UAT employee (e.g. payroll, training):
  -- removed too, and listed, so nothing is left behind or silently blocked.
  FOR fk IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND c.confrelid = 'public.employees'::regclass AND array_length(c.conkey, 1) = 1
       AND c.conrelid::regclass::text NOT IN ('staff_users', 'candidates', 'hr_documents', 'employment_contracts',
             'disciplinary_records', 'recognition_records', 'leave_requests', 'leave_balances', 'attendance')
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = ANY ($1)', fk.tbl, fk.col) INTO n USING emps;
    IF n > 0 THEN others := others || jsonb_build_object('table', fk.tbl::text, 'column', fk.col, 'rows', n); END IF;
  END LOOP;

  -- Reference numbers each counter goes back to.
  FOR ctr IN SELECT * FROM public.hr_document_counters LOOP
    SELECT coalesce(max(substring(d.ref_no FROM '[0-9]+$')::int), 0) INTO new_value
      FROM public.hr_documents d
     WHERE d.doc_type = ctr.doc_type AND d.ref_no IS NOT NULL AND split_part(d.ref_no, '/', 4)::int = ctr.year
       AND NOT (d.id = ANY (docs));
    counters := counters || jsonb_build_object('doc_type', ctr.doc_type, 'year', ctr.year, 'from', ctr.last_value, 'to', new_value);
  END LOOP;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'would_remove', counts,
      'other_tables', others,
      'employees', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'name', trim(concat_ws(' ', e."firstName", e."lastName"))) ORDER BY e.id), '[]')
                      FROM public.employees e WHERE e.id = ANY (emps)),
      'logins', (SELECT coalesce(jsonb_agg(s.email ORDER BY s.email), '[]') FROM public.staff_users s WHERE s.id = ANY (logins)),
      'candidates', (SELECT coalesce(jsonb_agg(x.full_name ORDER BY x.full_name), '[]') FROM public.candidates x WHERE x.id = ANY (cands)),
      'counters', counters,
      'files', files);
  END IF;

  -- ── Remove (children first) ──────────────────────────────────────────────
  PERFORM set_config('app.uat_cleanup', 'on', true);
  PERFORM set_config('hr_docs.rpc', '1', true);   -- candidates_guard: offers on test candidates
  PERFORM set_config('leave.rpc', '1', true);

  DELETE FROM public.hr_notifications
   WHERE recipient_id = ANY (logins)
      OR EXISTS (SELECT 1 FROM unnest(emps) e WHERE hr_notifications.link = '/hr/employees?open=' || e);
  DELETE FROM public.recognition_records WHERE employee_id = ANY (emps);
  DELETE FROM public.disciplinary_records WHERE employee_id = ANY (emps);
  DELETE FROM public.contract_expiry_notices WHERE contract_id = ANY (contracts);
  UPDATE public.employment_contracts SET parent_contract_id = NULL WHERE id = ANY (contracts) AND parent_contract_id IS NOT NULL;
  DELETE FROM public.employment_contracts WHERE id = ANY (contracts);
  DELETE FROM public.attendance WHERE employee_id = ANY (emps);
  DELETE FROM public.leave_requests WHERE id = ANY (leave_ids);
  DELETE FROM public.leave_balances WHERE employee_id = ANY (emps);
  DELETE FROM public.hr_documents WHERE id = ANY (docs);
  DELETE FROM public.candidates WHERE id = ANY (cands);
  FOR fk IN SELECT x ->> 'table' AS tbl, x ->> 'column' AS col FROM jsonb_array_elements(others) x LOOP
    EXECUTE format('DELETE FROM %s WHERE %I = ANY ($1)', fk.tbl, fk.col) USING emps;
  END LOOP;
  DELETE FROM auth.users WHERE id = ANY (logins);          -- staff_users rows go with them (ON DELETE CASCADE)
  DELETE FROM public.staff_users WHERE id = ANY (logins);  -- in case a row had no auth user
  DELETE FROM public.employees WHERE id = ANY (emps);

  FOR ctr IN SELECT * FROM jsonb_to_recordset(counters) AS t(doc_type text, year integer, "from" integer, "to" integer) LOOP
    UPDATE public.hr_document_counters SET last_value = ctr."to" WHERE doc_type = ctr.doc_type AND year = ctr.year;
  END LOOP;

  PERFORM set_config('leave.rpc', '', true);
  PERFORM set_config('hr_docs.rpc', '', true);
  PERFORM set_config('app.uat_cleanup', '', true);

  INSERT INTO public.audit_log (actor_id, action, table_name, record_id, metadata)
  VALUES (NULL, 'uat.cleanup', 'employees', 'uat',
          jsonb_build_object('removed', counts, 'other_tables', others, 'counters', counters, 'files', files));

  RETURN jsonb_build_object('dry_run', false, 'removed', counts, 'other_tables', others, 'counters', counters, 'files', files);
END;
$_$;


ALTER FUNCTION "public"."cleanup_uat_data"("p_dry_run" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_past_orders"() RETURNS "void"
    LANGUAGE "sql"
    AS $$
  UPDATE public.orders
  SET status = 'completed', "updatedAt" = now()
  WHERE status = 'confirmed' AND end_date::date < CURRENT_DATE;
$$;


ALTER FUNCTION "public"."complete_past_orders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."contracts_due_for_reminder"("p_today" "date") RETURNS TABLE("contract_id" "uuid", "employee_id" "text", "employee_name" "text", "end_date" "date", "threshold_days" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT (public.can_manage_hr() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Only HR can see contract reminders.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT c.id, c.employee_id, public.hr_employee_name(c.employee_id), c.end_date, t.th
      FROM public.employment_contracts c
     CROSS JOIN LATERAL (
       SELECT CASE WHEN c.end_date < p_today THEN 0
                   WHEN (c.end_date - p_today) IN (60, 30, 7) THEN (c.end_date - p_today)
              END AS th
     ) t
     WHERE c.status = 'active' AND c.end_date IS NOT NULL AND t.th IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.contract_expiry_notices n WHERE n.contract_id = c.id AND n.threshold_days = t.th)
     ORDER BY t.th DESC, c.end_date;
END;
$$;


ALTER FUNCTION "public"."contracts_due_for_reminder"("p_today" "date") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "text" NOT NULL,
    "proformaId" "text",
    "status" "text",
    "invoiceDate" timestamp with time zone,
    "clientId" "text",
    "receiverName" "text",
    "receiverPosition" "text",
    "lpoNumber" "text",
    "location" "text",
    "numberOfDays" integer,
    "multiplyByDays" boolean,
    "serviceCharge" numeric DEFAULT 0 NOT NULL,
    "transportCosts" numeric DEFAULT 0 NOT NULL,
    "vatType" "text",
    "selectedEventType" "text",
    "customEventType" "text",
    "startDate" timestamp with time zone,
    "endDate" timestamp with time zone,
    "serviceFields" "jsonb",
    "serviceDesc" "text",
    "items" "jsonb",
    "signedAtDate" timestamp with time zone,
    "signedAtLocation" "text",
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "updatedAt" timestamp with time zone DEFAULT "now"(),
    "region" "public"."region",
    "amountPaid" numeric DEFAULT 0,
    "orderId" "text",
    "paymentDate" timestamp with time zone,
    CONSTRAINT "invoices_service_charge_nonneg" CHECK (("serviceCharge" >= (0)::numeric)),
    CONSTRAINT "invoices_transport_costs_nonneg" CHECK (("transportCosts" >= (0)::numeric))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_invoice_from_proforma"("p_invoice" "jsonb") RETURNS "public"."invoices"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_proforma_id TEXT := p_invoice->>'proformaId';
  v_existing_id TEXT;
  v_is_voided BOOLEAN;
  v_result public.invoices;
BEGIN
  IF v_proforma_id IS NOT NULL THEN
    SELECT "isVoided" INTO v_is_voided FROM public.proforma_invoices WHERE id = v_proforma_id;
    IF v_is_voided THEN
      RAISE EXCEPTION 'Proforma % has been marked Uninvoiced and can never be invoiced.', v_proforma_id;
    END IF;

    SELECT id INTO v_existing_id FROM public.invoices WHERE "proformaId" = v_proforma_id LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'A final invoice (%) already exists for this proforma. Open that invoice instead of creating a new one.', v_existing_id;
    END IF;
  END IF;

  INSERT INTO public.invoices
  SELECT * FROM jsonb_populate_record(NULL::public.invoices, p_invoice)
  RETURNING * INTO v_result;

  IF v_proforma_id IS NOT NULL THEN
    UPDATE public.proforma_invoices SET "isInvoiced" = true WHERE id = v_proforma_id;
  END IF;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."create_invoice_from_proforma"("p_invoice" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_employee_id"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT employee_id FROM public.staff_users
  WHERE id = public.safe_auth_uid() AND is_active = true;
$$;


ALTER FUNCTION "public"."current_employee_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_employee"("p_employee" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  emp public.employees%ROWTYPE;
  attached text;
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can delete employees.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO emp FROM public.employees WHERE id = p_employee FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found.'; END IF;

  SELECT string_agg(h.records || ' ' || h.what, ', ' ORDER BY h.what) INTO attached FROM public.employee_history(p_employee) h;
  IF attached IS NOT NULL THEN
    RAISE EXCEPTION '% cannot be deleted: they have %. Employment records must be kept; end their employment instead (they become Inactive).',
      trim(concat_ws(' ', emp."firstName", emp."lastName")), attached
      USING HINT = 'HAS_HISTORY';
  END IF;

  PERFORM set_config('app.hr_deleting_employee', 'on', true);
  DELETE FROM public.employees WHERE id = p_employee;   -- audited by audit_row_change
  PERFORM set_config('app.hr_deleting_employee', '', true);
END;
$$;


ALTER FUNCTION "public"."delete_employee"("p_employee" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_invoice_and_revert_proforma"("p_invoice_id" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_proforma_id TEXT;
BEGIN
  SELECT "proformaId" INTO v_proforma_id FROM public.invoices WHERE id = p_invoice_id;

  DELETE FROM public.invoices WHERE id = p_invoice_id;

  IF v_proforma_id IS NOT NULL THEN
    UPDATE public.proforma_invoices
    SET "isInvoiced" = false, "updatedAt" = now()
    WHERE id = v_proforma_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."delete_invoice_and_revert_proforma"("p_invoice_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text", "p_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_email TEXT;
  v_auth_user_id UUID;
BEGIN
  SELECT email, auth_user_id INTO v_email, v_auth_user_id
  FROM marketing_users WHERE id = p_marketer_id;

  UPDATE marketing_users SET
    is_active           = false,
    approval_status      = 'DELETED',
    full_name            = 'Deleted Account',
    first_name           = NULL,
    middle_name          = NULL,
    last_name            = NULL,
    email                = 'deleted_' || p_marketer_id || '@abbys.internal',
    google_email         = NULL,
    google_name          = NULL,
    google_avatar_url    = NULL,
    phone                = NULL,
    physical_address     = NULL,
    nida_number          = NULL,
    tin_number           = NULL,
    emergency_name        = NULL,
    emergency_phone       = NULL,
    emergency_address     = NULL,
    profile_photo_path    = NULL,
    auth_user_id          = NULL,
    deleted_at            = NOW(),
    deleted_by            = p_manager_id
  WHERE id = p_marketer_id;

  INSERT INTO marketer_account_actions
    (marketer_id, action, performed_by, reason, internal_notes,
     visible_to_marketer)
  VALUES
    (p_marketer_id, 'DELETED', p_manager_id, p_reason,
     COALESCE(p_notes, '') || ' | Original email: ' || COALESCE(v_email, 'unknown'),
     false);

  INSERT INTO marketer_approval_log (marketer_id, action, performed_by, reason)
  VALUES (p_marketer_id, 'DELETED', p_manager_id, p_reason);

  RETURN jsonb_build_object('auth_user_id', v_auth_user_id);
END;
$$;


ALTER FUNCTION "public"."delete_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."disable_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text", "p_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE marketing_users SET
    is_active       = false,
    approval_status = 'DISABLED',
    disabled_reason = p_reason,
    disabled_at     = NOW(),
    disabled_by     = p_manager_id
  WHERE id = p_marketer_id;

  INSERT INTO marketer_account_actions
    (marketer_id, action, performed_by, reason, internal_notes)
  VALUES
    (p_marketer_id, 'DISABLED', p_manager_id, p_reason, p_notes);

  INSERT INTO marketer_approval_log (marketer_id, action, performed_by, reason)
  VALUES (p_marketer_id, 'DISABLED', p_manager_id, p_reason);
END;
$$;


ALTER FUNCTION "public"."disable_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."employee_history"("p_employee" "text") RETURNS TABLE("what" "text", "records" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  fk record;
  n bigint;
BEGIN
  IF NOT public.can_manage_hr() AND public.safe_auth_uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can see what is recorded for an employee.' USING ERRCODE = '42501';
  END IF;
  FOR fk IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND c.confrelid = 'public.employees'::regclass AND array_length(c.conkey, 1) = 1
       AND c.conrelid::regclass::text NOT IN ('staff_users', 'candidates')
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', fk.tbl, fk.col) INTO n USING p_employee;
    IF n > 0 THEN
      what := CASE fk.tbl::text
        WHEN 'attendance' THEN 'attendance day(s)'
        WHEN 'payroll' THEN 'payslip(s)'
        WHEN 'leave_requests' THEN 'leave request(s)'
        WHEN 'leave_balances' THEN 'leave balance(s)'
        WHEN 'hr_documents' THEN 'HR letter(s)'
        WHEN 'employment_contracts' THEN 'contract(s)'
        WHEN 'disciplinary_records' THEN 'warning(s)'
        WHEN 'recognition_records' THEN 'recognition record(s)'
        ELSE fk.tbl::text || ' row(s)' END;
      records := n;
      RETURN NEXT;
    END IF;
  END LOOP;
  IF to_regclass('public.training_participants') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.training_participants WHERE employee_id = $1' INTO n USING p_employee;
    IF n > 0 THEN what := 'training record(s)'; records := n; RETURN NEXT; END IF;
  END IF;
END;
$_$;


ALTER FUNCTION "public"."employee_history"("p_employee" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."employees_delete_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF public.safe_auth_uid() IS NULL
     OR coalesce(current_setting('app.hr_deleting_employee', true), '') = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Employees are deleted with "Delete employee", which first checks that they have no records.';
END;
$$;


ALTER FUNCTION "public"."employees_delete_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."employees_status_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  ending boolean := coalesce(current_setting('app.hr_ending_employment', true), '') = 'on';
  noise constant text[] := ARRAY['updated_by', 'updatedAt', 'updated_at'];
BEGIN
  -- No signed-in user: maintenance or migrations, not an end user.
  IF public.safe_auth_uid() IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'Inactive' AND NOT ending THEN
      RAISE EXCEPTION 'A new employee is always added as Active.';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'Active' AND NEW.status = 'Inactive' AND NOT ending THEN
    RAISE EXCEPTION 'Employment is ended with a termination letter, or with "End employment without a letter". It cannot be switched off here.';
  END IF;
  IF OLD.status = 'Inactive' AND NEW.status = 'Active' THEN
    -- Reactivation (re-hire): the only change allowed on someone who has left.
    NEW."employmentEndDate" := NULL;
    NEW."employmentEndReason" := NULL;
    RETURN NEW;
  END IF;
  IF OLD.status = 'Inactive' AND NEW.status = 'Inactive' AND NOT ending
     AND (to_jsonb(NEW) - noise) IS DISTINCT FROM (to_jsonb(OLD) - noise) THEN
    RAISE EXCEPTION '% has left and their record is closed. Reactivate them (re-hire) to make changes.',
      trim(concat_ws(' ', OLD."firstName", OLD."lastName"));
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."employees_status_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."end_employment_without_letter"("p_employee" "text", "p_end_date" "date", "p_reason" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  emp public.employees%ROWTYPE;
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can end employment.' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Give the reason employment is ending; it is kept on the employee record.';
  END IF;
  IF p_end_date IS NULL THEN RAISE EXCEPTION 'Choose the last working day.'; END IF;
  SELECT * INTO emp FROM public.employees WHERE id = p_employee FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found.'; END IF;
  IF emp.status <> 'Active' THEN RAISE EXCEPTION 'This employee is not active.'; END IF;
  RETURN public.hr_end_employment(p_employee, p_end_date, trim(p_reason));
END;
$$;


ALTER FUNCTION "public"."end_employment_without_letter"("p_employee" "text", "p_end_date" "date", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_leave_balance"("p_employee" "text", "p_type" "uuid", "p_year" integer) RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  INSERT INTO public.leave_balances (employee_id, leave_type_id, year, entitled)
  SELECT p_employee, lt.id, p_year, lt.days_per_year
  FROM public.leave_types lt WHERE lt.id = p_type AND lt.tracks_balance
  ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;
$$;


ALTER FUNCTION "public"."ensure_leave_balance"("p_employee" "text", "p_type" "uuid", "p_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expire_offers"("p_today" "date" DEFAULT NULL::"date") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  n integer;
  today date := coalesce(p_today, public.hr_today());
BEGIN
  IF NOT (public.can_manage_hr() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Only HR can expire offers.' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('hr_docs.rpc', '1', true);
  UPDATE public.candidates c SET offer_status = 'expired'
    FROM public.hr_documents d
   WHERE c.offer_status = 'offered' AND d.id = c.offer_document_id
     AND nullif(d.data ->> 'acceptanceDeadline', '')::date < today;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('hr_docs.rpc', '', true);
  RETURN n;
END;
$$;


ALTER FUNCTION "public"."expire_offers"("p_today" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_nearby_companies"("p_lat" double precision, "p_lng" double precision, "p_radius_m" double precision DEFAULT 150) RETURNS TABLE("id" "uuid", "name" "text", "distance_m" double precision, "pipeline_stage" "text", "assigned_marketer_id" "uuid", "landed_by_name" "text", "contact_name" "text", "last_visited_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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


ALTER FUNCTION "public"."find_nearby_companies"("p_lat" double precision, "p_lng" double precision, "p_radius_m" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_employee_directory"() RETURNS TABLE("id" "text", "firstName" "text", "lastName" "text", "department" "text", "role" "text", "status" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT e.id, e."firstName", e."lastName", e.department, e.role, e.status
    FROM public.employees e;
END;
$$;


ALTER FUNCTION "public"."get_employee_directory"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_employee_directory_for_portal"() RETURNS TABLE("id" "text", "firstName" "text", "lastName" "text", "department" "text", "role" "text", "status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.has_portal_role(ARRAY['super_admin', 'finance']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT e.id, e."firstName", e."lastName", e.department, e.role, e.status
    FROM public.employees e;
END;
$$;


ALTER FUNCTION "public"."get_employee_directory_for_portal"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_company_settings"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF (NEW.company_name, NEW.company_address, NEW.company_phone, NEW.company_email, NEW.company_tin, NEW.company_vrn)
     IS DISTINCT FROM
     (OLD.company_name, OLD.company_address, OLD.company_phone, OLD.company_email, OLD.company_tin, OLD.company_vrn)
     -- No signed-in user means maintenance/migrations, not an end user.
     AND public.safe_auth_uid() IS NOT NULL
     AND NOT public.can_manage_settings()
  THEN
    RAISE EXCEPTION 'Only an Admin can change the company details.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."guard_company_settings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_hr_settings"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF (NEW.hr_modules IS DISTINCT FROM OLD.hr_modules OR NEW.hr_go_live_at IS DISTINCT FROM OLD.hr_go_live_at)
     -- No signed-in user: the SQL editor, migrations or the service role.
     AND public.safe_auth_uid() IS NOT NULL
     AND NOT public.can_manage_settings()
  THEN
    RAISE EXCEPTION 'Only an Admin can change which HR modules are switched on, or the go-live date.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."guard_hr_settings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_expense_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_expense_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_supplier_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_supplier_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_portal_role"("roles" "text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.portal_users
    WHERE id = public.portal_uid() AND is_active = true AND role = ANY(roles)
  );
$$;


ALTER FUNCTION "public"."has_portal_role"("roles" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_staff_role"("roles" "text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_users
    WHERE id = public.safe_auth_uid() AND is_active = true AND role = ANY (roles)
  );
$$;


ALTER FUNCTION "public"."has_staff_role"("roles" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hr_doc_apply_effects"("d" "public"."hr_documents") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  k public.employment_contracts%ROWTYPE;
  v_type text; v_end date; v_incident date; v_last date;
  changes text[];
  type_label text;
  emp_name text;
BEGIN
  IF d.doc_type = 'offer' THEN
    PERFORM set_config('hr_docs.rpc', '1', true);
    UPDATE public.candidates
       SET offer_status = 'offered', offer_document_id = d.id, responded_at = NULL
     WHERE id = d.candidate_id AND offer_document_id IS DISTINCT FROM d.id;
    RETURN;
  END IF;

  IF d.doc_type = 'contract' THEN
    IF EXISTS (SELECT 1 FROM public.employment_contracts WHERE document_id = d.id) THEN RETURN; END IF;
    v_type := d.data ->> 'contractType';
    INSERT INTO public.employment_contracts
      (employee_id, contract_type, start_date, end_date, position, salary, probation_months, notice_days, status, document_id, source)
    VALUES (
      d.employee_id, v_type,
      public.hr_doc_date(d.data, 'startDate', 'The start date'),
      public.hr_doc_date(d.data, 'endDate', 'The end date', v_type <> 'permanent'),
      public.hr_doc_text(d.data, 'position', 'The position'),
      public.hr_doc_num(d.data, 'salary', 'The salary'),
      public.hr_doc_num(d.data, 'probationMonths', 'Probation', false)::integer,
      public.hr_doc_num(d.data, 'noticeDays', 'Notice', false)::integer,
      'active', d.id, 'letter'
    );
    UPDATE public.employees SET "employmentStartDate" = public.hr_doc_date(d.data, 'startDate', 'The start date')
     WHERE id = d.employee_id AND "employmentStartDate" IS NULL;
    RETURN;
  END IF;

  IF d.doc_type = 'extension' THEN
    IF EXISTS (SELECT 1 FROM public.employment_contracts WHERE document_id = d.id) THEN RETURN; END IF;
    SELECT * INTO k FROM public.employment_contracts WHERE id = (d.data ->> 'contractId')::uuid FOR UPDATE;
    v_end := public.hr_doc_date(d.data, 'newEndDate', 'The new end date');
    -- Parent first, so the one-active-contract rule is never broken in between.
    UPDATE public.employment_contracts SET status = 'extended' WHERE id = k.id;
    INSERT INTO public.employment_contracts
      (employee_id, contract_type, start_date, end_date, position, salary, probation_months, notice_days,
       status, parent_contract_id, document_id, source)
    VALUES (
      k.employee_id, k.contract_type, k.end_date + 1, v_end, k.position,
      coalesce(public.hr_doc_num(d.data, 'newSalary', 'The new salary', false), k.salary),
      0, k.notice_days, 'active', k.id, d.id, 'letter'
    );
    RETURN;
  END IF;

  IF d.doc_type = 'termination' THEN
    -- Idempotent: if the employee is already Inactive this letter has run.
    IF EXISTS (SELECT 1 FROM public.employees WHERE id = d.employee_id AND status = 'Inactive') THEN RETURN; END IF;
    v_last := public.hr_doc_date(d.data, 'lastWorkingDay', 'The last working day');
    type_label := initcap(replace(d.data ->> 'terminationType', '_', ' '));
    changes := public.hr_end_employment(
      d.employee_id, v_last,
      left(type_label || ': ' || coalesce(d.data ->> 'reason', ''), 1000)
    );
    emp_name := public.hr_employee_name(d.employee_id);
    PERFORM public.notify_hr_roles(
      'employment_ended',
      format('Employment ended: %s', emp_name),
      format('Termination letter %s was issued. %s Consider issuing a Certificate of Service.', d.ref_no, array_to_string(changes, ' ')),
      '/hr/employees?open=' || d.employee_id
    );
    RETURN;
  END IF;

  IF d.doc_type = 'warning' THEN
    IF EXISTS (SELECT 1 FROM public.disciplinary_records WHERE document_id = d.id) THEN RETURN; END IF;
    v_incident := public.hr_doc_date(d.data, 'incidentDate', 'The incident date');
    INSERT INTO public.disciplinary_records (employee_id, level, offence_category, incident_date, expires_on, status, document_id)
    VALUES (
      d.employee_id, d.data ->> 'level', d.data ->> 'offenceCategory', v_incident,
      coalesce(public.hr_doc_date(d.data, 'expiresOn', 'The expiry date', false), (v_incident + interval '12 months')::date),
      'active', d.id
    );
    RETURN;
  END IF;

  IF d.doc_type = 'recognition' THEN
    IF EXISTS (SELECT 1 FROM public.recognition_records WHERE document_id = d.id) THEN RETURN; END IF;
    v_type := d.data ->> 'rewardType';
    INSERT INTO public.recognition_records (employee_id, category, reward_type, amount, payroll_status, status, document_id)
    VALUES (
      d.employee_id, d.data ->> 'category', v_type,
      CASE WHEN v_type = 'cash' THEN public.hr_doc_num(d.data, 'amount', 'The cash amount') ELSE public.hr_doc_num(d.data, 'amount', 'The amount', false) END,
      CASE WHEN v_type = 'cash' THEN 'pending' ELSE 'not_applicable' END,
      'active', d.id
    );
    RETURN;
  END IF;

  -- general_letter, certificate_of_service: no record changes.
END;
$$;


ALTER FUNCTION "public"."hr_doc_apply_effects"("d" "public"."hr_documents") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hr_doc_date"("p_data" "jsonb", "p_key" "text", "p_label" "text", "p_required" boolean DEFAULT true) RETURNS "date"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  v text := nullif(trim(coalesce(p_data ->> p_key, '')), '');
BEGIN
  IF v IS NULL THEN
    IF p_required THEN RAISE EXCEPTION '% is missing.', p_label; END IF;
    RETURN NULL;
  END IF;
  RETURN v::date;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
  RAISE EXCEPTION '% is not a valid date.', p_label;
END;
$$;


ALTER FUNCTION "public"."hr_doc_date"("p_data" "jsonb", "p_key" "text", "p_label" "text", "p_required" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hr_doc_draft_marker"() RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT 'DRAFT TEMPLATE — HR Manager to replace this wording before use.'::text;
$$;


ALTER FUNCTION "public"."hr_doc_draft_marker"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hr_doc_notify_approvers"("p_exclude" "uuid", "p_type" "text", "p_title" "text", "p_body" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  r uuid;
BEGIN
  FOR r IN
    SELECT s.id FROM public.staff_users s
    WHERE s.is_active AND s.role IN ('admin', 'hr_manager', 'general_manager')
      AND s.id IS DISTINCT FROM p_exclude
  LOOP
    PERFORM public.notify_user(r, p_type, p_title, p_body, '/hr/documents');
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."hr_doc_notify_approvers"("p_exclude" "uuid", "p_type" "text", "p_title" "text", "p_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hr_doc_num"("p_data" "jsonb", "p_key" "text", "p_label" "text", "p_required" boolean DEFAULT true) RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  v text := nullif(trim(coalesce(p_data ->> p_key, '')), '');
BEGIN
  IF v IS NULL THEN
    IF p_required THEN RAISE EXCEPTION '% is missing.', p_label; END IF;
    RETURN NULL;
  END IF;
  RETURN v::numeric;
EXCEPTION WHEN invalid_text_representation THEN
  RAISE EXCEPTION '% is not a number.', p_label;
END;
$$;


ALTER FUNCTION "public"."hr_doc_num"("p_data" "jsonb", "p_key" "text", "p_label" "text", "p_required" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hr_doc_text"("p_data" "jsonb", "p_key" "text", "p_label" "text", "p_required" boolean DEFAULT true) RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  v text := nullif(trim(coalesce(p_data ->> p_key, '')), '');
BEGIN
  IF v IS NULL AND p_required THEN RAISE EXCEPTION '% is missing.', p_label; END IF;
  RETURN v;
END;
$$;


ALTER FUNCTION "public"."hr_doc_text"("p_data" "jsonb", "p_key" "text", "p_label" "text", "p_required" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hr_doc_validate"("d" "public"."hr_documents", "p_stage" "text" DEFAULT 'issue'::"text") RETURNS "void"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  tpl_body text;
  emp public.employees%ROWTYPE;
  cand public.candidates%ROWTYPE;
  k public.employment_contracts%ROWTYPE;
  v_type text; v_start date; v_end date; v_date date; v_date2 date; v_num numeric;
  w text;
BEGIN
  -- A letter written from draft template wording never goes further.
  SELECT body INTO tpl_body FROM public.hr_document_templates WHERE id = d.template_id;
  IF position(public.hr_doc_draft_marker() IN coalesce(tpl_body, '')) > 0 THEN
    RAISE EXCEPTION 'This letter was written from a DRAFT template. Ask the HR Manager to save the final wording under Templates, then use "Update to latest" on this letter.';
  END IF;

  IF d.doc_type = 'general_letter' THEN
    RETURN; -- unchanged from Phase 3
  END IF;

  -- ── Offer: for a candidate ──────────────────────────────────────────────
  IF d.doc_type = 'offer' THEN
    IF d.candidate_id IS NULL OR d.employee_id IS NOT NULL THEN
      RAISE EXCEPTION 'An offer letter is written for a candidate, not an employee.';
    END IF;
    SELECT * INTO cand FROM public.candidates WHERE id = d.candidate_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'The candidate for this offer no longer exists.'; END IF;
    IF cand.employee_id IS NOT NULL THEN
      RAISE EXCEPTION '% is already an employee.', cand.full_name;
    END IF;
    IF cand.offer_status IN ('offered', 'accepted') AND cand.offer_document_id IS DISTINCT FROM d.id THEN
      RAISE EXCEPTION '% already has an offer that is open or accepted. Record the response to it (or void it) first.', cand.full_name;
    END IF;
    PERFORM public.hr_doc_text(d.data, 'position', 'The position');
    v_num := public.hr_doc_num(d.data, 'salary', 'The salary');
    IF v_num <= 0 THEN RAISE EXCEPTION 'The salary must be more than zero.'; END IF;
    PERFORM public.hr_doc_date(d.data, 'startDate', 'The start date');
    v_date := public.hr_doc_date(d.data, 'acceptanceDeadline', 'The acceptance deadline');
    IF p_stage = 'issue' AND v_date < public.hr_today() THEN
      RAISE EXCEPTION 'The acceptance deadline (%) has passed. Return the letter to draft and set a new one.', v_date;
    END IF;
    RETURN;
  END IF;

  -- ── Everything else: for an employee ────────────────────────────────────
  IF d.employee_id IS NULL OR d.candidate_id IS NOT NULL THEN
    RAISE EXCEPTION 'This letter is written for an employee.';
  END IF;
  SELECT * INTO emp FROM public.employees WHERE id = d.employee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'The employee for this letter no longer exists.'; END IF;

  IF d.doc_type = 'certificate_of_service' THEN
    IF emp.status <> 'Inactive' OR emp."employmentEndDate" IS NULL THEN
      RAISE EXCEPTION 'A certificate of service is for someone whose employment has ended. % is still Active or has no end date.', public.hr_employee_name(emp.id);
    END IF;
    RETURN;
  END IF;

  IF emp.status <> 'Active' THEN
    RAISE EXCEPTION '% is not an active employee.', public.hr_employee_name(emp.id);
  END IF;

  IF d.doc_type = 'contract' THEN
    v_type := public.hr_doc_text(d.data, 'contractType', 'The contract type');
    IF v_type NOT IN ('permanent', 'fixed_term', 'probation', 'casual') THEN RAISE EXCEPTION 'Unknown contract type.'; END IF;
    v_start := public.hr_doc_date(d.data, 'startDate', 'The start date');
    v_end := public.hr_doc_date(d.data, 'endDate', 'The end date', v_type <> 'permanent');
    IF v_end IS NOT NULL AND v_end < v_start THEN RAISE EXCEPTION 'The end date cannot be before the start date.'; END IF;
    PERFORM public.hr_doc_text(d.data, 'position', 'The position');
    v_num := public.hr_doc_num(d.data, 'salary', 'The salary');
    IF v_num < 0 THEN RAISE EXCEPTION 'The salary cannot be negative.'; END IF;
    IF EXISTS (SELECT 1 FROM public.employment_contracts WHERE employee_id = emp.id AND status = 'active') THEN
      RAISE EXCEPTION '% already has an active contract. Extend it, or let it end, before issuing a new one.', public.hr_employee_name(emp.id);
    END IF;

  ELSIF d.doc_type = 'extension' THEN
    BEGIN
      SELECT * INTO k FROM public.employment_contracts WHERE id = (d.data ->> 'contractId')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Choose the contract being extended.';
    END;
    IF k.id IS NULL OR k.employee_id <> emp.id THEN RAISE EXCEPTION 'Choose one of this employee''s contracts to extend.'; END IF;
    IF k.status <> 'active' THEN RAISE EXCEPTION 'The contract being extended is no longer active (it is %).', k.status; END IF;
    IF k.end_date IS NULL THEN RAISE EXCEPTION 'A permanent contract has no end date to extend.'; END IF;
    v_end := public.hr_doc_date(d.data, 'newEndDate', 'The new end date');
    IF v_end <= k.end_date THEN RAISE EXCEPTION 'The new end date must be after the current end date (%).', k.end_date; END IF;
    v_num := public.hr_doc_num(d.data, 'newSalary', 'The new salary', false);
    IF v_num IS NOT NULL AND v_num < 0 THEN RAISE EXCEPTION 'The new salary cannot be negative.'; END IF;
    PERFORM public.hr_doc_text(d.data, 'reason', 'The reason');

  ELSIF d.doc_type = 'termination' THEN
    v_type := public.hr_doc_text(d.data, 'terminationType', 'The type of termination');
    IF v_type NOT IN ('resignation', 'end_of_contract', 'misconduct', 'poor_performance', 'redundancy', 'mutual_agreement', 'other') THEN
      RAISE EXCEPTION 'Unknown type of termination.';
    END IF;
    v_date := public.hr_doc_date(d.data, 'noticeDate', 'The notice date');
    v_date2 := public.hr_doc_date(d.data, 'lastWorkingDay', 'The last working day');
    IF v_date2 < v_date THEN RAISE EXCEPTION 'The last working day cannot be before the notice date.'; END IF;
    PERFORM public.hr_doc_text(d.data, 'reason', 'The reason');
    IF jsonb_typeof(d.data -> 'warningIds') = 'array' THEN
      FOR w IN SELECT jsonb_array_elements_text(d.data -> 'warningIds') LOOP
        IF NOT EXISTS (SELECT 1 FROM public.disciplinary_records r WHERE r.id::text = w AND r.employee_id = emp.id AND r.status <> 'void') THEN
          RAISE EXCEPTION 'One of the linked warnings does not belong to this employee or has been voided.';
        END IF;
      END LOOP;
    END IF;

  ELSIF d.doc_type = 'warning' THEN
    v_type := public.hr_doc_text(d.data, 'level', 'The warning level');
    IF v_type NOT IN ('verbal', 'first_written', 'final_written') THEN RAISE EXCEPTION 'Unknown warning level.'; END IF;
    PERFORM public.hr_doc_text(d.data, 'offenceCategory', 'The offence category');
    v_date := public.hr_doc_date(d.data, 'incidentDate', 'The incident date');
    IF v_date > public.hr_today() THEN RAISE EXCEPTION 'The incident date cannot be in the future.'; END IF;
    v_date2 := public.hr_doc_date(d.data, 'expiresOn', 'The expiry date', false);
    IF v_date2 IS NOT NULL AND v_date2 < v_date THEN RAISE EXCEPTION 'The warning cannot expire before the incident date.'; END IF;
    PERFORM public.hr_doc_text(d.data, 'description', 'The description');

  ELSIF d.doc_type = 'recognition' THEN
    v_type := public.hr_doc_text(d.data, 'category', 'The category');
    IF v_type NOT IN ('performance', 'long_service', 'conduct', 'customer_praise', 'other') THEN RAISE EXCEPTION 'Unknown recognition category.'; END IF;
    v_type := public.hr_doc_text(d.data, 'rewardType', 'The reward type');
    IF v_type NOT IN ('none', 'cash', 'voucher', 'gift', 'time_off') THEN RAISE EXCEPTION 'Unknown reward type.'; END IF;
    IF v_type = 'cash' THEN
      v_num := public.hr_doc_num(d.data, 'amount', 'The cash amount');
      IF v_num <= 0 THEN RAISE EXCEPTION 'A cash reward needs an amount above zero.'; END IF;
    END IF;
    PERFORM public.hr_doc_text(d.data, 'reason', 'The reason');
  END IF;
END;
$$;


ALTER FUNCTION "public"."hr_doc_validate"("d" "public"."hr_documents", "p_stage" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hr_doc_void_effects"("d" "public"."hr_documents") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  child public.employment_contracts%ROWTYPE;
  parent public.employment_contracts%ROWTYPE;
BEGIN
  IF d.doc_type = 'offer' THEN
    PERFORM set_config('hr_docs.rpc', '1', true);
    UPDATE public.candidates SET offer_status = 'none', offer_document_id = NULL, responded_at = NULL
     WHERE offer_document_id = d.id;

  ELSIF d.doc_type = 'contract' THEN
    UPDATE public.employment_contracts SET status = 'void' WHERE document_id = d.id;

  ELSIF d.doc_type = 'extension' THEN
    UPDATE public.employment_contracts SET status = 'void' WHERE document_id = d.id RETURNING * INTO child;
    IF FOUND AND child.parent_contract_id IS NOT NULL THEN
      SELECT * INTO parent FROM public.employment_contracts WHERE id = child.parent_contract_id FOR UPDATE;
      -- Back to active only if nothing else continues it and the employee has no
      -- other active contract (e.g. a new contract issued since).
      IF parent.status = 'extended'
         AND NOT EXISTS (SELECT 1 FROM public.employment_contracts c WHERE c.parent_contract_id = parent.id AND c.status <> 'void')
         AND NOT EXISTS (SELECT 1 FROM public.employment_contracts c WHERE c.employee_id = parent.employee_id AND c.status = 'active') THEN
        UPDATE public.employment_contracts SET status = 'active' WHERE id = parent.id;
      END IF;
    END IF;

  ELSIF d.doc_type = 'warning' THEN
    UPDATE public.disciplinary_records SET status = 'void' WHERE document_id = d.id;

  ELSIF d.doc_type = 'recognition' THEN
    -- A reward already paid stays recorded as paid; HR settles that by hand.
    UPDATE public.recognition_records
       SET status = 'void', payroll_status = CASE WHEN payroll_status = 'pending' THEN 'not_applicable' ELSE payroll_status END
     WHERE document_id = d.id;
  END IF;
  -- termination: the employee is deliberately NOT reactivated (the app tells HR
  -- to reactivate by hand if that is intended). certificate / general: nothing.
END;
$$;


ALTER FUNCTION "public"."hr_doc_void_effects"("d" "public"."hr_documents") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hr_document_templates_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.hr_documents d WHERE d.template_id = OLD.id) THEN
      RAISE EXCEPTION 'This template version is used by existing documents and cannot be deleted.';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.doc_type IS DISTINCT FROM OLD.doc_type OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.title IS DISTINCT FROM OLD.title OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.use_stored_signature IS DISTINCT FROM OLD.use_stored_signature THEN
    RAISE EXCEPTION 'A saved template version cannot be edited. Save a new version instead.';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."hr_document_templates_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hr_document_types_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Document types cannot be deleted.';
  END IF;
  IF TG_OP = 'INSERT' THEN
    RETURN NEW; -- the list is seeded; Phase 4 adds none, but a migration may
  END IF;
  IF NEW.doc_type IS DISTINCT FROM OLD.doc_type OR NEW.code IS DISTINCT FROM OLD.code THEN
    RAISE EXCEPTION 'A document type''s name and code cannot be changed: they are part of issued reference numbers.';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."hr_document_types_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hr_documents_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  via_rpc boolean := coalesce(current_setting('hr_docs.rpc', true), '') = '1';
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Whatever the client sent, a new document is a blank draft.
    NEW.status := 'draft';
    NEW.ref_no := NULL;
    NEW.return_note := NULL; NEW.void_reason := NULL; NEW.voided_by := NULL; NEW.voided_at := NULL;
    NEW.pdf_path := NULL; NEW.pdf_sha256 := NULL; NEW.issued_at := NULL;
    NEW.approved_by := NULL; NEW.approved_at := NULL;
    NEW.approved_by_portal := NULL;                                               -- Phase 6
    NEW.issued_content := NULL;                                                   -- export, not stored
    -- The recorded template version is the template's own, not the client's.
    SELECT t.version INTO NEW.template_version
    FROM public.hr_document_templates t
    WHERE t.id = NEW.template_id AND t.doc_type = NEW.doc_type;
    IF NEW.template_version IS NULL THEN
      RAISE EXCEPTION 'That template does not belong to this type of document.';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- Phase 5: the UAT cleanup removes test letters whatever their stage.
    IF public.uat_cleanup_on()
       AND ((OLD.employee_id IS NOT NULL AND public.is_uat_employee(OLD.employee_id))
            OR (OLD.candidate_id IS NOT NULL AND public.is_uat_candidate(OLD.candidate_id))) THEN
      RETURN OLD;
    END IF;
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Only a draft can be deleted. Void this document instead; its reference number stays on record.';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE ---------------------------------------------------------------
  IF OLD.ref_no IS NOT NULL AND NEW.ref_no IS DISTINCT FROM OLD.ref_no THEN
    RAISE EXCEPTION 'A reference number cannot be changed once it has been reserved.';
  END IF;

  IF OLD.status = 'issued' THEN
    IF NOT (via_rpc AND NEW.status = 'void' AND length(trim(coalesce(NEW.void_reason, ''))) > 0) THEN
      RAISE EXCEPTION 'An issued document cannot be changed. It can only be voided, with a reason, and then reissued as a new document.';
    END IF;
    IF to_jsonb(NEW) - ARRAY['status', 'void_reason', 'voided_by', 'voided_at', 'updated_by']
       IS DISTINCT FROM to_jsonb(OLD) - ARRAY['status', 'void_reason', 'voided_by', 'voided_at', 'updated_by'] THEN
      RAISE EXCEPTION 'Voiding an issued document changes nothing else about it.';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'void' THEN
    RAISE EXCEPTION 'A voided document cannot be changed.';
  END IF;

  -- A draft moved to another template takes that template's version.
  IF OLD.status = 'draft' AND NEW.template_id IS DISTINCT FROM OLD.template_id THEN
    SELECT t.version INTO NEW.template_version
    FROM public.hr_document_templates t
    WHERE t.id = NEW.template_id AND t.doc_type = NEW.doc_type;
    IF NEW.template_version IS NULL THEN
      RAISE EXCEPTION 'That template does not belong to this type of document.';
    END IF;
  END IF;

  -- Content freezes as soon as the document leaves draft (it is what the
  -- approver reviews, and what the PDF is built from).
  IF OLD.status <> 'draft' AND (
       NEW.data IS DISTINCT FROM OLD.data OR NEW.template_id IS DISTINCT FROM OLD.template_id
    OR NEW.template_version IS DISTINCT FROM OLD.template_version OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
    OR NEW.candidate_id IS DISTINCT FROM OLD.candidate_id OR NEW.subject IS DISTINCT FROM OLD.subject
    OR NEW.doc_type IS DISTINCT FROM OLD.doc_type OR NEW.confidential IS DISTINCT FROM OLD.confidential
    OR NEW.preview IS DISTINCT FROM OLD.preview                                   -- Phase 6
  ) THEN
    RAISE EXCEPTION 'This document is no longer a draft, so its content is frozen. Return it to draft to edit it.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Phase 6: a letter for someone who has left cannot go forward (voiding still can).
    IF NEW.status IN ('pending_approval', 'approved', 'issued') AND NEW.employee_id IS NOT NULL
       AND public.hr_employee_is_inactive(NEW.employee_id) THEN
      RAISE EXCEPTION '% has left and their record is closed. Reactivate them (re-hire) before this letter can go forward.',
        coalesce(public.hr_employee_name(NEW.employee_id), NEW.employee_id);
    END IF;
    IF NOT via_rpc THEN
      RAISE EXCEPTION 'Use Submit, Approve, Issue or Void to move a document between stages.';
    END IF;
    IF NOT ((OLD.status, NEW.status) IN (
         ('draft', 'pending_approval'), ('pending_approval', 'draft'), ('pending_approval', 'approved'),
         ('approved', 'issued'), ('draft', 'void'), ('pending_approval', 'void'), ('approved', 'void'))) THEN
      RAISE EXCEPTION 'A document cannot go from % to %.', OLD.status, NEW.status;
    END IF;
  ELSIF NOT via_rpc AND (
       NEW.ref_no IS DISTINCT FROM OLD.ref_no OR NEW.return_note IS DISTINCT FROM OLD.return_note
    OR NEW.void_reason IS DISTINCT FROM OLD.void_reason OR NEW.voided_by IS DISTINCT FROM OLD.voided_by
    OR NEW.voided_at IS DISTINCT FROM OLD.voided_at OR NEW.pdf_path IS DISTINCT FROM OLD.pdf_path
    OR NEW.pdf_sha256 IS DISTINCT FROM OLD.pdf_sha256 OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
    OR NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
    OR NEW.approved_by_portal IS DISTINCT FROM OLD.approved_by_portal            -- Phase 6
    OR NEW.issued_content IS DISTINCT FROM OLD.issued_content                    -- export, not stored
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
  ) THEN
    RAISE EXCEPTION 'That field is set by the approval and issue process and cannot be edited directly.';
  END IF;

  -- The signatory may be overridden by hand only while still a draft.
  IF NOT via_rpc AND OLD.status <> 'draft'
     AND (NEW.signatory_name IS DISTINCT FROM OLD.signatory_name OR NEW.signatory_title IS DISTINCT FROM OLD.signatory_title) THEN
    RAISE EXCEPTION 'The signatory can only be changed while the document is a draft.';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."hr_documents_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hr_documents_notify_portal"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  lbl text;
BEGIN
  IF NEW.status = 'pending_approval' AND OLD.status IS DISTINCT FROM 'pending_approval' THEN
    SELECT label INTO lbl FROM public.hr_document_types WHERE doc_type = NEW.doc_type;
    INSERT INTO public.portal_notifications (portal_user_id, type, title, body)
    SELECT pu.id, 'hr_letter_submitted', 'HR letter waiting for approval',
           format('%s: %s', coalesce(lbl, NEW.doc_type), NEW.subject)
      FROM public.portal_users pu
     WHERE pu.is_active AND pu.role IN ('super_admin', 'management');
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."hr_documents_notify_portal"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hr_employee_is_inactive"("p_employee" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.employees WHERE id = p_employee AND status = 'Inactive');
$$;


ALTER FUNCTION "public"."hr_employee_is_inactive"("p_employee" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hr_employee_name"("p_employee" "text") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT trim(concat_ws(' ', e."firstName", e."lastName")) FROM public.employees e WHERE e.id = p_employee;
$$;


ALTER FUNCTION "public"."hr_employee_name"("p_employee" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hr_end_employment"("p_employee" "text", "p_last_day" "date", "p_reason" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  changes text[] := '{}';
  r public.leave_requests%ROWTYPE;
  lt public.leave_types%ROWTYPE;
  k public.employment_contracts%ROWTYPE;
  new_days numeric;
  me uuid := public.safe_auth_uid();
  note text := 'Employment ended ' || to_char(p_last_day, 'FMDD Mon YYYY');
BEGIN
  PERFORM set_config('app.hr_ending_employment', 'on', true);
  UPDATE public.employees
     SET status = 'Inactive', "employmentEndDate" = p_last_day, "employmentEndReason" = p_reason
   WHERE id = p_employee;
  PERFORM set_config('app.hr_ending_employment', '', true);
  changes := changes || format('Employee set to Inactive; last working day %s.', to_char(p_last_day, 'FMDD Mon YYYY'));

  UPDATE public.employment_contracts
     SET status = 'terminated', end_date = greatest(p_last_day, start_date)
   WHERE employee_id = p_employee AND status = 'active'
  RETURNING * INTO k;
  IF FOUND THEN
    changes := changes || format('Contract starting %s marked terminated.', to_char(k.start_date, 'FMDD Mon YYYY'));
  END IF;

  PERFORM set_config('leave.rpc', '1', true);
  FOR r IN
    SELECT * FROM public.leave_requests
     WHERE employee_id = p_employee AND status IN ('approved', 'pending') AND end_date > p_last_day
     ORDER BY start_date FOR UPDATE
  LOOP
    SELECT * INTO lt FROM public.leave_types WHERE id = r.leave_type_id;
    IF r.status = 'pending' THEN
      UPDATE public.leave_requests SET status = 'cancelled', cancelled_by = me, cancelled_at = now(), decision_note = note WHERE id = r.id;
      changes := changes || format('Pending %s leave %s to %s cancelled.', lt.name, r.start_date, r.end_date);
      CONTINUE;
    END IF;

    new_days := CASE WHEN r.start_date > p_last_day THEN 0 ELSE public.leave_working_days(r.start_date, p_last_day) END;
    IF new_days <= 0 THEN
      -- Entirely after the last day: cancel, give the days back, clear its attendance.
      IF lt.tracks_balance THEN
        UPDATE public.leave_balances SET taken = greatest(taken - r.days, 0)
         WHERE employee_id = r.employee_id AND leave_type_id = r.leave_type_id AND year = public.leave_year_of(r.start_date);
      END IF;
      DELETE FROM public.attendance WHERE leave_request_id = r.id;
      UPDATE public.leave_requests SET status = 'cancelled', cancelled_by = me, cancelled_at = now(), decision_note = note WHERE id = r.id;
      changes := changes || format('Approved %s leave %s to %s cancelled; %s day(s) returned.', lt.name, r.start_date, r.end_date, r.days);
    ELSE
      -- Straddles the last day: keep the part up to it.
      IF lt.tracks_balance THEN
        UPDATE public.leave_balances SET taken = greatest(taken - (r.days - new_days), 0)
         WHERE employee_id = r.employee_id AND leave_type_id = r.leave_type_id AND year = public.leave_year_of(r.start_date);
      END IF;
      DELETE FROM public.attendance WHERE leave_request_id = r.id AND date::date > p_last_day;
      UPDATE public.leave_requests
         SET end_date = p_last_day, days = new_days,
             decision_note = concat_ws(' ', nullif(decision_note, ''), '(' || note || '; shortened.)')
       WHERE id = r.id;
      changes := changes || format('Approved %s leave %s to %s shortened to end %s (%s day(s)).', lt.name, r.start_date, r.end_date, p_last_day, new_days);
    END IF;
  END LOOP;
  PERFORM set_config('leave.rpc', '', true);

  RETURN changes;
END;
$$;


ALTER FUNCTION "public"."hr_end_employment"("p_employee" "text", "p_last_day" "date", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hr_go_live_year"() RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT extract(year FROM (coalesce((SELECT hr_go_live_at FROM public.app_settings WHERE id = true), now())
                            AT TIME ZONE 'Africa/Dar_es_Salaam'))::integer;
$$;


ALTER FUNCTION "public"."hr_go_live_year"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hr_notifications_only_read"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.recipient_id IS DISTINCT FROM OLD.recipient_id OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.title IS DISTINCT FROM OLD.title OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.link IS DISTINCT FROM OLD.link OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Notifications can only be marked as read.';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."hr_notifications_only_read"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hr_refuse_if_employee_inactive"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  emp_id text := to_jsonb(NEW) ->> TG_ARGV[0];
BEGIN
  IF emp_id IS NULL OR public.hr_system_change() OR NOT public.hr_employee_is_inactive(emp_id) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION '% has left and their record is closed. Reactivate them (re-hire) first.',
    coalesce(public.hr_employee_name(emp_id), emp_id)
    USING ERRCODE = 'P0001', HINT = 'EMPLOYEE_INACTIVE';
END;
$$;


ALTER FUNCTION "public"."hr_refuse_if_employee_inactive"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hr_system_change"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT public.safe_auth_uid() IS NULL                                   -- SQL editor, migrations, service role
      OR coalesce(current_setting('leave.rpc', true), '') = '1'           -- leave functions, end of employment
      OR coalesce(current_setting('hr_docs.rpc', true), '') = '1'         -- letter lifecycle (e.g. voiding)
      OR coalesce(current_setting('app.hr_ending_employment', true), '') = 'on'
      OR coalesce(current_setting('app.uat_cleanup', true), '') = 'on';
$$;


ALTER FUNCTION "public"."hr_system_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hr_today"() RETURNS "date"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date;
$$;


ALTER FUNCTION "public"."hr_today"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."import_legacy_contracts"("p_rows" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  r jsonb;
  i integer := 0;
  n_active integer := 0;
  n_expired integer := 0;
  emp public.employees%ROWTYPE;
  v_type text; v_start date; v_end date; v_status text; v_position text;
  today date := public.hr_today();
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can import contracts.' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'The file has no rows to import.';
  END IF;
  IF jsonb_array_length(p_rows) > 500 THEN
    RAISE EXCEPTION 'At most 500 rows per file (this one has %). Split it into smaller files.', jsonb_array_length(p_rows);
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    i := i + 1;
    BEGIN
      SELECT * INTO emp FROM public.employees WHERE id = trim(r ->> 'employee_id');
      IF NOT FOUND THEN RAISE EXCEPTION 'employee "%" not found', r ->> 'employee_id'; END IF;
      v_type := lower(trim(r ->> 'contract_type'));
      IF v_type NOT IN ('permanent', 'fixed_term', 'probation', 'casual') THEN
        RAISE EXCEPTION 'contract type must be permanent, fixed_term, probation or casual';
      END IF;
      v_start := public.hr_doc_date(r, 'start_date', 'the start date');
      v_end := public.hr_doc_date(r, 'end_date', 'the end date (needed unless permanent)', v_type <> 'permanent');
      IF v_end IS NOT NULL AND v_end < v_start THEN RAISE EXCEPTION 'the end date is before the start date'; END IF;
      v_position := public.hr_doc_text(r, 'position', 'the position');
      v_status := CASE WHEN v_end IS NOT NULL AND v_end < today THEN 'expired' ELSE 'active' END;
      IF v_status = 'active' AND emp.status <> 'Active' THEN
        RAISE EXCEPTION '% is not an active employee, so this can only be a past contract (end date before today)', public.hr_employee_name(emp.id);
      END IF;
      IF v_status = 'active' AND EXISTS (SELECT 1 FROM public.employment_contracts WHERE employee_id = emp.id AND status = 'active') THEN
        RAISE EXCEPTION '% already has an active contract', public.hr_employee_name(emp.id);
      END IF;
      PERFORM public.record_legacy_contract(
        emp.id, v_type, v_start, v_end, v_position,
        public.hr_doc_num(r, 'salary', 'the salary', false),
        NULL,
        public.hr_doc_num(r, 'notice_days', 'the notice period', false)::integer,
        v_status);
      IF v_status = 'active' THEN n_active := n_active + 1; ELSE n_expired := n_expired + 1; END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Row %: %. Nothing was imported.', i, SQLERRM;
    END;
  END LOOP;

  INSERT INTO public.audit_log (actor_id, action, table_name, record_id, metadata)
  VALUES (public.safe_auth_uid(), 'import.legacy_contracts', 'employment_contracts', 'import',
          jsonb_build_object('rows', i, 'active', n_active, 'expired', n_expired));
  RETURN jsonb_build_object('imported', i, 'active', n_active, 'expired', n_expired);
END;
$$;


ALTER FUNCTION "public"."import_legacy_contracts"("p_rows" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."import_opening_leave"("p_rows" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  r jsonb;
  i integer := 0;
  type_id uuid;
  seen text[] := '{}';
  k text;
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can import opening balances.' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'The file has no rows to import.';
  END IF;
  IF jsonb_array_length(p_rows) > 500 THEN
    RAISE EXCEPTION 'At most 500 rows per file (this one has %). Split it into smaller files.', jsonb_array_length(p_rows);
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    i := i + 1;
    BEGIN
      SELECT id INTO type_id FROM public.leave_types WHERE lower(name) = lower(trim(r ->> 'leave_type'));
      IF type_id IS NULL THEN RAISE EXCEPTION 'unknown leave type "%"', r ->> 'leave_type'; END IF;
      k := trim(r ->> 'employee_id') || '/' || type_id::text || '/' || trim(r ->> 'year');
      IF k = ANY (seen) THEN RAISE EXCEPTION 'the same employee, leave type and year appear twice in the file'; END IF;
      seen := seen || k;
      PERFORM public.set_opening_leave_taken(trim(r ->> 'employee_id'), type_id, (r ->> 'year')::integer,
                                             (r ->> 'taken_before_go_live')::numeric);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Row %: %. Nothing was imported.', i, SQLERRM;
    END;
  END LOOP;

  INSERT INTO public.audit_log (actor_id, action, table_name, record_id, metadata)
  VALUES (public.safe_auth_uid(), 'import.opening_leave', 'leave_balances', 'import', jsonb_build_object('rows', i));
  RETURN jsonb_build_object('imported', i);
END;
$$;


ALTER FUNCTION "public"."import_opening_leave"("p_rows" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_active_portal_user"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.portal_users
    WHERE id = public.portal_uid() AND is_active = true
  );
$$;


ALTER FUNCTION "public"."is_active_portal_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_active_staff"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_users
    WHERE id = public.safe_auth_uid() AND is_active = true
  );
$$;


ALTER FUNCTION "public"."is_active_staff"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_users
    WHERE id = public.safe_auth_uid() AND is_active = true AND role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_marketing_manager"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM marketing_users
    WHERE email = auth.jwt() ->> 'email'
    AND is_active = true
    AND role IN ('MARKETING_MANAGER', 'ADMIN')
  );
$$;


ALTER FUNCTION "public"."is_marketing_manager"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_marketing_user"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
      SELECT EXISTS (
        SELECT 1 FROM marketing_users
        WHERE email = auth.jwt() ->> 'email'
        AND is_active = true
      );
    $$;


ALTER FUNCTION "public"."is_marketing_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_portal_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.portal_users
    WHERE id = public.portal_uid() AND is_active = true AND role = 'super_admin'
  );
$$;


ALTER FUNCTION "public"."is_portal_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_portal_hr_approver"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.has_portal_role(ARRAY['super_admin', 'management']);
$$;


ALTER FUNCTION "public"."is_portal_hr_approver"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_uat_candidate"("p_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.candidates c
                  WHERE c.id = p_id AND (c.full_name LIKE 'UAT %'
                                         OR (c.employee_id IS NOT NULL AND public.is_uat_employee(c.employee_id))));
$$;


ALTER FUNCTION "public"."is_uat_candidate"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_uat_employee"("p_id" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT p_id LIKE 'UAT-%'
      OR EXISTS (SELECT 1 FROM public.employees e
                  WHERE e.id = p_id AND (e."firstName" LIKE 'UAT %' OR e."firstName" = 'UAT'));
$$;


ALTER FUNCTION "public"."is_uat_employee"("p_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."issue_hr_document"("p_id" "uuid", "p_content" "jsonb") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  d public.hr_documents%ROWTYPE;
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can issue HR documents.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO d FROM public.hr_documents WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document not found.'; END IF;
  IF d.status <> 'approved' THEN
    RAISE EXCEPTION 'Only an approved document can be issued. This document is %.', replace(d.status, '_', ' ');
  END IF;
  IF d.ref_no IS NULL THEN
    RAISE EXCEPTION 'No reference number has been reserved for this document yet.';
  END IF;

  -- The text that will be exported: complete, and carrying this letter's number.
  IF p_content IS NULL OR jsonb_typeof(p_content) <> 'object'
     OR p_content ->> 'ref_no' IS DISTINCT FROM d.ref_no
     OR length(trim(coalesce(p_content ->> 'date', ''))) = 0
     OR length(trim(coalesce(p_content ->> 'subject', ''))) = 0
     OR jsonb_typeof(p_content -> 'addressee') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_content -> 'paragraphs') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_content -> 'paragraphs') = 0
     OR length(trim(coalesce(p_content #>> '{signatory,name}', ''))) = 0
     OR length(trim(coalesce(p_content #>> '{signatory,title}', ''))) = 0 THEN
    RAISE EXCEPTION 'The letter text is incomplete or does not carry this letter''s reference number.';
  END IF;
  PERFORM public.hr_doc_validate(d, 'issue');

  PERFORM set_config('hr_docs.rpc', '1', true);
  UPDATE public.hr_documents
     SET status = 'issued', issued_content = p_content, issued_at = now()
   WHERE id = p_id RETURNING * INTO d;
  PERFORM public.hr_doc_apply_effects(d);
  PERFORM set_config('hr_docs.rpc', '', true);
  RETURN d.ref_no;
END;
$$;


ALTER FUNCTION "public"."issue_hr_document"("p_id" "uuid", "p_content" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_balances_opening_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF public.safe_auth_uid() IS NULL OR coalesce(current_setting('leave.opening', true), '') = '1' THEN
    RETURN NEW;
  END IF;
  IF (TG_OP = 'INSERT' AND NEW.opening_taken <> 0)
     OR (TG_OP = 'UPDATE' AND NEW.opening_taken IS DISTINCT FROM OLD.opening_taken) THEN
    RAISE EXCEPTION 'Leave taken before go-live is entered with "Import opening balances" on the Leave page.';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."leave_balances_opening_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_employee_name"("p_employee" "text") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT trim(concat_ws(' ', e."firstName", e."middleName", e."lastName")) FROM public.employees e WHERE e.id = p_employee;
$$;


ALTER FUNCTION "public"."leave_employee_name"("p_employee" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_notify_requester"("p_req" "public"."leave_requests", "p_title" "text", "p_body" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  recipient uuid;
BEGIN
  FOR recipient IN
    SELECT DISTINCT u FROM (
      SELECT p_req.created_by AS u
      UNION ALL
      SELECT s.id FROM public.staff_users s WHERE s.employee_id = p_req.employee_id
    ) x WHERE u IS NOT NULL AND u IS DISTINCT FROM public.safe_auth_uid()
  LOOP
    PERFORM public.notify_user(recipient, 'leave_decision', p_title, p_body, '/hr/leave');
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."leave_notify_requester"("p_req" "public"."leave_requests", "p_title" "text", "p_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_request_before_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  lt public.leave_types%ROWTYPE;
  linked text := public.current_employee_id();
  remaining numeric;
  yr integer;
BEGIN
  -- Whatever the client sent, a new request is pending, unreviewed and owned
  -- by the caller.
  NEW.status := 'pending';
  NEW.decided_by := NULL; NEW.decided_at := NULL; NEW.decision_note := NULL;
  NEW.approved_by := NULL; NEW.approved_at := NULL;
  NEW.cancelled_by := NULL; NEW.cancelled_at := NULL;
  NEW.created_by := public.safe_auth_uid();

  SELECT * INTO lt FROM public.leave_types WHERE id = NEW.leave_type_id;
  IF NOT FOUND OR NOT lt.is_active THEN
    RAISE EXCEPTION 'This leave type is not available. Please choose another.';
  END IF;

  -- A login linked to an employee files leave for that employee only. HR
  -- roles (and logins not linked to anyone, e.g. a clerk) may file for others.
  IF NOT public.can_manage_hr() AND linked IS NOT NULL AND NEW.employee_id <> linked THEN
    RAISE EXCEPTION 'You can only apply for leave for yourself.' USING ERRCODE = '42501';
  END IF;

  yr := public.leave_year_of(NEW.start_date);
  IF yr <> public.leave_year_of(NEW.end_date) THEN
    RAISE EXCEPTION 'A leave request cannot run across two leave years. Please file one request up to 31 December and another from 1 January.';
  END IF;

  NEW.days := public.leave_working_days(NEW.start_date, NEW.end_date);
  IF NEW.days IS NULL OR NEW.days <= 0 THEN
    RAISE EXCEPTION 'These dates contain no working days (only Sundays or public holidays). Please choose different dates.';
  END IF;

  IF lt.requires_attachment AND coalesce(trim(NEW.attachment_path), '') = '' THEN
    RAISE EXCEPTION '% leave needs a supporting document. Please attach one.', lt.name;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.leave_requests r
    WHERE r.employee_id = NEW.employee_id AND r.status IN ('pending', 'approved')
      AND r.start_date <= NEW.end_date AND r.end_date >= NEW.start_date
  ) THEN
    RAISE EXCEPTION 'This employee already has pending or approved leave that overlaps these dates.';
  END IF;

  IF lt.tracks_balance THEN
    PERFORM public.ensure_leave_balance(NEW.employee_id, lt.id, yr);
    SELECT b.entitled + b.carried_forward - b.opening_taken - b.taken INTO remaining        -- Phase 5
    FROM public.leave_balances b
    WHERE b.employee_id = NEW.employee_id AND b.leave_type_id = lt.id AND b.year = yr;
    IF NEW.days > remaining THEN
      RAISE EXCEPTION 'Not enough % leave: % day(s) left in %, but % requested.', lt.name, remaining, yr, NEW.days;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."leave_request_before_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_request_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Phase 5: the UAT cleanup removes test leave whatever its status.
    IF public.uat_cleanup_on() AND public.is_uat_employee(OLD.employee_id) THEN
      RETURN OLD;
    END IF;
    IF OLD.status = 'approved' THEN
      RAISE EXCEPTION 'Approved leave cannot be deleted. Cancel it instead, which restores the balance and clears the attendance days.';
    END IF;
    RETURN OLD;
  END IF;

  IF coalesce(current_setting('leave.rpc', true), '') <> '1' AND (
       NEW.status IS DISTINCT FROM OLD.status OR NEW.days IS DISTINCT FROM OLD.days
    OR NEW.employee_id IS DISTINCT FROM OLD.employee_id OR NEW.leave_type_id IS DISTINCT FROM OLD.leave_type_id
    OR NEW.start_date IS DISTINCT FROM OLD.start_date OR NEW.end_date IS DISTINCT FROM OLD.end_date
    OR NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
    OR NEW.decided_by IS DISTINCT FROM OLD.decided_by OR NEW.decided_at IS DISTINCT FROM OLD.decided_at
    OR NEW.decision_note IS DISTINCT FROM OLD.decision_note
    OR NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
  ) THEN
    RAISE EXCEPTION 'A leave request cannot be edited directly. Use Approve, Reject or Cancel.';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."leave_request_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_request_notify_hr"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  type_name text;
BEGIN
  SELECT name INTO type_name FROM public.leave_types WHERE id = NEW.leave_type_id;
  PERFORM public.notify_hr_roles(
    'leave_request',
    'New leave request',
    format('%s asked for %s leave, %s to %s (%s day(s)).',
           public.leave_employee_name(NEW.employee_id), type_name, NEW.start_date, NEW.end_date, NEW.days),
    '/hr/leave'
  );
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."leave_request_notify_hr"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_working_dates"("p_start" "date", "p_end" "date") RETURNS SETOF "date"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT g::date
  FROM generate_series(p_start, p_end, interval '1 day') AS g
  WHERE EXTRACT(ISODOW FROM g)::integer = ANY (SELECT unnest(working_days) FROM public.leave_settings WHERE id = 1)
    AND NOT EXISTS (SELECT 1 FROM public.public_holidays h WHERE h.holiday_date = g::date)
  ORDER BY 1;
$$;


ALTER FUNCTION "public"."leave_working_dates"("p_start" "date", "p_end" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_working_days"("p_start" "date", "p_end" "date") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT count(*)::integer FROM public.leave_working_dates(p_start, p_end);
$$;


ALTER FUNCTION "public"."leave_working_days"("p_start" "date", "p_end" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_year_of"("p_date" "date") RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT EXTRACT(YEAR FROM p_date)::integer;
$$;


ALTER FUNCTION "public"."leave_year_of"("p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lift_restriction"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE marketing_users SET
    approval_status    = 'APPROVED',
    restriction_reason = NULL,
    restricted_at      = NULL
  WHERE id = p_marketer_id;

  INSERT INTO marketer_account_actions
    (marketer_id, action, performed_by, internal_notes, visible_to_marketer)
  VALUES
    (p_marketer_id, 'RESTRICTION_LIFTED', p_manager_id, p_notes, true);

  INSERT INTO marketer_approval_log (marketer_id, action, performed_by)
  VALUES (p_marketer_id, 'RESTRICTION_LIFTED', p_manager_id);
END;
$$;


ALTER FUNCTION "public"."lift_restriction"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_rfq_to_proforma"("p_rfq_id" "text", "p_proforma_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_current_status TEXT;
  v_actor TEXT := public.portal_uid();
  v_requested_by TEXT;
BEGIN
  IF NOT (public.is_active_portal_user() OR public.is_active_staff()) THEN
    RAISE EXCEPTION 'Not an active portal user or staff member';
  END IF;

  SELECT status, requested_by_id INTO v_current_status, v_requested_by
  FROM public.rfqs WHERE id = p_rfq_id FOR UPDATE;
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'RFQ % not found', p_rfq_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.proforma_invoices WHERE id = p_proforma_id) THEN
    RAISE EXCEPTION 'Proforma % not found', p_proforma_id;
  END IF;

  INSERT INTO public.rfq_proforma_links (rfq_id, proforma_id, linked_by_id)
  VALUES (p_rfq_id, p_proforma_id, v_actor)
  ON CONFLICT (rfq_id, proforma_id) DO NOTHING;

  IF v_current_status IN ('draft', 'submitted', 'in_review') THEN
    UPDATE public.rfqs SET status = 'proforma_created', updated_at = now() WHERE id = p_rfq_id;

    INSERT INTO public.rfq_status_history (rfq_id, from_status, to_status, changed_by_id, note)
    VALUES (p_rfq_id, v_current_status, 'proforma_created', v_actor, 'Linked to proforma ' || p_proforma_id);

    -- Notify the admin who requested this RFQ that it's been answered.
    -- Only on the actual status transition, not on a later re-link.
    IF v_requested_by IS NOT NULL THEN
      INSERT INTO public.portal_notifications (portal_user_id, type, title, body, rfq_id, proforma_id)
      VALUES (
        v_requested_by,
        'rfq_answered',
        'Your RFQ has been answered',
        'Proforma ' || p_proforma_id || ' was created for RFQ ' || p_rfq_id || '.',
        p_rfq_id,
        p_proforma_id
      );
    END IF;
  END IF;
END;
$$;


ALTER FUNCTION "public"."link_rfq_to_proforma"("p_rfq_id" "text", "p_proforma_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_audit_event"("p_action" "text", "p_table" "text", "p_record_id" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT NULL::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.audit_log (actor_id, action, table_name, record_id, metadata)
  VALUES (public.safe_auth_uid(), p_action, p_table, p_record_id, p_metadata);
END;
$$;


ALTER FUNCTION "public"."log_audit_event"("p_action" "text", "p_table" "text", "p_record_id" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_portal_audit_event"("p_actor_id" "text", "p_actor_type" "text", "p_action" "text", "p_table_name" "text" DEFAULT NULL::"text", "p_record_id" "text" DEFAULT NULL::"text", "p_note" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  INSERT INTO public.portal_audit_log (actor_id, actor_type, action, table_name, record_id, note)
  VALUES (p_actor_id, p_actor_type, p_action, p_table_name, p_record_id, p_note);
$$;


ALTER FUNCTION "public"."log_portal_audit_event"("p_actor_id" "text", "p_actor_type" "text", "p_action" "text", "p_table_name" "text", "p_record_id" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_portal_user_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    PERFORM public.log_portal_audit_event(
      public.portal_uid(),
      'portal',
      'portal_user.updated',
      'portal_users',
      NEW.id,
      format('role: %s -> %s, active: %s -> %s', OLD.role, NEW.role, OLD.is_active, NEW.is_active)
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_portal_user_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_rfq_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.requested_by_id IS NOT NULL THEN
    INSERT INTO public.rfq_status_history (rfq_id, from_status, to_status, changed_by_id, note)
    VALUES (NEW.id, NULL, NEW.status, NEW.requested_by_id, 'RFQ created');
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_rfq_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_recognition_paid"("p_id" "uuid", "p_payroll_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  r public.recognition_records%ROWTYPE;
BEGIN
  IF NOT (public.can_manage_hr() OR public.has_staff_role(ARRAY['finance'])) THEN
    RAISE EXCEPTION 'Only HR and finance can mark rewards as paid.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.recognition_records WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reward not found.'; END IF;
  IF r.reward_type <> 'cash' OR r.status <> 'active' OR r.payroll_status <> 'pending' THEN
    RAISE EXCEPTION 'Only an active cash reward waiting for payroll can be marked as paid.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.payroll WHERE id = p_payroll_id) THEN
    RAISE EXCEPTION 'That payroll record does not exist.';
  END IF;
  UPDATE public.recognition_records SET payroll_status = 'paid', paid_in_payroll_id = p_payroll_id WHERE id = p_id;
END;
$$;


ALTER FUNCTION "public"."mark_recognition_paid"("p_id" "uuid", "p_payroll_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_costing_request_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.status = OLD.status OR NEW.status NOT IN ('fulfilled', 'rejected') THEN
    RETURN NEW;
  END IF;

  PERFORM public.log_portal_audit_event(
    NEW.fulfilled_by_id::TEXT, 'staff', 'costing_request.' || NEW.status,
    'portal_costing_requests', NEW.id::TEXT, NEW.rejection_reason
  );

  IF NEW.requested_by_id IS NOT NULL THEN
    INSERT INTO public.portal_notifications (portal_user_id, type, title, body, rfq_id)
    VALUES (
      NEW.requested_by_id,
      'costing_request_' || NEW.status,
      CASE WHEN NEW.status = 'fulfilled' THEN 'Costing report ready' ELSE 'Costing request rejected' END,
      CASE WHEN NEW.status = 'fulfilled'
        THEN 'Costing for RFQ ' || NEW.rfq_id || ' is ready — margin ' || COALESCE(NEW.gross_margin_pct::TEXT, '—') || '%.'
        ELSE 'Your costing request for RFQ ' || NEW.rfq_id || ' was rejected' ||
          CASE WHEN NEW.rejection_reason IS NOT NULL THEN ': ' || NEW.rejection_reason ELSE '.' END
      END,
      NEW.rfq_id
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_costing_request_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_deal_won"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.pipeline_stage = 'WON' AND OLD.pipeline_stage != 'WON' THEN
    INSERT INTO public.marketing_notifications (type, title, message, company_id, marketer_id)
    VALUES (
      'DEAL_WON',
      'New Client Won!',
      NEW.name || ' has been converted to a client.',
      NEW.id,
      NEW.assigned_marketer_id
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_deal_won"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_hot_lead"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.lead_score >= 80 AND (OLD.lead_score IS NULL OR OLD.lead_score < 80) THEN
    INSERT INTO public.marketing_notifications (type, title, message, company_id, marketer_id)
    VALUES (
      'HOT_LEAD',
      'Hot Lead Detected',
      NEW.name || ' has reached a lead score of ' || NEW.lead_score || '/100',
      NEW.id,
      NEW.assigned_marketer_id
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_hot_lead"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_hr_roles"("p_type" "text", "p_title" "text", "p_body" "text" DEFAULT NULL::"text", "p_link" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  INSERT INTO public.hr_notifications (recipient_id, type, title, body, link)
  SELECT s.id, p_type, p_title, p_body, p_link
  FROM public.staff_users s
  WHERE s.is_active AND s.role IN ('admin', 'hr_manager', 'general_manager');
$$;


ALTER FUNCTION "public"."notify_hr_roles"("p_type" "text", "p_title" "text", "p_body" "text", "p_link" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_invoice_request_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.status = OLD.status OR NEW.status NOT IN ('fulfilled', 'rejected') THEN
    RETURN NEW;
  END IF;

  PERFORM public.log_portal_audit_event(
    NEW.fulfilled_by_id::TEXT, 'staff', 'invoice_request.' || NEW.status,
    'portal_invoice_requests', NEW.id::TEXT, NEW.rejection_reason
  );

  IF NEW.requested_by_id IS NOT NULL THEN
    INSERT INTO public.portal_notifications (portal_user_id, type, title, body, rfq_id, proforma_id)
    VALUES (
      NEW.requested_by_id,
      'invoice_request_' || NEW.status,
      CASE WHEN NEW.status = 'fulfilled' THEN 'Invoice generated' ELSE 'Invoice request rejected' END,
      CASE WHEN NEW.status = 'fulfilled'
        THEN 'Invoice ' || COALESCE(NEW.invoice_id, '') || ' was generated from proforma ' || NEW.proforma_id || '.'
        ELSE 'Your invoice request for proforma ' || NEW.proforma_id || ' was rejected' ||
          CASE WHEN NEW.rejection_reason IS NOT NULL THEN ': ' || NEW.rejection_reason ELSE '.' END
      END,
      NEW.rfq_id, NEW.proforma_id
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_invoice_request_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_user"("p_recipient" "uuid", "p_type" "text", "p_title" "text", "p_body" "text" DEFAULT NULL::"text", "p_link" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  INSERT INTO public.hr_notifications (recipient_id, type, title, body, link)
  VALUES (p_recipient, p_type, p_title, p_body, p_link);
$$;


ALTER FUNCTION "public"."notify_user"("p_recipient" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_link" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."onboard_company_as_client"("p_company_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_stage TEXT;
BEGIN
  SELECT pipeline_stage::text INTO v_stage
  FROM companies WHERE id = p_company_id;

  IF v_stage NOT IN ('QUOTATION_REQUESTED','NEGOTIATING','WON') THEN
    RAISE EXCEPTION 'Only QUOTATION_REQUESTED, NEGOTIATING or WON companies can be onboarded as clients';
  END IF;

  UPDATE companies SET
    landed_at = COALESCE(landed_at, NOW()),
    client_since = COALESCE(client_since, NOW()),
    client_onboarding_requested = true,
    is_prospect = false
  WHERE id = p_company_id;
END;
$$;


ALTER FUNCTION "public"."onboard_company_as_client"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."open_leave_year"("p_year" integer) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  created integer;
BEGIN
  IF NOT (public.can_manage_hr() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Only HR can open a leave year.' USING ERRCODE = '42501';
  END IF;
  IF p_year NOT BETWEEN 2000 AND 2100 THEN RAISE EXCEPTION 'Invalid year.'; END IF;

  INSERT INTO public.leave_balances (employee_id, leave_type_id, year, entitled, carried_forward)
  SELECT e.id, lt.id, p_year, lt.days_per_year,
         least(lt.max_carry_forward,
               greatest(coalesce(prev.entitled + prev.carried_forward - prev.opening_taken - prev.taken, 0), 0))   -- Phase 5
    FROM public.employees e
   CROSS JOIN public.leave_types lt
    LEFT JOIN public.leave_balances prev
      ON prev.employee_id = e.id AND prev.leave_type_id = lt.id AND prev.year = p_year - 1
   WHERE e.status = 'Active' AND lt.is_active AND lt.tracks_balance
  ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;

  GET DIAGNOSTICS created = ROW_COUNT;
  RETURN created;
END;
$$;


ALTER FUNCTION "public"."open_leave_year"("p_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pending_cash_rewards"() RETURNS TABLE("id" "uuid", "employee_id" "text", "employee_name" "text", "amount" numeric, "awarded_on" "date", "category" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT (public.can_manage_hr() OR public.has_staff_role(ARRAY['finance'])) THEN
    RAISE EXCEPTION 'Only HR and finance can see pending rewards.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT r.id, r.employee_id, public.hr_employee_name(r.employee_id), r.amount,
           (d.issued_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date, r.category
      FROM public.recognition_records r
      JOIN public.hr_documents d ON d.id = r.document_id
     WHERE r.status = 'active' AND r.reward_type = 'cash' AND r.payroll_status = 'pending'
     ORDER BY d.issued_at;
END;
$$;


ALTER FUNCTION "public"."pending_cash_rewards"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."portal_approve_hr_document"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  d public.hr_documents%ROWTYPE;
  pu public.portal_users%ROWTYPE;
  author_email text;
  needs_other boolean;
  staff_id uuid;
  derived_name text;
  derived_title text;
BEGIN
  IF NOT public.is_portal_hr_approver() THEN
    RAISE EXCEPTION 'Only portal super admins and management can approve HR letters.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO pu FROM public.portal_users WHERE id = public.portal_uid();
  SELECT * INTO d FROM public.hr_documents WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Letter not found.'; END IF;
  IF d.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Only a letter waiting for approval can be approved. This one is %.', replace(d.status, '_', ' ');
  END IF;

  SELECT email INTO author_email FROM public.staff_users WHERE id = d.created_by;
  SELECT requires_different_approver INTO needs_other FROM public.hr_document_types WHERE doc_type = d.doc_type;
  IF needs_other AND lower(author_email) = lower(pu.email) THEN
    RAISE EXCEPTION 'This type of letter must be approved by someone other than the person who wrote it.';
  END IF;
  PERFORM public.hr_doc_validate(d, 'approve');

  -- The signatory: from the HR system's record of the same person (by email),
  -- otherwise the portal user's name and role.
  SELECT s.id, trim(concat_ws(' ', e."firstName", e."middleName", e."lastName")), nullif(trim(e.role), '')
    INTO staff_id, derived_name, derived_title
    FROM public.staff_users s LEFT JOIN public.employees e ON e.id = s.employee_id
   WHERE lower(s.email) = lower(pu.email) AND s.is_active
   LIMIT 1;
  derived_name := coalesce(nullif(derived_name, ''), nullif(trim(pu.full_name), ''), pu.email);
  derived_title := coalesce(derived_title, CASE pu.role WHEN 'super_admin' THEN 'Administrator' ELSE 'Management' END);

  PERFORM set_config('hr_docs.rpc', '1', true);
  UPDATE public.hr_documents
     SET status = 'approved', approved_by = staff_id, approved_by_portal = pu.id, approved_at = now(),
         signatory_name = coalesce(nullif(trim(signatory_name), ''), derived_name),
         signatory_title = coalesce(nullif(trim(signatory_title), ''), derived_title)
   WHERE id = p_id RETURNING * INTO d;
  PERFORM set_config('hr_docs.rpc', '', true);

  IF d.created_by IS NOT NULL THEN
    PERFORM public.notify_user(d.created_by, 'hr_document_approved', 'Document approved',
      format('%s was approved in the admin portal by %s and is ready to issue.', d.subject, coalesce(nullif(trim(pu.full_name), ''), pu.email)),
      '/hr/documents');
  END IF;
  -- The row audit cannot name a portal user (no HR login), so say who it was.
  INSERT INTO public.audit_log (actor_id, action, table_name, record_id, metadata)
  VALUES (staff_id, 'hr_documents.portal_approve', 'hr_documents', d.id::text,
          jsonb_build_object('portal_user', pu.id, 'email', pu.email, 'name', pu.full_name, 'role', pu.role));
END;
$$;


ALTER FUNCTION "public"."portal_approve_hr_document"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."portal_pending_hr_documents"() RETURNS TABLE("id" "uuid", "doc_type" "text", "type_label" "text", "subject" "text", "person" "text", "author_email" "text", "written_at" timestamp with time zone, "confidential" boolean, "needs_other_approver" boolean, "written_by_me" boolean, "preview" "jsonb")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  my_email text;
BEGIN
  IF NOT public.is_portal_hr_approver() THEN
    RAISE EXCEPTION 'Only portal super admins and management can approve HR letters.' USING ERRCODE = '42501';
  END IF;
  -- Qualified: the result columns (id, ...) are variables inside this function.
  SELECT lower(pu.email) INTO my_email FROM public.portal_users pu WHERE pu.id = public.portal_uid();
  RETURN QUERY
    SELECT d.id, d.doc_type, t.label, d.subject,
           coalesce(public.hr_employee_name(d.employee_id), c.full_name, '—'),
           s.email, d.created_at, d.confidential, t.requires_different_approver,
           (lower(s.email) = my_email), d.preview
      FROM public.hr_documents d
      JOIN public.hr_document_types t ON t.doc_type = d.doc_type
      LEFT JOIN public.staff_users s ON s.id = d.created_by
      LEFT JOIN public.candidates c ON c.id = d.candidate_id
     WHERE d.status = 'pending_approval'
     ORDER BY d.created_at;
END;
$$;


ALTER FUNCTION "public"."portal_pending_hr_documents"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."portal_return_hr_document"("p_id" "uuid", "p_note" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  d public.hr_documents%ROWTYPE;
  pu public.portal_users%ROWTYPE;
BEGIN
  IF NOT public.is_portal_hr_approver() THEN
    RAISE EXCEPTION 'Only portal super admins and management can return HR letters.' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(p_note, ''))) < 3 THEN
    RAISE EXCEPTION 'Say what needs to change, so the author knows.';
  END IF;
  SELECT * INTO pu FROM public.portal_users WHERE id = public.portal_uid();
  SELECT * INTO d FROM public.hr_documents WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Letter not found.'; END IF;
  IF d.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Only a letter waiting for approval can be returned. This one is %.', replace(d.status, '_', ' ');
  END IF;

  PERFORM set_config('hr_docs.rpc', '1', true);
  UPDATE public.hr_documents SET status = 'draft', return_note = trim(p_note) WHERE id = p_id RETURNING * INTO d;
  PERFORM set_config('hr_docs.rpc', '', true);

  IF d.created_by IS NOT NULL THEN
    PERFORM public.notify_user(d.created_by, 'hr_document_returned', 'Document returned for changes',
      format('%s was returned by %s: %s', d.subject, coalesce(nullif(trim(pu.full_name), ''), pu.email), trim(p_note)),
      '/hr/documents');
  END IF;
  INSERT INTO public.audit_log (actor_id, action, table_name, record_id, metadata)
  VALUES (NULL, 'hr_documents.portal_return', 'hr_documents', d.id::text,
          jsonb_build_object('portal_user', pu.id, 'email', pu.email, 'name', pu.full_name, 'note', trim(p_note)));
END;
$$;


ALTER FUNCTION "public"."portal_return_hr_document"("p_id" "uuid", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."portal_uid"() RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT auth.jwt()->>'sub';
$$;


ALTER FUNCTION "public"."portal_uid"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_all_performance"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_marketer RECORD;
  v_month INTEGER := EXTRACT(MONTH FROM NOW())::INTEGER;
  v_year  INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
BEGIN
  FOR v_marketer IN
    SELECT id FROM marketing_users WHERE is_active = true AND role = 'MARKETER'
  LOOP
    PERFORM recalculate_marketer_performance(v_marketer.id, v_month, v_year);
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."recalculate_all_performance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_marketer_performance"("p_marketer_id" "uuid", "p_month" integer, "p_year" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_start DATE;
  v_end   DATE;
  v_total_visits        INTEGER;
  v_verified_visits     INTEGER;
  v_new_leads           INTEGER;
  v_hot_leads           INTEGER;
  v_quotations          INTEGER;
  v_deals_won           INTEGER;
  v_fu_completed        INTEGER;
  v_fu_missed           INTEGER;
  v_revenue             NUMERIC(15,2);
  v_avg_score           NUMERIC(5,1);
BEGIN
  v_start := make_date(p_year, p_month, 1);
  v_end   := v_start + INTERVAL '1 month';

  SELECT COUNT(*), COUNT(*) FILTER (WHERE gps_verified = true)
  INTO v_total_visits, v_verified_visits
  FROM visits
  WHERE marketer_id = p_marketer_id
    AND check_in_time >= v_start AND check_in_time < v_end;

  SELECT
    COUNT(*) FILTER (WHERE pipeline_stage = 'IDENTIFIED'),
    COUNT(*) FILTER (WHERE lead_score >= 80),
    COUNT(*) FILTER (WHERE pipeline_stage = 'QUOTATION_REQUESTED'),
    COUNT(*) FILTER (WHERE pipeline_stage = 'WON')
  INTO v_new_leads, v_hot_leads, v_quotations, v_deals_won
  FROM companies
  WHERE assigned_marketer_id = p_marketer_id
    AND last_visited_at >= v_start AND last_visited_at < v_end;

  SELECT
    COUNT(*) FILTER (WHERE status = 'DONE' AND completed_at >= v_start AND completed_at < v_end),
    COUNT(*) FILTER (WHERE status = 'PENDING' AND due_date < v_start)
  INTO v_fu_completed, v_fu_missed
  FROM follow_ups WHERE marketer_id = p_marketer_id;

  SELECT COALESCE(SUM(estimated_value), 0) INTO v_revenue
  FROM companies
  WHERE assigned_marketer_id = p_marketer_id
    AND pipeline_stage = 'WON'
    AND last_visited_at >= v_start AND last_visited_at < v_end;

  SELECT COALESCE(AVG(lead_score), 0) INTO v_avg_score
  FROM visits
  WHERE marketer_id = p_marketer_id
    AND check_in_time >= v_start AND check_in_time < v_end
    AND lead_score IS NOT NULL;

  INSERT INTO marketing_performance (
    marketer_id, month, year, total_visits, verified_visits,
    new_leads, hot_leads, quotations_requested, deals_won,
    follow_ups_completed, follow_ups_missed,
    revenue_generated, avg_lead_score, updated_at
  ) VALUES (
    p_marketer_id, p_month, p_year,
    COALESCE(v_total_visits,0), COALESCE(v_verified_visits,0),
    COALESCE(v_new_leads,0), COALESCE(v_hot_leads,0),
    COALESCE(v_quotations,0), COALESCE(v_deals_won,0),
    COALESCE(v_fu_completed,0), COALESCE(v_fu_missed,0),
    COALESCE(v_revenue,0), COALESCE(v_avg_score,0), NOW()
  )
  ON CONFLICT (marketer_id, month, year)
  DO UPDATE SET
    total_visits=EXCLUDED.total_visits, verified_visits=EXCLUDED.verified_visits,
    new_leads=EXCLUDED.new_leads, hot_leads=EXCLUDED.hot_leads,
    quotations_requested=EXCLUDED.quotations_requested, deals_won=EXCLUDED.deals_won,
    follow_ups_completed=EXCLUDED.follow_ups_completed, follow_ups_missed=EXCLUDED.follow_ups_missed,
    revenue_generated=EXCLUDED.revenue_generated, avg_lead_score=EXCLUDED.avg_lead_score,
    updated_at=NOW();
END;
$$;


ALTER FUNCTION "public"."recalculate_marketer_performance"("p_marketer_id" "uuid", "p_month" integer, "p_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_commission"("p_company_id" "uuid", "p_invoice_ref" "text", "p_amount" numeric, "p_invoice_date" "date" DEFAULT CURRENT_DATE) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_landed_by   UUID;
  v_landed_at   TIMESTAMPTZ;
  v_rate        NUMERIC(5,4);
  v_is_first    BOOLEAN;
  v_total_comm  NUMERIC(15,2);
  v_marketers   UUID[];
  v_count       INTEGER;
  v_share       NUMERIC(15,2);
  v_mid         UUID;
BEGIN
  SELECT landed_by_marketer_id, landed_at
  INTO v_landed_by, v_landed_at
  FROM companies WHERE id = p_company_id;

  IF v_landed_by IS NULL THEN
    RETURN;   -- no landing marketer → no commission
  END IF;

  -- Rate: 1% first month, 0.5% after
  IF v_landed_at IS NOT NULL
     AND p_invoice_date <= (v_landed_at::date + INTERVAL '1 month') THEN
    v_rate := 0.01;  v_is_first := true;
  ELSE
    v_rate := 0.005; v_is_first := false;
  END IF;

  v_total_comm := ROUND(p_amount * v_rate, 2);

  -- Build the set of beneficiaries: landing marketer + collaborators
  SELECT ARRAY(
    SELECT DISTINCT m FROM (
      SELECT v_landed_by AS m
      UNION
      SELECT marketer_id FROM company_collaborators
      WHERE company_id = p_company_id
    ) s
  ) INTO v_marketers;

  v_count := array_length(v_marketers, 1);
  IF v_count IS NULL OR v_count = 0 THEN RETURN; END IF;

  v_share := ROUND(v_total_comm / v_count, 2);

  FOREACH v_mid IN ARRAY v_marketers LOOP
    INSERT INTO commissions (
      marketer_id, company_id, invoice_ref, invoice_amount,
      commission_rate, commission_amount, is_first_month,
      status, invoice_date, split_count
    ) VALUES (
      v_mid, p_company_id, p_invoice_ref, p_amount,
      v_rate, v_share, v_is_first,
      'PENDING', p_invoice_date, v_count
    )
    ON CONFLICT (invoice_ref, marketer_id) DO NOTHING;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."record_commission"("p_company_id" "uuid", "p_invoice_ref" "text", "p_amount" numeric, "p_invoice_date" "date") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employment_contracts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "text" NOT NULL,
    "contract_type" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "position" "text",
    "salary" numeric(14,2),
    "probation_months" integer,
    "notice_days" integer,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "parent_contract_id" "uuid",
    "document_id" "uuid",
    "source" "text" DEFAULT 'letter'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "public"."safe_auth_uid"(),
    "updated_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    CONSTRAINT "employment_contracts_contract_type_check" CHECK (("contract_type" = ANY (ARRAY['permanent'::"text", 'fixed_term'::"text", 'probation'::"text", 'casual'::"text"]))),
    CONSTRAINT "employment_contracts_dates" CHECK ((("end_date" IS NULL) OR ("end_date" >= "start_date"))),
    CONSTRAINT "employment_contracts_end_unless_permanent" CHECK ((("contract_type" = 'permanent'::"text") OR ("end_date" IS NOT NULL))),
    CONSTRAINT "employment_contracts_letter_has_document" CHECK ((("source" = 'legacy'::"text") OR ("document_id" IS NOT NULL))),
    CONSTRAINT "employment_contracts_notice_days_check" CHECK ((("notice_days" IS NULL) OR ("notice_days" >= 0))),
    CONSTRAINT "employment_contracts_probation_months_check" CHECK ((("probation_months" IS NULL) OR ("probation_months" >= 0))),
    CONSTRAINT "employment_contracts_salary_check" CHECK ((("salary" IS NULL) OR ("salary" >= (0)::numeric))),
    CONSTRAINT "employment_contracts_source_check" CHECK (("source" = ANY (ARRAY['letter'::"text", 'legacy'::"text"]))),
    CONSTRAINT "employment_contracts_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'extended'::"text", 'terminated'::"text", 'expired'::"text", 'void'::"text"])))
);


ALTER TABLE "public"."employment_contracts" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_legacy_contract"("p_employee" "text", "p_contract_type" "text", "p_start" "date", "p_end" "date", "p_position" "text", "p_salary" numeric DEFAULT NULL::numeric, "p_probation_months" integer DEFAULT NULL::integer, "p_notice_days" integer DEFAULT NULL::integer, "p_status" "text" DEFAULT 'active'::"text") RETURNS "public"."employment_contracts"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  k public.employment_contracts%ROWTYPE;
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can record contracts.' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('active', 'expired') THEN
    RAISE EXCEPTION 'An existing contract is recorded as active (current) or expired (past).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_employee) THEN RAISE EXCEPTION 'Employee not found.'; END IF;
  IF p_status = 'active' AND EXISTS (SELECT 1 FROM public.employment_contracts WHERE employee_id = p_employee AND status = 'active') THEN
    RAISE EXCEPTION 'This employee already has an active contract on record.';
  END IF;
  INSERT INTO public.employment_contracts
    (employee_id, contract_type, start_date, end_date, position, salary, probation_months, notice_days, status, source)
  VALUES (p_employee, p_contract_type, p_start, p_end, nullif(trim(p_position), ''), p_salary, p_probation_months, p_notice_days, p_status, 'legacy')
  RETURNING * INTO k;
  RETURN k;
END;
$$;


ALTER FUNCTION "public"."record_legacy_contract"("p_employee" "text", "p_contract_type" "text", "p_start" "date", "p_end" "date", "p_position" "text", "p_salary" numeric, "p_probation_months" integer, "p_notice_days" integer, "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."register_company_for_marketer"("p_marketer_id" "uuid", "p_name" "text", "p_industry" "text" DEFAULT NULL::"text", "p_address" "text" DEFAULT NULL::"text", "p_region_id" "uuid" DEFAULT NULL::"uuid", "p_contact_name" "text" DEFAULT NULL::"text", "p_contact_phone" "text" DEFAULT NULL::"text", "p_contact_email" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_company_id UUID;
  v_name       TEXT;
BEGIN
  SELECT full_name INTO v_name FROM marketing_users WHERE id = p_marketer_id;

  INSERT INTO companies (
    name, industry, address, region_id,
    contact_name, contact_phone, contact_email,
    assigned_marketer_id, landed_by_marketer_id, landed_by_name,
    registered_by_marketer, is_prospect,
    pipeline_stage, lead_score, created_at
  ) VALUES (
    p_name, p_industry, p_address, p_region_id,
    p_contact_name, p_contact_phone, p_contact_email,
    p_marketer_id, p_marketer_id, v_name,
    true, true,
    'IDENTIFIED', 0, NOW()
  )
  RETURNING id INTO v_company_id;

  RETURN v_company_id;
END;
$$;


ALTER FUNCTION "public"."register_company_for_marketer"("p_marketer_id" "uuid", "p_name" "text", "p_industry" "text", "p_address" "text", "p_region_id" "uuid", "p_contact_name" "text", "p_contact_phone" "text", "p_contact_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reinstate_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE marketing_users SET
    is_active         = true,
    approval_status   = 'APPROVED',
    disabled_reason   = NULL,
    disabled_at       = NULL,
    disabled_by       = NULL,
    suspended_until   = NULL,
    suspension_reason = NULL,
    suspended_by      = NULL,
    reinstated_at     = NOW(),
    reinstated_by     = p_manager_id
  WHERE id = p_marketer_id;

  INSERT INTO marketer_account_actions
    (marketer_id, action, performed_by, internal_notes, visible_to_marketer)
  VALUES
    (p_marketer_id, 'REINSTATED', p_manager_id, p_notes, true);

  INSERT INTO marketer_approval_log (marketer_id, action, performed_by)
  VALUES (p_marketer_id, 'REINSTATED', p_manager_id);
END;
$$;


ALTER FUNCTION "public"."reinstate_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE marketing_users SET
    approval_status = 'REJECTED', rejection_reason = p_reason, rejected_at = NOW()
  WHERE id = p_marketer_id;
  INSERT INTO marketer_approval_log (marketer_id, action, performed_by, reason)
  VALUES (p_marketer_id, 'REJECTED', p_manager_id, p_reason);
END;
$$;


ALTER FUNCTION "public"."reject_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_proforma"("p_proforma_id" "text", "p_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_is_voided BOOLEAN;
  v_review_status TEXT;
  v_actor TEXT := public.portal_uid();
  v_rfq RECORD;
BEGIN
  IF NOT public.is_active_portal_user() THEN
    RAISE EXCEPTION 'Not an active portal user';
  END IF;

  SELECT "isVoided", "reviewStatus" INTO v_is_voided, v_review_status
  FROM public.proforma_invoices WHERE id = p_proforma_id FOR UPDATE;
  IF v_review_status IS NULL THEN
    RAISE EXCEPTION 'Proforma % not found', p_proforma_id;
  END IF;
  IF v_is_voided THEN
    RAISE EXCEPTION 'Proforma % has been marked Uninvoiced and cannot be rejected', p_proforma_id;
  END IF;
  IF v_review_status <> 'pending' THEN
    RAISE EXCEPTION 'Proforma % has already been %', p_proforma_id, v_review_status;
  END IF;

  UPDATE public.proforma_invoices
  SET "reviewStatus" = 'rejected', "rejectionReason" = p_reason, "reviewedAt" = now(), "reviewedById" = v_actor, "updatedAt" = now()
  WHERE id = p_proforma_id;

  PERFORM public.log_portal_audit_event(v_actor, 'portal', 'proforma.rejected', 'proforma_invoices', p_proforma_id, p_reason);

  FOR v_rfq IN
    SELECT r.id, r.requested_by_id FROM public.rfqs r
    JOIN public.rfq_proforma_links l ON l.rfq_id = r.id
    WHERE l.proforma_id = p_proforma_id AND r.status = 'proforma_created'
  LOOP
    UPDATE public.rfqs SET status = 'in_review', updated_at = now() WHERE id = v_rfq.id;
    INSERT INTO public.rfq_status_history (rfq_id, from_status, to_status, changed_by_id, note)
    VALUES (
      v_rfq.id, 'proforma_created', 'in_review', v_actor,
      'Proforma ' || p_proforma_id || ' rejected' || CASE WHEN p_reason IS NOT NULL THEN ': ' || p_reason ELSE '' END
    );

    IF v_rfq.requested_by_id IS NOT NULL THEN
      INSERT INTO public.portal_notifications (portal_user_id, type, title, body, rfq_id, proforma_id)
      VALUES (
        v_rfq.requested_by_id, 'proforma_rejected', 'Proforma rejected',
        'Proforma ' || p_proforma_id || ' was rejected' || CASE WHEN p_reason IS NOT NULL THEN ': ' || p_reason ELSE '.' END,
        v_rfq.id, p_proforma_id
      );
    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."reject_proforma"("p_proforma_id" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_hr_document_ref"("p_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  d public.hr_documents%ROWTYPE;
  type_code text;
  yr integer := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Africa/Dar_es_Salaam'))::integer;
  n integer;
  ref text;
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can work with HR documents.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO d FROM public.hr_documents WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document not found.'; END IF;
  IF d.status <> 'approved' THEN
    RAISE EXCEPTION 'A reference number is only given to an approved document. This document is %.', replace(d.status, '_', ' ');
  END IF;
  IF d.ref_no IS NOT NULL THEN
    RETURN d.ref_no;
  END IF;

  SELECT code INTO type_code FROM public.hr_document_types WHERE doc_type = d.doc_type;
  INSERT INTO public.hr_document_counters (doc_type, year, last_value) VALUES (d.doc_type, yr, 1)
  ON CONFLICT (doc_type, year) DO UPDATE SET last_value = public.hr_document_counters.last_value + 1
  RETURNING last_value INTO n;

  -- At least four digits; never truncate once a year passes 9999.
  ref := format('ALC/HR/%s/%s/%s', type_code, yr, repeat('0', greatest(4 - length(n::text), 0)) || n::text);

  PERFORM set_config('hr_docs.rpc', '1', true);
  UPDATE public.hr_documents SET ref_no = ref WHERE id = p_id;
  PERFORM set_config('hr_docs.rpc', '', true);
  RETURN ref;
END;
$$;


ALTER FUNCTION "public"."reserve_hr_document_ref"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_user_password"("user_email" "text", "new_password" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  target_user_id UUID;
BEGIN
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = lower(trim(user_email));

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No account found for this email';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf')),
      updated_at = NOW()
  WHERE id = target_user_id;
END;
$$;


ALTER FUNCTION "public"."reset_user_password"("user_email" "text", "new_password" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."candidates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "address" "text",
    "position" "text",
    "department" "text",
    "proposed_salary" numeric(14,2),
    "proposed_start_date" "date",
    "notes" "text",
    "offer_status" "text" DEFAULT 'none'::"text" NOT NULL,
    "offer_document_id" "uuid",
    "responded_at" "date",
    "employee_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "public"."safe_auth_uid"(),
    "updated_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    CONSTRAINT "candidates_full_name_check" CHECK (("length"(TRIM(BOTH FROM "full_name")) > 0)),
    CONSTRAINT "candidates_offer_status_check" CHECK (("offer_status" = ANY (ARRAY['none'::"text", 'offered'::"text", 'accepted'::"text", 'declined'::"text", 'expired'::"text", 'withdrawn'::"text"]))),
    CONSTRAINT "candidates_proposed_salary_check" CHECK ((("proposed_salary" IS NULL) OR ("proposed_salary" >= (0)::numeric)))
);


ALTER TABLE "public"."candidates" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."respond_to_offer"("p_candidate" "uuid", "p_response" "text", "p_date" "date" DEFAULT NULL::"date") RETURNS "public"."candidates"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  c public.candidates%ROWTYPE;
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can record an offer response.' USING ERRCODE = '42501';
  END IF;
  IF p_response NOT IN ('accepted', 'declined', 'withdrawn') THEN
    RAISE EXCEPTION 'The response must be accepted, declined or withdrawn.';
  END IF;
  SELECT * INTO c FROM public.candidates WHERE id = p_candidate FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Candidate not found.'; END IF;
  IF c.offer_status <> 'offered' THEN
    RAISE EXCEPTION 'There is no open offer for % (the offer is %).', c.full_name, c.offer_status;
  END IF;
  PERFORM set_config('hr_docs.rpc', '1', true);
  UPDATE public.candidates SET offer_status = p_response, responded_at = coalesce(p_date, public.hr_today())
   WHERE id = p_candidate RETURNING * INTO c;
  PERFORM set_config('hr_docs.rpc', '', true);
  RETURN c;
END;
$$;


ALTER FUNCTION "public"."respond_to_offer"("p_candidate" "uuid", "p_response" "text", "p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restrict_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text", "p_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE marketing_users SET
    approval_status    = 'RESTRICTED',
    restriction_reason = p_reason,
    restricted_at      = NOW(),
    is_active          = true
  WHERE id = p_marketer_id;

  INSERT INTO marketer_account_actions
    (marketer_id, action, performed_by, reason, internal_notes)
  VALUES
    (p_marketer_id, 'RESTRICTED', p_manager_id, p_reason, p_notes);

  INSERT INTO marketer_approval_log (marketer_id, action, performed_by, reason)
  VALUES (p_marketer_id, 'RESTRICTED', p_manager_id, p_reason);
END;
$$;


ALTER FUNCTION "public"."restrict_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."return_hr_document"("p_id" "uuid", "p_note" "text") RETURNS "public"."hr_documents"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  d public.hr_documents%ROWTYPE;
  me uuid := public.safe_auth_uid();
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can work with HR documents.' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(p_note, ''))) < 3 THEN
    RAISE EXCEPTION 'Please say what needs to change, so the author knows what to fix.';
  END IF;
  SELECT * INTO d FROM public.hr_documents WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document not found.'; END IF;
  IF d.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Only a document waiting for approval can be returned. This document is %.', replace(d.status, '_', ' ');
  END IF;

  PERFORM set_config('hr_docs.rpc', '1', true);
  UPDATE public.hr_documents SET status = 'draft', return_note = trim(p_note)
   WHERE id = p_id RETURNING * INTO d;

  IF d.created_by IS NOT NULL AND d.created_by IS DISTINCT FROM me THEN
    PERFORM public.notify_user(d.created_by, 'hr_document_returned', 'Document returned for changes',
      format('%s: %s', d.subject, trim(p_note)), '/hr/documents');
  END IF;
  PERFORM set_config('hr_docs.rpc', '', true);
  RETURN d;
END;
$$;


ALTER FUNCTION "public"."return_hr_document"("p_id" "uuid", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."review_leave_request"("p_id" "uuid", "p_decision" "text", "p_note" "text" DEFAULT NULL::"text", "p_replace_absent" boolean DEFAULT false) RETURNS "public"."leave_requests"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  req public.leave_requests%ROWTYPE;
  lt public.leave_types%ROWTYPE;
  bal public.leave_balances%ROWTYPE;
  me uuid := public.safe_auth_uid();
  yr integer;
  emp_name text;
  conflicts jsonb;
  hard_conflicts integer;
  d date;
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can approve or reject leave.' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decision must be approved or rejected.';
  END IF;

  SELECT * INTO req FROM public.leave_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Leave request not found.'; END IF;
  IF req.status <> 'pending' THEN
    RAISE EXCEPTION 'This request is already % and can no longer be reviewed.', req.status;
  END IF;
  IF req.employee_id = public.current_employee_id() THEN
    RAISE EXCEPTION 'You cannot approve or reject your own leave. Another Admin, HR Manager or General Manager must do it.';
  END IF;

  SELECT * INTO lt FROM public.leave_types WHERE id = req.leave_type_id;
  yr := public.leave_year_of(req.start_date);
  emp_name := public.leave_employee_name(req.employee_id);
  PERFORM set_config('leave.rpc', '1', true);

  -- Reject ------------------------------------------------------------------
  IF p_decision = 'rejected' THEN
    IF coalesce(length(trim(p_note)), 0) < 3 THEN
      RAISE EXCEPTION 'Please give a short reason, so the employee knows why the request was rejected.';
    END IF;
    UPDATE public.leave_requests
       SET status = 'rejected', decided_by = me, decided_at = now(), decision_note = trim(p_note)
     WHERE id = p_id RETURNING * INTO req;
    PERFORM public.leave_notify_requester(req, 'Leave request rejected',
      format('Your %s leave from %s to %s was rejected: %s', lt.name, req.start_date, req.end_date, trim(p_note)));
    PERFORM set_config('leave.rpc', '', true);
    RETURN req;
  END IF;

  -- Approve -----------------------------------------------------------------
  IF lt.tracks_balance THEN
    PERFORM public.ensure_leave_balance(req.employee_id, lt.id, yr);
    SELECT * INTO bal FROM public.leave_balances
     WHERE employee_id = req.employee_id AND leave_type_id = lt.id AND year = yr FOR UPDATE;
    IF req.days > bal.entitled + bal.carried_forward - bal.opening_taken - bal.taken THEN          -- Phase 5
      RAISE EXCEPTION 'Not enough % leave: % day(s) left in %, but this request is for % day(s).',
        lt.name, bal.entitled + bal.carried_forward - bal.opening_taken - bal.taken, yr, req.days;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.leave_requests r
    WHERE r.id <> req.id AND r.employee_id = req.employee_id AND r.status = 'approved'
      AND r.start_date <= req.end_date AND r.end_date >= req.start_date
  ) THEN
    RAISE EXCEPTION 'This employee already has approved leave that overlaps these dates.';
  END IF;

  -- Attendance already recorded on these days. Present / Late / Half Day are
  -- never overwritten (HR corrects the attendance or the dates first); Absent
  -- can be replaced only when the approver says so; a manual Leave row with no
  -- request behind it is simply adopted.
  SELECT coalesce(jsonb_agg(jsonb_build_object('date', a.date, 'status', a.status) ORDER BY a.date), '[]'::jsonb),
         count(*) FILTER (WHERE a.status <> 'Absent' OR NOT p_replace_absent)
    INTO conflicts, hard_conflicts
    FROM public.attendance a
   WHERE a.employee_id = req.employee_id
     AND a.date::date IN (SELECT public.leave_working_dates(req.start_date, req.end_date))
     AND NOT (a.status = 'Leave' AND a.leave_request_id IS NULL)
     AND a.leave_request_id IS DISTINCT FROM req.id;

  IF hard_conflicts > 0 THEN
    RAISE EXCEPTION 'Attendance is already recorded on % of these days, so the leave cannot be approved yet.', jsonb_array_length(conflicts)
      USING DETAIL = conflicts::text,
            HINT = CASE WHEN NOT EXISTS (SELECT 1 FROM jsonb_array_elements(conflicts) c WHERE c ->> 'status' <> 'Absent')
                        THEN 'ONLY_ABSENT' ELSE 'MUST_CORRECT' END;
  END IF;

  FOR d IN SELECT * FROM public.leave_working_dates(req.start_date, req.end_date) LOOP
    INSERT INTO public.attendance (employee_id, employee, date, status, notes, leave_request_id)
    VALUES (req.employee_id, emp_name, d, 'Leave', format('%s leave (approved)', lt.name), req.id)
    ON CONFLICT (employee_id, date) DO UPDATE
      SET status = 'Leave', leave_request_id = EXCLUDED.leave_request_id, notes = EXCLUDED.notes,
          clock_in_time = NULL, clock_out_time = NULL;
  END LOOP;

  IF lt.tracks_balance THEN
    UPDATE public.leave_balances SET taken = taken + req.days WHERE id = bal.id;
  END IF;

  UPDATE public.leave_requests
     SET status = 'approved', approved_by = me, approved_at = now(),
         decided_by = me, decided_at = now(), decision_note = nullif(trim(p_note), '')
   WHERE id = p_id RETURNING * INTO req;

  PERFORM public.leave_notify_requester(req, 'Leave request approved',
    format('Your %s leave from %s to %s (%s day(s)) was approved.', lt.name, req.start_date, req.end_date, req.days));
  PERFORM set_config('leave.rpc', '', true);
  RETURN req;
END;
$$;


ALTER FUNCTION "public"."review_leave_request"("p_id" "uuid", "p_decision" "text", "p_note" "text", "p_replace_absent" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."run_contract_expiry_job"("p_today" "date" DEFAULT NULL::"date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  today date := coalesce(p_today, public.hr_today());
  rec RECORD;
  sent integer := 0;
  overdue integer := 0;
  expired_contracts integer;
  expired_offers integer;
  expired_warnings integer;
BEGIN
  IF NOT (public.can_manage_hr() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Only HR or the scheduled job can run contract reminders.' USING ERRCODE = '42501';
  END IF;

  FOR rec IN SELECT * FROM public.contracts_due_for_reminder(today) LOOP
    PERFORM public.notify_hr_roles(
      'contract_expiry',
      CASE WHEN rec.threshold_days = 0 THEN format('Contract overdue: %s', rec.employee_name)
           ELSE format('Contract ends in %s days: %s', rec.threshold_days, rec.employee_name) END,
      CASE WHEN rec.threshold_days = 0
           THEN format('%s''s contract ended on %s and no decision was recorded. It is now marked expired; extend it or end the employment.', rec.employee_name, to_char(rec.end_date, 'FMDD Mon YYYY'))
           ELSE format('%s''s contract ends on %s. Prepare an extension or plan the end of employment.', rec.employee_name, to_char(rec.end_date, 'FMDD Mon YYYY')) END,
      '/hr/employees?open=' || rec.employee_id
    );
    INSERT INTO public.contract_expiry_notices (contract_id, threshold_days) VALUES (rec.contract_id, rec.threshold_days)
    ON CONFLICT DO NOTHING;
    IF rec.threshold_days = 0 THEN overdue := overdue + 1; ELSE sent := sent + 1; END IF;
  END LOOP;

  UPDATE public.employment_contracts SET status = 'expired' WHERE status = 'active' AND end_date < today;
  GET DIAGNOSTICS expired_contracts = ROW_COUNT;

  expired_offers := public.expire_offers(today);

  UPDATE public.disciplinary_records SET status = 'expired' WHERE status = 'active' AND expires_on < today;
  GET DIAGNOSTICS expired_warnings = ROW_COUNT;

  RETURN jsonb_build_object('day', today, 'reminders', sent, 'overdue', overdue,
    'contracts_expired', expired_contracts, 'offers_expired', expired_offers, 'warnings_expired', expired_warnings);
END;
$$;


ALTER FUNCTION "public"."run_contract_expiry_job"("p_today" "date") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hr_document_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "doc_type" "text" NOT NULL,
    "version" integer NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "use_stored_signature" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "public"."safe_auth_uid"(),
    "updated_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    CONSTRAINT "hr_document_templates_version_check" CHECK (("version" >= 1))
);


ALTER TABLE "public"."hr_document_templates" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_hr_template_version"("p_doc_type" "text", "p_title" "text", "p_body" "text", "p_use_stored_signature" boolean DEFAULT false) RETURNS "public"."hr_document_templates"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  t public.hr_document_templates%ROWTYPE;
  next_version integer;
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can edit HR templates.' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(p_title, ''))) = 0 OR length(trim(coalesce(p_body, ''))) = 0 THEN
    RAISE EXCEPTION 'A template needs a title and some text.';
  END IF;
  -- Serialise concurrent saves for the same type.
  PERFORM 1 FROM public.hr_document_types WHERE doc_type = p_doc_type FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown document type.'; END IF;

  SELECT coalesce(max(version), 0) + 1 INTO next_version FROM public.hr_document_templates WHERE doc_type = p_doc_type;
  UPDATE public.hr_document_templates SET is_active = false WHERE doc_type = p_doc_type AND is_active;
  INSERT INTO public.hr_document_templates (doc_type, version, title, body, use_stored_signature, is_active)
  VALUES (p_doc_type, next_version, trim(p_title), p_body, coalesce(p_use_stored_signature, false), true)
  RETURNING * INTO t;
  RETURN t;
END;
$$;


ALTER FUNCTION "public"."save_hr_template_version"("p_doc_type" "text", "p_title" "text", "p_body" "text", "p_use_stored_signature" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_hr_modules"("p_modules" "text"[]) RETURNS "text"[]
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  before text[];
  after text[];
BEGIN
  IF NOT public.can_manage_settings() THEN
    RAISE EXCEPTION 'Only an Admin can change which HR modules are switched on.' USING ERRCODE = '42501';
  END IF;
  IF p_modules IS NULL OR NOT (p_modules <@ ARRAY['audit', 'leave', 'documents', 'letters', 'candidates']::text[]) THEN
    RAISE EXCEPTION 'Unknown HR module. Use audit, leave, documents, letters and candidates.';
  END IF;
  SELECT hr_modules INTO before FROM public.app_settings WHERE id = true FOR UPDATE;
  after := ARRAY(SELECT DISTINCT m FROM unnest(p_modules) m ORDER BY m);
  UPDATE public.app_settings SET hr_modules = after WHERE id = true;
  INSERT INTO public.audit_log (actor_id, action, table_name, record_id, metadata)
  VALUES (public.safe_auth_uid(), 'app_settings.hr_modules', 'app_settings', 'hr_modules',
          jsonb_build_object('old', to_jsonb(before), 'new', to_jsonb(after)));
  RETURN after;
END;
$$;


ALTER FUNCTION "public"."set_hr_modules"("p_modules" "text"[]) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leave_balances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "text" NOT NULL,
    "leave_type_id" "uuid" NOT NULL,
    "year" integer NOT NULL,
    "entitled" numeric(6,1) DEFAULT 0 NOT NULL,
    "carried_forward" numeric(6,1) DEFAULT 0 NOT NULL,
    "taken" numeric(6,1) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "public"."safe_auth_uid"(),
    "updated_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "opening_taken" numeric(6,1) DEFAULT 0 NOT NULL,
    CONSTRAINT "leave_balances_carried_forward_check" CHECK (("carried_forward" >= (0)::numeric)),
    CONSTRAINT "leave_balances_entitled_check" CHECK (("entitled" >= (0)::numeric)),
    CONSTRAINT "leave_balances_opening_taken_check" CHECK (("opening_taken" >= (0)::numeric)),
    CONSTRAINT "leave_balances_taken_check" CHECK (("taken" >= (0)::numeric)),
    CONSTRAINT "leave_balances_year_check" CHECK ((("year" >= 2000) AND ("year" <= 2100)))
);


ALTER TABLE "public"."leave_balances" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_opening_leave_taken"("p_employee" "text", "p_type" "uuid", "p_year" integer, "p_days" numeric) RETURNS "public"."leave_balances"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  lt public.leave_types%ROWTYPE;
  b public.leave_balances%ROWTYPE;
  live_year integer := public.hr_go_live_year();
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can enter opening leave balances.' USING ERRCODE = '42501';
  END IF;
  IF p_year IS DISTINCT FROM live_year OR public.leave_year_of(public.hr_today()) > live_year THEN
    RAISE EXCEPTION 'Opening balances can only be entered for the go-live year (%).', live_year;
  END IF;
  IF p_days IS NULL OR p_days < 0 OR p_days <> round(p_days * 2) / 2 THEN
    RAISE EXCEPTION 'Days taken must be zero or more, in whole or half days.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_employee) THEN
    RAISE EXCEPTION 'Employee % not found.', p_employee;
  END IF;
  SELECT * INTO lt FROM public.leave_types WHERE id = p_type;
  IF NOT FOUND THEN RAISE EXCEPTION 'Leave type not found.'; END IF;
  IF NOT lt.tracks_balance THEN
    RAISE EXCEPTION '% leave has no balance, so there is nothing to enter.', lt.name;
  END IF;

  PERFORM public.ensure_leave_balance(p_employee, p_type, p_year);
  SELECT * INTO b FROM public.leave_balances
   WHERE employee_id = p_employee AND leave_type_id = p_type AND year = p_year FOR UPDATE;
  IF p_days + b.taken > b.entitled + b.carried_forward THEN
    RAISE EXCEPTION '% days of % leave is more than % has left in % (% entitled, % carried, % taken in the system).',
      p_days, lt.name, public.leave_employee_name(p_employee), p_year, b.entitled, b.carried_forward, b.taken;
  END IF;

  PERFORM set_config('leave.opening', '1', true);
  UPDATE public.leave_balances SET opening_taken = p_days WHERE id = b.id RETURNING * INTO b;
  PERFORM set_config('leave.opening', '', true);
  RETURN b;
END;
$$;


ALTER FUNCTION "public"."set_opening_leave_taken"("p_employee" "text", "p_type" "uuid", "p_year" integer, "p_days" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_by"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Always overwrite: a client must not be able to forge who edited a row.
  NEW.updated_by := public.safe_auth_uid();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_by"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_hr_document"("p_id" "uuid") RETURNS "public"."hr_documents"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  d public.hr_documents%ROWTYPE;
  me uuid := public.safe_auth_uid();
  lbl text;
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can work with HR documents.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO d FROM public.hr_documents WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document not found.'; END IF;
  IF d.status <> 'draft' THEN
    RAISE EXCEPTION 'Only a draft can be sent for approval. This document is %.', replace(d.status, '_', ' ');
  END IF;
  IF length(trim(coalesce(d.subject, ''))) = 0 THEN
    RAISE EXCEPTION 'Add a subject before sending the document for approval.';
  END IF;
  PERFORM public.hr_doc_validate(d, 'submit');                       -- Phase 4

  PERFORM set_config('hr_docs.rpc', '1', true);
  UPDATE public.hr_documents SET status = 'pending_approval', return_note = NULL
   WHERE id = p_id RETURNING * INTO d;

  SELECT label INTO lbl FROM public.hr_document_types WHERE doc_type = d.doc_type;
  PERFORM public.hr_doc_notify_approvers(me, 'hr_document_submitted', 'Document waiting for approval',
    format('%s: %s', lbl, d.subject));
  PERFORM set_config('hr_docs.rpc', '', true);
  RETURN d;
END;
$$;


ALTER FUNCTION "public"."submit_hr_document"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_rfq"("p_rfq_id" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF NOT public.is_active_portal_user() THEN
    RAISE EXCEPTION 'Not an active portal user';
  END IF;

  SELECT status INTO v_status FROM public.rfqs WHERE id = p_rfq_id FOR UPDATE;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'RFQ % not found', p_rfq_id;
  END IF;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'RFQ % has already been submitted', p_rfq_id;
  END IF;

  UPDATE public.rfqs SET status = 'submitted', updated_at = now() WHERE id = p_rfq_id;

  INSERT INTO public.rfq_status_history (rfq_id, from_status, to_status, changed_by_id, note)
  VALUES (p_rfq_id, 'draft', 'submitted', public.portal_uid(), 'Submitted to catering system');
END;
$$;


ALTER FUNCTION "public"."submit_rfq"("p_rfq_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."suspend_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text", "p_until" timestamp with time zone, "p_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF p_until <= NOW() THEN
    RAISE EXCEPTION 'Suspension end date must be in the future';
  END IF;

  UPDATE marketing_users SET
    is_active         = false,
    approval_status   = 'SUSPENDED',
    suspension_reason = p_reason,
    suspended_until   = p_until,
    suspended_by      = p_manager_id
  WHERE id = p_marketer_id;

  INSERT INTO marketer_account_actions
    (marketer_id, action, performed_by, reason, internal_notes,
     effective_from, effective_until)
  VALUES
    (p_marketer_id, 'SUSPENDED', p_manager_id, p_reason, p_notes,
     NOW(), p_until);

  INSERT INTO marketer_approval_log (marketer_id, action, performed_by, reason)
  VALUES (p_marketer_id, 'SUSPENDED', p_manager_id, p_reason);
END;
$$;


ALTER FUNCTION "public"."suspend_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text", "p_until" timestamp with time zone, "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_training_applicants"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  tid text;
BEGIN
  FOREACH tid IN ARRAY ARRAY[
    CASE WHEN TG_OP <> 'INSERT' THEN OLD.training_id::text END,
    CASE WHEN TG_OP <> 'DELETE' THEN NEW.training_id::text END
  ]
  LOOP
    IF tid IS NOT NULL THEN
      UPDATE public.positions
      SET applicants = (SELECT count(*) FROM public.training_participants WHERE training_id::text = tid)
      WHERE id::text = tid;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."sync_training_applicants"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."uat_cleanup_on"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT coalesce(current_setting('app.uat_cleanup', true), '') = 'on';
$$;


ALTER FUNCTION "public"."uat_cleanup_on"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_company_from_visit"("p_company_id" "uuid", "p_stage" "text", "p_company_size" "text" DEFAULT NULL::"text", "p_operations" "text" DEFAULT NULL::"text", "p_likelihood" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE companies SET
    pipeline_stage = p_stage::pipeline_stage,
    company_size_note = COALESCE(p_company_size, company_size_note),
    operations_note = COALESCE(p_operations, operations_note),
    future_client_likelihood = COALESCE(p_likelihood, future_client_likelihood),
    last_visited_at = NOW(),
    updated_at = NOW()
  WHERE id = p_company_id;
END;
$$;


ALTER FUNCTION "public"."update_company_from_visit"("p_company_id" "uuid", "p_stage" "text", "p_company_size" "text", "p_operations" "text", "p_likelihood" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_hr_document"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  d public.hr_documents%ROWTYPE;
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can work with HR documents.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO d FROM public.hr_documents WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document not found.'; END IF;
  PERFORM public.hr_doc_validate(d, 'issue');
END;
$$;


ALTER FUNCTION "public"."validate_hr_document"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_nida"("nida" "text") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
BEGIN
  RETURN regexp_replace(nida, '[\s\-]', '', 'g') ~ '^[0-9]{20}$';
END;
$_$;


ALTER FUNCTION "public"."validate_nida"("nida" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_tin"("tin" "text") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
BEGIN
  RETURN regexp_replace(tin, '[\s\-]', '', 'g') ~ '^[0-9]{9}$';
END;
$_$;


ALTER FUNCTION "public"."validate_tin"("tin" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."void_hr_document"("p_id" "uuid", "p_reason" "text") RETURNS "public"."hr_documents"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  d public.hr_documents%ROWTYPE;
  me uuid := public.safe_auth_uid();
  was_issued boolean;
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can void HR documents.' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Please give a reason for voiding this document.';
  END IF;
  SELECT * INTO d FROM public.hr_documents WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document not found.'; END IF;
  IF d.status = 'void' THEN RAISE EXCEPTION 'This document is already void.'; END IF;
  was_issued := d.status = 'issued';

  PERFORM set_config('hr_docs.rpc', '1', true);
  UPDATE public.hr_documents
     SET status = 'void', void_reason = trim(p_reason), voided_by = me, voided_at = now()
   WHERE id = p_id RETURNING * INTO d;
  IF was_issued THEN
    PERFORM public.hr_doc_void_effects(d);                           -- Phase 4
  END IF;

  IF d.created_by IS NOT NULL AND d.created_by IS DISTINCT FROM me THEN
    PERFORM public.notify_user(d.created_by, 'hr_document_void', 'Document voided',
      format('%s was voided: %s', d.subject, trim(p_reason)), '/hr/documents');
  END IF;
  PERFORM set_config('hr_docs.rpc', '', true);
  RETURN d;
END;
$$;


ALTER FUNCTION "public"."void_hr_document"("p_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."void_proforma"("p_proforma_id" "text", "p_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_is_invoiced BOOLEAN;
BEGIN
  SELECT "isInvoiced" INTO v_is_invoiced FROM public.proforma_invoices WHERE id = p_proforma_id FOR UPDATE;
  IF v_is_invoiced IS NULL THEN
    RAISE EXCEPTION 'Proforma % not found', p_proforma_id;
  END IF;
  IF v_is_invoiced THEN
    RAISE EXCEPTION 'Proforma % has already been invoiced and cannot be voided', p_proforma_id;
  END IF;

  UPDATE public.proforma_invoices
  SET "isVoided" = true, "voidedAt" = now(), "voidedReason" = p_reason, "updatedAt" = now()
  WHERE id = p_proforma_id;

  -- Cascade: every order this proforma covers is no longer going ahead.
  UPDATE public.orders
  SET status = 'cancelled', "updatedAt" = now()
  WHERE proforma_id = p_proforma_id;
END;
$$;


ALTER FUNCTION "public"."void_proforma"("p_proforma_id" "text", "p_reason" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "id" boolean DEFAULT true NOT NULL,
    "login_image_url" "text",
    "header_url" "text",
    "footer_url" "text",
    "signature_url" "text",
    "proforma_stamp_url" "text",
    "invoice_stamp_url" "text",
    "next_order_number" integer,
    "next_proforma_number" "text",
    "next_invoice_number" "text",
    "pdf_scale" numeric(3,1) DEFAULT 2.0,
    "updated_by" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_name" "text",
    "company_address" "text",
    "company_phone" "text",
    "company_email" "text",
    "company_tin" "text",
    "company_vrn" "text",
    "hr_modules" "text"[],
    "hr_go_live_at" timestamp with time zone,
    CONSTRAINT "app_settings_hr_modules_known" CHECK ((("hr_modules" IS NULL) OR ("hr_modules" <@ ARRAY['audit'::"text", 'leave'::"text", 'documents'::"text", 'letters'::"text", 'candidates'::"text"]))),
    CONSTRAINT "app_settings_id_check" CHECK ("id")
);


ALTER TABLE "public"."app_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assets" (
    "id" "text" DEFAULT ('ASSET'::"text" || "substr"(("extensions"."uuid_generate_v4"())::"text", 1, 8)) NOT NULL,
    "name" "text" NOT NULL,
    "type" "text",
    "unit" "text",
    "unitPrice" numeric,
    "quantity" integer,
    "status" "text",
    "lastMaintenance" "date",
    "nextMaintenance" "date",
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "updatedAt" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" DEFAULT "public"."safe_auth_uid"(),
    "updated_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone
);


ALTER TABLE "public"."assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance" (
    "id" "text" DEFAULT ('ATT'::"text" || "substr"(("extensions"."uuid_generate_v4"())::"text", 1, 8)) NOT NULL,
    "employee" "text",
    "date" "date" NOT NULL,
    "clockIn" "text",
    "clockOut" "text",
    "totalHours" "text",
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "updatedAt" timestamp with time zone DEFAULT "now"(),
    "employee_id" "text" NOT NULL,
    "clock_in_time" time without time zone,
    "clock_out_time" time without time zone,
    "status" "text" DEFAULT 'Present'::"text" NOT NULL,
    "notes" "text",
    "created_by" "uuid" DEFAULT "public"."safe_auth_uid"(),
    "updated_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "leave_request_id" "uuid",
    CONSTRAINT "attendance_status_check" CHECK (("status" = ANY (ARRAY['Present'::"text", 'Absent'::"text", 'Leave'::"text", 'Half Day'::"text", 'Late'::"text"])))
);


ALTER TABLE "public"."attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "text" NOT NULL,
    "client_id" "text",
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "start_date" timestamp with time zone NOT NULL,
    "end_date" timestamp with time zone NOT NULL,
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "proforma_invoice_id" "text"
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catering_menu_recipes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "menu_id" "uuid" NOT NULL,
    "recipe_number" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."catering_menu_recipes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catering_menus" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "menu_type_id" "uuid" NOT NULL,
    "base_people" integer DEFAULT 1 NOT NULL,
    "price_per_person" numeric(12,2) DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    CONSTRAINT "catering_menus_base_people_check" CHECK (("base_people" >= 1)),
    CONSTRAINT "catering_menus_price_per_person_check" CHECK (("price_per_person" >= (0)::numeric))
);


ALTER TABLE "public"."catering_menus" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_invoice_tax_settings" (
    "client_id" "text" NOT NULL,
    "tax_type" "text" NOT NULL,
    "applies" boolean DEFAULT false NOT NULL,
    "updated_by" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "client_invoice_tax_settings_tax_type_check" CHECK (("tax_type" = ANY (ARRAY['vat'::"text", 'wht'::"text", 'vat_withholding'::"text"])))
);


ALTER TABLE "public"."client_invoice_tax_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "text" NOT NULL,
    "companyName" "text" NOT NULL,
    "companyEmail" "text",
    "phoneNumber" "text",
    "address1" "text",
    "address2" "text",
    "postalCode" "text",
    "primaryLocation" "text",
    "typeOfOrganization" "text",
    "contacts" "jsonb",
    "lastContacted" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "updatedAt" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "marketer_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "invoice_ref" "text" NOT NULL,
    "invoice_amount" numeric(15,2) NOT NULL,
    "commission_rate" numeric(5,4) NOT NULL,
    "commission_amount" numeric(15,2) NOT NULL,
    "is_first_month" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "invoice_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "split_count" integer DEFAULT 1,
    CONSTRAINT "commissions_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'APPROVED'::"text", 'PAID'::"text"])))
);


ALTER TABLE "public"."commissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "industry" "text",
    "business_size" "public"."business_size",
    "employee_count" integer,
    "address" "text",
    "latitude" double precision,
    "longitude" double precision,
    "region_id" "uuid",
    "contact_name" "text",
    "contact_position" "text",
    "contact_phone" "text",
    "contact_email" "text",
    "current_caterer" "text",
    "current_caterer_notes" "text",
    "pipeline_stage" "public"."pipeline_stage" DEFAULT 'IDENTIFIED'::"public"."pipeline_stage" NOT NULL,
    "lead_score" integer DEFAULT 0,
    "estimated_value" numeric(15,2),
    "assigned_marketer_id" "uuid",
    "qr_code" "text",
    "last_visited_at" timestamp with time zone,
    "client_since" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "landed_by_marketer_id" "uuid",
    "landed_by_name" "text",
    "landed_at" timestamp with time zone,
    "registered_by_marketer" boolean DEFAULT false,
    "is_prospect" boolean DEFAULT true,
    "quotation_requested" boolean DEFAULT false,
    "client_id" "text",
    "onboarding_requested" boolean DEFAULT false NOT NULL,
    "onboarding_requested_at" timestamp with time zone,
    "onboarding_requested_by" "uuid",
    "client_onboarding_requested" boolean DEFAULT false,
    "company_size_note" "text",
    "operations_note" "text",
    "future_client_likelihood" "text",
    "company_phone" "text",
    "organization_type" "text",
    "postal_address" "text",
    "postal_code" "text",
    "headquarters" "text",
    "branches" "text",
    "contact_persons" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "companies_future_client_likelihood_check" CHECK (("future_client_likelihood" = ANY (ARRAY['UNLIKELY'::"text", 'POSSIBLE'::"text", 'LIKELY'::"text", 'VERY_LIKELY'::"text"]))),
    CONSTRAINT "companies_lead_score_check" CHECK ((("lead_score" >= 0) AND ("lead_score" <= 100)))
);

ALTER TABLE ONLY "public"."companies" REPLICA IDENTITY FULL;


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_collaborators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "marketer_id" "uuid" NOT NULL,
    "added_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_collaborators" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "url" "text" NOT NULL,
    "uploaded_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "role" "public"."marketing_user_role" DEFAULT 'MARKETER'::"public"."marketing_user_role" NOT NULL,
    "is_active" boolean DEFAULT true,
    "region_id" "uuid",
    "last_latitude" double precision,
    "last_longitude" double precision,
    "last_seen_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "auth_user_id" "uuid",
    "google_email" "text",
    "google_name" "text",
    "google_avatar_url" "text",
    "first_name" "text",
    "middle_name" "text",
    "last_name" "text",
    "date_of_birth" "date",
    "gender" "text",
    "nationality" "text" DEFAULT 'Tanzanian'::"text",
    "physical_address" "text",
    "district" "text",
    "city" "text" DEFAULT 'Dar es Salaam'::"text",
    "nida_number" "text",
    "tin_number" "text",
    "nida_verified" boolean DEFAULT false,
    "tin_verified" boolean DEFAULT false,
    "employment_type" "text" DEFAULT 'FULL_TIME'::"text",
    "start_date" "date",
    "bio" "text",
    "supervisor_id" "uuid",
    "emergency_name" "text",
    "emergency_phone" "text",
    "emergency_relation" "text",
    "emergency_address" "text",
    "profile_photo_path" "text",
    "onboarding_step" integer DEFAULT 0,
    "onboarding_done" boolean DEFAULT false,
    "submitted_at" timestamp with time zone,
    "approval_status" "text" DEFAULT 'INCOMPLETE'::"text",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "rejection_reason" "text",
    "rejected_at" timestamp with time zone,
    "caution_count" integer DEFAULT 0,
    "last_caution_at" timestamp with time zone,
    "last_caution_reason" "text",
    "restriction_reason" "text",
    "restricted_at" timestamp with time zone,
    "disabled_reason" "text",
    "disabled_at" timestamp with time zone,
    "disabled_by" "uuid",
    "suspended_until" timestamp with time zone,
    "suspension_reason" "text",
    "suspended_by" "uuid",
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "reinstated_at" timestamp with time zone,
    "reinstated_by" "uuid",
    "marketer_code" "text",
    CONSTRAINT "marketing_users_approval_status_check" CHECK (("approval_status" = ANY (ARRAY['INCOMPLETE'::"text", 'PENDING'::"text", 'APPROVED'::"text", 'REJECTED'::"text", 'CAUTIONED'::"text", 'RESTRICTED'::"text", 'DISABLED'::"text", 'SUSPENDED'::"text", 'DELETED'::"text"]))),
    CONSTRAINT "marketing_users_employment_type_check" CHECK (("employment_type" = ANY (ARRAY['FULL_TIME'::"text", 'PART_TIME'::"text", 'CONTRACT'::"text"]))),
    CONSTRAINT "marketing_users_gender_check" CHECK (("gender" = ANY (ARRAY['MALE'::"text", 'FEMALE'::"text", 'OTHER'::"text"])))
);


ALTER TABLE "public"."marketing_users" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."company_map_pins" WITH ("security_invoker"='true') AS
 SELECT "c"."id",
    "c"."name",
    "c"."latitude",
    "c"."longitude",
    "c"."pipeline_stage",
    "c"."lead_score",
    "c"."last_visited_at",
    "c"."assigned_marketer_id",
    "mu"."full_name" AS "marketer_name",
        CASE
            WHEN ("date"("c"."last_visited_at") = CURRENT_DATE) THEN 'visited_today'::"text"
            WHEN ("c"."last_visited_at" >= ("now"() - '7 days'::interval)) THEN 'visited_week'::"text"
            WHEN ("c"."last_visited_at" IS NULL) THEN 'never_visited'::"text"
            ELSE 'not_recent'::"text"
        END AS "visit_recency"
   FROM ("public"."companies" "c"
     LEFT JOIN "public"."marketing_users" "mu" ON (("mu"."id" = "c"."assigned_marketer_id")))
  WHERE (("c"."is_active" = true) AND ("c"."latitude" IS NOT NULL) AND ("c"."longitude" IS NOT NULL));


ALTER VIEW "public"."company_map_pins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "is_pinned" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contract_expiry_notices" (
    "contract_id" "uuid" NOT NULL,
    "threshold_days" integer NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "contract_expiry_notices_threshold_days_check" CHECK (("threshold_days" = ANY (ARRAY[0, 7, 30, 60])))
);


ALTER TABLE "public"."contract_expiry_notices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."costing_reports" (
    "id" bigint NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "report_date" "date" NOT NULL,
    "type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "branch" "text" DEFAULT 'Dar es Salaam'::"text"
);


ALTER TABLE "public"."costing_reports" OWNER TO "postgres";


ALTER TABLE "public"."costing_reports" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."costing_reports_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."daily_menus" (
    "id" bigint NOT NULL,
    "order_id" "text" NOT NULL,
    "menu_date" "date" NOT NULL,
    "recipes" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "region" "text",
    "event_id" "text"
);


ALTER TABLE "public"."daily_menus" OWNER TO "postgres";


ALTER TABLE "public"."daily_menus" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."daily_menus_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."daily_orders" (
    "id" bigint NOT NULL,
    "booking_id" "text",
    "order_date" timestamp with time zone NOT NULL,
    "menu" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "unit_price" numeric NOT NULL,
    "total" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."daily_orders" OWNER TO "postgres";


ALTER TABLE "public"."daily_orders" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."daily_orders_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE SEQUENCE IF NOT EXISTS "public"."delivery_note_serial_sequence"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."delivery_note_serial_sequence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."delivery_notes" (
    "id" "text" NOT NULL,
    "order_id" "text",
    "client_id" "text",
    "client_name" "text",
    "delivery_date" "date" NOT NULL,
    "delivery_location" "text",
    "vehicle_reg_no" "text",
    "delivered_by" "text",
    "items" "jsonb",
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "event_id" "text",
    "is_narration" boolean DEFAULT false,
    "narration_text" "text"
);


ALTER TABLE "public"."delivery_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."disciplinary_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "text" NOT NULL,
    "level" "text" NOT NULL,
    "offence_category" "text" NOT NULL,
    "incident_date" "date" NOT NULL,
    "expires_on" "date" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "document_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "public"."safe_auth_uid"(),
    "updated_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    CONSTRAINT "disciplinary_records_dates" CHECK (("expires_on" >= "incident_date")),
    CONSTRAINT "disciplinary_records_level_check" CHECK (("level" = ANY (ARRAY['verbal'::"text", 'first_written'::"text", 'final_written'::"text"]))),
    CONSTRAINT "disciplinary_records_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'expired'::"text", 'void'::"text"])))
);


ALTER TABLE "public"."disciplinary_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "text" DEFAULT ('EMP'::"text" || "substr"(("extensions"."uuid_generate_v4"())::"text", 1, 8)) NOT NULL,
    "firstName" "text",
    "middleName" "text",
    "lastName" "text",
    "dob" "date",
    "gender" "text",
    "nationality" "text",
    "nationalId" "text",
    "tin" "text",
    "phone" "text",
    "email" "text",
    "address" "text",
    "emergencyContactName" "text",
    "emergencyContactRelationship" "text",
    "emergencyContactPhone" "text",
    "role" "text",
    "department" "text",
    "status" "text",
    "monthlySalary" numeric,
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "updatedAt" timestamp with time zone DEFAULT "now"(),
    "bankName" "text",
    "bankAccountNumber" "text",
    "nssfNumber" "text",
    "employmentEndDate" "date",
    "employmentEndReason" "text",
    "employmentStartDate" "date",
    "created_by" "uuid" DEFAULT "public"."safe_auth_uid"(),
    "updated_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone
);


ALTER TABLE "public"."employees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "text" NOT NULL,
    "date" "date" NOT NULL,
    "payee" "text" NOT NULL,
    "ref_number" "text" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "vat_amount" numeric(10,2) DEFAULT 0,
    "payment_md" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "expenses_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "expenses_category_check" CHECK (("category" = ANY (ARRAY['Transport & Fuel'::"text", 'Utilities'::"text", 'Venue Rent'::"text", 'Kitchen Consumables'::"text", 'Marketing'::"text", 'Office Overhead'::"text"]))),
    CONSTRAINT "expenses_payment_md_check" CHECK (("payment_md" = ANY (ARRAY['cash'::"text", 'bank'::"text", 'mobile_money'::"text"])))
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


COMMENT ON TABLE "public"."expenses" IS 'Ledger for general and event-specific operational overhead expenses';



CREATE TABLE IF NOT EXISTS "public"."follow_ups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "visit_id" "uuid",
    "assigned_to" "uuid" NOT NULL,
    "type" "public"."follow_up_type" NOT NULL,
    "due_date" timestamp with time zone NOT NULL,
    "status" "public"."follow_up_status" DEFAULT 'PENDING'::"public"."follow_up_status" NOT NULL,
    "notes" "text",
    "completed_at" timestamp with time zone,
    "reminder_sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."follow_ups" REPLICA IDENTITY FULL;


ALTER TABLE "public"."follow_ups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hr_document_counters" (
    "doc_type" "text" NOT NULL,
    "year" integer NOT NULL,
    "last_value" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "hr_document_counters_last_value_check" CHECK (("last_value" >= 0)),
    CONSTRAINT "hr_document_counters_year_check" CHECK ((("year" >= 2000) AND ("year" <= 2100)))
);


ALTER TABLE "public"."hr_document_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hr_document_types" (
    "doc_type" "text" NOT NULL,
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "requires_different_approver" boolean DEFAULT false NOT NULL,
    "confidential_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "public"."safe_auth_uid"(),
    "updated_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    CONSTRAINT "hr_document_types_code_check" CHECK (("code" ~ '^[A-Z]{3}$'::"text"))
);


ALTER TABLE "public"."hr_document_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hr_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "link" "text",
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."hr_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."id_counters" (
    "name" "text" NOT NULL,
    "value" bigint DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."id_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ingredients" (
    "itemNumber" "text" NOT NULL,
    "itemDescription" "text" NOT NULL,
    "itemClassification" "text",
    "units" "jsonb",
    "quantityUsed" numeric DEFAULT 0,
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "updatedAt" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid"
);


ALTER TABLE "public"."ingredients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_tax_rates" (
    "tax_type" "text" NOT NULL,
    "rate" numeric(5,2) NOT NULL,
    "updated_by" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "invoice_tax_rates_tax_type_check" CHECK (("tax_type" = ANY (ARRAY['vat'::"text", 'wht'::"text", 'vat_withholding'::"text"])))
);


ALTER TABLE "public"."invoice_tax_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."issuance" (
    "id" "text" DEFAULT ('ISS'::"text" || "substr"(("extensions"."uuid_generate_v4"())::"text", 1, 8)) NOT NULL,
    "orderId" "text",
    "issuedTo" "text",
    "date" "date",
    "status" "text",
    "items" "jsonb",
    "totalValue" numeric,
    "notes" "text",
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "updatedAt" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" DEFAULT "public"."safe_auth_uid"(),
    "updated_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone
);


ALTER TABLE "public"."issuance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leave_settings" (
    "id" integer DEFAULT 1 NOT NULL,
    "working_days" integer[] DEFAULT ARRAY[1, 2, 3, 4, 5, 6] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "public"."safe_auth_uid"(),
    "updated_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    CONSTRAINT "leave_settings_id_check" CHECK (("id" = 1)),
    CONSTRAINT "leave_settings_working_days_check" CHECK ((("working_days" <@ ARRAY[1, 2, 3, 4, 5, 6, 7]) AND ("array_length"("working_days", 1) >= 1)))
);


ALTER TABLE "public"."leave_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leave_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "days_per_year" numeric(6,1) DEFAULT 0 NOT NULL,
    "is_paid" boolean DEFAULT true NOT NULL,
    "tracks_balance" boolean DEFAULT true NOT NULL,
    "requires_attachment" boolean DEFAULT false NOT NULL,
    "max_carry_forward" numeric(6,1) DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "public"."safe_auth_uid"(),
    "updated_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    CONSTRAINT "leave_types_days_per_year_check" CHECK (("days_per_year" >= (0)::numeric)),
    CONSTRAINT "leave_types_max_carry_forward_check" CHECK (("max_carry_forward" >= (0)::numeric))
);


ALTER TABLE "public"."leave_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketer_account_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "marketer_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "performed_by" "uuid" NOT NULL,
    "reason" "text",
    "internal_notes" "text",
    "visible_to_marketer" boolean DEFAULT true,
    "effective_from" timestamp with time zone DEFAULT "now"(),
    "effective_until" timestamp with time zone,
    "reverted_at" timestamp with time zone,
    "reverted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."marketer_account_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_performance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "marketer_id" "uuid" NOT NULL,
    "month" integer NOT NULL,
    "year" integer NOT NULL,
    "total_visits" integer DEFAULT 0,
    "verified_visits" integer DEFAULT 0,
    "new_leads" integer DEFAULT 0,
    "hot_leads" integer DEFAULT 0,
    "quotations_requested" integer DEFAULT 0,
    "deals_won" integer DEFAULT 0,
    "follow_ups_completed" integer DEFAULT 0,
    "follow_ups_missed" integer DEFAULT 0,
    "revenue_generated" numeric(15,2) DEFAULT 0,
    "avg_lead_score" numeric(5,2) DEFAULT 0,
    "avg_interest_level" numeric(5,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "marketing_performance_month_check" CHECK ((("month" >= 1) AND ("month" <= 12)))
);


ALTER TABLE "public"."marketing_performance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."regions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."regions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."marketer_account_overview" WITH ("security_invoker"='true') AS
 SELECT "mu"."id",
    "mu"."full_name",
    "mu"."email",
    "mu"."google_email",
    "mu"."phone",
    "mu"."role",
    "mu"."is_active",
    "mu"."approval_status",
    "mu"."caution_count",
    "mu"."last_caution_at",
    "mu"."disabled_reason",
    "mu"."disabled_at",
    "mu"."suspended_until",
    "mu"."suspension_reason",
    "mu"."deleted_at",
    "r"."name" AS "region_name",
    "mu"."region_id",
    "mp"."total_visits" AS "visits_this_month",
    "mp"."deals_won" AS "deals_this_month",
    "mp"."avg_lead_score",
    "mu"."last_seen_at",
    "mu"."last_latitude",
    "mu"."last_longitude",
    ( SELECT "count"(*) AS "count"
           FROM "public"."marketer_account_actions" "a"
          WHERE (("a"."marketer_id" = "mu"."id") AND ("a"."action" = 'CAUTIONED'::"text"))) AS "total_cautions",
    ( SELECT "count"(*) AS "count"
           FROM "public"."marketer_account_actions" "a"
          WHERE (("a"."marketer_id" = "mu"."id") AND ("a"."action" = 'DISABLED'::"text"))) AS "total_disables"
   FROM (("public"."marketing_users" "mu"
     LEFT JOIN "public"."regions" "r" ON (("r"."id" = "mu"."region_id")))
     LEFT JOIN "public"."marketing_performance" "mp" ON ((("mp"."marketer_id" = "mu"."id") AND ("mp"."month" = (EXTRACT(month FROM "now"()))::integer) AND ("mp"."year" = (EXTRACT(year FROM "now"()))::integer))))
  WHERE "public"."is_marketing_manager"()
  ORDER BY
        CASE "mu"."approval_status"
            WHEN 'PENDING'::"text" THEN 0
            WHEN 'INCOMPLETE'::"text" THEN 1
            ELSE 2
        END, "mu"."full_name";


ALTER VIEW "public"."marketer_account_overview" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketer_approval_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "marketer_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "performed_by" "text" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "marketer_approval_log_action_check" CHECK (("action" = ANY (ARRAY['REGISTERED'::"text", 'SUBMITTED'::"text", 'APPROVED'::"text", 'REJECTED'::"text", 'CAUTIONED'::"text", 'RESTRICTED'::"text", 'RESTRICTION_LIFTED'::"text", 'DISABLED'::"text", 'REINSTATED'::"text", 'SUSPENDED'::"text", 'SUSPENSION_LIFTED'::"text", 'DELETED'::"text", 'PROFILE_UPDATED_BY_MANAGER'::"text"])))
);


ALTER TABLE "public"."marketer_approval_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."marketer_code_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."marketer_code_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketer_commissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "marketer_id" "uuid" NOT NULL,
    "client_id" "text" NOT NULL,
    "invoice_id" "text" NOT NULL,
    "invoice_total" numeric(15,2) NOT NULL,
    "commission_rate" numeric(5,4) NOT NULL,
    "commission_amount" numeric(15,2) NOT NULL,
    "status" "text" DEFAULT 'PENDING_REVIEW'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "split_count" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "marketer_commissions_status_check" CHECK (("status" = ANY (ARRAY['PENDING_REVIEW'::"text", 'APPROVED'::"text", 'REJECTED'::"text"])))
);


ALTER TABLE "public"."marketer_commissions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."marketer_commission_summary" WITH ("security_invoker"='true') AS
 SELECT "marketer_id",
    "count"(*) AS "total_invoices",
    "count"(*) FILTER (WHERE ("commission_rate" >= 0.01)) AS "first_month_invoices",
    "sum"("commission_amount") AS "total_earned",
    "sum"("commission_amount") FILTER (WHERE ("status" = 'APPROVED'::"text")) AS "total_paid",
    "sum"("commission_amount") FILTER (WHERE ("status" = 'PENDING_REVIEW'::"text")) AS "total_pending",
    "count"(DISTINCT "company_id") AS "companies_earning"
   FROM "public"."marketer_commissions" "mc"
  GROUP BY "marketer_id";


ALTER VIEW "public"."marketer_commission_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketer_daily_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "marketer_id" "uuid" NOT NULL,
    "report_date" "date" NOT NULL,
    "narrative" "text" NOT NULL,
    "visits_count" integer DEFAULT 0 NOT NULL,
    "prospects_count" integer DEFAULT 0 NOT NULL,
    "quotations_requested_count" integer DEFAULT 0 NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."marketer_daily_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketer_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "marketer_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_size" integer,
    "mime_type" "text",
    "uploaded_at" timestamp with time zone DEFAULT "now"(),
    "verified" boolean DEFAULT false,
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "notes" "text",
    CONSTRAINT "marketer_documents_document_type_check" CHECK (("document_type" = ANY (ARRAY['NIDA_FRONT'::"text", 'NIDA_BACK'::"text", 'TIN_CERTIFICATE'::"text", 'PROFILE_PHOTO'::"text", 'SUPPORTING_DOCUMENT'::"text"])))
);


ALTER TABLE "public"."marketer_documents" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."marketer_landed_clients" WITH ("security_invoker"='true') AS
 WITH "attributed" AS (
         SELECT "companies"."id" AS "company_id",
            "companies"."landed_by_marketer_id" AS "marketer_id",
            true AS "is_primary"
           FROM "public"."companies"
          WHERE ("companies"."landed_by_marketer_id" IS NOT NULL)
        UNION
         SELECT "company_collaborators"."company_id",
            "company_collaborators"."marketer_id",
            false
           FROM "public"."company_collaborators"
        )
 SELECT "a"."marketer_id",
    "c"."id" AS "company_id",
    "c"."name",
    ("c"."pipeline_stage")::"text" AS "pipeline_stage",
    "c"."client_since",
    "c"."landed_at",
    ("c"."client_id" IS NOT NULL) AS "is_client",
    "bool_or"("a"."is_primary") AS "is_primary_lander",
    COALESCE(( SELECT "sum"("mc"."invoice_total") AS "sum"
           FROM "public"."marketer_commissions" "mc"
          WHERE (("mc"."company_id" = "c"."id") AND ("mc"."marketer_id" = "a"."marketer_id"))), (0)::numeric) AS "total_invoiced",
    COALESCE(( SELECT "sum"("mc"."commission_amount") AS "sum"
           FROM "public"."marketer_commissions" "mc"
          WHERE (("mc"."company_id" = "c"."id") AND ("mc"."marketer_id" = "a"."marketer_id"))), (0)::numeric) AS "my_commission",
    COALESCE(( SELECT "count"(*) AS "count"
           FROM "public"."marketer_commissions" "mc"
          WHERE (("mc"."company_id" = "c"."id") AND ("mc"."marketer_id" = "a"."marketer_id"))), (0)::bigint) AS "invoice_count"
   FROM ("attributed" "a"
     JOIN "public"."companies" "c" ON (("c"."id" = "a"."company_id")))
  GROUP BY "a"."marketer_id", "c"."id", "c"."name", "c"."pipeline_stage", "c"."client_since", "c"."landed_at", "c"."client_id";


ALTER VIEW "public"."marketer_landed_clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."visits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "marketer_id" "uuid" NOT NULL,
    "check_in_time" timestamp with time zone,
    "check_out_time" timestamp with time zone,
    "check_in_latitude" double precision,
    "check_in_longitude" double precision,
    "gps_verified" boolean DEFAULT false,
    "gps_accuracy_tag" "text",
    "purpose" "public"."visit_purpose",
    "outcome" "public"."visit_outcome",
    "interest_level" "public"."interest_level",
    "decision_maker_met" boolean DEFAULT false,
    "budget_confirmed" boolean DEFAULT false,
    "follow_up_requested" boolean DEFAULT false,
    "services_presented" "text"[] DEFAULT '{}'::"text"[],
    "notes" "text",
    "lead_score" integer,
    "selfie_url" "text",
    "gate_photo_url" "text",
    "voice_note_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "visit_code" "text",
    CONSTRAINT "visits_gps_accuracy_tag_check" CHECK (("gps_accuracy_tag" = ANY (ARRAY['VERIFIED'::"text", 'APPROXIMATE'::"text", 'UNVERIFIED'::"text"])))
);


ALTER TABLE "public"."visits" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."marketer_live_locations" WITH ("security_invoker"='true') AS
 SELECT "mu"."id",
    "mu"."full_name",
    "mu"."email",
    "mu"."last_latitude",
    "mu"."last_longitude",
    "mu"."last_seen_at",
    "mu"."region_id",
    "r"."name" AS "region_name",
    "count"("v"."id") FILTER (WHERE ("date"("v"."check_in_time") = CURRENT_DATE)) AS "visits_today",
    "max"("v"."check_in_time") AS "last_check_in"
   FROM (("public"."marketing_users" "mu"
     LEFT JOIN "public"."regions" "r" ON (("r"."id" = "mu"."region_id")))
     LEFT JOIN "public"."visits" "v" ON (("v"."marketer_id" = "mu"."id")))
  WHERE (("mu"."is_active" = true) AND ("mu"."last_latitude" IS NOT NULL) AND ("mu"."last_longitude" IS NOT NULL))
  GROUP BY "mu"."id", "mu"."full_name", "mu"."email", "mu"."last_latitude", "mu"."last_longitude", "mu"."last_seen_at", "mu"."region_id", "r"."name";


ALTER VIEW "public"."marketer_live_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_monthly_expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "month" integer NOT NULL,
    "year" integer NOT NULL,
    "total_expenses" numeric(15,2) NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."marketing_monthly_expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "public"."marketing_notification_type" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "company_id" "uuid",
    "marketer_id" "uuid",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."marketing_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_target_analyses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target_id" "uuid" NOT NULL,
    "actuals" "jsonb" NOT NULL,
    "score" numeric(5,2) NOT NULL,
    "status" "text" NOT NULL,
    "narrative" "text",
    "recommendation" "text",
    "analysed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "marketing_target_analyses_status_check" CHECK (("status" = ANY (ARRAY['NOT_STARTED'::"text", 'IN_PROGRESS'::"text", 'ACHIEVED'::"text", 'PARTIALLY_ACHIEVED'::"text", 'MISSED'::"text"])))
);


ALTER TABLE "public"."marketing_target_analyses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_targets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scope" "text" NOT NULL,
    "marketer_id" "uuid",
    "period_type" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "metrics" "jsonb" NOT NULL,
    "notes" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "marketing_targets_check" CHECK ((("scope" = 'OVERALL'::"text") OR ("marketer_id" IS NOT NULL))),
    CONSTRAINT "marketing_targets_check1" CHECK (("end_date" >= "start_date")),
    CONSTRAINT "marketing_targets_period_type_check" CHECK (("period_type" = ANY (ARRAY['DAILY'::"text", 'WEEKLY'::"text", 'MONTHLY'::"text", 'QUARTERLY'::"text", 'SEMI_ANNUAL'::"text", 'ANNUAL'::"text"]))),
    CONSTRAINT "marketing_targets_scope_check" CHECK (("scope" = ANY (ARRAY['MARKETER'::"text", 'OVERALL'::"text"])))
);


ALTER TABLE "public"."marketing_targets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_planned_ingredients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "menu_id" "uuid" NOT NULL,
    "ingredient_name" "text" NOT NULL,
    "planned_quantity" numeric(12,4) DEFAULT 0 NOT NULL,
    "unit" "text" DEFAULT 'kg'::"text" NOT NULL,
    "unit_cost" numeric(12,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "category" "text" DEFAULT 'ingredient'::"text" NOT NULL,
    CONSTRAINT "menu_planned_ingredients_category_check" CHECK (("category" = ANY (ARRAY['ingredient'::"text", 'miscellaneous'::"text"]))),
    CONSTRAINT "menu_planned_ingredients_planned_quantity_check" CHECK (("planned_quantity" >= (0)::numeric)),
    CONSTRAINT "menu_planned_ingredients_unit_cost_check" CHECK (("unit_cost" >= (0)::numeric))
);


ALTER TABLE "public"."menu_planned_ingredients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."menu_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "text" NOT NULL,
    "name" "text",
    "description" "text",
    "proformaId" "text",
    "clientEvents" "jsonb",
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "updatedAt" timestamp with time zone DEFAULT "now"(),
    "booking_id" "text",
    "client_id" "text",
    "start_date" "text",
    "end_date" "text",
    "proforma_id" "text",
    "region" "text",
    "status" "text" DEFAULT 'confirmed'::"text",
    CONSTRAINT "orders_status_check" CHECK (("status" = ANY (ARRAY['pending_confirmation'::"text", 'confirmed'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."orders_id_seq"
    START WITH 50
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."orders_id_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."otp_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "code" "text" NOT NULL,
    "used" boolean DEFAULT false,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."otp_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payroll" (
    "id" "text" DEFAULT ('PAY'::"text" || "substr"(("extensions"."uuid_generate_v4"())::"text", 1, 8)) NOT NULL,
    "employeeId" "text",
    "employeeName" "text",
    "payPeriodStart" "date",
    "payPeriodEnd" "date",
    "basicSalary" numeric DEFAULT 0 NOT NULL,
    "allowances" numeric DEFAULT 0 NOT NULL,
    "deductions" numeric DEFAULT 0 NOT NULL,
    "grossSalary" numeric DEFAULT 0 NOT NULL,
    "netSalary" numeric DEFAULT 0 NOT NULL,
    "status" "text",
    "paymentDate" "date",
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "updatedAt" timestamp with time zone DEFAULT "now"(),
    "event_id" "text" DEFAULT 'MONTHLY_CORE'::"text",
    "staff_type" "text" DEFAULT 'permanent'::"text",
    "days_worked" numeric(5,2) DEFAULT NULL::numeric,
    "daily_rate" numeric(12,2) DEFAULT NULL::numeric,
    "wcf_contrib" numeric(10,2) DEFAULT 0 NOT NULL,
    "paye_amount" numeric DEFAULT 0 NOT NULL,
    "nssf_employee" numeric DEFAULT 0 NOT NULL,
    "nssf_employer" numeric DEFAULT 0 NOT NULL,
    "sdl_amount" numeric DEFAULT 0 NOT NULL,
    "other_deductions" numeric DEFAULT 0 NOT NULL,
    "tax_rate_version_id" "uuid",
    "created_by" "uuid" DEFAULT "public"."safe_auth_uid"(),
    "updated_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    CONSTRAINT "payroll_allowances_nonneg" CHECK (("allowances" >= (0)::numeric)),
    CONSTRAINT "payroll_basic_salary_nonneg" CHECK (("basicSalary" >= (0)::numeric)),
    CONSTRAINT "payroll_deductions_nonneg" CHECK (("deductions" >= (0)::numeric)),
    CONSTRAINT "payroll_gross_salary_nonneg" CHECK (("grossSalary" >= (0)::numeric)),
    CONSTRAINT "payroll_net_salary_nonneg" CHECK (("netSalary" >= (0)::numeric)),
    CONSTRAINT "payroll_nssf_employee_nonneg" CHECK (("nssf_employee" >= (0)::numeric)),
    CONSTRAINT "payroll_nssf_employer_nonneg" CHECK (("nssf_employer" >= (0)::numeric)),
    CONSTRAINT "payroll_other_deductions_nonneg" CHECK (("other_deductions" >= (0)::numeric)),
    CONSTRAINT "payroll_paye_amount_nonneg" CHECK (("paye_amount" >= (0)::numeric)),
    CONSTRAINT "payroll_sdl_amount_nonneg" CHECK (("sdl_amount" >= (0)::numeric)),
    CONSTRAINT "payroll_staff_type_check" CHECK (("staff_type" = ANY (ARRAY['permanent'::"text", 'casual'::"text"]))),
    CONSTRAINT "payroll_wcf_contrib_nonneg" CHECK (("wcf_contrib" >= (0)::numeric))
);


ALTER TABLE "public"."payroll" OWNER TO "postgres";


COMMENT ON COLUMN "public"."payroll"."event_id" IS 'Links casual worker wages directly to specific events, or MONTHLY_CORE for permanent staff';



CREATE OR REPLACE VIEW "public"."pending_marketer_applications" WITH ("security_invoker"='true') AS
 SELECT "mu"."id",
    "mu"."full_name",
    "mu"."first_name",
    "mu"."last_name",
    "mu"."google_email" AS "email",
    "mu"."google_avatar_url",
    "mu"."phone",
    "mu"."nida_number",
    "mu"."tin_number",
    "mu"."region_id",
    "r"."name" AS "region_name",
    "mu"."employment_type",
    "mu"."submitted_at",
    "mu"."approval_status",
    "mu"."onboarding_step",
    "count"("md"."id") AS "document_count"
   FROM (("public"."marketing_users" "mu"
     LEFT JOIN "public"."regions" "r" ON (("r"."id" = "mu"."region_id")))
     LEFT JOIN "public"."marketer_documents" "md" ON (("md"."marketer_id" = "mu"."id")))
  WHERE (("mu"."approval_status" = 'PENDING'::"text") AND ("mu"."submitted_at" IS NOT NULL) AND "public"."is_marketing_manager"())
  GROUP BY "mu"."id", "mu"."full_name", "mu"."first_name", "mu"."last_name", "mu"."google_email", "mu"."google_avatar_url", "mu"."phone", "mu"."nida_number", "mu"."tin_number", "mu"."region_id", "r"."name", "mu"."employment_type", "mu"."submitted_at", "mu"."approval_status", "mu"."onboarding_step"
  ORDER BY "mu"."submitted_at";


ALTER VIEW "public"."pending_marketer_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portal_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "text",
    "actor_type" "text" NOT NULL,
    "action" "text" NOT NULL,
    "table_name" "text",
    "record_id" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "portal_audit_log_actor_type_check" CHECK (("actor_type" = ANY (ARRAY['portal'::"text", 'staff'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."portal_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portal_costing_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rfq_id" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "total_cost" numeric,
    "total_revenue" numeric,
    "gross_margin_pct" numeric,
    "notes" "text",
    "requested_by_id" "text",
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fulfilled_by_id" "uuid",
    "fulfilled_at" timestamp with time zone,
    "rejection_reason" "text",
    CONSTRAINT "portal_costing_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'fulfilled'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."portal_costing_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portal_invoice_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rfq_id" "text",
    "proforma_id" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "invoice_id" "text",
    "requested_by_id" "text",
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fulfilled_by_id" "uuid",
    "fulfilled_at" timestamp with time zone,
    "rejection_reason" "text",
    CONSTRAINT "portal_invoice_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'fulfilled'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."portal_invoice_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portal_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portal_user_id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "rfq_id" "text",
    "proforma_id" "text",
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."portal_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portal_users" (
    "id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "role" "text" DEFAULT 'staff'::"text" NOT NULL,
    "branch" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "portal_users_branch_check" CHECK (("branch" = ANY (ARRAY['Dar es Salaam'::"text", 'Dodoma'::"text", 'Arusha'::"text"]))),
    CONSTRAINT "portal_users_role_check" CHECK (("role" = ANY (ARRAY['super_admin'::"text", 'management'::"text", 'finance'::"text", 'operations'::"text", 'hr'::"text", 'branch_manager'::"text", 'staff'::"text"])))
);


ALTER TABLE "public"."portal_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."positions" (
    "id" "text" DEFAULT ('JOB'::"text" || "substr"(("extensions"."uuid_generate_v4"())::"text", 1, 8)) NOT NULL,
    "title" "text",
    "department" "text",
    "location" "text",
    "type" "text",
    "applicants" integer,
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "updatedAt" timestamp with time zone DEFAULT "now"(),
    "description" "text",
    "trainer_name" "text",
    "duration_days" integer DEFAULT 1,
    "expected_outcomes" "text" DEFAULT ''::"text",
    "custom_skills" "text"[] DEFAULT ARRAY['Punctuality'::"text", 'Attentiveness'::"text", 'Practical Skills'::"text", 'Theory Knowledge'::"text", 'Teamwork'::"text"],
    "session_status" "text" DEFAULT 'Upcoming'::"text",
    "training_date" "date",
    "module_code" "text",
    "learning_objectives" "text"[] DEFAULT '{}'::"text"[],
    "assessment_method" "text" DEFAULT 'Observation'::"text",
    "resource_requirements" "text",
    "target_audience" "text",
    "created_by" "uuid" DEFAULT "public"."safe_auth_uid"(),
    "updated_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    CONSTRAINT "positions_session_status_check" CHECK (("session_status" = ANY (ARRAY['Upcoming'::"text", 'In Progress'::"text", 'Completed'::"text"])))
);


ALTER TABLE "public"."positions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "text" DEFAULT ('PROD'::"text" || "substr"(("extensions"."uuid_generate_v4"())::"text", 1, 8)) NOT NULL,
    "sku" "text",
    "name" "text",
    "category" "text",
    "quantity" numeric(10,2),
    "unit" "text",
    "unitPrice" numeric(10,2),
    "minStock" numeric(10,2),
    "maxStock" integer,
    "expiryDate" "date",
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "updatedAt" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "quantity_dar" numeric(10,2) DEFAULT 0,
    "quantity_arusha" numeric(10,2) DEFAULT 0,
    "quantity_dodoma" numeric(10,2) DEFAULT 0,
    "unitPrice_dar" numeric(10,2) DEFAULT 0,
    "unitPrice_arusha" numeric(10,2) DEFAULT 0,
    "unitPrice_dodoma" numeric(10,2) DEFAULT 0,
    "created_by" "uuid" DEFAULT "public"."safe_auth_uid"(),
    "updated_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proforma_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proforma_id" "text" NOT NULL,
    "author_type" "text" NOT NULL,
    "portal_author_id" "text",
    "staff_author_id" "uuid",
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "proforma_comments_author_type_check" CHECK (("author_type" = ANY (ARRAY['portal'::"text", 'staff'::"text"])))
);


ALTER TABLE "public"."proforma_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proforma_invoices" (
    "id" "text" NOT NULL,
    "invoiceDate" timestamp with time zone,
    "clientId" "text",
    "receiverName" "text",
    "receiverPosition" "text",
    "lpoNumber" "text",
    "location" "text",
    "numberOfDays" integer,
    "multiplyByDays" boolean,
    "serviceCharge" numeric DEFAULT 0 NOT NULL,
    "transportCosts" numeric DEFAULT 0 NOT NULL,
    "vatType" "text",
    "selectedEventType" "text",
    "customEventType" "text",
    "startDate" timestamp with time zone,
    "endDate" timestamp with time zone,
    "serviceFields" "jsonb",
    "serviceDesc" "text",
    "items" "jsonb",
    "isInvoiced" boolean DEFAULT false,
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "updatedAt" timestamp with time zone DEFAULT "now"(),
    "booking_id" "text",
    "region" "public"."region",
    "orderId" "text",
    "isVoided" boolean DEFAULT false NOT NULL,
    "voidedAt" timestamp with time zone,
    "voidedReason" "text",
    "reviewStatus" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewedAt" timestamp with time zone,
    "reviewedById" "text",
    "rejectionReason" "text",
    CONSTRAINT "proforma_invoices_reviewStatus_check" CHECK (("reviewStatus" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "proforma_invoices_service_charge_nonneg" CHECK (("serviceCharge" >= (0)::numeric)),
    CONSTRAINT "proforma_invoices_transport_costs_nonneg" CHECK (("transportCosts" >= (0)::numeric))
);


ALTER TABLE "public"."proforma_invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."public_holidays" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "holiday_date" "date" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "public"."safe_auth_uid"(),
    "updated_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone
);


ALTER TABLE "public"."public_holidays" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "supplier" "text" NOT NULL,
    "invoicenumber" "text" NOT NULL,
    "description" "text" NOT NULL,
    "quantity" numeric(10,2) NOT NULL,
    "unitcost" numeric(10,2) NOT NULL,
    "totalcost" numeric(12,2) NOT NULL,
    "taxamount" numeric(10,2) DEFAULT 0,
    "paymentmethod" "text",
    "paymentstatus" "text",
    "expensecategory" "text",
    "user_id" "uuid" NOT NULL,
    "createdat" timestamp with time zone DEFAULT "now"(),
    "updatedat" timestamp with time zone DEFAULT "now"(),
    "event_id" "text",
    "supplier_tin" "text",
    "efd_receipt" "text",
    "amount_paid" numeric(15,2) DEFAULT 0 NOT NULL,
    "supplier_id" "uuid",
    "payment_date" "date",
    CONSTRAINT "purchases_paymentmethod_check" CHECK (("paymentmethod" = ANY (ARRAY['cash'::"text", 'bank'::"text", 'credit'::"text"]))),
    CONSTRAINT "purchases_paymentstatus_check" CHECK (("paymentstatus" = ANY (ARRAY['paid'::"text", 'unpaid'::"text"])))
);


ALTER TABLE "public"."purchases" OWNER TO "postgres";


COMMENT ON COLUMN "public"."purchases"."event_id" IS 'Master key linking ingredient purchases to specific events';



COMMENT ON COLUMN "public"."purchases"."supplier_tin" IS '9-digit Taxpayer Identification Number of the supplier, required by TRA';



COMMENT ON COLUMN "public"."purchases"."efd_receipt" IS 'Supplier EFD receipt number to validate input tax credits';



CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portal_user_id" "text" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotation_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "marketer_id" "uuid" NOT NULL,
    "marketer_name" "text",
    "event_type" "text",
    "event_date" "date",
    "guest_count" integer,
    "services" "jsonb" DEFAULT '[]'::"jsonb",
    "budget_estimate" numeric(15,2),
    "location" "text",
    "notes" "text",
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "priority" "text" DEFAULT 'NORMAL'::"text",
    "issued_by" "uuid",
    "issued_at" timestamp with time zone,
    "quotation_amount" numeric(15,2),
    "quotation_doc_url" "text",
    "decline_reason" "text",
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "quotation_requests_priority_check" CHECK (("priority" = ANY (ARRAY['LOW'::"text", 'NORMAL'::"text", 'HIGH'::"text", 'URGENT'::"text"]))),
    CONSTRAINT "quotation_requests_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'IN_PROGRESS'::"text", 'ISSUED'::"text", 'DECLINED'::"text"])))
);


ALTER TABLE "public"."quotation_requests" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."recipes_recipe_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."recipes_recipe_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipes" (
    "recipeNumber" "text" DEFAULT ('RN-'::"text" || "lpad"(("nextval"('"public"."recipes_recipe_number_seq"'::"regclass"))::"text", 5, '0'::"text")) NOT NULL,
    "recipeName" "text" NOT NULL,
    "recipeType" "text",
    "ingredients" "jsonb",
    "user_id" "uuid",
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "updatedAt" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recipes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recognition_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "text" NOT NULL,
    "category" "text" NOT NULL,
    "reward_type" "text" NOT NULL,
    "amount" numeric(14,2),
    "payroll_status" "text" DEFAULT 'not_applicable'::"text" NOT NULL,
    "paid_in_payroll_id" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "document_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "public"."safe_auth_uid"(),
    "updated_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    CONSTRAINT "recognition_cash_has_amount" CHECK ((("reward_type" <> 'cash'::"text") OR (("amount" IS NOT NULL) AND ("amount" > (0)::numeric)))),
    CONSTRAINT "recognition_paid_has_payroll" CHECK ((("payroll_status" <> 'paid'::"text") OR ("paid_in_payroll_id" IS NOT NULL))),
    CONSTRAINT "recognition_records_amount_check" CHECK ((("amount" IS NULL) OR ("amount" >= (0)::numeric))),
    CONSTRAINT "recognition_records_category_check" CHECK (("category" = ANY (ARRAY['performance'::"text", 'long_service'::"text", 'conduct'::"text", 'customer_praise'::"text", 'other'::"text"]))),
    CONSTRAINT "recognition_records_payroll_status_check" CHECK (("payroll_status" = ANY (ARRAY['not_applicable'::"text", 'pending'::"text", 'paid'::"text"]))),
    CONSTRAINT "recognition_records_reward_type_check" CHECK (("reward_type" = ANY (ARRAY['none'::"text", 'cash'::"text", 'voucher'::"text", 'gift'::"text", 'time_off'::"text"]))),
    CONSTRAINT "recognition_records_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'void'::"text"])))
);


ALTER TABLE "public"."recognition_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rfq_proforma_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rfq_id" "text" NOT NULL,
    "proforma_id" "text" NOT NULL,
    "linked_by_id" "text",
    "linked_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rfq_proforma_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rfq_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rfq_id" "text" NOT NULL,
    "from_status" "text",
    "to_status" "text" NOT NULL,
    "changed_by_id" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rfq_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rfqs" (
    "id" "text" NOT NULL,
    "client_id" "text",
    "client_name_freetext" "text",
    "title" "text" NOT NULL,
    "description" "text",
    "requested_by_id" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "target_event_date" "date",
    "region" "text",
    "branch" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "service_start_date" "date",
    "service_end_date" "date",
    "proforma_required_by" "date",
    "same_pax_all_dates" boolean DEFAULT true NOT NULL,
    "pax_per_day" "jsonb",
    "rate_per_plate" numeric,
    "vat_type" "text",
    "location" "text",
    "same_meal_type_all_dates" boolean DEFAULT true NOT NULL,
    "meal_type_per_day" "jsonb",
    CONSTRAINT "rfqs_branch_check" CHECK (("branch" = ANY (ARRAY['Dar es Salaam'::"text", 'Dodoma'::"text", 'Arusha'::"text"]))),
    CONSTRAINT "rfqs_rate_per_plate_check" CHECK ((("rate_per_plate" IS NULL) OR ("rate_per_plate" >= (0)::numeric))),
    CONSTRAINT "rfqs_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'in_review'::"text", 'proforma_created'::"text", 'approved'::"text", 'closed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "rfqs_vat_type_check" CHECK (("vat_type" = ANY (ARRAY['inclusive'::"text", 'exclusive'::"text"])))
);

ALTER TABLE ONLY "public"."rfqs" REPLICA IDENTITY FULL;


ALTER TABLE "public"."rfqs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "customerid" "text" NOT NULL,
    "invoicenumber" "text" NOT NULL,
    "description" "text" NOT NULL,
    "quantity" numeric(10,2) NOT NULL,
    "unitprice" numeric(10,2) NOT NULL,
    "totalamount" numeric(12,2) NOT NULL,
    "taxamount" numeric(10,2) DEFAULT 0,
    "paymentmethod" "text",
    "paymentstatus" "text",
    "user_id" "uuid" NOT NULL,
    "createdat" timestamp with time zone DEFAULT "now"(),
    "updatedat" timestamp with time zone DEFAULT "now"(),
    "event_id" "text",
    "efd_receipt" "text",
    CONSTRAINT "sales_paymentmethod_check" CHECK (("paymentmethod" = ANY (ARRAY['cash'::"text", 'bank'::"text", 'credit'::"text"]))),
    CONSTRAINT "sales_paymentstatus_check" CHECK (("paymentstatus" = ANY (ARRAY['paid'::"text", 'unpaid'::"text"])))
);


ALTER TABLE "public"."sales" OWNER TO "postgres";


COMMENT ON COLUMN "public"."sales"."event_id" IS 'Master key (EVT-YYYY-MM-DD-XXXX) linking revenue to specific catering bookings';



COMMENT ON COLUMN "public"."sales"."efd_receipt" IS 'Official Electronic Fiscal Device receipt number for TRA VAT auditing';



CREATE TABLE IF NOT EXISTS "public"."service_feedback" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "report_date" "date" NOT NULL,
    "order_id" "text",
    "overall_summary" "text",
    "positive_feedback" "text",
    "complaints" "text",
    "waiter_challenges" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."service_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'staff'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "employee_id" "text",
    CONSTRAINT "staff_users_role_check_v2" CHECK (("role" = ANY (ARRAY['admin'::"text", 'general_manager'::"text", 'hr_manager'::"text", 'finance'::"text", 'staff'::"text"])))
);


ALTER TABLE "public"."staff_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_logs" (
    "id" "text" DEFAULT ('LOG'::"text" || "substr"(("extensions"."uuid_generate_v4"())::"text", 1, 8)) NOT NULL,
    "productId" "text",
    "productName" "text",
    "type" "text",
    "quantity" numeric(10,2),
    "price" numeric(10,2),
    "reason" "text",
    "date" "date",
    "status" "text",
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "updatedAt" timestamp with time zone DEFAULT "now"(),
    "actual_unit_price" numeric(10,2),
    "actual_quantity" numeric(10,2),
    "branch" "text" DEFAULT 'Dar es Salaam'::"text",
    "created_by" "uuid" DEFAULT "public"."safe_auth_uid"(),
    "updated_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone
);


ALTER TABLE "public"."stock_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supervisor_reports" (
    "id" bigint NOT NULL,
    "report_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "supervisor_id" "uuid",
    "supervisor_name" "text" NOT NULL,
    "status" "text" DEFAULT 'Draft'::"text" NOT NULL,
    "criteria" "jsonb" NOT NULL,
    "general_comments" "text",
    "prepared_by" "text" NOT NULL,
    "checked_by" "text",
    "signature" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."supervisor_reports" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."supervisor_reports_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."supervisor_reports_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."supervisor_reports_id_seq" OWNED BY "public"."supervisor_reports"."id";



CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "contact_person" "text",
    "email" "text",
    "phone" "text",
    "address" "text",
    "tin" "text",
    "notes" "text",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "suppliers_tin_check" CHECK ((("tin" IS NULL) OR ("length"("tin") <= 9)))
);


ALTER TABLE "public"."suppliers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tax_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "effective_from" "date" NOT NULL,
    "effective_to" "date",
    "paye_bands" "jsonb" NOT NULL,
    "nssf_employee_rate" numeric DEFAULT 0.10 NOT NULL,
    "nssf_employer_rate" numeric DEFAULT 0.10 NOT NULL,
    "sdl_rate" numeric DEFAULT 0.035 NOT NULL,
    "wcf_rate" numeric DEFAULT 0.005 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tax_rates_check" CHECK ((("effective_to" IS NULL) OR ("effective_to" >= "effective_from"))),
    CONSTRAINT "tax_rates_nssf_employee_rate_check" CHECK ((("nssf_employee_rate" >= (0)::numeric) AND ("nssf_employee_rate" <= (1)::numeric))),
    CONSTRAINT "tax_rates_nssf_employer_rate_check" CHECK ((("nssf_employer_rate" >= (0)::numeric) AND ("nssf_employer_rate" <= (1)::numeric))),
    CONSTRAINT "tax_rates_sdl_rate_check" CHECK ((("sdl_rate" >= (0)::numeric) AND ("sdl_rate" <= (1)::numeric))),
    CONSTRAINT "tax_rates_wcf_rate_check" CHECK ((("wcf_rate" >= (0)::numeric) AND ("wcf_rate" <= (1)::numeric)))
);


ALTER TABLE "public"."tax_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_evaluations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "participant_id" "uuid" NOT NULL,
    "training_id" "text" NOT NULL,
    "evaluation_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "score" integer NOT NULL,
    "skills_demonstrated" "text"[] DEFAULT '{}'::"text"[],
    "notes" "text" DEFAULT ''::"text",
    "evaluator_name" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" DEFAULT "public"."safe_auth_uid"(),
    "updated_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    CONSTRAINT "training_evaluations_score_check" CHECK ((("score" >= 1) AND ("score" <= 5)))
);


ALTER TABLE "public"."training_evaluations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_participants" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "training_id" "text",
    "employee_id" "text",
    "status" "text" DEFAULT 'Enrolled'::"text",
    "grade" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" DEFAULT "public"."safe_auth_uid"(),
    "updated_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    CONSTRAINT "training_participants_status_check" CHECK (("status" = ANY (ARRAY['Enrolled'::"text", 'In Progress'::"text", 'Completed'::"text", 'Failed'::"text"])))
);


ALTER TABLE "public"."training_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vat_wht_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "text" NOT NULL,
    "date" "date" NOT NULL,
    "tax_type" "text" NOT NULL,
    "ref_ledger" "text" NOT NULL,
    "ref_record" "uuid" NOT NULL,
    "base_amount" numeric(12,2) NOT NULL,
    "tax_rate" numeric(5,2) NOT NULL,
    "tax_amount" numeric(12,2) NOT NULL,
    "filing_st" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "vat_wht_ledger_filing_st_check" CHECK (("filing_st" = ANY (ARRAY['accrued'::"text", 'filed'::"text", 'paid'::"text"]))),
    CONSTRAINT "vat_wht_ledger_ref_ledger_check" CHECK (("ref_ledger" = ANY (ARRAY['sales'::"text", 'purchases'::"text", 'expenses'::"text", 'payroll'::"text"]))),
    CONSTRAINT "vat_wht_ledger_tax_type_check" CHECK (("tax_type" = ANY (ARRAY['VAT Output'::"text", 'VAT Input'::"text", 'WHT Resident 5%'::"text", 'WHT Resident 2%'::"text", 'PAYE'::"text"])))
);


ALTER TABLE "public"."vat_wht_ledger" OWNER TO "postgres";


COMMENT ON TABLE "public"."vat_wht_ledger" IS 'Tanzanian tax ledger tracking VAT balances and Supplier/Casual Withholding taxes';



CREATE TABLE IF NOT EXISTS "public"."visit_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "visit_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "url" "text" NOT NULL,
    "uploaded_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."visit_documents" OWNER TO "postgres";


ALTER TABLE ONLY "public"."supervisor_reports" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."supervisor_reports_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_employee_id_date_key" UNIQUE ("employee_id", "date");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_proforma_invoice_id_unique" UNIQUE ("proforma_invoice_id");



ALTER TABLE ONLY "public"."candidates"
    ADD CONSTRAINT "candidates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."catering_menu_recipes"
    ADD CONSTRAINT "catering_menu_recipes_menu_id_recipe_number_key" UNIQUE ("menu_id", "recipe_number");



ALTER TABLE ONLY "public"."catering_menu_recipes"
    ADD CONSTRAINT "catering_menu_recipes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."catering_menus"
    ADD CONSTRAINT "catering_menus_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_invoice_tax_settings"
    ADD CONSTRAINT "client_invoice_tax_settings_pkey" PRIMARY KEY ("client_id", "tax_type");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commissions"
    ADD CONSTRAINT "commissions_invoice_marketer_key" UNIQUE ("invoice_ref", "marketer_id");



ALTER TABLE ONLY "public"."commissions"
    ADD CONSTRAINT "commissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_qr_code_key" UNIQUE ("qr_code");



ALTER TABLE ONLY "public"."company_collaborators"
    ADD CONSTRAINT "company_collaborators_company_id_marketer_id_key" UNIQUE ("company_id", "marketer_id");



ALTER TABLE ONLY "public"."company_collaborators"
    ADD CONSTRAINT "company_collaborators_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_documents"
    ADD CONSTRAINT "company_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_notes"
    ADD CONSTRAINT "company_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contract_expiry_notices"
    ADD CONSTRAINT "contract_expiry_notices_pkey" PRIMARY KEY ("contract_id", "threshold_days");



ALTER TABLE ONLY "public"."costing_reports"
    ADD CONSTRAINT "costing_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."costing_reports"
    ADD CONSTRAINT "costing_reports_report_date_type_description_branch_key" UNIQUE ("report_date", "type", "description", "branch");



ALTER TABLE ONLY "public"."daily_menus"
    ADD CONSTRAINT "daily_menus_event_id_menu_date_key" UNIQUE ("event_id", "menu_date");



ALTER TABLE ONLY "public"."daily_menus"
    ADD CONSTRAINT "daily_menus_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_orders"
    ADD CONSTRAINT "daily_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."delivery_notes"
    ADD CONSTRAINT "delivery_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."disciplinary_records"
    ADD CONSTRAINT "disciplinary_records_document_id_key" UNIQUE ("document_id");



ALTER TABLE ONLY "public"."disciplinary_records"
    ADD CONSTRAINT "disciplinary_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employment_contracts"
    ADD CONSTRAINT "employment_contracts_document_id_key" UNIQUE ("document_id");



ALTER TABLE ONLY "public"."employment_contracts"
    ADD CONSTRAINT "employment_contracts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."follow_ups"
    ADD CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hr_document_counters"
    ADD CONSTRAINT "hr_document_counters_pkey" PRIMARY KEY ("doc_type", "year");



ALTER TABLE ONLY "public"."hr_document_templates"
    ADD CONSTRAINT "hr_document_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hr_document_templates"
    ADD CONSTRAINT "hr_document_templates_version_key" UNIQUE ("doc_type", "version");



ALTER TABLE ONLY "public"."hr_document_types"
    ADD CONSTRAINT "hr_document_types_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."hr_document_types"
    ADD CONSTRAINT "hr_document_types_pkey" PRIMARY KEY ("doc_type");



ALTER TABLE ONLY "public"."hr_documents"
    ADD CONSTRAINT "hr_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hr_documents"
    ADD CONSTRAINT "hr_documents_ref_no_key" UNIQUE ("ref_no");



ALTER TABLE ONLY "public"."hr_notifications"
    ADD CONSTRAINT "hr_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."id_counters"
    ADD CONSTRAINT "id_counters_pkey" PRIMARY KEY ("name");



ALTER TABLE ONLY "public"."ingredients"
    ADD CONSTRAINT "ingredients_pkey" PRIMARY KEY ("itemNumber");



ALTER TABLE ONLY "public"."invoice_tax_rates"
    ADD CONSTRAINT "invoice_tax_rates_pkey" PRIMARY KEY ("tax_type");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."issuance"
    ADD CONSTRAINT "issuance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_balances"
    ADD CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_balances"
    ADD CONSTRAINT "leave_balances_unique" UNIQUE ("employee_id", "leave_type_id", "year");



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_settings"
    ADD CONSTRAINT "leave_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_types"
    ADD CONSTRAINT "leave_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."leave_types"
    ADD CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketer_account_actions"
    ADD CONSTRAINT "marketer_account_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketer_approval_log"
    ADD CONSTRAINT "marketer_approval_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketer_commissions"
    ADD CONSTRAINT "marketer_commissions_invoice_id_marketer_id_key" UNIQUE ("invoice_id", "marketer_id");



ALTER TABLE ONLY "public"."marketer_commissions"
    ADD CONSTRAINT "marketer_commissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketer_daily_reports"
    ADD CONSTRAINT "marketer_daily_reports_marketer_id_report_date_key" UNIQUE ("marketer_id", "report_date");



ALTER TABLE ONLY "public"."marketer_daily_reports"
    ADD CONSTRAINT "marketer_daily_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketer_documents"
    ADD CONSTRAINT "marketer_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_monthly_expenses"
    ADD CONSTRAINT "marketing_monthly_expenses_month_year_key" UNIQUE ("month", "year");



ALTER TABLE ONLY "public"."marketing_monthly_expenses"
    ADD CONSTRAINT "marketing_monthly_expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_notifications"
    ADD CONSTRAINT "marketing_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_performance"
    ADD CONSTRAINT "marketing_performance_marketer_id_month_year_key" UNIQUE ("marketer_id", "month", "year");



ALTER TABLE ONLY "public"."marketing_performance"
    ADD CONSTRAINT "marketing_performance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_target_analyses"
    ADD CONSTRAINT "marketing_target_analyses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_targets"
    ADD CONSTRAINT "marketing_targets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_users"
    ADD CONSTRAINT "marketing_users_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."marketing_users"
    ADD CONSTRAINT "marketing_users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."marketing_users"
    ADD CONSTRAINT "marketing_users_marketer_code_key" UNIQUE ("marketer_code");



ALTER TABLE ONLY "public"."marketing_users"
    ADD CONSTRAINT "marketing_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_planned_ingredients"
    ADD CONSTRAINT "menu_planned_ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_types"
    ADD CONSTRAINT "menu_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."menu_types"
    ADD CONSTRAINT "menu_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."otp_codes"
    ADD CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payroll"
    ADD CONSTRAINT "payroll_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portal_audit_log"
    ADD CONSTRAINT "portal_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portal_costing_requests"
    ADD CONSTRAINT "portal_costing_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portal_invoice_requests"
    ADD CONSTRAINT "portal_invoice_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portal_notifications"
    ADD CONSTRAINT "portal_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portal_users"
    ADD CONSTRAINT "portal_users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."portal_users"
    ADD CONSTRAINT "portal_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proforma_comments"
    ADD CONSTRAINT "proforma_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proforma_invoices"
    ADD CONSTRAINT "proforma_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."public_holidays"
    ADD CONSTRAINT "public_holidays_holiday_date_key" UNIQUE ("holiday_date");



ALTER TABLE ONLY "public"."public_holidays"
    ADD CONSTRAINT "public_holidays_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotation_requests"
    ADD CONSTRAINT "quotation_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "recipes_pkey" PRIMARY KEY ("recipeNumber");



ALTER TABLE ONLY "public"."recognition_records"
    ADD CONSTRAINT "recognition_records_document_id_key" UNIQUE ("document_id");



ALTER TABLE ONLY "public"."recognition_records"
    ADD CONSTRAINT "recognition_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."regions"
    ADD CONSTRAINT "regions_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."regions"
    ADD CONSTRAINT "regions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rfq_proforma_links"
    ADD CONSTRAINT "rfq_proforma_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rfq_proforma_links"
    ADD CONSTRAINT "rfq_proforma_links_rfq_id_proforma_id_key" UNIQUE ("rfq_id", "proforma_id");



ALTER TABLE ONLY "public"."rfq_status_history"
    ADD CONSTRAINT "rfq_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rfqs"
    ADD CONSTRAINT "rfqs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_feedback"
    ADD CONSTRAINT "service_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_users"
    ADD CONSTRAINT "staff_users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."staff_users"
    ADD CONSTRAINT "staff_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_logs"
    ADD CONSTRAINT "stock_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supervisor_reports"
    ADD CONSTRAINT "supervisor_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supervisor_reports"
    ADD CONSTRAINT "supervisor_reports_report_date_prepared_by_key" UNIQUE ("report_date", "prepared_by");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tax_rates"
    ADD CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_evaluations"
    ADD CONSTRAINT "training_evaluations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_participants"
    ADD CONSTRAINT "training_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_participants"
    ADD CONSTRAINT "training_participants_training_id_employee_id_key" UNIQUE ("training_id", "employee_id");



ALTER TABLE ONLY "public"."vat_wht_ledger"
    ADD CONSTRAINT "vat_wht_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."visit_documents"
    ADD CONSTRAINT "visit_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."visits"
    ADD CONSTRAINT "visits_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "employment_contracts_one_active" ON "public"."employment_contracts" USING "btree" ("employee_id") WHERE ("status" = 'active'::"text");



CREATE INDEX "expenses_category_idx" ON "public"."expenses" USING "btree" ("category");



CREATE INDEX "expenses_date_idx" ON "public"."expenses" USING "btree" ("date" DESC);



CREATE UNIQUE INDEX "hr_document_templates_one_active" ON "public"."hr_document_templates" USING "btree" ("doc_type") WHERE "is_active";



CREATE INDEX "idx_account_actions_marketer" ON "public"."marketer_account_actions" USING "btree" ("marketer_id", "created_at" DESC);



CREATE INDEX "idx_attendance_date" ON "public"."attendance" USING "btree" ("date");



CREATE INDEX "idx_attendance_employee_date" ON "public"."attendance" USING "btree" ("employee_id", "date");



CREATE INDEX "idx_attendance_leave_request" ON "public"."attendance" USING "btree" ("leave_request_id") WHERE ("leave_request_id" IS NOT NULL);



CREATE INDEX "idx_audit_log_actor_id" ON "public"."audit_log" USING "btree" ("actor_id");



CREATE INDEX "idx_audit_log_created_at" ON "public"."audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_catering_menu_recipes_menu" ON "public"."catering_menu_recipes" USING "btree" ("menu_id");



CREATE INDEX "idx_catering_menu_recipes_recipe" ON "public"."catering_menu_recipes" USING "btree" ("recipe_number");



CREATE INDEX "idx_catering_menus_type" ON "public"."catering_menus" USING "btree" ("menu_type_id");



CREATE INDEX "idx_collab_company" ON "public"."company_collaborators" USING "btree" ("company_id");



CREATE INDEX "idx_collab_marketer" ON "public"."company_collaborators" USING "btree" ("marketer_id");



CREATE INDEX "idx_commissions_company" ON "public"."commissions" USING "btree" ("company_id");



CREATE INDEX "idx_commissions_marketer" ON "public"."commissions" USING "btree" ("marketer_id");



CREATE INDEX "idx_companies_assigned_marketer" ON "public"."companies" USING "btree" ("assigned_marketer_id");



CREATE INDEX "idx_companies_client_id" ON "public"."companies" USING "btree" ("client_id");



CREATE INDEX "idx_companies_landed_by" ON "public"."companies" USING "btree" ("landed_by_marketer_id");



CREATE INDEX "idx_companies_last_visited" ON "public"."companies" USING "btree" ("last_visited_at");



CREATE INDEX "idx_companies_lead_score" ON "public"."companies" USING "btree" ("lead_score" DESC);



CREATE INDEX "idx_companies_pipeline_stage" ON "public"."companies" USING "btree" ("pipeline_stage");



CREATE INDEX "idx_companies_region" ON "public"."companies" USING "btree" ("region_id");



CREATE INDEX "idx_company_collaborators_company" ON "public"."company_collaborators" USING "btree" ("company_id");



CREATE INDEX "idx_company_notes_company" ON "public"."company_notes" USING "btree" ("company_id");



CREATE UNIQUE INDEX "idx_daily_menus_event_date" ON "public"."daily_menus" USING "btree" ("event_id", "menu_date");



CREATE INDEX "idx_daily_reports_date" ON "public"."marketer_daily_reports" USING "btree" ("report_date" DESC);



CREATE INDEX "idx_disciplinary_employee" ON "public"."disciplinary_records" USING "btree" ("employee_id", "status");



CREATE INDEX "idx_employment_contracts_end" ON "public"."employment_contracts" USING "btree" ("end_date") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_followups_assigned" ON "public"."follow_ups" USING "btree" ("assigned_to", "status");



CREATE INDEX "idx_followups_company" ON "public"."follow_ups" USING "btree" ("company_id");



CREATE INDEX "idx_followups_due_status" ON "public"."follow_ups" USING "btree" ("due_date", "status");



CREATE INDEX "idx_hr_documents_employee" ON "public"."hr_documents" USING "btree" ("employee_id");



CREATE INDEX "idx_hr_documents_status" ON "public"."hr_documents" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_hr_notifications_recipient" ON "public"."hr_notifications" USING "btree" ("recipient_id", "created_at" DESC);



CREATE INDEX "idx_hr_notifications_unread" ON "public"."hr_notifications" USING "btree" ("recipient_id") WHERE ("read_at" IS NULL);



CREATE INDEX "idx_ingredients_classification" ON "public"."ingredients" USING "btree" ("itemClassification");



CREATE INDEX "idx_ingredients_description" ON "public"."ingredients" USING "btree" ("itemDescription");



CREATE INDEX "idx_invoices_client_id" ON "public"."invoices" USING "btree" ("clientId");



CREATE INDEX "idx_invoices_created_at" ON "public"."invoices" USING "btree" ("createdAt");



CREATE INDEX "idx_leave_requests_employee" ON "public"."leave_requests" USING "btree" ("employee_id", "start_date");



CREATE INDEX "idx_leave_requests_status" ON "public"."leave_requests" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_marketer_docs_marketer_id" ON "public"."marketer_documents" USING "btree" ("marketer_id");



CREATE INDEX "idx_menu_planned_ingredients_menu" ON "public"."menu_planned_ingredients" USING "btree" ("menu_id");



CREATE INDEX "idx_notifications_unread" ON "public"."marketing_notifications" USING "btree" ("is_read", "created_at" DESC);



CREATE INDEX "idx_orders_booking_id" ON "public"."orders" USING "btree" ("booking_id");



CREATE INDEX "idx_orders_client_id" ON "public"."orders" USING "btree" ("client_id");



CREATE INDEX "idx_orders_created_at" ON "public"."orders" USING "btree" ("createdAt");



CREATE INDEX "idx_orders_status_start_date" ON "public"."orders" USING "btree" ("status", "start_date");



CREATE INDEX "idx_otp_codes_email_code" ON "public"."otp_codes" USING "btree" ("email", "code");



CREATE INDEX "idx_payroll_employee_id" ON "public"."payroll" USING "btree" ("employeeId");



CREATE INDEX "idx_payroll_pay_period_start" ON "public"."payroll" USING "btree" ("payPeriodStart");



CREATE INDEX "idx_perf_marketer_month" ON "public"."marketing_performance" USING "btree" ("marketer_id", "year", "month");



CREATE INDEX "idx_portal_audit_log_created_at" ON "public"."portal_audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_portal_audit_log_table_record" ON "public"."portal_audit_log" USING "btree" ("table_name", "record_id");



CREATE UNIQUE INDEX "idx_portal_costing_requests_one_pending_per_rfq" ON "public"."portal_costing_requests" USING "btree" ("rfq_id") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_portal_costing_requests_rfq_id" ON "public"."portal_costing_requests" USING "btree" ("rfq_id");



CREATE INDEX "idx_portal_costing_requests_status" ON "public"."portal_costing_requests" USING "btree" ("status");



CREATE UNIQUE INDEX "idx_portal_invoice_requests_one_pending_per_proforma" ON "public"."portal_invoice_requests" USING "btree" ("proforma_id") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_portal_invoice_requests_rfq_id" ON "public"."portal_invoice_requests" USING "btree" ("rfq_id");



CREATE INDEX "idx_portal_invoice_requests_status" ON "public"."portal_invoice_requests" USING "btree" ("status");



CREATE INDEX "idx_portal_notifications_recipient" ON "public"."portal_notifications" USING "btree" ("portal_user_id", "is_read");



CREATE INDEX "idx_products_name" ON "public"."products" USING "btree" ("name");



CREATE INDEX "idx_products_sku" ON "public"."products" USING "btree" ("sku");



CREATE INDEX "idx_proforma_comments_proforma_id" ON "public"."proforma_comments" USING "btree" ("proforma_id", "created_at");



CREATE INDEX "idx_proforma_invoices_client_id" ON "public"."proforma_invoices" USING "btree" ("clientId");



CREATE INDEX "idx_proforma_invoices_created_at" ON "public"."proforma_invoices" USING "btree" ("createdAt");



CREATE INDEX "idx_push_subscriptions_portal_user_id" ON "public"."push_subscriptions" USING "btree" ("portal_user_id");



CREATE INDEX "idx_quotation_requests_company" ON "public"."quotation_requests" USING "btree" ("company_id");



CREATE INDEX "idx_quotation_requests_marketer" ON "public"."quotation_requests" USING "btree" ("marketer_id");



CREATE INDEX "idx_quotation_requests_status" ON "public"."quotation_requests" USING "btree" ("status");



CREATE INDEX "idx_recipes_name" ON "public"."recipes" USING "btree" ("recipeName");



CREATE INDEX "idx_recognition_pending" ON "public"."recognition_records" USING "btree" ("payroll_status") WHERE ("payroll_status" = 'pending'::"text");



CREATE INDEX "idx_rfq_proforma_links_proforma_id" ON "public"."rfq_proforma_links" USING "btree" ("proforma_id");



CREATE INDEX "idx_rfq_proforma_links_rfq_id" ON "public"."rfq_proforma_links" USING "btree" ("rfq_id");



CREATE INDEX "idx_rfq_status_history_rfq_id" ON "public"."rfq_status_history" USING "btree" ("rfq_id");



CREATE INDEX "idx_rfqs_client_id" ON "public"."rfqs" USING "btree" ("client_id");



CREATE INDEX "idx_rfqs_status" ON "public"."rfqs" USING "btree" ("status");



CREATE INDEX "idx_sales_customerid" ON "public"."sales" USING "btree" ("customerid");



CREATE INDEX "idx_sales_date" ON "public"."sales" USING "btree" ("date");



CREATE INDEX "idx_sf_date" ON "public"."service_feedback" USING "btree" ("report_date");



CREATE INDEX "idx_sf_order" ON "public"."service_feedback" USING "btree" ("order_id");



CREATE INDEX "idx_stock_logs_date" ON "public"."stock_logs" USING "btree" ("date");



CREATE INDEX "idx_stock_logs_product_id" ON "public"."stock_logs" USING "btree" ("productId");



CREATE INDEX "idx_target_analyses_target" ON "public"."marketing_target_analyses" USING "btree" ("target_id", "created_at" DESC);



CREATE INDEX "idx_targets_marketer" ON "public"."marketing_targets" USING "btree" ("marketer_id");



CREATE INDEX "idx_targets_period" ON "public"."marketing_targets" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_tax_rates_effective_from" ON "public"."tax_rates" USING "btree" ("effective_from" DESC);



CREATE INDEX "idx_tr_part_employee" ON "public"."training_participants" USING "btree" ("employee_id");



CREATE INDEX "idx_tr_part_training" ON "public"."training_participants" USING "btree" ("training_id");



CREATE INDEX "idx_training_evaluations_date" ON "public"."training_evaluations" USING "btree" ("evaluation_date");



CREATE INDEX "idx_training_evaluations_participant" ON "public"."training_evaluations" USING "btree" ("participant_id");



CREATE INDEX "idx_training_evaluations_training" ON "public"."training_evaluations" USING "btree" ("training_id");



CREATE INDEX "idx_visits_check_in" ON "public"."visits" USING "btree" ("check_in_time");



CREATE INDEX "idx_visits_company" ON "public"."visits" USING "btree" ("company_id");



CREATE INDEX "idx_visits_marketer" ON "public"."visits" USING "btree" ("marketer_id");



CREATE INDEX "idx_visits_visit_code" ON "public"."visits" USING "btree" ("visit_code");



CREATE UNIQUE INDEX "staff_users_employee_id_key" ON "public"."staff_users" USING "btree" ("employee_id") WHERE ("employee_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "attendance_leave_guard" BEFORE INSERT OR DELETE OR UPDATE ON "public"."attendance" FOR EACH ROW EXECUTE FUNCTION "public"."attendance_leave_guard"();



CREATE OR REPLACE TRIGGER "audit_row_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."assets" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."attendance" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."candidates" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."contract_expiry_notices" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."disciplinary_records" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."employees" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."employment_contracts" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."hr_document_counters" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."hr_document_templates" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."hr_document_types" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."hr_documents" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."issuance" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."leave_balances" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."leave_requests" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."leave_settings" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."leave_types" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."payroll" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."positions" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."public_holidays" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."recognition_records" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."stock_logs" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."training_evaluations" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_row_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."training_participants" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_staff_user_change" AFTER UPDATE ON "public"."staff_users" FOR EACH ROW EXECUTE FUNCTION "public"."audit_staff_user_change"();



CREATE OR REPLACE TRIGGER "candidates_guard" BEFORE INSERT OR DELETE OR UPDATE ON "public"."candidates" FOR EACH ROW EXECUTE FUNCTION "public"."candidates_guard"();



CREATE OR REPLACE TRIGGER "deal_won_trigger" AFTER UPDATE OF "pipeline_stage" ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."notify_deal_won"();



CREATE OR REPLACE TRIGGER "employees_delete_guard" BEFORE DELETE ON "public"."employees" FOR EACH ROW EXECUTE FUNCTION "public"."employees_delete_guard"();



CREATE OR REPLACE TRIGGER "employees_status_guard" BEFORE INSERT OR UPDATE ON "public"."employees" FOR EACH ROW EXECUTE FUNCTION "public"."employees_status_guard"();



CREATE OR REPLACE TRIGGER "expenses_set_updated_at" BEFORE UPDATE ON "public"."expenses" FOR EACH ROW EXECUTE FUNCTION "public"."handle_expense_updated_at"();



CREATE OR REPLACE TRIGGER "guard_company_settings" BEFORE UPDATE ON "public"."app_settings" FOR EACH ROW EXECUTE FUNCTION "public"."guard_company_settings"();



CREATE OR REPLACE TRIGGER "guard_hr_settings" BEFORE UPDATE ON "public"."app_settings" FOR EACH ROW EXECUTE FUNCTION "public"."guard_hr_settings"();



CREATE OR REPLACE TRIGGER "hot_lead_trigger" AFTER UPDATE OF "lead_score" ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."notify_hot_lead"();



CREATE OR REPLACE TRIGGER "hr_document_templates_guard" BEFORE DELETE OR UPDATE ON "public"."hr_document_templates" FOR EACH ROW EXECUTE FUNCTION "public"."hr_document_templates_guard"();



CREATE OR REPLACE TRIGGER "hr_document_types_guard" BEFORE INSERT OR DELETE OR UPDATE ON "public"."hr_document_types" FOR EACH ROW EXECUTE FUNCTION "public"."hr_document_types_guard"();



CREATE OR REPLACE TRIGGER "hr_documents_guard" BEFORE INSERT OR DELETE OR UPDATE ON "public"."hr_documents" FOR EACH ROW EXECUTE FUNCTION "public"."hr_documents_guard"();



CREATE OR REPLACE TRIGGER "hr_documents_notify_portal" AFTER UPDATE OF "status" ON "public"."hr_documents" FOR EACH ROW EXECUTE FUNCTION "public"."hr_documents_notify_portal"();



CREATE OR REPLACE TRIGGER "hr_notifications_only_read" BEFORE UPDATE ON "public"."hr_notifications" FOR EACH ROW EXECUTE FUNCTION "public"."hr_notifications_only_read"();



CREATE OR REPLACE TRIGGER "hr_refuse_if_employee_inactive" BEFORE INSERT OR UPDATE ON "public"."attendance" FOR EACH ROW EXECUTE FUNCTION "public"."hr_refuse_if_employee_inactive"('employee_id');



CREATE OR REPLACE TRIGGER "hr_refuse_if_employee_inactive" BEFORE INSERT ON "public"."employment_contracts" FOR EACH ROW EXECUTE FUNCTION "public"."hr_refuse_if_employee_inactive"('employee_id');



CREATE OR REPLACE TRIGGER "hr_refuse_if_employee_inactive" BEFORE INSERT OR UPDATE ON "public"."hr_documents" FOR EACH ROW EXECUTE FUNCTION "public"."hr_refuse_if_employee_inactive"('employee_id');



CREATE OR REPLACE TRIGGER "hr_refuse_if_employee_inactive" BEFORE INSERT OR UPDATE ON "public"."leave_balances" FOR EACH ROW EXECUTE FUNCTION "public"."hr_refuse_if_employee_inactive"('employee_id');



CREATE OR REPLACE TRIGGER "hr_refuse_if_employee_inactive" BEFORE INSERT ON "public"."leave_requests" FOR EACH ROW EXECUTE FUNCTION "public"."hr_refuse_if_employee_inactive"('employee_id');



CREATE OR REPLACE TRIGGER "hr_refuse_if_employee_inactive" BEFORE INSERT ON "public"."payroll" FOR EACH ROW EXECUTE FUNCTION "public"."hr_refuse_if_employee_inactive"('employeeId');



CREATE OR REPLACE TRIGGER "hr_refuse_if_employee_inactive" BEFORE INSERT OR UPDATE ON "public"."training_participants" FOR EACH ROW EXECUTE FUNCTION "public"."hr_refuse_if_employee_inactive"('employee_id');



CREATE OR REPLACE TRIGGER "leave_balances_opening_guard" BEFORE INSERT OR UPDATE ON "public"."leave_balances" FOR EACH ROW EXECUTE FUNCTION "public"."leave_balances_opening_guard"();



CREATE OR REPLACE TRIGGER "leave_request_before_insert" BEFORE INSERT ON "public"."leave_requests" FOR EACH ROW EXECUTE FUNCTION "public"."leave_request_before_insert"();



CREATE OR REPLACE TRIGGER "leave_request_guard" BEFORE DELETE OR UPDATE ON "public"."leave_requests" FOR EACH ROW EXECUTE FUNCTION "public"."leave_request_guard"();



CREATE OR REPLACE TRIGGER "leave_request_notify_hr" AFTER INSERT ON "public"."leave_requests" FOR EACH ROW EXECUTE FUNCTION "public"."leave_request_notify_hr"();



CREATE OR REPLACE TRIGGER "on_daily_menus_updated" BEFORE UPDATE ON "public"."daily_menus" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "portal_costing_requests_notify" AFTER UPDATE ON "public"."portal_costing_requests" FOR EACH ROW EXECUTE FUNCTION "public"."notify_costing_request_change"();



CREATE OR REPLACE TRIGGER "portal_invoice_requests_notify" AFTER UPDATE ON "public"."portal_invoice_requests" FOR EACH ROW EXECUTE FUNCTION "public"."notify_invoice_request_change"();



CREATE OR REPLACE TRIGGER "portal_users_log_changes" AFTER UPDATE ON "public"."portal_users" FOR EACH ROW EXECUTE FUNCTION "public"."log_portal_user_change"();



CREATE OR REPLACE TRIGGER "rfq_log_initial_status" AFTER INSERT ON "public"."rfqs" FOR EACH ROW EXECUTE FUNCTION "public"."log_rfq_created"();



CREATE OR REPLACE TRIGGER "set_updated_by" BEFORE UPDATE ON "public"."assets" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();



CREATE OR REPLACE TRIGGER "set_updated_by" BEFORE UPDATE ON "public"."attendance" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();



CREATE OR REPLACE TRIGGER "set_updated_by" BEFORE UPDATE ON "public"."candidates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();



CREATE OR REPLACE TRIGGER "set_updated_by" BEFORE UPDATE ON "public"."disciplinary_records" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();



CREATE OR REPLACE TRIGGER "set_updated_by" BEFORE UPDATE ON "public"."employees" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();



CREATE OR REPLACE TRIGGER "set_updated_by" BEFORE UPDATE ON "public"."employment_contracts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();



CREATE OR REPLACE TRIGGER "set_updated_by" BEFORE UPDATE ON "public"."hr_document_templates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();



CREATE OR REPLACE TRIGGER "set_updated_by" BEFORE UPDATE ON "public"."hr_document_types" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();



CREATE OR REPLACE TRIGGER "set_updated_by" BEFORE UPDATE ON "public"."hr_documents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();



CREATE OR REPLACE TRIGGER "set_updated_by" BEFORE UPDATE ON "public"."issuance" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();



CREATE OR REPLACE TRIGGER "set_updated_by" BEFORE UPDATE ON "public"."leave_balances" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();



CREATE OR REPLACE TRIGGER "set_updated_by" BEFORE UPDATE ON "public"."leave_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();



CREATE OR REPLACE TRIGGER "set_updated_by" BEFORE UPDATE ON "public"."leave_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();



CREATE OR REPLACE TRIGGER "set_updated_by" BEFORE UPDATE ON "public"."leave_types" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();



CREATE OR REPLACE TRIGGER "set_updated_by" BEFORE UPDATE ON "public"."payroll" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();



CREATE OR REPLACE TRIGGER "set_updated_by" BEFORE UPDATE ON "public"."positions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();



CREATE OR REPLACE TRIGGER "set_updated_by" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();



CREATE OR REPLACE TRIGGER "set_updated_by" BEFORE UPDATE ON "public"."public_holidays" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();



CREATE OR REPLACE TRIGGER "set_updated_by" BEFORE UPDATE ON "public"."recognition_records" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();



CREATE OR REPLACE TRIGGER "set_updated_by" BEFORE UPDATE ON "public"."stock_logs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();



CREATE OR REPLACE TRIGGER "set_updated_by" BEFORE UPDATE ON "public"."training_evaluations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();



CREATE OR REPLACE TRIGGER "set_updated_by" BEFORE UPDATE ON "public"."training_participants" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();



CREATE OR REPLACE TRIGGER "suppliers_set_updated_at" BEFORE UPDATE ON "public"."suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."handle_supplier_updated_at"();



CREATE OR REPLACE TRIGGER "sync_training_applicants" AFTER INSERT OR DELETE OR UPDATE OF "training_id" ON "public"."training_participants" FOR EACH ROW EXECUTE FUNCTION "public"."sync_training_applicants"();



CREATE OR REPLACE TRIGGER "tr_ingredients_updated_at" BEFORE UPDATE ON "public"."ingredients" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "tr_products_updated_at" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "tr_recipes_updated_at" BEFORE UPDATE ON "public"."recipes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_requests"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidates"
    ADD CONSTRAINT "candidates_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."candidates"
    ADD CONSTRAINT "candidates_offer_document_id_fkey" FOREIGN KEY ("offer_document_id") REFERENCES "public"."hr_documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."catering_menu_recipes"
    ADD CONSTRAINT "catering_menu_recipes_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "public"."catering_menus"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."catering_menu_recipes"
    ADD CONSTRAINT "catering_menu_recipes_recipe_number_fkey" FOREIGN KEY ("recipe_number") REFERENCES "public"."recipes"("recipeNumber") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."catering_menus"
    ADD CONSTRAINT "catering_menus_menu_type_id_fkey" FOREIGN KEY ("menu_type_id") REFERENCES "public"."menu_types"("id");



ALTER TABLE ONLY "public"."catering_menus"
    ADD CONSTRAINT "catering_menus_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."client_invoice_tax_settings"
    ADD CONSTRAINT "client_invoice_tax_settings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_invoice_tax_settings"
    ADD CONSTRAINT "client_invoice_tax_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."portal_users"("id");



ALTER TABLE ONLY "public"."commissions"
    ADD CONSTRAINT "commissions_marketer_id_fkey" FOREIGN KEY ("marketer_id") REFERENCES "public"."marketing_users"("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_assigned_marketer_id_fkey" FOREIGN KEY ("assigned_marketer_id") REFERENCES "public"."marketing_users"("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_landed_by_marketer_id_fkey" FOREIGN KEY ("landed_by_marketer_id") REFERENCES "public"."marketing_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_onboarding_requested_by_fkey" FOREIGN KEY ("onboarding_requested_by") REFERENCES "public"."marketing_users"("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id");



ALTER TABLE ONLY "public"."company_collaborators"
    ADD CONSTRAINT "company_collaborators_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."marketing_users"("id");



ALTER TABLE ONLY "public"."company_collaborators"
    ADD CONSTRAINT "company_collaborators_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_collaborators"
    ADD CONSTRAINT "company_collaborators_marketer_id_fkey" FOREIGN KEY ("marketer_id") REFERENCES "public"."marketing_users"("id");



ALTER TABLE ONLY "public"."company_documents"
    ADD CONSTRAINT "company_documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."company_notes"
    ADD CONSTRAINT "company_notes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."contract_expiry_notices"
    ADD CONSTRAINT "contract_expiry_notices_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."employment_contracts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."costing_reports"
    ADD CONSTRAINT "costing_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."daily_orders"
    ADD CONSTRAINT "daily_orders_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."disciplinary_records"
    ADD CONSTRAINT "disciplinary_records_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."hr_documents"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."disciplinary_records"
    ADD CONSTRAINT "disciplinary_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."employment_contracts"
    ADD CONSTRAINT "employment_contracts_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."hr_documents"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."employment_contracts"
    ADD CONSTRAINT "employment_contracts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."employment_contracts"
    ADD CONSTRAINT "employment_contracts_parent_contract_id_fkey" FOREIGN KEY ("parent_contract_id") REFERENCES "public"."employment_contracts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "fk_booking" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proforma_invoices"
    ADD CONSTRAINT "fk_booking" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_menus"
    ADD CONSTRAINT "fk_order" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "fk_orders_client" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "fk_proforma_invoice" FOREIGN KEY ("proforma_invoice_id") REFERENCES "public"."proforma_invoices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."follow_ups"
    ADD CONSTRAINT "follow_ups_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."marketing_users"("id");



ALTER TABLE ONLY "public"."follow_ups"
    ADD CONSTRAINT "follow_ups_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."follow_ups"
    ADD CONSTRAINT "follow_ups_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id");



ALTER TABLE ONLY "public"."hr_document_counters"
    ADD CONSTRAINT "hr_document_counters_doc_type_fkey" FOREIGN KEY ("doc_type") REFERENCES "public"."hr_document_types"("doc_type") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."hr_document_templates"
    ADD CONSTRAINT "hr_document_templates_doc_type_fkey" FOREIGN KEY ("doc_type") REFERENCES "public"."hr_document_types"("doc_type") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."hr_documents"
    ADD CONSTRAINT "hr_documents_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."hr_documents"
    ADD CONSTRAINT "hr_documents_doc_type_fkey" FOREIGN KEY ("doc_type") REFERENCES "public"."hr_document_types"("doc_type") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."hr_documents"
    ADD CONSTRAINT "hr_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."hr_documents"
    ADD CONSTRAINT "hr_documents_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."hr_document_templates"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."hr_notifications"
    ADD CONSTRAINT "hr_notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ingredients"
    ADD CONSTRAINT "ingredients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_tax_rates"
    ADD CONSTRAINT "invoice_tax_rates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."portal_users"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE RESTRICT NOT VALID;



ALTER TABLE ONLY "public"."leave_balances"
    ADD CONSTRAINT "leave_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."leave_balances"
    ADD CONSTRAINT "leave_balances_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."marketer_account_actions"
    ADD CONSTRAINT "marketer_account_actions_marketer_id_fkey" FOREIGN KEY ("marketer_id") REFERENCES "public"."marketing_users"("id");



ALTER TABLE ONLY "public"."marketer_account_actions"
    ADD CONSTRAINT "marketer_account_actions_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "public"."marketing_users"("id");



ALTER TABLE ONLY "public"."marketer_account_actions"
    ADD CONSTRAINT "marketer_account_actions_reverted_by_fkey" FOREIGN KEY ("reverted_by") REFERENCES "public"."marketing_users"("id");



ALTER TABLE ONLY "public"."marketer_approval_log"
    ADD CONSTRAINT "marketer_approval_log_marketer_id_fkey" FOREIGN KEY ("marketer_id") REFERENCES "public"."marketing_users"("id");



ALTER TABLE ONLY "public"."marketer_commissions"
    ADD CONSTRAINT "marketer_commissions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketer_commissions"
    ADD CONSTRAINT "marketer_commissions_marketer_id_fkey" FOREIGN KEY ("marketer_id") REFERENCES "public"."marketing_users"("id");



ALTER TABLE ONLY "public"."marketer_commissions"
    ADD CONSTRAINT "marketer_commissions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."marketing_users"("id");



ALTER TABLE ONLY "public"."marketer_daily_reports"
    ADD CONSTRAINT "marketer_daily_reports_marketer_id_fkey" FOREIGN KEY ("marketer_id") REFERENCES "public"."marketing_users"("id");



ALTER TABLE ONLY "public"."marketer_documents"
    ADD CONSTRAINT "marketer_documents_marketer_id_fkey" FOREIGN KEY ("marketer_id") REFERENCES "public"."marketing_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketer_documents"
    ADD CONSTRAINT "marketer_documents_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."marketing_users"("id");



ALTER TABLE ONLY "public"."marketing_notifications"
    ADD CONSTRAINT "marketing_notifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."marketing_notifications"
    ADD CONSTRAINT "marketing_notifications_marketer_id_fkey" FOREIGN KEY ("marketer_id") REFERENCES "public"."marketing_users"("id");



ALTER TABLE ONLY "public"."marketing_performance"
    ADD CONSTRAINT "marketing_performance_marketer_id_fkey" FOREIGN KEY ("marketer_id") REFERENCES "public"."marketing_users"("id");



ALTER TABLE ONLY "public"."marketing_target_analyses"
    ADD CONSTRAINT "marketing_target_analyses_analysed_by_fkey" FOREIGN KEY ("analysed_by") REFERENCES "public"."marketing_users"("id");



ALTER TABLE ONLY "public"."marketing_target_analyses"
    ADD CONSTRAINT "marketing_target_analyses_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "public"."marketing_targets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketing_targets"
    ADD CONSTRAINT "marketing_targets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."marketing_users"("id");



ALTER TABLE ONLY "public"."marketing_targets"
    ADD CONSTRAINT "marketing_targets_marketer_id_fkey" FOREIGN KEY ("marketer_id") REFERENCES "public"."marketing_users"("id");



ALTER TABLE ONLY "public"."marketing_users"
    ADD CONSTRAINT "marketing_users_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."marketing_users"("id");



ALTER TABLE ONLY "public"."marketing_users"
    ADD CONSTRAINT "marketing_users_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketing_users"
    ADD CONSTRAINT "marketing_users_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."marketing_users"("id");



ALTER TABLE ONLY "public"."marketing_users"
    ADD CONSTRAINT "marketing_users_disabled_by_fkey" FOREIGN KEY ("disabled_by") REFERENCES "public"."marketing_users"("id");



ALTER TABLE ONLY "public"."marketing_users"
    ADD CONSTRAINT "marketing_users_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id");



ALTER TABLE ONLY "public"."marketing_users"
    ADD CONSTRAINT "marketing_users_reinstated_by_fkey" FOREIGN KEY ("reinstated_by") REFERENCES "public"."marketing_users"("id");



ALTER TABLE ONLY "public"."marketing_users"
    ADD CONSTRAINT "marketing_users_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "public"."marketing_users"("id");



ALTER TABLE ONLY "public"."marketing_users"
    ADD CONSTRAINT "marketing_users_suspended_by_fkey" FOREIGN KEY ("suspended_by") REFERENCES "public"."marketing_users"("id");



ALTER TABLE ONLY "public"."menu_planned_ingredients"
    ADD CONSTRAINT "menu_planned_ingredients_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "public"."catering_menus"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payroll"
    ADD CONSTRAINT "payroll_employee_id_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payroll"
    ADD CONSTRAINT "payroll_tax_rate_version_id_fkey" FOREIGN KEY ("tax_rate_version_id") REFERENCES "public"."tax_rates"("id");



ALTER TABLE ONLY "public"."portal_costing_requests"
    ADD CONSTRAINT "portal_costing_requests_fulfilled_by_id_fkey" FOREIGN KEY ("fulfilled_by_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."portal_costing_requests"
    ADD CONSTRAINT "portal_costing_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "public"."portal_users"("id");



ALTER TABLE ONLY "public"."portal_costing_requests"
    ADD CONSTRAINT "portal_costing_requests_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_invoice_requests"
    ADD CONSTRAINT "portal_invoice_requests_fulfilled_by_id_fkey" FOREIGN KEY ("fulfilled_by_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."portal_invoice_requests"
    ADD CONSTRAINT "portal_invoice_requests_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."portal_invoice_requests"
    ADD CONSTRAINT "portal_invoice_requests_proforma_id_fkey" FOREIGN KEY ("proforma_id") REFERENCES "public"."proforma_invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_invoice_requests"
    ADD CONSTRAINT "portal_invoice_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "public"."portal_users"("id");



ALTER TABLE ONLY "public"."portal_invoice_requests"
    ADD CONSTRAINT "portal_invoice_requests_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."portal_notifications"
    ADD CONSTRAINT "portal_notifications_portal_user_id_fkey" FOREIGN KEY ("portal_user_id") REFERENCES "public"."portal_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_notifications"
    ADD CONSTRAINT "portal_notifications_proforma_id_fkey" FOREIGN KEY ("proforma_id") REFERENCES "public"."proforma_invoices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."portal_notifications"
    ADD CONSTRAINT "portal_notifications_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proforma_comments"
    ADD CONSTRAINT "proforma_comments_portal_author_id_fkey" FOREIGN KEY ("portal_author_id") REFERENCES "public"."portal_users"("id");



ALTER TABLE ONLY "public"."proforma_comments"
    ADD CONSTRAINT "proforma_comments_proforma_id_fkey" FOREIGN KEY ("proforma_id") REFERENCES "public"."proforma_invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proforma_comments"
    ADD CONSTRAINT "proforma_comments_staff_author_id_fkey" FOREIGN KEY ("staff_author_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."proforma_invoices"
    ADD CONSTRAINT "proforma_invoices_client_id_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE RESTRICT NOT VALID;



ALTER TABLE ONLY "public"."proforma_invoices"
    ADD CONSTRAINT "proforma_invoices_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "public"."portal_users"("id");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_portal_user_id_fkey" FOREIGN KEY ("portal_user_id") REFERENCES "public"."portal_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_requests"
    ADD CONSTRAINT "quotation_requests_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "public"."marketing_users"("id");



ALTER TABLE ONLY "public"."quotation_requests"
    ADD CONSTRAINT "quotation_requests_marketer_id_fkey" FOREIGN KEY ("marketer_id") REFERENCES "public"."marketing_users"("id");



ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "recipes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."recognition_records"
    ADD CONSTRAINT "recognition_records_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."hr_documents"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."recognition_records"
    ADD CONSTRAINT "recognition_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."recognition_records"
    ADD CONSTRAINT "recognition_records_paid_in_payroll_id_fkey" FOREIGN KEY ("paid_in_payroll_id") REFERENCES "public"."payroll"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."rfq_proforma_links"
    ADD CONSTRAINT "rfq_proforma_links_linked_by_id_fkey" FOREIGN KEY ("linked_by_id") REFERENCES "public"."portal_users"("id");



ALTER TABLE ONLY "public"."rfq_proforma_links"
    ADD CONSTRAINT "rfq_proforma_links_proforma_id_fkey" FOREIGN KEY ("proforma_id") REFERENCES "public"."proforma_invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rfq_proforma_links"
    ADD CONSTRAINT "rfq_proforma_links_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rfq_status_history"
    ADD CONSTRAINT "rfq_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "public"."portal_users"("id");



ALTER TABLE ONLY "public"."rfq_status_history"
    ADD CONSTRAINT "rfq_status_history_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rfqs"
    ADD CONSTRAINT "rfqs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."rfqs"
    ADD CONSTRAINT "rfqs_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "public"."portal_users"("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_customerid_fkey" FOREIGN KEY ("customerid") REFERENCES "public"."clients"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."service_feedback"
    ADD CONSTRAINT "service_feedback_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_users"
    ADD CONSTRAINT "staff_users_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_users"
    ADD CONSTRAINT "staff_users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supervisor_reports"
    ADD CONSTRAINT "supervisor_reports_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."training_evaluations"
    ADD CONSTRAINT "training_evaluations_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "public"."training_participants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_participants"
    ADD CONSTRAINT "training_participants_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_participants"
    ADD CONSTRAINT "training_participants_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "public"."positions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visit_documents"
    ADD CONSTRAINT "visit_documents_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id");



ALTER TABLE ONLY "public"."visits"
    ADD CONSTRAINT "visits_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."visits"
    ADD CONSTRAINT "visits_marketer_id_fkey" FOREIGN KEY ("marketer_id") REFERENCES "public"."marketing_users"("id");



CREATE POLICY "Allow all access for authenticated users" ON "public"."catering_menu_recipes" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."catering_menus"
  WHERE (("catering_menus"."id" = "catering_menu_recipes"."menu_id") AND ("catering_menus"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow all access for authenticated users" ON "public"."catering_menus" TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow all access for authenticated users" ON "public"."menu_planned_ingredients" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."catering_menus"
  WHERE (("catering_menus"."id" = "menu_planned_ingredients"."menu_id") AND ("catering_menus"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow authenticated users to manage clients" ON "public"."clients" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated users to manage invoices" ON "public"."invoices" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated users to manage orders" ON "public"."orders" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated users to manage proforma_invoices" ON "public"."proforma_invoices" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow delete access to all users" ON "public"."daily_menus" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow individual delete access" ON "public"."delivery_notes" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow individual insert access" ON "public"."delivery_notes" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow individual read access" ON "public"."delivery_notes" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow individual update access" ON "public"."delivery_notes" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow insert access to all users" ON "public"."daily_menus" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow read access to all users" ON "public"."daily_menus" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow read for authenticated users" ON "public"."menu_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow update access to all users" ON "public"."daily_menus" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Allow users to manage daily orders for their bookings" ON "public"."daily_orders" USING ((("auth"."role"() = 'authenticated'::"text") AND (( SELECT "bookings"."user_id"
   FROM "public"."bookings"
  WHERE ("bookings"."id" = "daily_orders"."booking_id")) = "auth"."uid"()))) WITH CHECK ((("auth"."role"() = 'authenticated'::"text") AND (( SELECT "bookings"."user_id"
   FROM "public"."bookings"
  WHERE ("bookings"."id" = "daily_orders"."booking_id")) = "auth"."uid"())));



CREATE POLICY "Allow users to manage their own bookings" ON "public"."bookings" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Anyone can view supervisor reports" ON "public"."supervisor_reports" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can manage their own costing reports" ON "public"."costing_reports" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can manage their own purchases" ON "public"."purchases" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can manage their own sales" ON "public"."sales" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can perform all operations on their own rec" ON "public"."recipes" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Enable all actions for authenticated users on companies" ON "public"."companies" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all actions for authenticated users on company_documents" ON "public"."company_documents" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all actions for authenticated users on company_notes" ON "public"."company_notes" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all actions for authenticated users on follow_ups" ON "public"."follow_ups" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all actions for authenticated users on marketing_perform" ON "public"."marketing_performance" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all actions for authenticated users on marketing_users" ON "public"."marketing_users" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all actions for authenticated users on regions" ON "public"."regions" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all actions for authenticated users on visit_documents" ON "public"."visit_documents" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all actions for authenticated users on visits" ON "public"."visits" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Owner access to ingredients" ON "public"."ingredients" TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Owner access to recipes" ON "public"."recipes" TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own reports" ON "public"."supervisor_reports" FOR INSERT WITH CHECK (("auth"."uid"() = "supervisor_id"));



CREATE POLICY "Users can manage their own costing reports" ON "public"."costing_reports" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own draft reports" ON "public"."supervisor_reports" FOR UPDATE USING ((("auth"."uid"() = "supervisor_id") AND ("status" = 'Draft'::"text")));



CREATE POLICY "account_actions_insert" ON "public"."marketer_account_actions" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "account_actions_select" ON "public"."marketer_account_actions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "account_actions_update" ON "public"."marketer_account_actions" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "app_settings_read" ON "public"."app_settings" FOR SELECT TO "authenticated" USING (("public"."is_active_staff"() OR "public"."is_active_portal_user"()));



CREATE POLICY "app_settings_write" ON "public"."app_settings" FOR UPDATE TO "authenticated" USING ("public"."is_active_staff"()) WITH CHECK ("public"."is_active_staff"());



CREATE POLICY "approval_log_insert" ON "public"."marketer_approval_log" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "approval_log_select" ON "public"."marketer_approval_log" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attendance" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "attendance_delete" ON "public"."attendance" FOR DELETE TO "authenticated" USING ("public"."can_manage_hr"());



CREATE POLICY "attendance_insert" ON "public"."attendance" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_active_staff"());



CREATE POLICY "attendance_select" ON "public"."attendance" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "attendance_update" ON "public"."attendance" FOR UPDATE TO "authenticated" USING (("public"."can_manage_hr"() OR ("public"."is_active_staff"() AND ("created_by" = "public"."safe_auth_uid"()) AND ("date" = (("now"() AT TIME ZONE 'Africa/Dar_es_Salaam'::"text"))::"date")))) WITH CHECK (("public"."can_manage_hr"() OR ("public"."is_active_staff"() AND ("created_by" = "public"."safe_auth_uid"()) AND ("date" = (("now"() AT TIME ZONE 'Africa/Dar_es_Salaam'::"text"))::"date"))));



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_log_select_all" ON "public"."audit_log" FOR SELECT TO "authenticated" USING ("public"."has_staff_role"(ARRAY['admin'::"text", 'general_manager'::"text"]));



CREATE POLICY "audit_log_select_hr" ON "public"."audit_log" FOR SELECT TO "authenticated" USING (("public"."has_staff_role"(ARRAY['hr_manager'::"text"]) AND ("table_name" = ANY (ARRAY['employees'::"text", 'attendance'::"text", 'positions'::"text", 'training_participants'::"text", 'training_evaluations'::"text", 'payroll'::"text", 'leave_requests'::"text", 'leave_balances'::"text", 'leave_types'::"text", 'leave_settings'::"text", 'public_holidays'::"text", 'hr_document_types'::"text", 'hr_document_templates'::"text", 'hr_documents'::"text", 'hr_document_counters'::"text", 'candidates'::"text", 'employment_contracts'::"text", 'disciplinary_records'::"text", 'recognition_records'::"text", 'contract_expiry_notices'::"text"]))));



ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."candidates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "candidates_hr_delete" ON "public"."candidates" FOR DELETE TO "authenticated" USING ("public"."can_manage_hr"());



CREATE POLICY "candidates_hr_insert" ON "public"."candidates" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_manage_hr"());



CREATE POLICY "candidates_hr_select" ON "public"."candidates" FOR SELECT TO "authenticated" USING ("public"."can_manage_hr"());



CREATE POLICY "candidates_hr_update" ON "public"."candidates" FOR UPDATE TO "authenticated" USING ("public"."can_manage_hr"()) WITH CHECK ("public"."can_manage_hr"());



ALTER TABLE "public"."catering_menu_recipes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."catering_menus" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_invoice_tax_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_invoice_tax_settings_read" ON "public"."client_invoice_tax_settings" FOR SELECT TO "authenticated" USING (("public"."is_active_portal_user"() OR "public"."is_active_staff"()));



CREATE POLICY "client_invoice_tax_settings_write" ON "public"."client_invoice_tax_settings" TO "authenticated" USING ("public"."has_portal_role"(ARRAY['super_admin'::"text", 'finance'::"text"])) WITH CHECK ("public"."has_portal_role"(ARRAY['super_admin'::"text", 'finance'::"text"]));



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "collab_delete" ON "public"."company_collaborators" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "collab_insert" ON "public"."company_collaborators" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "collab_select" ON "public"."company_collaborators" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "comm_insert" ON "public"."commissions" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "comm_select" ON "public"."commissions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "comm_update" ON "public"."commissions" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "public"."commissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "commissions_insert" ON "public"."marketer_commissions" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "commissions_select" ON "public"."marketer_commissions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "commissions_update" ON "public"."marketer_commissions" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "companies_delete" ON "public"."companies" FOR DELETE TO "authenticated" USING ("public"."is_marketing_user"());



CREATE POLICY "companies_insert" ON "public"."companies" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_marketing_user"());



CREATE POLICY "companies_select" ON "public"."companies" FOR SELECT TO "authenticated" USING ("public"."is_marketing_user"());



CREATE POLICY "companies_update" ON "public"."companies" FOR UPDATE TO "authenticated" USING ("public"."is_marketing_user"());



ALTER TABLE "public"."company_collaborators" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_collaborators_delete" ON "public"."company_collaborators" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "company_collaborators_insert" ON "public"."company_collaborators" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "company_collaborators_select" ON "public"."company_collaborators" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."company_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_documents_insert" ON "public"."company_documents" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_marketing_user"());



CREATE POLICY "company_documents_select" ON "public"."company_documents" FOR SELECT TO "authenticated" USING ("public"."is_marketing_user"());



ALTER TABLE "public"."company_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_notes_insert" ON "public"."company_notes" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_marketing_user"());



CREATE POLICY "company_notes_select" ON "public"."company_notes" FOR SELECT TO "authenticated" USING ("public"."is_marketing_user"());



CREATE POLICY "company_notes_update" ON "public"."company_notes" FOR UPDATE TO "authenticated" USING ("public"."is_marketing_user"());



ALTER TABLE "public"."contract_expiry_notices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "contract_expiry_notices_hr_select" ON "public"."contract_expiry_notices" FOR SELECT TO "authenticated" USING ("public"."can_manage_hr"());



ALTER TABLE "public"."costing_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_menus" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "daily_reports_insert" ON "public"."marketer_daily_reports" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "daily_reports_select" ON "public"."marketer_daily_reports" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "daily_reports_update" ON "public"."marketer_daily_reports" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "public"."delivery_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."disciplinary_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "disciplinary_records_hr_select" ON "public"."disciplinary_records" FOR SELECT TO "authenticated" USING ("public"."can_manage_hr"());



ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employees_delete" ON "public"."employees" FOR DELETE TO "authenticated" USING ("public"."can_manage_hr"());



CREATE POLICY "employees_insert" ON "public"."employees" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_active_staff"());



CREATE POLICY "employees_select" ON "public"."employees" FOR SELECT TO "authenticated" USING (("public"."can_manage_hr"() OR "public"."has_staff_role"(ARRAY['finance'::"text"])));



CREATE POLICY "employees_update" ON "public"."employees" FOR UPDATE TO "authenticated" USING ("public"."can_manage_hr"()) WITH CHECK ("public"."can_manage_hr"());



ALTER TABLE "public"."employment_contracts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employment_contracts_hr_select" ON "public"."employment_contracts" FOR SELECT TO "authenticated" USING ("public"."can_manage_hr"());



ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expenses_all" ON "public"."marketing_monthly_expenses" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "expenses_delete" ON "public"."expenses" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "expenses_insert" ON "public"."expenses" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "expenses_select" ON "public"."expenses" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "expenses_update" ON "public"."expenses" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "public"."follow_ups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "followups_insert" ON "public"."follow_ups" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_marketing_user"());



CREATE POLICY "followups_select" ON "public"."follow_ups" FOR SELECT TO "authenticated" USING ("public"."is_marketing_user"());



CREATE POLICY "followups_update" ON "public"."follow_ups" FOR UPDATE TO "authenticated" USING ("public"."is_marketing_user"());



ALTER TABLE "public"."hr_document_counters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hr_document_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hr_document_templates_hr_only" ON "public"."hr_document_templates" TO "authenticated" USING ("public"."can_manage_hr"()) WITH CHECK ("public"."can_manage_hr"());



ALTER TABLE "public"."hr_document_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hr_document_types_hr_only" ON "public"."hr_document_types" TO "authenticated" USING ("public"."can_manage_hr"()) WITH CHECK ("public"."can_manage_hr"());



ALTER TABLE "public"."hr_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hr_documents_hr_only" ON "public"."hr_documents" TO "authenticated" USING ("public"."can_manage_hr"()) WITH CHECK ("public"."can_manage_hr"());



ALTER TABLE "public"."hr_notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hr_notifications_select" ON "public"."hr_notifications" FOR SELECT TO "authenticated" USING (("recipient_id" = "public"."safe_auth_uid"()));



CREATE POLICY "hr_notifications_update" ON "public"."hr_notifications" FOR UPDATE TO "authenticated" USING (("recipient_id" = "public"."safe_auth_uid"())) WITH CHECK (("recipient_id" = "public"."safe_auth_uid"()));



ALTER TABLE "public"."id_counters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ingredients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_tax_rates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoice_tax_rates_read" ON "public"."invoice_tax_rates" FOR SELECT TO "authenticated" USING (("public"."is_active_portal_user"() OR "public"."is_active_staff"()));



CREATE POLICY "invoice_tax_rates_write" ON "public"."invoice_tax_rates" TO "authenticated" USING ("public"."has_portal_role"(ARRAY['super_admin'::"text", 'finance'::"text"])) WITH CHECK ("public"."has_portal_role"(ARRAY['super_admin'::"text", 'finance'::"text"]));



ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."issuance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leave_balances" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leave_balances_delete" ON "public"."leave_balances" FOR DELETE TO "authenticated" USING ("public"."can_manage_hr"());



CREATE POLICY "leave_balances_insert" ON "public"."leave_balances" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_manage_hr"());



CREATE POLICY "leave_balances_select" ON "public"."leave_balances" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "leave_balances_update" ON "public"."leave_balances" FOR UPDATE TO "authenticated" USING ("public"."can_manage_hr"()) WITH CHECK ("public"."can_manage_hr"());



ALTER TABLE "public"."leave_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leave_requests_delete" ON "public"."leave_requests" FOR DELETE TO "authenticated" USING ("public"."can_manage_hr"());



CREATE POLICY "leave_requests_insert" ON "public"."leave_requests" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_active_staff"() AND ("status" = 'pending'::"text")));



CREATE POLICY "leave_requests_select" ON "public"."leave_requests" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "leave_requests_update" ON "public"."leave_requests" FOR UPDATE TO "authenticated" USING ("public"."can_manage_hr"()) WITH CHECK ("public"."can_manage_hr"());



ALTER TABLE "public"."leave_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leave_settings_delete" ON "public"."leave_settings" FOR DELETE TO "authenticated" USING ("public"."can_manage_hr"());



CREATE POLICY "leave_settings_insert" ON "public"."leave_settings" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_manage_hr"());



CREATE POLICY "leave_settings_select" ON "public"."leave_settings" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "leave_settings_update" ON "public"."leave_settings" FOR UPDATE TO "authenticated" USING ("public"."can_manage_hr"()) WITH CHECK ("public"."can_manage_hr"());



ALTER TABLE "public"."leave_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leave_types_delete" ON "public"."leave_types" FOR DELETE TO "authenticated" USING ("public"."can_manage_hr"());



CREATE POLICY "leave_types_insert" ON "public"."leave_types" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_manage_hr"());



CREATE POLICY "leave_types_select" ON "public"."leave_types" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "leave_types_update" ON "public"."leave_types" FOR UPDATE TO "authenticated" USING ("public"."can_manage_hr"()) WITH CHECK ("public"."can_manage_hr"());



ALTER TABLE "public"."marketer_account_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketer_approval_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketer_commissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketer_daily_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketer_docs_insert" ON "public"."marketer_documents" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "marketer_docs_select" ON "public"."marketer_documents" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "marketer_docs_update" ON "public"."marketer_documents" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "public"."marketer_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketer_read" ON "public"."marketing_users" FOR SELECT TO "authenticated" USING ((("auth_user_id" = "auth"."uid"()) OR ("email" = (( SELECT "users"."email"
   FROM "auth"."users"
  WHERE ("users"."id" = "auth"."uid"())))::"text")));



CREATE POLICY "marketer_update" ON "public"."marketing_users" FOR UPDATE TO "authenticated" USING ((("auth_user_id" = "auth"."uid"()) OR ("email" = (( SELECT "users"."email"
   FROM "auth"."users"
  WHERE ("users"."id" = "auth"."uid"())))::"text")));



ALTER TABLE "public"."marketing_monthly_expenses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_performance" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketing_performance_insert" ON "public"."marketing_performance" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_marketing_user"());



CREATE POLICY "marketing_performance_select" ON "public"."marketing_performance" FOR SELECT TO "authenticated" USING ("public"."is_marketing_user"());



CREATE POLICY "marketing_performance_update" ON "public"."marketing_performance" FOR UPDATE TO "authenticated" USING ("public"."is_marketing_user"());



ALTER TABLE "public"."marketing_target_analyses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_targets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketing_users_insert" ON "public"."marketing_users" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_marketing_user"());



CREATE POLICY "marketing_users_select" ON "public"."marketing_users" FOR SELECT TO "authenticated" USING ("public"."is_marketing_user"());



CREATE POLICY "marketing_users_update" ON "public"."marketing_users" FOR UPDATE TO "authenticated" USING ("public"."is_marketing_user"());



ALTER TABLE "public"."menu_planned_ingredients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."menu_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_select" ON "public"."marketing_notifications" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "notifications_update" ON "public"."marketing_notifications" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."otp_codes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "otp_insert" ON "public"."otp_codes" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "otp_select" ON "public"."otp_codes" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "otp_update" ON "public"."otp_codes" FOR UPDATE TO "authenticated", "anon" USING (true);



CREATE POLICY "own_delete_push_subscriptions" ON "public"."push_subscriptions" FOR DELETE TO "authenticated" USING (("portal_user_id" = "public"."portal_uid"()));



CREATE POLICY "own_insert_push_subscriptions" ON "public"."push_subscriptions" FOR INSERT TO "authenticated" WITH CHECK (("portal_user_id" = "public"."portal_uid"()));



CREATE POLICY "own_read_push_subscriptions" ON "public"."push_subscriptions" FOR SELECT TO "authenticated" USING (("portal_user_id" = "public"."portal_uid"()));



ALTER TABLE "public"."payroll" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payroll_delete" ON "public"."payroll" FOR DELETE TO "authenticated" USING (("public"."can_manage_hr"() OR "public"."has_staff_role"(ARRAY['finance'::"text"])));



CREATE POLICY "payroll_insert" ON "public"."payroll" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_active_staff"());



CREATE POLICY "payroll_select" ON "public"."payroll" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "payroll_update" ON "public"."payroll" FOR UPDATE TO "authenticated" USING (("public"."can_manage_hr"() OR "public"."has_staff_role"(ARRAY['finance'::"text"]))) WITH CHECK (("public"."can_manage_hr"() OR "public"."has_staff_role"(ARRAY['finance'::"text"])));



CREATE POLICY "perf_insert" ON "public"."marketing_performance" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "perf_select" ON "public"."marketing_performance" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "perf_update" ON "public"."marketing_performance" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "public"."portal_audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "portal_audit_log_admin_select" ON "public"."portal_audit_log" FOR SELECT TO "authenticated" USING ("public"."is_portal_admin"());



ALTER TABLE "public"."portal_costing_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "portal_insert_costing_requests" ON "public"."portal_costing_requests" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_active_portal_user"());



CREATE POLICY "portal_insert_invoice_requests" ON "public"."portal_invoice_requests" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_active_portal_user"());



CREATE POLICY "portal_insert_proforma_comments" ON "public"."proforma_comments" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_active_portal_user"() AND ("author_type" = 'portal'::"text") AND ("portal_author_id" = "public"."portal_uid"())));



ALTER TABLE "public"."portal_invoice_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."portal_notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "portal_notifications_own_select" ON "public"."portal_notifications" FOR SELECT TO "authenticated" USING (("portal_user_id" = "public"."portal_uid"()));



CREATE POLICY "portal_notifications_own_update" ON "public"."portal_notifications" FOR UPDATE TO "authenticated" USING (("portal_user_id" = "public"."portal_uid"())) WITH CHECK (("portal_user_id" = "public"."portal_uid"()));



CREATE POLICY "portal_read_attendance" ON "public"."attendance" FOR SELECT TO "authenticated" USING ("public"."has_portal_role"(ARRAY['super_admin'::"text", 'finance'::"text"]));



CREATE POLICY "portal_read_clients" ON "public"."clients" FOR SELECT TO "authenticated" USING ("public"."is_active_portal_user"());



CREATE POLICY "portal_read_costing_requests" ON "public"."portal_costing_requests" FOR SELECT TO "authenticated" USING ("public"."is_active_portal_user"());



CREATE POLICY "portal_read_invoice_requests" ON "public"."portal_invoice_requests" FOR SELECT TO "authenticated" USING ("public"."is_active_portal_user"());



CREATE POLICY "portal_read_invoices" ON "public"."invoices" FOR SELECT TO "authenticated" USING ("public"."is_active_portal_user"());



CREATE POLICY "portal_read_orders" ON "public"."orders" FOR SELECT TO "authenticated" USING ("public"."is_active_portal_user"());



CREATE POLICY "portal_read_payroll" ON "public"."payroll" FOR SELECT TO "authenticated" USING ("public"."has_portal_role"(ARRAY['super_admin'::"text", 'finance'::"text"]));



CREATE POLICY "portal_read_proforma_comments" ON "public"."proforma_comments" FOR SELECT TO "authenticated" USING ("public"."is_active_portal_user"());



CREATE POLICY "portal_read_proforma_invoices" ON "public"."proforma_invoices" FOR SELECT TO "authenticated" USING ("public"."is_active_portal_user"());



ALTER TABLE "public"."portal_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "portal_users_admin_all" ON "public"."portal_users" TO "authenticated" USING ("public"."is_portal_admin"()) WITH CHECK ("public"."is_portal_admin"());



CREATE POLICY "portal_users_self_select" ON "public"."portal_users" FOR SELECT TO "authenticated" USING (("id" = "public"."portal_uid"()));



ALTER TABLE "public"."positions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "positions_delete" ON "public"."positions" FOR DELETE TO "authenticated" USING ("public"."can_manage_hr"());



CREATE POLICY "positions_insert" ON "public"."positions" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_active_staff"());



CREATE POLICY "positions_select" ON "public"."positions" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "positions_update" ON "public"."positions" FOR UPDATE TO "authenticated" USING ("public"."can_manage_hr"()) WITH CHECK ("public"."can_manage_hr"());



ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."proforma_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."proforma_invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."public_holidays" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public_holidays_delete" ON "public"."public_holidays" FOR DELETE TO "authenticated" USING ("public"."can_manage_hr"());



CREATE POLICY "public_holidays_insert" ON "public"."public_holidays" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_manage_hr"());



CREATE POLICY "public_holidays_select" ON "public"."public_holidays" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "public_holidays_update" ON "public"."public_holidays" FOR UPDATE TO "authenticated" USING ("public"."can_manage_hr"()) WITH CHECK ("public"."can_manage_hr"());



ALTER TABLE "public"."purchases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "qr_insert" ON "public"."quotation_requests" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "qr_select" ON "public"."quotation_requests" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "qr_update" ON "public"."quotation_requests" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "public"."quotation_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recognition_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recognition_records_hr_select" ON "public"."recognition_records" FOR SELECT TO "authenticated" USING ("public"."can_manage_hr"());



ALTER TABLE "public"."regions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "regions_insert" ON "public"."regions" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_marketing_user"());



CREATE POLICY "regions_select" ON "public"."regions" FOR SELECT TO "authenticated" USING ("public"."is_marketing_user"());



CREATE POLICY "regions_update" ON "public"."regions" FOR UPDATE TO "authenticated" USING ("public"."is_marketing_user"());



ALTER TABLE "public"."rfq_proforma_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rfq_proforma_links_portal_staff_all" ON "public"."rfq_proforma_links" TO "authenticated" USING ("public"."is_active_portal_user"()) WITH CHECK ("public"."is_active_portal_user"());



ALTER TABLE "public"."rfq_status_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rfq_status_history_portal_staff_insert" ON "public"."rfq_status_history" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_active_portal_user"() AND ("changed_by_id" = "public"."portal_uid"())));



CREATE POLICY "rfq_status_history_portal_staff_select" ON "public"."rfq_status_history" FOR SELECT TO "authenticated" USING ("public"."is_active_portal_user"());



ALTER TABLE "public"."rfqs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rfqs_portal_staff_all" ON "public"."rfqs" TO "authenticated" USING ("public"."is_active_portal_user"()) WITH CHECK ("public"."is_active_portal_user"());



ALTER TABLE "public"."sales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_feedback" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_feedback_authenticated" ON "public"."service_feedback" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "staff_insert_proforma_comments" ON "public"."proforma_comments" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_active_staff"() AND ("author_type" = 'staff'::"text")));



CREATE POLICY "staff_manage_assets" ON "public"."assets" TO "authenticated" USING ("public"."can_manage_ops"()) WITH CHECK ("public"."can_manage_ops"());



CREATE POLICY "staff_manage_bookings" ON "public"."bookings" TO "authenticated" USING ("public"."is_active_staff"()) WITH CHECK ("public"."is_active_staff"());



CREATE POLICY "staff_manage_clients" ON "public"."clients" TO "authenticated" USING ("public"."is_active_staff"()) WITH CHECK ("public"."is_active_staff"());



CREATE POLICY "staff_manage_costing_reports" ON "public"."costing_reports" TO "authenticated" USING ("public"."is_active_staff"()) WITH CHECK ("public"."is_active_staff"());



CREATE POLICY "staff_manage_daily_menus" ON "public"."daily_menus" TO "authenticated" USING ("public"."is_active_staff"()) WITH CHECK ("public"."is_active_staff"());



CREATE POLICY "staff_manage_delivery_notes" ON "public"."delivery_notes" TO "authenticated" USING ("public"."is_active_staff"()) WITH CHECK ("public"."is_active_staff"());



CREATE POLICY "staff_manage_expenses" ON "public"."expenses" TO "authenticated" USING ("public"."is_active_staff"()) WITH CHECK ("public"."is_active_staff"());



CREATE POLICY "staff_manage_invoices" ON "public"."invoices" TO "authenticated" USING ("public"."is_active_staff"()) WITH CHECK ("public"."is_active_staff"());



CREATE POLICY "staff_manage_issuance" ON "public"."issuance" TO "authenticated" USING ("public"."can_manage_ops"()) WITH CHECK ("public"."can_manage_ops"());



CREATE POLICY "staff_manage_orders" ON "public"."orders" TO "authenticated" USING ("public"."is_active_staff"()) WITH CHECK ("public"."is_active_staff"());



CREATE POLICY "staff_manage_products" ON "public"."products" TO "authenticated" USING ("public"."can_manage_ops"()) WITH CHECK ("public"."can_manage_ops"());



CREATE POLICY "staff_manage_proforma_invoices" ON "public"."proforma_invoices" TO "authenticated" USING ("public"."is_active_staff"()) WITH CHECK ("public"."is_active_staff"());



CREATE POLICY "staff_manage_sales" ON "public"."sales" TO "authenticated" USING ("public"."is_active_staff"()) WITH CHECK ("public"."is_active_staff"());



CREATE POLICY "staff_manage_stock_logs" ON "public"."stock_logs" TO "authenticated" USING ("public"."can_manage_ops"()) WITH CHECK ("public"."can_manage_ops"());



CREATE POLICY "staff_manage_vat_wht_ledger" ON "public"."vat_wht_ledger" TO "authenticated" USING ("public"."is_active_staff"()) WITH CHECK ("public"."is_active_staff"());



CREATE POLICY "staff_read_costing_requests" ON "public"."portal_costing_requests" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "staff_read_invoice_requests" ON "public"."portal_invoice_requests" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "staff_read_proforma_comments" ON "public"."proforma_comments" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "staff_read_rfq_proforma_links" ON "public"."rfq_proforma_links" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "staff_read_rfq_status_history" ON "public"."rfq_status_history" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "staff_read_rfqs" ON "public"."rfqs" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "staff_update_costing_requests" ON "public"."portal_costing_requests" FOR UPDATE TO "authenticated" USING ("public"."is_active_staff"()) WITH CHECK ("public"."is_active_staff"());



CREATE POLICY "staff_update_invoice_requests" ON "public"."portal_invoice_requests" FOR UPDATE TO "authenticated" USING ("public"."is_active_staff"()) WITH CHECK ("public"."is_active_staff"());



ALTER TABLE "public"."staff_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_users_admin_all" ON "public"."staff_users" TO "authenticated" USING ("public"."can_manage_settings"()) WITH CHECK ("public"."can_manage_settings"());



CREATE POLICY "staff_users_hr_select" ON "public"."staff_users" FOR SELECT TO "authenticated" USING ("public"."can_manage_hr"());



CREATE POLICY "staff_users_self_select" ON "public"."staff_users" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



ALTER TABLE "public"."stock_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supervisor_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "suppliers_delete" ON "public"."suppliers" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "suppliers_insert" ON "public"."suppliers" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "suppliers_select" ON "public"."suppliers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "suppliers_update" ON "public"."suppliers" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "target_analyses_insert" ON "public"."marketing_target_analyses" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "target_analyses_select" ON "public"."marketing_target_analyses" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "targets_delete" ON "public"."marketing_targets" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "targets_insert" ON "public"."marketing_targets" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "targets_select" ON "public"."marketing_targets" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "targets_update" ON "public"."marketing_targets" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "public"."tax_rates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tax_rates_admin_write" ON "public"."tax_rates" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "tax_rates_staff_select" ON "public"."tax_rates" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



ALTER TABLE "public"."training_evaluations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "training_evaluations_delete" ON "public"."training_evaluations" FOR DELETE TO "authenticated" USING ("public"."can_manage_hr"());



CREATE POLICY "training_evaluations_insert" ON "public"."training_evaluations" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_active_staff"());



CREATE POLICY "training_evaluations_select" ON "public"."training_evaluations" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "training_evaluations_update" ON "public"."training_evaluations" FOR UPDATE TO "authenticated" USING ("public"."can_manage_hr"()) WITH CHECK ("public"."can_manage_hr"());



ALTER TABLE "public"."training_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "training_participants_delete" ON "public"."training_participants" FOR DELETE TO "authenticated" USING ("public"."can_manage_hr"());



CREATE POLICY "training_participants_insert" ON "public"."training_participants" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_active_staff"());



CREATE POLICY "training_participants_select" ON "public"."training_participants" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "training_participants_update" ON "public"."training_participants" FOR UPDATE TO "authenticated" USING ("public"."can_manage_hr"()) WITH CHECK ("public"."can_manage_hr"());



ALTER TABLE "public"."vat_wht_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."visit_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "visit_documents_insert" ON "public"."visit_documents" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_marketing_user"());



CREATE POLICY "visit_documents_select" ON "public"."visit_documents" FOR SELECT TO "authenticated" USING ("public"."is_marketing_user"());



ALTER TABLE "public"."visits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "visits_delete" ON "public"."visits" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "visits_insert" ON "public"."visits" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_marketing_user"());



CREATE POLICY "visits_select" ON "public"."visits" FOR SELECT TO "authenticated" USING ("public"."is_marketing_user"());



CREATE POLICY "visits_update" ON "public"."visits" FOR UPDATE TO "authenticated" USING ("public"."is_marketing_user"());





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."companies";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."follow_ups";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."invoices";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."marketing_notifications";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."marketing_users";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."orders";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."portal_costing_requests";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."portal_invoice_requests";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."portal_notifications";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."products";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."proforma_comments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."proforma_invoices";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."recipes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."rfq_proforma_links";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."rfq_status_history";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."rfqs";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."stock_logs";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."visits";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."acknowledge_caution"("p_marketer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."acknowledge_caution"("p_marketer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."acknowledge_caution"("p_marketer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_company_collaborator"("p_company_id" "uuid", "p_marketer_id" "uuid", "p_added_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."add_company_collaborator"("p_company_id" "uuid", "p_marketer_id" "uuid", "p_added_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_company_collaborator"("p_company_id" "uuid", "p_marketer_id" "uuid", "p_added_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."aggregate_marketing_performance"("p_month" integer, "p_year" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."aggregate_marketing_performance"("p_month" integer, "p_year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."aggregate_marketing_performance"("p_month" integer, "p_year" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."safe_auth_uid"() TO "anon";
GRANT ALL ON FUNCTION "public"."safe_auth_uid"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."safe_auth_uid"() TO "service_role";



GRANT ALL ON TABLE "public"."hr_documents" TO "anon";
GRANT ALL ON TABLE "public"."hr_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."hr_documents" TO "service_role";



REVOKE ALL ON FUNCTION "public"."approve_hr_document"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."approve_hr_document"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_hr_document"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_proforma"("p_proforma_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_proforma"("p_proforma_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_proforma"("p_proforma_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."attendance_leave_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."attendance_leave_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."attendance_leave_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_row_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_row_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_row_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_staff_user_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_staff_user_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_staff_user_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_reinstate_expired_suspensions"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_reinstate_expired_suspensions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_reinstate_expired_suspensions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."can_manage_hr"() TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_hr"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_hr"() TO "service_role";



GRANT ALL ON FUNCTION "public"."can_manage_ops"() TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_ops"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_ops"() TO "service_role";



GRANT ALL ON FUNCTION "public"."can_manage_settings"() TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_settings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_settings"() TO "service_role";



GRANT ALL ON TABLE "public"."leave_requests" TO "anon";
GRANT ALL ON TABLE "public"."leave_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."leave_requests" TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_leave_request"("p_id" "uuid", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_leave_request"("p_id" "uuid", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_leave_request"("p_id" "uuid", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."candidates_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."candidates_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."candidates_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."caution_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."caution_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."caution_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_ids"("counter_name" "text", "count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."claim_ids"("counter_name" "text", "count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_ids"("counter_name" "text", "count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_otps"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_otps"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_otps"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_uat_data"("p_dry_run" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_uat_data"("p_dry_run" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_past_orders"() TO "anon";
GRANT ALL ON FUNCTION "public"."complete_past_orders"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_past_orders"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."contracts_due_for_reminder"("p_today" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."contracts_due_for_reminder"("p_today" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contracts_due_for_reminder"("p_today" "date") TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON FUNCTION "public"."create_invoice_from_proforma"("p_invoice" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_invoice_from_proforma"("p_invoice" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_invoice_from_proforma"("p_invoice" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_employee_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_employee_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_employee_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_employee"("p_employee" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_employee"("p_employee" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_employee"("p_employee" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_invoice_and_revert_proforma"("p_invoice_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_invoice_and_revert_proforma"("p_invoice_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_invoice_and_revert_proforma"("p_invoice_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."disable_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."disable_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."disable_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text", "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."employee_history"("p_employee" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."employee_history"("p_employee" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."employee_history"("p_employee" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."employees_delete_guard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."employees_delete_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."employees_status_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."employees_status_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."employees_status_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."end_employment_without_letter"("p_employee" "text", "p_end_date" "date", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."end_employment_without_letter"("p_employee" "text", "p_end_date" "date", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."end_employment_without_letter"("p_employee" "text", "p_end_date" "date", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ensure_leave_balance"("p_employee" "text", "p_type" "uuid", "p_year" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ensure_leave_balance"("p_employee" "text", "p_type" "uuid", "p_year" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."expire_offers"("p_today" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."expire_offers"("p_today" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."expire_offers"("p_today" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_nearby_companies"("p_lat" double precision, "p_lng" double precision, "p_radius_m" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."find_nearby_companies"("p_lat" double precision, "p_lng" double precision, "p_radius_m" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_nearby_companies"("p_lat" double precision, "p_lng" double precision, "p_radius_m" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_employee_directory"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_employee_directory"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_employee_directory"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_employee_directory_for_portal"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_employee_directory_for_portal"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_employee_directory_for_portal"() TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_company_settings"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_company_settings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_company_settings"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_hr_settings"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_hr_settings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_expense_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_expense_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_expense_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_supplier_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_supplier_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_supplier_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_portal_role"("roles" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."has_portal_role"("roles" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_portal_role"("roles" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."has_staff_role"("roles" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."has_staff_role"("roles" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_staff_role"("roles" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."hr_doc_apply_effects"("d" "public"."hr_documents") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."hr_doc_apply_effects"("d" "public"."hr_documents") TO "service_role";



GRANT ALL ON FUNCTION "public"."hr_doc_date"("p_data" "jsonb", "p_key" "text", "p_label" "text", "p_required" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."hr_doc_date"("p_data" "jsonb", "p_key" "text", "p_label" "text", "p_required" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hr_doc_date"("p_data" "jsonb", "p_key" "text", "p_label" "text", "p_required" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."hr_doc_draft_marker"() TO "anon";
GRANT ALL ON FUNCTION "public"."hr_doc_draft_marker"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."hr_doc_draft_marker"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."hr_doc_notify_approvers"("p_exclude" "uuid", "p_type" "text", "p_title" "text", "p_body" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."hr_doc_notify_approvers"("p_exclude" "uuid", "p_type" "text", "p_title" "text", "p_body" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hr_doc_num"("p_data" "jsonb", "p_key" "text", "p_label" "text", "p_required" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."hr_doc_num"("p_data" "jsonb", "p_key" "text", "p_label" "text", "p_required" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hr_doc_num"("p_data" "jsonb", "p_key" "text", "p_label" "text", "p_required" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."hr_doc_text"("p_data" "jsonb", "p_key" "text", "p_label" "text", "p_required" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."hr_doc_text"("p_data" "jsonb", "p_key" "text", "p_label" "text", "p_required" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hr_doc_text"("p_data" "jsonb", "p_key" "text", "p_label" "text", "p_required" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."hr_doc_validate"("d" "public"."hr_documents", "p_stage" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."hr_doc_validate"("d" "public"."hr_documents", "p_stage" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."hr_doc_void_effects"("d" "public"."hr_documents") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."hr_doc_void_effects"("d" "public"."hr_documents") TO "service_role";



GRANT ALL ON FUNCTION "public"."hr_document_templates_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."hr_document_templates_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."hr_document_templates_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."hr_document_types_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."hr_document_types_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."hr_document_types_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."hr_documents_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."hr_documents_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."hr_documents_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."hr_documents_notify_portal"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."hr_documents_notify_portal"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."hr_employee_is_inactive"("p_employee" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."hr_employee_is_inactive"("p_employee" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hr_employee_is_inactive"("p_employee" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."hr_employee_name"("p_employee" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."hr_employee_name"("p_employee" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hr_employee_name"("p_employee" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."hr_end_employment"("p_employee" "text", "p_last_day" "date", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."hr_end_employment"("p_employee" "text", "p_last_day" "date", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."hr_go_live_year"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."hr_go_live_year"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."hr_go_live_year"() TO "service_role";



GRANT ALL ON FUNCTION "public"."hr_notifications_only_read"() TO "anon";
GRANT ALL ON FUNCTION "public"."hr_notifications_only_read"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."hr_notifications_only_read"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."hr_refuse_if_employee_inactive"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."hr_refuse_if_employee_inactive"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."hr_system_change"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."hr_system_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."hr_system_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."hr_today"() TO "anon";
GRANT ALL ON FUNCTION "public"."hr_today"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."hr_today"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."import_legacy_contracts"("p_rows" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."import_legacy_contracts"("p_rows" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."import_legacy_contracts"("p_rows" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."import_opening_leave"("p_rows" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."import_opening_leave"("p_rows" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."import_opening_leave"("p_rows" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_active_portal_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_active_portal_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_active_portal_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_active_staff"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_active_staff"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_active_staff"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_marketing_manager"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_marketing_manager"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_marketing_manager"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_marketing_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_marketing_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_marketing_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_portal_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_portal_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_portal_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_portal_hr_approver"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_portal_hr_approver"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_portal_hr_approver"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_uat_candidate"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_uat_candidate"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_uat_candidate"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_uat_employee"("p_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_uat_employee"("p_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_uat_employee"("p_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."issue_hr_document"("p_id" "uuid", "p_content" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."issue_hr_document"("p_id" "uuid", "p_content" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."issue_hr_document"("p_id" "uuid", "p_content" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."leave_balances_opening_guard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."leave_balances_opening_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."leave_employee_name"("p_employee" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."leave_employee_name"("p_employee" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."leave_employee_name"("p_employee" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."leave_notify_requester"("p_req" "public"."leave_requests", "p_title" "text", "p_body" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."leave_notify_requester"("p_req" "public"."leave_requests", "p_title" "text", "p_body" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."leave_request_before_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."leave_request_before_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."leave_request_before_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."leave_request_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."leave_request_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."leave_request_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."leave_request_notify_hr"() TO "anon";
GRANT ALL ON FUNCTION "public"."leave_request_notify_hr"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."leave_request_notify_hr"() TO "service_role";



GRANT ALL ON FUNCTION "public"."leave_working_dates"("p_start" "date", "p_end" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."leave_working_dates"("p_start" "date", "p_end" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."leave_working_dates"("p_start" "date", "p_end" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."leave_working_days"("p_start" "date", "p_end" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."leave_working_days"("p_start" "date", "p_end" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."leave_working_days"("p_start" "date", "p_end" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."leave_year_of"("p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."leave_year_of"("p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."leave_year_of"("p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."lift_restriction"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."lift_restriction"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lift_restriction"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."link_rfq_to_proforma"("p_rfq_id" "text", "p_proforma_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."link_rfq_to_proforma"("p_rfq_id" "text", "p_proforma_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_rfq_to_proforma"("p_rfq_id" "text", "p_proforma_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_audit_event"("p_action" "text", "p_table" "text", "p_record_id" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_audit_event"("p_action" "text", "p_table" "text", "p_record_id" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_audit_event"("p_action" "text", "p_table" "text", "p_record_id" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_portal_audit_event"("p_actor_id" "text", "p_actor_type" "text", "p_action" "text", "p_table_name" "text", "p_record_id" "text", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_portal_audit_event"("p_actor_id" "text", "p_actor_type" "text", "p_action" "text", "p_table_name" "text", "p_record_id" "text", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_portal_audit_event"("p_actor_id" "text", "p_actor_type" "text", "p_action" "text", "p_table_name" "text", "p_record_id" "text", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_portal_user_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_portal_user_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_portal_user_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_rfq_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_rfq_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_rfq_created"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_recognition_paid"("p_id" "uuid", "p_payroll_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_recognition_paid"("p_id" "uuid", "p_payroll_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_recognition_paid"("p_id" "uuid", "p_payroll_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_costing_request_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_costing_request_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_costing_request_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_deal_won"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_deal_won"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_deal_won"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_hot_lead"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_hot_lead"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_hot_lead"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_hr_roles"("p_type" "text", "p_title" "text", "p_body" "text", "p_link" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_hr_roles"("p_type" "text", "p_title" "text", "p_body" "text", "p_link" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_invoice_request_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_invoice_request_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_invoice_request_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_user"("p_recipient" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_link" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_user"("p_recipient" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_link" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."onboard_company_as_client"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."onboard_company_as_client"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."onboard_company_as_client"("p_company_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."open_leave_year"("p_year" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."open_leave_year"("p_year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."open_leave_year"("p_year" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."pending_cash_rewards"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pending_cash_rewards"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."pending_cash_rewards"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."portal_approve_hr_document"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."portal_approve_hr_document"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."portal_approve_hr_document"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."portal_pending_hr_documents"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."portal_pending_hr_documents"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."portal_pending_hr_documents"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."portal_return_hr_document"("p_id" "uuid", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."portal_return_hr_document"("p_id" "uuid", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."portal_return_hr_document"("p_id" "uuid", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."portal_uid"() TO "anon";
GRANT ALL ON FUNCTION "public"."portal_uid"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."portal_uid"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_all_performance"() TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_all_performance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_all_performance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_marketer_performance"("p_marketer_id" "uuid", "p_month" integer, "p_year" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_marketer_performance"("p_marketer_id" "uuid", "p_month" integer, "p_year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_marketer_performance"("p_marketer_id" "uuid", "p_month" integer, "p_year" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."record_commission"("p_company_id" "uuid", "p_invoice_ref" "text", "p_amount" numeric, "p_invoice_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."record_commission"("p_company_id" "uuid", "p_invoice_ref" "text", "p_amount" numeric, "p_invoice_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_commission"("p_company_id" "uuid", "p_invoice_ref" "text", "p_amount" numeric, "p_invoice_date" "date") TO "service_role";



GRANT ALL ON TABLE "public"."employment_contracts" TO "anon";
GRANT ALL ON TABLE "public"."employment_contracts" TO "authenticated";
GRANT ALL ON TABLE "public"."employment_contracts" TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_legacy_contract"("p_employee" "text", "p_contract_type" "text", "p_start" "date", "p_end" "date", "p_position" "text", "p_salary" numeric, "p_probation_months" integer, "p_notice_days" integer, "p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_legacy_contract"("p_employee" "text", "p_contract_type" "text", "p_start" "date", "p_end" "date", "p_position" "text", "p_salary" numeric, "p_probation_months" integer, "p_notice_days" integer, "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_legacy_contract"("p_employee" "text", "p_contract_type" "text", "p_start" "date", "p_end" "date", "p_position" "text", "p_salary" numeric, "p_probation_months" integer, "p_notice_days" integer, "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."register_company_for_marketer"("p_marketer_id" "uuid", "p_name" "text", "p_industry" "text", "p_address" "text", "p_region_id" "uuid", "p_contact_name" "text", "p_contact_phone" "text", "p_contact_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."register_company_for_marketer"("p_marketer_id" "uuid", "p_name" "text", "p_industry" "text", "p_address" "text", "p_region_id" "uuid", "p_contact_name" "text", "p_contact_phone" "text", "p_contact_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."register_company_for_marketer"("p_marketer_id" "uuid", "p_name" "text", "p_industry" "text", "p_address" "text", "p_region_id" "uuid", "p_contact_name" "text", "p_contact_phone" "text", "p_contact_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reinstate_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reinstate_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reinstate_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_proforma"("p_proforma_id" "text", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_proforma"("p_proforma_id" "text", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_proforma"("p_proforma_id" "text", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reserve_hr_document_ref"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reserve_hr_document_ref"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reserve_hr_document_ref"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_user_password"("user_email" "text", "new_password" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reset_user_password"("user_email" "text", "new_password" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_user_password"("user_email" "text", "new_password" "text") TO "service_role";



GRANT ALL ON TABLE "public"."candidates" TO "anon";
GRANT ALL ON TABLE "public"."candidates" TO "authenticated";
GRANT ALL ON TABLE "public"."candidates" TO "service_role";



REVOKE ALL ON FUNCTION "public"."respond_to_offer"("p_candidate" "uuid", "p_response" "text", "p_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."respond_to_offer"("p_candidate" "uuid", "p_response" "text", "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."respond_to_offer"("p_candidate" "uuid", "p_response" "text", "p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."restrict_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."restrict_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."restrict_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text", "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."return_hr_document"("p_id" "uuid", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."return_hr_document"("p_id" "uuid", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."return_hr_document"("p_id" "uuid", "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."review_leave_request"("p_id" "uuid", "p_decision" "text", "p_note" "text", "p_replace_absent" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."review_leave_request"("p_id" "uuid", "p_decision" "text", "p_note" "text", "p_replace_absent" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."review_leave_request"("p_id" "uuid", "p_decision" "text", "p_note" "text", "p_replace_absent" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."run_contract_expiry_job"("p_today" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."run_contract_expiry_job"("p_today" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."run_contract_expiry_job"("p_today" "date") TO "service_role";



GRANT ALL ON TABLE "public"."hr_document_templates" TO "anon";
GRANT ALL ON TABLE "public"."hr_document_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."hr_document_templates" TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_hr_template_version"("p_doc_type" "text", "p_title" "text", "p_body" "text", "p_use_stored_signature" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_hr_template_version"("p_doc_type" "text", "p_title" "text", "p_body" "text", "p_use_stored_signature" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_hr_template_version"("p_doc_type" "text", "p_title" "text", "p_body" "text", "p_use_stored_signature" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_hr_modules"("p_modules" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_hr_modules"("p_modules" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_hr_modules"("p_modules" "text"[]) TO "service_role";



GRANT ALL ON TABLE "public"."leave_balances" TO "anon";
GRANT ALL ON TABLE "public"."leave_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."leave_balances" TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_opening_leave_taken"("p_employee" "text", "p_type" "uuid", "p_year" integer, "p_days" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_opening_leave_taken"("p_employee" "text", "p_type" "uuid", "p_year" integer, "p_days" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_opening_leave_taken"("p_employee" "text", "p_type" "uuid", "p_year" integer, "p_days" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_by"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_by"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_by"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_hr_document"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_hr_document"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_hr_document"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_rfq"("p_rfq_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_rfq"("p_rfq_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_rfq"("p_rfq_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."suspend_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text", "p_until" timestamp with time zone, "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."suspend_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text", "p_until" timestamp with time zone, "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."suspend_marketer"("p_marketer_id" "uuid", "p_manager_id" "uuid", "p_reason" "text", "p_until" timestamp with time zone, "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_training_applicants"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_training_applicants"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_training_applicants"() TO "service_role";



GRANT ALL ON FUNCTION "public"."uat_cleanup_on"() TO "anon";
GRANT ALL ON FUNCTION "public"."uat_cleanup_on"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."uat_cleanup_on"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_company_from_visit"("p_company_id" "uuid", "p_stage" "text", "p_company_size" "text", "p_operations" "text", "p_likelihood" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_company_from_visit"("p_company_id" "uuid", "p_stage" "text", "p_company_size" "text", "p_operations" "text", "p_likelihood" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_company_from_visit"("p_company_id" "uuid", "p_stage" "text", "p_company_size" "text", "p_operations" "text", "p_likelihood" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_hr_document"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_hr_document"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_hr_document"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_nida"("nida" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_nida"("nida" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_nida"("nida" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_tin"("tin" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_tin"("tin" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_tin"("tin" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."void_hr_document"("p_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."void_hr_document"("p_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."void_hr_document"("p_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."void_proforma"("p_proforma_id" "text", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."void_proforma"("p_proforma_id" "text", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."void_proforma"("p_proforma_id" "text", "p_reason" "text") TO "service_role";
























GRANT ALL ON TABLE "public"."app_settings" TO "anon";
GRANT ALL ON TABLE "public"."app_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."app_settings" TO "service_role";



GRANT ALL ON TABLE "public"."assets" TO "anon";
GRANT ALL ON TABLE "public"."assets" TO "authenticated";
GRANT ALL ON TABLE "public"."assets" TO "service_role";



GRANT ALL ON TABLE "public"."attendance" TO "anon";
GRANT ALL ON TABLE "public"."attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."catering_menu_recipes" TO "anon";
GRANT ALL ON TABLE "public"."catering_menu_recipes" TO "authenticated";
GRANT ALL ON TABLE "public"."catering_menu_recipes" TO "service_role";



GRANT ALL ON TABLE "public"."catering_menus" TO "anon";
GRANT ALL ON TABLE "public"."catering_menus" TO "authenticated";
GRANT ALL ON TABLE "public"."catering_menus" TO "service_role";



GRANT ALL ON TABLE "public"."client_invoice_tax_settings" TO "anon";
GRANT ALL ON TABLE "public"."client_invoice_tax_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."client_invoice_tax_settings" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."commissions" TO "anon";
GRANT ALL ON TABLE "public"."commissions" TO "authenticated";
GRANT ALL ON TABLE "public"."commissions" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."company_collaborators" TO "anon";
GRANT ALL ON TABLE "public"."company_collaborators" TO "authenticated";
GRANT ALL ON TABLE "public"."company_collaborators" TO "service_role";



GRANT ALL ON TABLE "public"."company_documents" TO "anon";
GRANT ALL ON TABLE "public"."company_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."company_documents" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_users" TO "anon";
GRANT ALL ON TABLE "public"."marketing_users" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_users" TO "service_role";



GRANT ALL ON TABLE "public"."company_map_pins" TO "anon";
GRANT ALL ON TABLE "public"."company_map_pins" TO "authenticated";
GRANT ALL ON TABLE "public"."company_map_pins" TO "service_role";



GRANT ALL ON TABLE "public"."company_notes" TO "anon";
GRANT ALL ON TABLE "public"."company_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."company_notes" TO "service_role";



GRANT ALL ON TABLE "public"."contract_expiry_notices" TO "anon";
GRANT ALL ON TABLE "public"."contract_expiry_notices" TO "authenticated";
GRANT ALL ON TABLE "public"."contract_expiry_notices" TO "service_role";



GRANT ALL ON TABLE "public"."costing_reports" TO "anon";
GRANT ALL ON TABLE "public"."costing_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."costing_reports" TO "service_role";



GRANT ALL ON SEQUENCE "public"."costing_reports_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."costing_reports_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."costing_reports_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."daily_menus" TO "anon";
GRANT ALL ON TABLE "public"."daily_menus" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_menus" TO "service_role";



GRANT ALL ON SEQUENCE "public"."daily_menus_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."daily_menus_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."daily_menus_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."daily_orders" TO "anon";
GRANT ALL ON TABLE "public"."daily_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_orders" TO "service_role";



GRANT ALL ON SEQUENCE "public"."daily_orders_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."daily_orders_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."daily_orders_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."delivery_note_serial_sequence" TO "anon";
GRANT ALL ON SEQUENCE "public"."delivery_note_serial_sequence" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."delivery_note_serial_sequence" TO "service_role";



GRANT ALL ON TABLE "public"."delivery_notes" TO "anon";
GRANT ALL ON TABLE "public"."delivery_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."delivery_notes" TO "service_role";



GRANT ALL ON TABLE "public"."disciplinary_records" TO "anon";
GRANT ALL ON TABLE "public"."disciplinary_records" TO "authenticated";
GRANT ALL ON TABLE "public"."disciplinary_records" TO "service_role";



GRANT ALL ON TABLE "public"."employees" TO "anon";
GRANT ALL ON TABLE "public"."employees" TO "authenticated";
GRANT ALL ON TABLE "public"."employees" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON TABLE "public"."follow_ups" TO "anon";
GRANT ALL ON TABLE "public"."follow_ups" TO "authenticated";
GRANT ALL ON TABLE "public"."follow_ups" TO "service_role";



GRANT ALL ON TABLE "public"."hr_document_counters" TO "anon";
GRANT ALL ON TABLE "public"."hr_document_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."hr_document_counters" TO "service_role";



GRANT ALL ON TABLE "public"."hr_document_types" TO "anon";
GRANT ALL ON TABLE "public"."hr_document_types" TO "authenticated";
GRANT ALL ON TABLE "public"."hr_document_types" TO "service_role";



GRANT ALL ON TABLE "public"."hr_notifications" TO "anon";
GRANT ALL ON TABLE "public"."hr_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."hr_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."id_counters" TO "anon";
GRANT ALL ON TABLE "public"."id_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."id_counters" TO "service_role";



GRANT ALL ON TABLE "public"."ingredients" TO "anon";
GRANT ALL ON TABLE "public"."ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."ingredients" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_tax_rates" TO "anon";
GRANT ALL ON TABLE "public"."invoice_tax_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_tax_rates" TO "service_role";



GRANT ALL ON TABLE "public"."issuance" TO "anon";
GRANT ALL ON TABLE "public"."issuance" TO "authenticated";
GRANT ALL ON TABLE "public"."issuance" TO "service_role";



GRANT ALL ON TABLE "public"."leave_settings" TO "anon";
GRANT ALL ON TABLE "public"."leave_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."leave_settings" TO "service_role";



GRANT ALL ON TABLE "public"."leave_types" TO "anon";
GRANT ALL ON TABLE "public"."leave_types" TO "authenticated";
GRANT ALL ON TABLE "public"."leave_types" TO "service_role";



GRANT ALL ON TABLE "public"."marketer_account_actions" TO "anon";
GRANT ALL ON TABLE "public"."marketer_account_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."marketer_account_actions" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_performance" TO "anon";
GRANT ALL ON TABLE "public"."marketing_performance" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_performance" TO "service_role";



GRANT ALL ON TABLE "public"."regions" TO "anon";
GRANT ALL ON TABLE "public"."regions" TO "authenticated";
GRANT ALL ON TABLE "public"."regions" TO "service_role";



GRANT ALL ON TABLE "public"."marketer_account_overview" TO "anon";
GRANT ALL ON TABLE "public"."marketer_account_overview" TO "authenticated";
GRANT ALL ON TABLE "public"."marketer_account_overview" TO "service_role";



GRANT ALL ON TABLE "public"."marketer_approval_log" TO "anon";
GRANT ALL ON TABLE "public"."marketer_approval_log" TO "authenticated";
GRANT ALL ON TABLE "public"."marketer_approval_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."marketer_code_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."marketer_code_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."marketer_code_seq" TO "service_role";



GRANT ALL ON TABLE "public"."marketer_commissions" TO "anon";
GRANT ALL ON TABLE "public"."marketer_commissions" TO "authenticated";
GRANT ALL ON TABLE "public"."marketer_commissions" TO "service_role";



GRANT ALL ON TABLE "public"."marketer_commission_summary" TO "anon";
GRANT ALL ON TABLE "public"."marketer_commission_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."marketer_commission_summary" TO "service_role";



GRANT ALL ON TABLE "public"."marketer_daily_reports" TO "anon";
GRANT ALL ON TABLE "public"."marketer_daily_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."marketer_daily_reports" TO "service_role";



GRANT ALL ON TABLE "public"."marketer_documents" TO "anon";
GRANT ALL ON TABLE "public"."marketer_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."marketer_documents" TO "service_role";



GRANT ALL ON TABLE "public"."marketer_landed_clients" TO "anon";
GRANT ALL ON TABLE "public"."marketer_landed_clients" TO "authenticated";
GRANT ALL ON TABLE "public"."marketer_landed_clients" TO "service_role";



GRANT ALL ON TABLE "public"."visits" TO "anon";
GRANT ALL ON TABLE "public"."visits" TO "authenticated";
GRANT ALL ON TABLE "public"."visits" TO "service_role";



GRANT ALL ON TABLE "public"."marketer_live_locations" TO "anon";
GRANT ALL ON TABLE "public"."marketer_live_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."marketer_live_locations" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_monthly_expenses" TO "anon";
GRANT ALL ON TABLE "public"."marketing_monthly_expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_monthly_expenses" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_notifications" TO "anon";
GRANT ALL ON TABLE "public"."marketing_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_target_analyses" TO "anon";
GRANT ALL ON TABLE "public"."marketing_target_analyses" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_target_analyses" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_targets" TO "anon";
GRANT ALL ON TABLE "public"."marketing_targets" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_targets" TO "service_role";



GRANT ALL ON TABLE "public"."menu_planned_ingredients" TO "anon";
GRANT ALL ON TABLE "public"."menu_planned_ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_planned_ingredients" TO "service_role";



GRANT ALL ON TABLE "public"."menu_types" TO "anon";
GRANT ALL ON TABLE "public"."menu_types" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_types" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON SEQUENCE "public"."orders_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."orders_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."orders_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."otp_codes" TO "anon";
GRANT ALL ON TABLE "public"."otp_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."otp_codes" TO "service_role";



GRANT ALL ON TABLE "public"."payroll" TO "anon";
GRANT ALL ON TABLE "public"."payroll" TO "authenticated";
GRANT ALL ON TABLE "public"."payroll" TO "service_role";



GRANT ALL ON TABLE "public"."pending_marketer_applications" TO "anon";
GRANT ALL ON TABLE "public"."pending_marketer_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_marketer_applications" TO "service_role";



GRANT ALL ON TABLE "public"."portal_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."portal_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."portal_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."portal_costing_requests" TO "anon";
GRANT ALL ON TABLE "public"."portal_costing_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."portal_costing_requests" TO "service_role";



GRANT ALL ON TABLE "public"."portal_invoice_requests" TO "anon";
GRANT ALL ON TABLE "public"."portal_invoice_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."portal_invoice_requests" TO "service_role";



GRANT ALL ON TABLE "public"."portal_notifications" TO "anon";
GRANT ALL ON TABLE "public"."portal_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."portal_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."portal_users" TO "anon";
GRANT ALL ON TABLE "public"."portal_users" TO "authenticated";
GRANT ALL ON TABLE "public"."portal_users" TO "service_role";



GRANT ALL ON TABLE "public"."positions" TO "anon";
GRANT ALL ON TABLE "public"."positions" TO "authenticated";
GRANT ALL ON TABLE "public"."positions" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."proforma_comments" TO "anon";
GRANT ALL ON TABLE "public"."proforma_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."proforma_comments" TO "service_role";



GRANT ALL ON TABLE "public"."proforma_invoices" TO "anon";
GRANT ALL ON TABLE "public"."proforma_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."proforma_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."public_holidays" TO "anon";
GRANT ALL ON TABLE "public"."public_holidays" TO "authenticated";
GRANT ALL ON TABLE "public"."public_holidays" TO "service_role";



GRANT ALL ON TABLE "public"."purchases" TO "anon";
GRANT ALL ON TABLE "public"."purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."purchases" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."quotation_requests" TO "anon";
GRANT ALL ON TABLE "public"."quotation_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."quotation_requests" TO "service_role";



GRANT ALL ON SEQUENCE "public"."recipes_recipe_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."recipes_recipe_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."recipes_recipe_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."recipes" TO "anon";
GRANT ALL ON TABLE "public"."recipes" TO "authenticated";
GRANT ALL ON TABLE "public"."recipes" TO "service_role";



GRANT ALL ON TABLE "public"."recognition_records" TO "anon";
GRANT ALL ON TABLE "public"."recognition_records" TO "authenticated";
GRANT ALL ON TABLE "public"."recognition_records" TO "service_role";



GRANT ALL ON TABLE "public"."rfq_proforma_links" TO "anon";
GRANT ALL ON TABLE "public"."rfq_proforma_links" TO "authenticated";
GRANT ALL ON TABLE "public"."rfq_proforma_links" TO "service_role";



GRANT ALL ON TABLE "public"."rfq_status_history" TO "anon";
GRANT ALL ON TABLE "public"."rfq_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."rfq_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."rfqs" TO "anon";
GRANT ALL ON TABLE "public"."rfqs" TO "authenticated";
GRANT ALL ON TABLE "public"."rfqs" TO "service_role";



GRANT ALL ON TABLE "public"."sales" TO "anon";
GRANT ALL ON TABLE "public"."sales" TO "authenticated";
GRANT ALL ON TABLE "public"."sales" TO "service_role";



GRANT ALL ON TABLE "public"."service_feedback" TO "anon";
GRANT ALL ON TABLE "public"."service_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."service_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."staff_users" TO "anon";
GRANT ALL ON TABLE "public"."staff_users" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_users" TO "service_role";



GRANT ALL ON TABLE "public"."stock_logs" TO "anon";
GRANT ALL ON TABLE "public"."stock_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_logs" TO "service_role";



GRANT ALL ON TABLE "public"."supervisor_reports" TO "anon";
GRANT ALL ON TABLE "public"."supervisor_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."supervisor_reports" TO "service_role";



GRANT ALL ON SEQUENCE "public"."supervisor_reports_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."supervisor_reports_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."supervisor_reports_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."suppliers" TO "anon";
GRANT ALL ON TABLE "public"."suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."tax_rates" TO "anon";
GRANT ALL ON TABLE "public"."tax_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."tax_rates" TO "service_role";



GRANT ALL ON TABLE "public"."training_evaluations" TO "anon";
GRANT ALL ON TABLE "public"."training_evaluations" TO "authenticated";
GRANT ALL ON TABLE "public"."training_evaluations" TO "service_role";



GRANT ALL ON TABLE "public"."training_participants" TO "anon";
GRANT ALL ON TABLE "public"."training_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."training_participants" TO "service_role";



GRANT ALL ON TABLE "public"."vat_wht_ledger" TO "anon";
GRANT ALL ON TABLE "public"."vat_wht_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."vat_wht_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."visit_documents" TO "anon";
GRANT ALL ON TABLE "public"."visit_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."visit_documents" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































