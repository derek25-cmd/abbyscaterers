-- ============================================================
-- Marketing & CRM Module — Database Migration
-- Abby's Legendary Caterers
-- ============================================================

-- Enums
CREATE TYPE pipeline_stage AS ENUM (
  'IDENTIFIED', 'VISITED', 'INTERESTED', 'QUOTATION_REQUESTED',
  'NEGOTIATING', 'WON', 'LOST'
);

CREATE TYPE visit_purpose AS ENUM (
  'INTRODUCTION', 'FOLLOW_UP', 'PROPOSAL_DELIVERY', 'QUOTATION_FOLLOW_UP',
  'CONTRACT_RENEWAL', 'COMPLAINT_RESOLUTION', 'EVENT_INVITATION', 'TASTING_SESSION'
);

CREATE TYPE visit_outcome AS ENUM (
  'VISITED', 'NO_ONE_AVAILABLE', 'MEETING_POSTPONED', 'PROPOSAL_REQUESTED',
  'QUOTATION_SENT', 'CONTRACT_NEGOTIATION', 'CUSTOMER_ACQUIRED'
);

CREATE TYPE interest_level AS ENUM (
  'NOT_INTERESTED', 'MAYBE', 'INTERESTED', 'VERY_INTERESTED'
);

CREATE TYPE follow_up_type AS ENUM (
  'CALL', 'EMAIL', 'WHATSAPP', 'IN_PERSON_VISIT', 'SEND_QUOTATION',
  'SEND_COMPANY_PROFILE', 'ARRANGE_TASTING', 'MEET_CEO',
  'MEET_PROCUREMENT', 'CONTRACT_SIGNING'
);

CREATE TYPE follow_up_status AS ENUM (
  'PENDING', 'DONE', 'OVERDUE', 'CANCELLED', 'RESCHEDULED'
);

CREATE TYPE marketing_user_role AS ENUM (
  'MARKETER', 'MARKETING_MANAGER', 'ADMIN'
);

CREATE TYPE business_size AS ENUM (
  'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE'
);

-- Regions / Territories
CREATE TABLE IF NOT EXISTS public.regions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Marketing team users
CREATE TABLE IF NOT EXISTS public.marketing_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name       TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  phone           TEXT,
  role            marketing_user_role NOT NULL DEFAULT 'MARKETER',
  is_active       BOOLEAN DEFAULT TRUE,
  region_id       UUID REFERENCES public.regions(id),
  last_latitude   DOUBLE PRECISION,
  last_longitude  DOUBLE PRECISION,
  last_seen_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Companies / Prospects
CREATE TABLE IF NOT EXISTS public.companies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  industry              TEXT,
  business_size         business_size,
  employee_count        INTEGER,
  address               TEXT,
  latitude              DOUBLE PRECISION,
  longitude             DOUBLE PRECISION,
  region_id             UUID REFERENCES public.regions(id),
  contact_name          TEXT,
  contact_position      TEXT,
  contact_phone         TEXT,
  contact_email         TEXT,
  current_caterer       TEXT,
  current_caterer_notes TEXT,
  pipeline_stage        pipeline_stage NOT NULL DEFAULT 'IDENTIFIED',
  lead_score            INTEGER DEFAULT 0 CHECK (lead_score BETWEEN 0 AND 100),
  estimated_value       NUMERIC(15, 2),
  assigned_marketer_id  UUID REFERENCES public.marketing_users(id),
  qr_code               TEXT UNIQUE,
  last_visited_at       TIMESTAMPTZ,
  client_since          TIMESTAMPTZ,
  is_active             BOOLEAN DEFAULT TRUE,
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_pipeline_stage ON public.companies(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_companies_assigned_marketer ON public.companies(assigned_marketer_id);
CREATE INDEX IF NOT EXISTS idx_companies_lead_score ON public.companies(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_companies_region ON public.companies(region_id);
CREATE INDEX IF NOT EXISTS idx_companies_last_visited ON public.companies(last_visited_at);

-- Visits
CREATE TABLE IF NOT EXISTS public.visits (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES public.companies(id),
  marketer_id         UUID NOT NULL REFERENCES public.marketing_users(id),
  check_in_time       TIMESTAMPTZ,
  check_out_time      TIMESTAMPTZ,
  check_in_latitude   DOUBLE PRECISION,
  check_in_longitude  DOUBLE PRECISION,
  gps_verified        BOOLEAN DEFAULT FALSE,
  gps_accuracy_tag    TEXT CHECK (gps_accuracy_tag IN ('VERIFIED','APPROXIMATE','UNVERIFIED')),
  purpose             visit_purpose,
  outcome             visit_outcome,
  interest_level      interest_level,
  decision_maker_met  BOOLEAN DEFAULT FALSE,
  budget_confirmed    BOOLEAN DEFAULT FALSE,
  follow_up_requested BOOLEAN DEFAULT FALSE,
  services_presented  TEXT[] DEFAULT '{}',
  notes               TEXT,
  lead_score          INTEGER,
  selfie_url          TEXT,
  gate_photo_url      TEXT,
  voice_note_url      TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visits_company ON public.visits(company_id);
CREATE INDEX IF NOT EXISTS idx_visits_marketer ON public.visits(marketer_id);
CREATE INDEX IF NOT EXISTS idx_visits_check_in ON public.visits(check_in_time);

-- Follow-ups
CREATE TABLE IF NOT EXISTS public.follow_ups (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES public.companies(id),
  visit_id         UUID REFERENCES public.visits(id),
  assigned_to      UUID NOT NULL REFERENCES public.marketing_users(id),
  type             follow_up_type NOT NULL,
  due_date         TIMESTAMPTZ NOT NULL,
  status           follow_up_status NOT NULL DEFAULT 'PENDING',
  notes            TEXT,
  completed_at     TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_followups_due_status ON public.follow_ups(due_date, status);
CREATE INDEX IF NOT EXISTS idx_followups_assigned ON public.follow_ups(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_followups_company ON public.follow_ups(company_id);

-- Company notes
CREATE TABLE IF NOT EXISTS public.company_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  author_id  UUID NOT NULL,
  content    TEXT NOT NULL,
  is_pinned  BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_notes_company ON public.company_notes(company_id);

-- Company documents
CREATE TABLE IF NOT EXISTS public.company_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies(id),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,
  url         TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Visit documents
CREATE TABLE IF NOT EXISTS public.visit_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id    UUID NOT NULL REFERENCES public.visits(id),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,
  url         TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Monthly performance snapshots
CREATE TABLE IF NOT EXISTS public.marketing_performance (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marketer_id           UUID NOT NULL REFERENCES public.marketing_users(id),
  month                 INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year                  INTEGER NOT NULL,
  total_visits          INTEGER DEFAULT 0,
  verified_visits       INTEGER DEFAULT 0,
  new_leads             INTEGER DEFAULT 0,
  hot_leads             INTEGER DEFAULT 0,
  quotations_requested  INTEGER DEFAULT 0,
  deals_won             INTEGER DEFAULT 0,
  follow_ups_completed  INTEGER DEFAULT 0,
  follow_ups_missed     INTEGER DEFAULT 0,
  revenue_generated     NUMERIC(15, 2) DEFAULT 0,
  avg_lead_score        NUMERIC(5, 2) DEFAULT 0,
  avg_interest_level    NUMERIC(5, 2) DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(marketer_id, month, year)
);

-- Enable RLS on all new tables (matching existing pattern in schema.sql)
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_performance ENABLE ROW LEVEL SECURITY;

-- Permissive policies for logged-in staff (this module has shared team
-- data with no per-row owner, matching how `bookings` was first set up
-- before per-user ownership was introduced).
CREATE POLICY "Enable all actions for authenticated users on regions" ON public.regions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all actions for authenticated users on marketing_users" ON public.marketing_users FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all actions for authenticated users on companies" ON public.companies FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all actions for authenticated users on visits" ON public.visits FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all actions for authenticated users on follow_ups" ON public.follow_ups FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all actions for authenticated users on company_notes" ON public.company_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all actions for authenticated users on company_documents" ON public.company_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all actions for authenticated users on visit_documents" ON public.visit_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all actions for authenticated users on marketing_performance" ON public.marketing_performance FOR ALL TO authenticated USING (true) WITH CHECK (true);
